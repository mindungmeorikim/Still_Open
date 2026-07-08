/*
  OrderSystem.js

  역할:
  - Day 시작 전 발주 확정/배송/재고 정리 이벤트 연결
  - 발주 비용 계산 및 정산 이벤트 전달
  - 재고 입고는 RESTOCK_COMPLETED 이벤트로 InventorySystem에 위임

  규칙:
  - InventorySystem 직접 호출 금지
  - GameState.todayStats 직접 수정 금지
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { getProductById } from "../data/ProductData.js";
import { BMSystem } from "./BMSystem.js";
import { InventorySystem } from "./InventorySystem.js";

const TUTORIAL_PRACTICE_RESET_REQUESTED = "TUTORIAL_PRACTICE_RESET_REQUESTED";
const SAVE_GAME_LOADED = "SAVE_GAME_LOADED";
const ORDER_DELIVERY_PICKUP_REQUESTED = "ORDER_DELIVERY_PICKUP_REQUESTED";
const ORDER_CONFIRMATION_FAILED = "ORDER_CONFIRMATION_FAILED";
const ORDER_VALIDATION_MESSAGES = Object.freeze({
  notEnoughGold: "골드가 부족합니다.",
  quantityExceeded: "발주 가능 수량을 초과했습니다.",
  emptyOrder: "발주할 상품을 선택해주세요.",
  lockedProduct: "발주할 수 없는 상품입니다.",
  unavailable: "발주를 진행할 수 없습니다."
});

export const OrderSystem = {
  isInitialized: false,
  orderSequence: 0,
  pendingDelivery: null,
  deliveryTimerId: null,
  DELIVERY_WAIT_MS: 3000,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;

    EventBus.on(EVENTS.ORDER_CONFIRMED, (data) => {
      this.handleOrderConfirmed(data);
    });

    EventBus.on(EVENTS.ORDER_REQUESTED, (data) => {
      this.handleOrderRequested(data);
    });

    EventBus.on(EVENTS.STOCK_ORGANIZED, (data) => {
      this.handleStockOrganized(data);
    });

    EventBus.on(SAVE_GAME_LOADED, (data = {}) => {
      this.hydrateSaveSnapshot(data.order ?? data.saveData?.order ?? {});
    });

    EventBus.on(EVENTS.PLAYER_ACTION_RECORDED, (data) => {
      this.handlePlayerActionRecorded(data);
    });

    EventBus.on(TUTORIAL_PRACTICE_RESET_REQUESTED, () => {
      this.resetTutorialPracticeOrder();
    });
  },

  resetTutorialPracticeOrder() {
    this.clearDeliveryTimer();
    this.pendingDelivery = null;
    this.orderSequence = 0;
    this.syncOrderSnapshotToGameState("tutorial_practice_reset");

    EventBus.emit(EVENTS.ORDER_DELIVERED, {
      day: GameState.day,
      orderId: null,
      items: [],
      totalCost: 0,
      isArrived: false,
      isCompleted: true,
      status: "tutorial_reset",
      message: "튜토리얼 연습 발주가 초기화되었습니다."
    });
  },

  emitOrderConfirmationFailed(reason = "발주를 진행할 수 없습니다.", requestData = {}, details = {}) {
    const message = this.getOrderFailureMessage(reason, details);

    console.warn(`[OrderSystem] 발주 불가: ${message}`, {
      requestData,
      ...details
    });

    EventBus.emit(ORDER_CONFIRMATION_FAILED, {
      day: GameState.day,
      reason,
      message,
      ...details
    });
  },

  getOrderFailureMessage(reason = "", details = {}) {
    const reasonText = String(reason || "");

    if (
      reasonText === "not_enough_gold" ||
      reasonText === ORDER_VALIDATION_MESSAGES.notEnoughGold ||
      reasonText.includes("보유금") ||
      reasonText.includes("발주 가능 금액") ||
      reasonText.includes("골드")
    ) {
      return ORDER_VALIDATION_MESSAGES.notEnoughGold;
    }

    if (
      reasonText === "quantity_exceeded" ||
      reasonText === ORDER_VALIDATION_MESSAGES.quantityExceeded ||
      reasonText.includes("창고") ||
      reasonText.includes("수량")
    ) {
      return ORDER_VALIDATION_MESSAGES.quantityExceeded;
    }

    if (
      reasonText === "empty_order" ||
      reasonText === ORDER_VALIDATION_MESSAGES.emptyOrder
    ) {
      return ORDER_VALIDATION_MESSAGES.emptyOrder;
    }

    if (
      reasonText === "locked_product" ||
      reasonText === "no_orderable_items" ||
      reasonText === ORDER_VALIDATION_MESSAGES.lockedProduct
    ) {
      return ORDER_VALIDATION_MESSAGES.lockedProduct;
    }

    return reasonText || ORDER_VALIDATION_MESSAGES.unavailable;
  },

  handleOrderRequested(data = {}) {
    const productId = data.productId;
    const quantity = Number(data.quantity ?? 1);

    if (!productId) {
      console.warn("[OrderSystem] ORDER_REQUESTED에 productId가 없습니다.", data);
      this.emitOrderConfirmationFailed("locked_product", data);
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      console.warn("[OrderSystem] 잘못된 발주 수량입니다.", data);
      this.emitOrderConfirmationFailed("empty_order", data);
      return;
    }

    this.handleOrderConfirmed({
      day: data.day ?? GameState.day,
      source: "order_requested_compat",
      items: [
        {
          productId,
          quantity
        }
      ]
    });
  },

  handleOrderConfirmed(data = {}) {
    const availability = this.validateOrderAvailability(data);

    if (!availability.isAvailable) {
      this.emitOrderConfirmationFailed(availability.reason, data);
      return;
    }

    const orderValidation = this.validateConfirmedOrderItems(data);

    if (!orderValidation.isAvailable) {
      this.emitOrderConfirmationFailed(orderValidation.reason, data, orderValidation.details);
      return;
    }

    const items = orderValidation.items;
    const totalCost = orderValidation.totalCost;
    const availableMoney = orderValidation.availableMoney;

    this.orderSequence += 1;

    const orderId = `order-${GameState.day}-${this.orderSequence}`;

    if (orderValidation.isEmptyOrder || items.length === 0) {
      this.completeEmptyOrder(data, orderId, availableMoney);
      return;
    }

    if (totalCost > 0) {
      EventBus.emit(EVENTS.COST_CHANGED, {
        day: GameState.day,
        orderId,
        amount: totalCost,
        reason: "order",
        source: data.source ?? "order_confirmed",
        items
      });
    }

    this.clearDeliveryTimer();

    this.pendingDelivery = {
      orderId,
      day: GameState.day,
      items: items.map((item) => {
        return {
          ...item,
          isSorted: false
        };
      }),
      totalCost,
      isArrived: false
    };

    this.syncOrderSnapshotToGameState("order_confirmed");

    this.deliveryTimerId = setTimeout(() => {
      this.deliverPendingOrder(orderId, availableMoney);
    }, this.DELIVERY_WAIT_MS);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  deliverPendingOrder(orderId, availableMoney = this.getAvailableMoney()) {
    if (!this.pendingDelivery || this.pendingDelivery.orderId !== orderId) {
      return;
    }

    this.pendingDelivery.isArrived = true;
    this.deliveryTimerId = null;
    this.syncOrderSnapshotToGameState("order_arrived");

    EventBus.emit(EVENTS.ORDER_DELIVERED, {
      ...this.createDeliveryPayload("arrived"),
      remainingMoney: Math.max(0, availableMoney - this.pendingDelivery.totalCost)
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handlePlayerActionRecorded(data = {}) {
    if (data.actionType === "open_delivery_box") {
      this.handleDeliveryBoxPickupRequested(data);
      return;
    }

    if (data.actionType !== "sort_delivery_item") {
      return;
    }

    this.handleDeliveryItemSorted(data);
  },

  handleDeliveryBoxPickupRequested(data = {}) {
    if (!this.pendingDelivery || !this.pendingDelivery.isArrived) {
      return;
    }

    const requestedOrderId = data.orderId ?? this.pendingDelivery.orderId;

    if (requestedOrderId !== this.pendingDelivery.orderId) {
      return;
    }

    if (this.isDeliveryFullySorted()) {
      return;
    }

    EventBus.emit(ORDER_DELIVERY_PICKUP_REQUESTED, {
      ...this.createDeliveryPayload("pickup_requested"),
      source: data.source ?? "delivery_box_zone"
    });
  },

  handleDeliveryItemSorted(data = {}) {
    if (!this.pendingDelivery || !this.pendingDelivery.isArrived) {
      return;
    }

    const requestedOrderId = data.orderId ?? this.pendingDelivery.orderId;

    if (requestedOrderId !== this.pendingDelivery.orderId) {
      return;
    }

    const productId = data.productId;
    const item = this.pendingDelivery.items.find((deliveryItem) => {
      return deliveryItem.productId === productId;
    });

    if (!item || item.quantity <= 0 || item.isSorted) {
      return;
    }

    item.isSorted = true;
    this.syncOrderSnapshotToGameState("delivery_item_sorted");

    EventBus.emit(EVENTS.RESTOCK_COMPLETED, {
      day: GameState.day,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      source: "delivery_box_item",
      orderId: this.pendingDelivery.orderId
    });

    if (this.isDeliveryFullySorted()) {
      const completedPayload = this.createDeliveryPayload("completed", {
        productId: item.productId
      });
      const completedItems = completedPayload.items.map((deliveryItem) => ({
        ...deliveryItem
      }));

      this.pendingDelivery = null;
      this.clearDeliveryTimer();
      this.syncOrderSnapshotToGameState("delivery_completed");

      EventBus.emit(EVENTS.ORDER_DELIVERED, completedPayload);

      EventBus.emit(EVENTS.STOCK_ORGANIZED, {
        day: GameState.day,
        orderId: completedPayload.orderId,
        items: completedItems,
        totalCost: completedPayload.totalCost,
        source: "delivery_box_sorted",
        message: "발주 상품 정리가 완료되었습니다."
      });
    } else {
      EventBus.emit(EVENTS.ORDER_DELIVERED, this.createDeliveryPayload("item_sorted", {
        productId: item.productId
      }));
    }

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handleStockOrganized(data = {}) {
    if (!this.pendingDelivery) return;

    const requestedOrderId = data.orderId ?? this.pendingDelivery.orderId;

    if (requestedOrderId !== this.pendingDelivery.orderId) {
      return;
    }

    this.pendingDelivery.items.forEach((item) => {
      if (item.quantity <= 0 || item.isSorted) return;

      item.isSorted = true;

      EventBus.emit(EVENTS.RESTOCK_COMPLETED, {
        day: GameState.day,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        source: "order_delivery_compat",
        orderId: this.pendingDelivery.orderId
      });
    });

    const completedPayload = this.createDeliveryPayload("completed");

    this.pendingDelivery = null;
    this.clearDeliveryTimer();
    this.syncOrderSnapshotToGameState("stock_organized_compat");

    EventBus.emit(EVENTS.ORDER_DELIVERED, completedPayload);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  hydrateSaveSnapshot(snapshot = {}) {
    this.clearDeliveryTimer();

    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    this.orderSequence = this.toNonNegativeInteger(source.orderSequence);
    this.pendingDelivery = this.normalizePendingDeliveryForRuntime(source.pendingDelivery);

    if (this.pendingDelivery && !this.pendingDelivery.isArrived) {
      const orderId = this.pendingDelivery.orderId;
      this.deliveryTimerId = setTimeout(() => {
        this.deliverPendingOrder(orderId);
      }, Math.min(this.DELIVERY_WAIT_MS, 500));
    }

    if (this.pendingDelivery?.isArrived === true && !this.isDeliveryFullySorted()) {
      EventBus.emit(EVENTS.ORDER_DELIVERED, this.createDeliveryPayload("save_loaded"));
    }

    this.syncOrderSnapshotToGameState("save_loaded");
  },

  syncOrderSnapshotToGameState(reason = "order_sync") {
    GameState.orderSnapshot = {
      orderSequence: this.toNonNegativeInteger(this.orderSequence),
      pendingDelivery: this.clonePendingDelivery(this.pendingDelivery),
      reason
    };
  },

  clonePendingDelivery(delivery = null) {
    if (!delivery || typeof delivery !== "object") {
      return null;
    }

    const normalized = this.normalizePendingDeliveryForRuntime(delivery);

    if (!normalized) {
      return null;
    }

    return JSON.parse(JSON.stringify(normalized));
  },

  normalizePendingDeliveryForRuntime(delivery = null) {
    if (!delivery || typeof delivery !== "object") {
      return null;
    }

    const orderId = String(delivery.orderId ?? "").trim();
    const items = Array.isArray(delivery.items)
      ? delivery.items
          .map((item) => {
            const productId = String(item?.productId ?? "").trim().replace(/-/g, "_");
            const quantity = this.toPositiveInteger(item?.quantity);

            if (!productId || quantity <= 0) {
              return null;
            }

            return {
              ...item,
              productId,
              quantity,
              isSorted: item?.isSorted === true
            };
          })
          .filter(Boolean)
      : [];

    if (!orderId || items.length === 0 || items.every((item) => item.isSorted === true)) {
      return null;
    }

    return {
      orderId,
      day: this.toDayNumber(delivery.day, GameState.day),
      items,
      totalCost: this.toNonNegativeNumber(delivery.totalCost),
      isArrived: delivery.isArrived === true
    };
  },

  isZeroQuantityOrderAllowed(day = GameState.day) {
    const dayNumber = this.toDayNumber(day, GameState.day);

    return dayNumber >= 2;
  },

  completeEmptyOrder(data = {}, orderId = null, availableMoney = this.getAvailableMoney()) {
    this.pendingDelivery = null;
    this.clearDeliveryTimer();
    this.syncOrderSnapshotToGameState("empty_order");

    EventBus.emit(EVENTS.ORDER_DELIVERED, {
      day: GameState.day,
      orderId,
      items: [],
      totalCost: 0,
      isArrived: true,
      isCompleted: true,
      reason: "empty_order",
      source: data.source ?? "empty_order",
      message: "발주 없이 오늘 영업 준비를 진행합니다.",
      remainingMoney: availableMoney
    });

    EventBus.emit(EVENTS.STOCK_ORGANIZED, {
      day: GameState.day,
      orderId,
      items: [],
      totalCost: 0,
      source: "empty_order",
      message: "발주 없이 준비를 완료했습니다. 영업 시작 버튼을 눌러주세요."
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  validateConfirmedOrderItems(data = {}) {
    const requestedItems = Array.isArray(data.items) ? data.items : [];
    const positiveItems = requestedItems.filter((item) => {
      return this.toPositiveInteger(item.quantity) > 0;
    });

    if (positiveItems.length === 0) {
      if (this.isZeroQuantityOrderAllowed(data.day ?? GameState.day)) {
        const availableMoney = this.getAvailableMoney();
        const inventorySnapshot = InventorySystem.getInventorySnapshot?.() ?? {};
        const currentWarehouseStock = Math.max(0, Math.floor(Number(inventorySnapshot.totalQuantity) || 0));
        const warehouseCapacity = BMSystem.getWarehouseCapacity();

        return {
          isAvailable: true,
          reason: null,
          details: {
            requestedItems,
            isEmptyOrder: true
          },
          items: [],
          totalCost: 0,
          availableMoney,
          orderQuantity: 0,
          currentWarehouseStock,
          warehouseCapacity,
          isEmptyOrder: true
        };
      }

      return {
        isAvailable: false,
        reason: "empty_order",
        details: {
          requestedItems
        }
      };
    }

    const items = [];

    for (const item of positiveItems) {
      const product = getProductById(item.productId);
      const quantity = this.toPositiveInteger(item.quantity);

      if (!product || !BMSystem.canOrderProduct(product.id)) {
        const productId = product?.id ?? item.productId ?? null;

        console.warn("[OrderSystem] 발주 조건 미충족 상품 차단:", {
          productId,
          productName: product ? BMSystem.getProductDisplayName(product) : null,
          reason: productId ? BMSystem.getProductLockReason(productId) : "invalid_product"
        });

        return {
          isAvailable: false,
          reason: "locked_product",
          details: {
            productId,
            requestedItems
          }
        };
      }

      items.push({
        productId: product.id,
        productName: BMSystem.getProductDisplayName(product),
        shelfId: product.shelfId,
        imagePath: product.imagePath,
        quantity,
        purchasePrice: product.purchasePrice,
        salePrice: BMSystem.getProductSalePrice(product.id) || product.salePrice,
        lineCost: product.purchasePrice * quantity
      });
    }

    const orderQuantity = items.reduce((total, item) => total + item.quantity, 0);

    if (orderQuantity <= 0) {
      if (this.isZeroQuantityOrderAllowed(data.day ?? GameState.day)) {
        const availableMoney = this.getAvailableMoney();
        const inventorySnapshot = InventorySystem.getInventorySnapshot?.() ?? {};
        const currentWarehouseStock = Math.max(0, Math.floor(Number(inventorySnapshot.totalQuantity) || 0));
        const warehouseCapacity = BMSystem.getWarehouseCapacity();

        return {
          isAvailable: true,
          reason: null,
          details: {
            requestedItems,
            isEmptyOrder: true
          },
          items: [],
          totalCost: 0,
          availableMoney,
          orderQuantity: 0,
          currentWarehouseStock,
          warehouseCapacity,
          isEmptyOrder: true
        };
      }

      return {
        isAvailable: false,
        reason: "empty_order",
        details: {
          requestedItems
        }
      };
    }

    const totalCost = this.calculateTotalCost(items);
    const availableMoney = this.getAvailableMoney();

    if (totalCost > availableMoney) {
      return {
        isAvailable: false,
        reason: "not_enough_gold",
        details: {
          totalCost,
          availableMoney,
          requestedItems
        }
      };
    }

    const inventorySnapshot = InventorySystem.getInventorySnapshot?.() ?? {};
    const currentWarehouseStock = Math.max(0, Math.floor(Number(inventorySnapshot.totalQuantity) || 0));
    const warehouseCapacity = BMSystem.getWarehouseCapacity();

    if (currentWarehouseStock + orderQuantity > warehouseCapacity) {
      return {
        isAvailable: false,
        reason: "quantity_exceeded",
        details: {
          currentWarehouseStock,
          orderQuantity,
          warehouseCapacity,
          requestedItems
        }
      };
    }

    return {
      isAvailable: true,
      reason: null,
      details: {},
      items,
      totalCost,
      availableMoney,
      orderQuantity,
      currentWarehouseStock,
      warehouseCapacity
    };
  },

  normalizeOrderItems(items = []) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.reduce((normalizedItems, item) => {
      const product = getProductById(item.productId);
      const quantity = this.toPositiveInteger(item.quantity);

      if (!product || quantity <= 0) {
        return normalizedItems;
      }

      if (!BMSystem.canOrderProduct(product.id)) {
        console.warn("[OrderSystem] BM 조건 미충족 상품 발주 차단:", {
          productId: product.id,
          productName: BMSystem.getProductDisplayName(product),
          reason: BMSystem.getProductLockReason(product.id)
        });
        return normalizedItems;
      }

      normalizedItems.push({
        productId: product.id,
        productName: BMSystem.getProductDisplayName(product),
        shelfId: product.shelfId,
        imagePath: product.imagePath,
        quantity,
        purchasePrice: product.purchasePrice,
        salePrice: BMSystem.getProductSalePrice(product.id) || product.salePrice,
        lineCost: product.purchasePrice * quantity
      });

      return normalizedItems;
    }, []);
  },

  calculateTotalCost(items = []) {
    return items.reduce((totalCost, item) => {
      return totalCost + item.lineCost;
    }, 0);
  },

  getAvailableMoney() {
    const money = this.toNonNegativeNumber(GameState.money);
    const recordedCost = this.toNonNegativeNumber(
      GameState.todayStats?.cost
    );

    return Math.max(0, money - recordedCost);
  },

  validateOrderAvailability(data = {}) {
    const requestDay = this.toDayNumber(data.day, GameState.day);

    if (requestDay !== GameState.day) {
      return {
        isAvailable: false,
        reason: "현재 Day와 발주 요청 Day가 일치하지 않습니다."
      };
    }

    const isOrderPhase =
      GameState.phase === GAME_PHASE.DAY_START ||
      GameState.phase === GAME_PHASE.ORDER;

    if (!isOrderPhase) {
      return {
        isAvailable: false,
        reason: "발주는 Day 시작 후 영업 시작 전까지만 가능합니다."
      };
    }

    if (this.pendingDelivery || this.deliveryTimerId) {
      return {
        isAvailable: false,
        reason: "기존 발주 상품의 배송과 재고 정리를 먼저 완료해야 합니다."
      };
    }

    return {
      isAvailable: true,
      reason: null
    };
  },

  createDeliveryMessage(items = []) {
    const orderedCount = items.reduce((totalCount, item) => {
      return totalCount + item.quantity;
    }, 0);

    if (orderedCount <= 0) {
      return "발주 없이 오늘 영업 준비를 진행합니다.";
    }

    return "가게 앞 발주 박스가 도착했습니다. 박스를 눌러 발주 상품을 정리해주세요.";
  },

  createDeliveryPayload(reason = "arrived", details = {}) {
    const delivery = this.pendingDelivery;

    if (!delivery) {
      return {
        day: GameState.day,
        orderId: null,
        items: [],
        totalCost: 0,
        reason,
        message: "정리할 발주 상품이 없습니다.",
        ...details
      };
    }

    return {
      day: delivery.day,
      orderId: delivery.orderId,
      items: delivery.items.map((item) => ({ ...item })),
      totalCost: delivery.totalCost,
      isArrived: delivery.isArrived,
      isCompleted: this.isDeliveryFullySorted(),
      reason,
      message: this.createDeliveryMessage(delivery.items),
      ...details
    };
  },

  isDeliveryFullySorted() {
    if (!this.pendingDelivery) return true;

    return this.pendingDelivery.items.every((item) => {
      return item.quantity <= 0 || item.isSorted;
    });
  },

  clearDeliveryTimer() {
    if (!this.deliveryTimerId) return;

    clearTimeout(this.deliveryTimerId);
    this.deliveryTimerId = null;
  },

  toPositiveInteger(value) {
    const numberValue = Math.floor(Number(value) || 0);

    return Math.max(0, numberValue);
  },

  toNonNegativeNumber(value) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return 0;
    }

    return numberValue;
  },

  toNonNegativeInteger(value) {
    const numberValue = Math.floor(Number(value) || 0);

    if (!Number.isFinite(numberValue) || numberValue < 0) {
      return 0;
    }

    return numberValue;
  },

  toDayNumber(value, fallback) {
    const day = Math.floor(Number(value));

    if (!Number.isFinite(day) || day < 1) {
      return fallback;
    }

    return day;
  }
};
