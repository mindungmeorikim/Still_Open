/*
  ExpirationSystem.js

  담당:
  - 4번 담당자

  역할:
  - Day 시작 시 재고 묶음의 유통기한 검사
  - 폐기 대상과 매입가 기준 손실 금액 계산
  - 폐기 결과를 EventBus로 전달

  규칙:
  - 다른 시스템 직접 호출 금지
  - GameState.todayStats 직접 수정 금지
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import { getProductById } from "../data/ProductData.js";

export const ExpirationSystem = {
  inventoryItems: [],
  lastCheckedDay: null,
  isInitialized: false,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;

    EventBus.on(EVENTS.INVENTORY_CHANGED, (data) => {
      this.captureInventory(data);
    });

    EventBus.on(EVENTS.DAY_STARTED, (data) => {
      this.checkExpiration(data.day ?? GameState.day);
    });
  },

  captureInventory(data = {}) {
    if (!Array.isArray(data.items)) return;

    this.inventoryItems = data.items.map((item) => {
      const lots = Array.isArray(item.lots)
        ? item.lots.map((lot) => ({ ...lot }))
        : [];

      return {
        productId: item.productId,
        lots
      };
    });
  },

  checkExpiration(day = GameState.day) {
    const safeDay = Math.max(
      1,
      Math.floor(Number(day) || GameState.day)
    );

    if (this.lastCheckedDay === safeDay) {
      return [];
    }

    this.lastCheckedDay = safeDay;

    const expiredLots = [];

    this.inventoryItems.forEach((item) => {
      const product = getProductById(item.productId);

      if (!product) return;

      item.lots.forEach((lot) => {
        const quantity = Math.max(0, Math.floor(Number(lot.quantity) || 0));
        const expireDay = Math.floor(Number(lot.expireDay) || 0);

        if (quantity <= 0 || expireDay > safeDay) {
          return;
        }

        expiredLots.push({
          lotId: lot.lotId,
          productId: product.id,
          productName: product.name,
          quantity,
          receivedDay: lot.receivedDay,
          expireDay,
          lossAmount: product.purchasePrice * quantity
        });
      });
    });

    if (expiredLots.length === 0) {
      return [];
    }

    const amount = expiredLots.reduce((total, lot) => {
      return total + lot.lossAmount;
    }, 0);

    EventBus.emit(EVENTS.EXPIRED_LOSS_RECORDED, {
      day: safeDay,
      amount,
      expiredLots
    });

    return expiredLots.map((lot) => ({ ...lot }));
  }
};
