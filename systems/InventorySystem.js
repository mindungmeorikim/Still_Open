/*
  InventorySystem.js

  담당:
  - 4번 담당자

  역할:
  - 상품별 재고와 입고 묶음 관리
  - 유통기한이 빠른 재고부터 차감
  - 손님 구매 및 재고 보충 이벤트 처리
  - 재고 변경 내용을 EventBus로 전달

  규칙:
  - 다른 시스템 직접 호출 금지
  - GameState.todayStats 직접 수정 금지
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";

import {
  PRODUCTS,
  getProductById,
  getProductsByCustomerRequestId,
  getUnlockedProducts
} from "../data/ProductData.js";
import { getDayScenario } from "../data/DayScenarioData.js";

export const InventorySystem = {
  lots: [],
  initializedProductIds: new Set(),
  lotSequence: 0,
  isInitialized: false,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;

    EventBus.on(EVENTS.DAY_STARTED, () => {
      this.handleDayStarted();
    });

    EventBus.on(EVENTS.STORE_OPENED, (data) => {
      this.handleStoreOpened(data);
    });

    EventBus.on(EVENTS.CUSTOMER_SATISFIED, (data) => {
      this.handleCustomerSatisfied(data);
    });

    EventBus.on(EVENTS.RESTOCK_COMPLETED, (data) => {
      this.handleRestockCompleted(data);
    });

    EventBus.on(EVENTS.EXPIRED_LOSS_RECORDED, (data) => {
      this.handleExpiredLossRecorded(data);
    });

    this.unlockProductsForDay(GameState.day);
    this.emitInventoryChanged("inventory_initialized");
  },

  handleDayStarted() {
    const unlockedProductIds = this.unlockProductsForDay(GameState.day);

    if (unlockedProductIds.length > 0) {
      this.emitInventoryChanged("products_unlocked", {
        unlockedProductIds
      });
    }
  },

  handleStoreOpened(data = {}) {
    if (data.day !== GameState.day) {
      return;
    }

    this.emitInventoryChanged("store_open_stock_check");
  },

  unlockProductsForDay(day) {
    const newlyUnlockedProductIds = [];
    const products = getUnlockedProducts(day);

    products.forEach((product) => {
      if (this.initializedProductIds.has(product.id)) return;

      this.initializedProductIds.add(product.id);
      newlyUnlockedProductIds.push(product.id);

      // v3.1: 발주하지 않은 상품에 기본 재고가 생기지 않도록
      // 상품 해금과 재고 입고를 분리한다.
      // 실제 재고 증가는 택배 박스 상품 정리 후 RESTOCK_COMPLETED 이벤트로만 처리한다.
    });

    return newlyUnlockedProductIds;
  },

  handleCustomerSatisfied(data = {}) {
    const requestId = data.wantedProductId ?? null;
    const actualProductId = data.productId ?? null;
    const quantity = this.toPositiveInteger(data.quantity ?? 1);
    const saleDetails = {
      checkoutId: data.checkoutId ?? null,
      customerId: data.customerId ?? null,
      requestedProductId: requestId,
      actualProductId
    };

    if (quantity <= 0) {
      this.emitInventoryChanged("invalid_sale_quantity", {
        ...saleDetails,
        requestedQuantity: data.quantity
      });
      return false;
    }

    let product = null;

    if (actualProductId) {
      product = getProductById(actualProductId);

      if (!product || product.unlockDay > GameState.day) {
        this.emitInventoryChanged("invalid_sale_product", {
          ...saleDetails,
          quantity
        });
        return false;
      }

      if (
        requestId &&
        !this.isProductMatchingRequest(product.id, requestId)
      ) {
        this.emitInventoryChanged("sale_product_mismatch", {
          ...saleDetails,
          productId: product.id,
          productName: product.name,
          quantity
        });
        return false;
      }
    } else if (requestId) {
      product = this.findAvailableProductForRequest(requestId, quantity);
    }

    if (!product) {
      this.emitInventoryChanged("stock_shortage", {
        ...saleDetails,
        requestedQuantity: quantity
      });
      return false;
    }

    return this.consumeStock(product.id, quantity, saleDetails);
  },

  handleRestockCompleted(data = {}) {
    const productId = data.productId;
    const quantity = this.toPositiveInteger(data.quantity);

    if (!productId || quantity <= 0) return;

    this.addStock(productId, quantity);
  },

  handleExpiredLossRecorded(data = {}) {
    const expiredLots = Array.isArray(data.expiredLots)
      ? data.expiredLots
      : [];

    if (expiredLots.length === 0) return;

    const expiredLotIds = new Set(
      expiredLots.map((lot) => lot.lotId).filter(Boolean)
    );

    if (expiredLotIds.size === 0) return;

    let removedQuantity = 0;

    this.lots = this.lots.filter((lot) => {
      if (!expiredLotIds.has(lot.lotId)) {
        return true;
      }

      removedQuantity += lot.quantity;
      return false;
    });

    if (removedQuantity > 0) {
      this.emitInventoryChanged("expired_stock_removed", {
        removedQuantity,
        expiredLotIds: [...expiredLotIds]
      });
    }
  },

  addStock(productId, quantity, options = {}) {
    const product = getProductById(productId);
    const safeQuantity = this.toPositiveInteger(quantity);

    if (!product || safeQuantity <= 0) {
      return null;
    }

    if (product.unlockDay > GameState.day) {
      return null;
    }

    this.lotSequence += 1;

    const receivedDay = GameState.day;
    const lot = {
      lotId: `lot-${product.id}-${receivedDay}-${this.lotSequence}`,
      productId: product.id,
      quantity: safeQuantity,
      receivedDay,
      expireDay: receivedDay + product.shelfLifeDays
    };

    this.lots.push(lot);

    if (options.emitChange !== false) {
      this.emitInventoryChanged("stock_added", {
        productId: product.id,
        quantity: safeQuantity,
        lotId: lot.lotId
      });
    }

    return { ...lot };
  },

  consumeStock(productId, quantity = 1, details = {}) {
    const safeQuantity = this.toPositiveInteger(quantity);
    const availableQuantity = this.getStockQuantity(productId);

    if (safeQuantity <= 0 || availableQuantity < safeQuantity) {
      this.emitInventoryChanged("stock_shortage", {
        ...details,
        productId,
        requestedQuantity: safeQuantity,
        availableQuantity
      });

      return false;
    }

    let remainingQuantity = safeQuantity;

    const productLots = this.lots
      .filter((lot) => lot.productId === productId && lot.quantity > 0)
      .sort((first, second) => {
        if (first.expireDay !== second.expireDay) {
          return first.expireDay - second.expireDay;
        }

        if (first.receivedDay !== second.receivedDay) {
          return first.receivedDay - second.receivedDay;
        }

        return first.lotId.localeCompare(second.lotId);
      });

    productLots.forEach((lot) => {
      if (remainingQuantity <= 0) return;

      const usedQuantity = Math.min(lot.quantity, remainingQuantity);

      lot.quantity -= usedQuantity;
      remainingQuantity -= usedQuantity;
    });

    this.lots = this.lots.filter((lot) => lot.quantity > 0);

    this.emitInventoryChanged("stock_consumed", {
      ...details,
      productId,
      quantity: safeQuantity
    });

    return true;
  },

  applyEventInventoryChanges(changes = [], details = {}) {
    const normalizedChanges = this.normalizeEventInventoryChanges(changes);
    const appliedChanges = normalizedChanges.filter((change) => {
      return change.apply === true && change.productId && change.quantity !== 0;
    });
    const skippedChanges = normalizedChanges.filter((change) => {
      return !appliedChanges.includes(change);
    });

    if (appliedChanges.length === 0) {
      return {
        success: true,
        appliedChanges: [],
        skippedChanges,
        reason: "no_applicable_inventory_changes"
      };
    }

    const validation = this.validateEventInventoryChanges(appliedChanges);

    if (!validation.isValid) {
      this.emitInventoryChanged("event_inventory_change_failed", {
        ...details,
        failedChange: validation.failedChange,
        reasonDetail: validation.reason
      });

      return {
        success: false,
        appliedChanges: [],
        skippedChanges,
        reason: validation.reason,
        failedChange: validation.failedChange
      };
    }

    appliedChanges.forEach((change) => {
      if (change.quantity < 0) {
        this.consumeStock(change.productId, Math.abs(change.quantity), {
          ...details,
          label: change.label,
          reason: "customer_event_inventory_consumed"
        });
        return;
      }

      this.addStock(change.productId, change.quantity, {
        emitChange: false
      });
    });

    this.emitInventoryChanged("customer_event_inventory_applied", {
      ...details,
      appliedChanges,
      skippedChanges
    });

    return {
      success: true,
      appliedChanges,
      skippedChanges,
      reason: "customer_event_inventory_applied"
    };
  },

  normalizeEventInventoryChanges(changes = []) {
    if (!Array.isArray(changes)) {
      return [];
    }

    return changes.map((change) => {
      return {
        label: change.label ?? "재고",
        productId: change.productId ?? null,
        itemKey: change.itemKey ?? null,
        quantity: Math.floor(Number(change.quantity) || 0),
        apply: change.apply === true
      };
    });
  },

  validateEventInventoryChanges(changes = []) {
    for (const change of changes) {
      const product = getProductById(change.productId);

      if (!product) {
        return {
          isValid: false,
          reason: "invalid_product",
          failedChange: change
        };
      }

      if (product.unlockDay > GameState.day) {
        return {
          isValid: false,
          reason: "locked_product",
          failedChange: change
        };
      }

      if (change.quantity < 0) {
        const requiredQuantity = Math.abs(change.quantity);
        const availableQuantity = this.getStockQuantity(change.productId);

        if (availableQuantity < requiredQuantity) {
          return {
            isValid: false,
            reason: "stock_shortage",
            failedChange: {
              ...change,
              requiredQuantity,
              availableQuantity
            }
          };
        }
      }
    }

    return {
      isValid: true,
      reason: null,
      failedChange: null
    };
  },

  findAvailableProductForRequest(requestId, quantity = 1) {
    const requiredQuantity = Math.max(
      1,
      this.toPositiveInteger(quantity)
    );

    const candidates = getProductsByCustomerRequestId(requestId)
      .filter((product) => {
        return (
          product.unlockDay <= GameState.day &&
          this.getStockQuantity(product.id) >= requiredQuantity
        );
      })
      .sort((first, second) => {
        const firstExpireDay = this.getNextExpireDay(first.id);
        const secondExpireDay = this.getNextExpireDay(second.id);

        if (firstExpireDay !== secondExpireDay) {
          return firstExpireDay - secondExpireDay;
        }

        return PRODUCTS.indexOf(first) - PRODUCTS.indexOf(second);
      });

    return candidates[0] ?? null;
  },

  isProductMatchingRequest(productId, requestId) {
    if (!productId || !requestId) {
      return false;
    }

    return getProductsByCustomerRequestId(requestId).some((product) => {
      return product.id === productId;
    });
  },

  getStockQuantity(productId) {
    return this.lots.reduce((total, lot) => {
      if (lot.productId !== productId) {
        return total;
      }

      return total + lot.quantity;
    }, 0);
  },

  getNextExpireDay(productId) {
    const expireDays = this.lots
      .filter((lot) => lot.productId === productId && lot.quantity > 0)
      .map((lot) => lot.expireDay);

    if (expireDays.length === 0) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.min(...expireDays);
  },

  getSellableProductIdsForCurrentDayRequests(day = GameState.day) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const scenario = getDayScenario(safeDay);
    const requestIds = Array.isArray(scenario?.wantedProductIds)
      ? scenario.wantedProductIds
      : [];
    const sellableProductIds = new Set();

    requestIds.forEach((requestId) => {
      getProductsByCustomerRequestId(requestId).forEach((product) => {
        if (product.unlockDay <= safeDay) {
          sellableProductIds.add(product.id);
        }
      });
    });

    return [...sellableProductIds];
  },

  getSellableStockQuantityForCurrentDayRequests(day = GameState.day) {
    return this.getSellableProductIdsForCurrentDayRequests(day).reduce(
      (total, productId) => total + this.getStockQuantity(productId),
      0
    );
  },

  hasSellableStockForCurrentDayRequests(day = GameState.day) {
    return this.getSellableStockQuantityForCurrentDayRequests(day) > 0;
  },

  getInventorySnapshot() {
    const sellableProductIdsForCurrentDay =
      this.getSellableProductIdsForCurrentDayRequests(GameState.day);
    const items = PRODUCTS.map((product) => {
      const lots = this.lots
        .filter((lot) => lot.productId === product.id && lot.quantity > 0)
        .sort((first, second) => first.expireDay - second.expireDay)
        .map((lot) => ({ ...lot }));

      const quantity = lots.reduce((total, lot) => {
        return total + lot.quantity;
      }, 0);

      return {
        productId: product.id,
        productName: product.name,
        category: product.category,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        shelfLifeDays: product.shelfLifeDays,
        unlockDay: product.unlockDay,
        isUnlocked: product.unlockDay <= GameState.day,
        quantity,
        nextExpireDay: lots[0]?.expireDay ?? null,
        lots
      };
    });

    return {
      day: GameState.day,
      totalQuantity: items.reduce((total, item) => {
        return total + item.quantity;
      }, 0),
      sellableProductIdsForCurrentDay,
      sellableStockQuantityForCurrentDayRequests:
        sellableProductIdsForCurrentDay.reduce((total, productId) => {
          return total + this.getStockQuantity(productId);
        }, 0),
      items
    };
  },

  emitInventoryChanged(reason, details = {}) {
    EventBus.emit(EVENTS.INVENTORY_CHANGED, {
      ...details,
      ...this.getInventorySnapshot(),
      reason
    });
  },

  toPositiveInteger(value) {
    const numberValue = Math.floor(Number(value));

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return 0;
    }

    return numberValue;
  }
};
