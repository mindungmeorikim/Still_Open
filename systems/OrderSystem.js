/*
  OrderSystem.js

  역할:
  - Day 시작 전 발주 확정/배송/재고 정리 이벤트 연결
  - 발주 비용 차감
  - 재고 입고는 RESTOCK_COMPLETED 이벤트로 InventorySystem에 위임

  규칙:
  - InventorySystem 직접 호출 금지
  - GameState.todayStats 직접 수정 금지
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import { getProductById } from "../data/ProductData.js";

export const OrderSystem = {
  isInitialized: false,
  orderSequence: 0,
  pendingDelivery: null,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;

    EventBus.on(EVENTS.ORDER_CONFIRMED, (data) => {
      this.handleOrderConfirmed(data);
    });

    EventBus.on(EVENTS.STOCK_ORGANIZED, (data) => {
      this.handleStockOrganized(data);
    });
  },

  handleOrderConfirmed(data = {}) {
    const items = this.normalizeOrderItems(data.items);
    const totalCost = this.calculateTotalCost(items);

    if (totalCost > GameState.money) {
      return;
    }

    GameState.money -= totalCost;
    this.orderSequence += 1;

    const orderId = `order-${GameState.day}-${this.orderSequence}`;

    this.pendingDelivery = {
      orderId,
      day: GameState.day,
      items,
      totalCost
    };

    EventBus.emit(EVENTS.ORDER_DELIVERED, {
      day: GameState.day,
      orderId,
      items,
      totalCost,
      remainingMoney: GameState.money,
      message: this.createDeliveryMessage(items)
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handleStockOrganized(data = {}) {
    if (!this.pendingDelivery) return;

    const requestedOrderId = data.orderId ?? this.pendingDelivery.orderId;

    if (requestedOrderId !== this.pendingDelivery.orderId) {
      return;
    }

    this.pendingDelivery.items.forEach((item) => {
      if (item.quantity <= 0) return;

      EventBus.emit(EVENTS.RESTOCK_COMPLETED, {
        day: GameState.day,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        source: "order_delivery",
        orderId: this.pendingDelivery.orderId
      });
    });

    this.pendingDelivery = null;

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  normalizeOrderItems(items = []) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.reduce((normalizedItems, item) => {
      const product = getProductById(item.productId);
      const quantity = this.toPositiveInteger(item.quantity);

      if (!product || product.unlockDay > GameState.day) {
        return normalizedItems;
      }

      normalizedItems.push({
        productId: product.id,
        productName: product.name,
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

  createDeliveryMessage(items = []) {
    const orderedCount = items.reduce((totalCount, item) => {
      return totalCount + item.quantity;
    }, 0);

    if (orderedCount <= 0) {
      return "발주 없이 오늘 영업 준비를 진행합니다.";
    }

    return "발주 상품이 도착했습니다. 재고 정리를 완료해주세요.";
  },

  toPositiveInteger(value) {
    const numberValue = Math.floor(Number(value) || 0);

    return Math.max(0, numberValue);
  }
};
