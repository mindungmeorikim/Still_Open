/*
  EconomySystem.js

  담당:
  - 4번 담당자

  역할:
  - 계산 완료 상품의 판매 매출 계산
  - 중복 계산 및 잘못된 결제 데이터 차단
  - 매출 변경 내용을 EventBus로 전달

  규칙:
  - 다른 시스템 직접 호출 금지
  - GameState.todayStats 직접 수정 금지
  - GameState.money 직접 수정 금지
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import { getProductById } from "../data/ProductData.js";

export const EconomySystem = {
  processedCheckoutKeys: new Set(),
  activeDay: null,
  isInitialized: false,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.activeDay = GameState.day;

    EventBus.on(EVENTS.DAY_STARTED, (data) => {
      this.handleDayStarted(data);
    });

    EventBus.on(EVENTS.CHECKOUT_COMPLETED, (data) => {
      this.handleCheckoutCompleted(data);
    });
  },

  handleDayStarted(data = {}) {
    const day = this.toDayNumber(data.day, GameState.day);

    if (day !== this.activeDay) {
      this.processedCheckoutKeys.clear();
    }

    this.activeDay = day;
  },

  handleCheckoutCompleted(data = {}) {
    const checkout = this.normalizeCheckout(data);

    if (!checkout.isValid) {
      if (checkout.reason === "day_mismatch") {
        console.warn(
          "[EconomySystem] 매출 처리 스킵: 현재 Day와 계산 요청 Day가 일치하지 않습니다.",
          {
            amount: data.amount,
            requestDay: checkout.requestDay,
            currentDay: checkout.currentDay
          }
        );
      } else {
        console.warn(`[EconomySystem] 매출 처리 실패: ${checkout.reason}`, data);
      }

      return {
        success: false,
        reason: checkout.reason
      };
    }

    const isDuplicate = checkout.checkoutKeys.some((checkoutKey) => {
      return this.processedCheckoutKeys.has(checkoutKey);
    });

    if (isDuplicate) {
      console.warn("[EconomySystem] 이미 처리된 계산입니다.", data);
      return {
        success: false,
        reason: "duplicate_checkout"
      };
    }

    checkout.checkoutKeys.forEach((checkoutKey) => {
      this.processedCheckoutKeys.add(checkoutKey);
    });

    EventBus.emit(EVENTS.REVENUE_CHANGED, {
      checkoutId: checkout.checkoutId,
      day: checkout.day,
      customerId: checkout.customerId,
      wantedProductId: checkout.wantedProductId,
      productId: checkout.product?.id ?? null,
      productName: checkout.product?.name ?? null,
      quantity: checkout.quantity,
      unitPrice: checkout.unitPrice,
      amount: checkout.amount,
      reason: "product_sale"
    });

    return {
      success: true,
      amount: checkout.amount,
      productId: checkout.product?.id ?? null,
      quantity: checkout.quantity
    };
  },

  normalizeCheckout(data = {}) {
    const requestDay = Number(data.day);
    const currentDay = Number(GameState.day);

    if (!Number.isFinite(requestDay) || requestDay !== currentDay) {
      return {
        isValid: false,
        reason: "day_mismatch",
        requestDay,
        currentDay
      };
    }

    const day = currentDay;
    const productId = data.productId ?? data.wantedProductId;
    const requestedAmount = this.toNonNegativeNumber(data.amount);

    if (!productId) {
      if (requestedAmount <= 0) {
        return {
          isValid: false,
          reason: "판매 금액은 0원보다 커야 합니다."
        };
      }

      return {
        isValid: true,
        checkoutKeys: this.createCheckoutKeys(data, day),
        checkoutId: data.checkoutId ?? null,
        day,
        customerId: data.customerId ?? null,
        wantedProductId: null,
        product: null,
        quantity: this.toPositiveInteger(data.quantity) || 1,
        unitPrice: requestedAmount,
        amount: requestedAmount
      };
    }

    const product = getProductById(productId);

    if (!product) {
      return {
        isValid: false,
        reason: "실제 판매 상품을 확인할 수 없습니다."
      };
    }

    if (product.unlockDay > GameState.day) {
      return {
        isValid: false,
        reason: "아직 판매할 수 없는 잠금 상품입니다."
      };
    }

    const quantity = this.toPositiveInteger(data.quantity);

    if (quantity <= 0) {
      return {
        isValid: false,
        reason: "판매 수량은 1개 이상이어야 합니다."
      };
    }

    const checkoutKeys = this.createCheckoutKeys(data, day);

    if (checkoutKeys.length === 0) {
      return {
        isValid: false,
        reason: "checkoutId 또는 customerId가 필요합니다."
      };
    }

    const amount = product.salePrice * quantity;

    if (requestedAmount > 0 && requestedAmount !== amount) {
      console.warn(
        `[EconomySystem] 전달 금액 ${requestedAmount}원 대신 상품 데이터 기준 ${amount}원을 적용합니다.`
      );
    }

    return {
      isValid: true,
      checkoutKeys,
      checkoutId: data.checkoutId ?? null,
      day,
      customerId: data.customerId ?? null,
      wantedProductId: data.wantedProductId ?? product.id,
      product,
      quantity,
      unitPrice: product.salePrice,
      amount
    };
  },

  createCheckoutKeys(data = {}, day = GameState.day) {
    const checkoutKeys = [];

    if (data.checkoutId !== undefined && data.checkoutId !== null) {
      const checkoutId = String(data.checkoutId).trim();

      if (checkoutId) {
        checkoutKeys.push(`${day}:checkout:${checkoutId}`);
      }
    }

    if (data.customerId !== undefined && data.customerId !== null) {
      const customerId = String(data.customerId).trim();

      if (customerId) {
        checkoutKeys.push(`${day}:customer:${customerId}`);
      }
    }

    return checkoutKeys;
  },

  toPositiveInteger(value) {
    const numberValue = Math.floor(Number(value));

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return 0;
    }

    return numberValue;
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
