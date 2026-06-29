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

    EventBus.on(EVENTS.PLAYER_ACTION_RECORDED, (data) => {
      this.handlePlayerActionRecorded(data);
    });
  },

  handleOrderRequested(data = {}) {
    const productId = data.productId;
    const quantity = Number(data.quantity ?? 1);

    if (!productId) {
      console.warn("[OrderSystem] ORDER_REQUESTED에 productId가 없습니다.", data);
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      console.warn("[OrderSystem] 잘못된 발주 수량입니다.", data);
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
      console.warn(`[OrderSystem] 발주 불가: ${availability.reason}`, data);
      return;
    }

    const items = this.normalizeOrderItems(data.items);
    const totalCost = this.calculateTotalCost(items);
    const availableMoney = this.getAvailableMoney();

    if (totalCost > availableMoney) {
      console.warn("[OrderSystem] 보유금보다 발주 비용이 큽니다.", {
        totalCost,
        availableMoney
      });
      return;
    }

    this.orderSequence += 1;

    const orderId = `order-${GameState.day}-${this.orderSequence}`;

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

    if (items.length === 0) {
      this.pendingDelivery = null;

      EventBus.emit(EVENTS.STOCK_ORGANIZED, {
        day: GameState.day,
        orderId,
        items: [],
        totalCost: 0,
        source: "empty_order",
        message: "발주 상품 없이 영업 준비를 완료했습니다."
      });

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
      return;
    }

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

    EventBus.emit(EVENTS.ORDER_DELIVERED, {
      ...this.createDeliveryPayload("arrived"),
      remainingMoney: Math.max(0, availableMoney - this.pendingDelivery.totalCost)
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handlePlayerActionRecorded(data = {}) {
    if (data.actionType !== "sort_delivery_item") {
      return;
    }

    this.handleDeliveryItemSorted(data);
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

      EventBus.emit(EVENTS.ORDER_DELIVERED, completedPayload);

      EventBus.emit(EVENTS.STOCK_ORGANIZED, {
        day: GameState.day,
        orderId: completedPayload.orderId,
        items: completedItems,
        totalCost: completedPayload.totalCost,
        source: "delivery_box_sorted",
        message: "모든 입고 상품 정리가 완료되었습니다."
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

    EventBus.emit(EVENTS.ORDER_DELIVERED, completedPayload);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  normalizeOrderItems(items = []) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.reduce((normalizedItems, item) => {
      const product = getProductById(item.productId);
      const quantity = this.toPositiveInteger(item.quantity);

      if (!product || product.unlockDay > GameState.day || quantity <= 0) {
        return normalizedItems;
      }

      normalizedItems.push({
        productId: product.id,
        productName: product.name,
        imagePath: product.imagePath,
        quantity,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
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

    return "가게 앞 택배 박스가 도착했습니다. 박스를 눌러 입고 상품을 정리해주세요.";
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
        message: "정리할 입고 상품이 없습니다.",
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

  toDayNumber(value, fallback) {
    const day = Math.floor(Number(value));

    if (!Number.isFinite(day) || day < 1) {
      return fallback;
    }

    return day;
  }
};
