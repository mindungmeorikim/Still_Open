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
import { BMSystem } from "./BMSystem.js";

export const CURRENCY_EVENTS = Object.freeze({
  CHANGED: "CURRENCY_CHANGED",
  PREMIUM_GRANTED: "PREMIUM_CURRENCY_GRANTED"
});

const CURRENCY_TYPES = Object.freeze({
  GOLD: "gold",
  DIAMOND: "diamond"
});

const ACCOUNT_BM_WALLET_STORAGE_KEY = "today_normal_open_bm_wallet_v1";
const ACCOUNT_BM_WALLET_VERSION = 2;

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

  addCurrency(type, amount, reason = "currency_added", meta = {}) {
    return this.changeCurrency({
      type,
      amount,
      direction: "add",
      reason,
      meta
    });
  },

  spendCurrency(type, amount, reason = "currency_spent", meta = {}) {
    return this.changeCurrency({
      type,
      amount,
      direction: "spend",
      reason,
      meta
    });
  },

  addDiamond(amount, reason = "diamond_added", meta = {}) {
    return this.addCurrency(CURRENCY_TYPES.DIAMOND, amount, reason, meta);
  },

  spendDiamond(amount, reason = "diamond_spent", meta = {}) {
    return this.spendCurrency(CURRENCY_TYPES.DIAMOND, amount, reason, meta);
  },

  addGold(amount, reason = "gold_added", meta = {}) {
    return this.addCurrency(CURRENCY_TYPES.GOLD, amount, reason, meta);
  },

  spendGold(amount, reason = "gold_spent", meta = {}) {
    return this.spendCurrency(CURRENCY_TYPES.GOLD, amount, reason, meta);
  },

  changeCurrency({ type, amount, direction, reason, meta = {} } = {}) {
    const currencyType = this.normalizeCurrencyType(type);
    const normalizedAmount = this.toPositiveInteger(amount);
    const normalizedDirection = direction === "spend" ? "spend" : "add";

    if (!currencyType) {
      return this.currencyFailure("invalid_currency_type", "지원하지 않는 재화 타입입니다.", {
        type,
        amount,
        direction: normalizedDirection,
        reason,
        meta
      });
    }

    if (normalizedAmount <= 0) {
      return this.currencyFailure("invalid_currency_amount", "재화 수량은 1 이상이어야 합니다.", {
        type: currencyType,
        amount,
        direction: normalizedDirection,
        reason,
        meta
      });
    }

    const previousBalances = this.getCurrencyBalances();
    const previousBalance = previousBalances[currencyType] ?? 0;

    if (normalizedDirection === "spend" && previousBalance < normalizedAmount) {
      return this.currencyFailure(`not_enough_${currencyType}`, "보유 재화가 부족합니다.", {
        type: currencyType,
        amount: normalizedAmount,
        balance: previousBalance,
        direction: normalizedDirection,
        reason,
        meta
      });
    }

    const delta = normalizedDirection === "spend" ? -normalizedAmount : normalizedAmount;

    if (currencyType === CURRENCY_TYPES.GOLD) {
      GameState.money = Math.max(0, previousBalance + delta);
    } else if (currencyType === CURRENCY_TYPES.DIAMOND) {
      const bm = this.ensurePremiumWallet();
      bm.diamond = Math.max(0, previousBalance + delta);
      GameState.bmWallet.diamonds = bm.diamond;

      if (normalizedDirection === "add" && meta?.walletBucket === "paid") {
        bm.paidWallet = bm.paidWallet && typeof bm.paidWallet === "object" ? bm.paidWallet : {};
        bm.paidWallet.diamond = this.toNonNegativeInteger(bm.paidWallet.diamond) + normalizedAmount;
      }

      this.persistAccountDiamondWallet(bm.diamond);
    }

    const balances = this.getCurrencyBalances();
    const result = {
      success: true,
      type: currencyType,
      amount: normalizedAmount,
      delta,
      direction: normalizedDirection,
      reason: reason || (normalizedDirection === "spend" ? "currency_spent" : "currency_added"),
      meta: this.cloneMeta(meta),
      previousBalances,
      balances,
      day: GameState.day
    };

    this.emitCurrencyChanged(result);

    return result;
  },

  emitCurrencyChanged(payload = {}) {
    EventBus.emit(CURRENCY_EVENTS.CHANGED, payload);

    if (payload.direction === "add" && payload.type === CURRENCY_TYPES.DIAMOND) {
      EventBus.emit(CURRENCY_EVENTS.PREMIUM_GRANTED, payload);
    }

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  currencyFailure(reason, message, details = {}) {
    return {
      success: false,
      reason,
      message,
      day: GameState.day,
      ...details
    };
  },

  getCurrencyBalance(type) {
    const currencyType = this.normalizeCurrencyType(type);
    if (!currencyType) return 0;
    return this.getCurrencyBalances()[currencyType] ?? 0;
  },

  getCurrencyBalances() {
    const bm = this.ensurePremiumWallet();

    return {
      gold: this.toNonNegativeInteger(GameState.money),
      diamond: this.toNonNegativeInteger(bm.diamond)
    };
  },

  ensurePremiumWallet() {
    if (!GameState.bm || typeof GameState.bm !== "object") {
      GameState.bm = {};
    }

    GameState.bm.diamond = this.toNonNegativeInteger(GameState.bm.diamond);

    if (!GameState.bmWallet || typeof GameState.bmWallet !== "object") {
      GameState.bmWallet = {};
    }

    GameState.bmWallet.diamonds = GameState.bm.diamond;

    return GameState.bm;
  },

  persistAccountDiamondWallet(diamondAmount = 0) {
    try {
      if (!window?.localStorage) return false;

      let storedWallet = {};
      const rawWallet = window.localStorage.getItem(ACCOUNT_BM_WALLET_STORAGE_KEY);

      if (rawWallet) {
        const parsedWallet = JSON.parse(rawWallet);
        if (parsedWallet && typeof parsedWallet === "object") {
          storedWallet = parsedWallet;
        }
      }

      const nextWallet = {
        ...storedWallet,
        diamonds: this.toNonNegativeInteger(diamondAmount),
        accountWalletVersion: ACCOUNT_BM_WALLET_VERSION,
        diamondUpdatedAt: Date.now()
      };

      window.localStorage.setItem(ACCOUNT_BM_WALLET_STORAGE_KEY, JSON.stringify(nextWallet));
      return true;
    } catch (error) {
      console.warn("[EconomySystem] 계정 다이아 지갑 저장 실패", error);
      return false;
    }
  },

  normalizeCurrencyType(type) {
    const normalizedType = String(type ?? "").trim().toLowerCase();

    if (["gold", "money", "cash"].includes(normalizedType)) {
      return CURRENCY_TYPES.GOLD;
    }

    if (["diamond", "diamonds", "dia"].includes(normalizedType)) {
      return CURRENCY_TYPES.DIAMOND;
    }

    return null;
  },

  cloneMeta(meta = {}) {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      return {};
    }

    return { ...meta };
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
      productName: checkout.product ? BMSystem.getProductDisplayName(checkout.product) : null,
      quantity: checkout.quantity,
      unitPrice: checkout.unitPrice,
      baseAmount: checkout.baseAmount,
      revenueMultiplier: checkout.revenueMultiplier,
      bonusAmount: checkout.bonusAmount,
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
    const checkoutKeys = this.createCheckoutKeys(data, day);

    if (checkoutKeys.length === 0) {
      return {
        isValid: false,
        reason: "checkoutId 또는 customerId가 필요합니다."
      };
    }

    if (!productId) {
      if (requestedAmount <= 0) {
        return {
          isValid: false,
          reason: "판매 금액은 0원보다 커야 합니다."
        };
      }

      return {
        isValid: true,
        checkoutKeys,
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

    if (!BMSystem.canSellProduct(product.id)) {
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

    const revenueMultiplier = BMSystem.getRevenueMultiplier();
    const unitPrice = BMSystem.getProductSalePrice(product.id) || product.salePrice;
    const baseAmount = unitPrice * quantity;
    const amount = Math.floor(baseAmount * revenueMultiplier);
    const bonusAmount = Math.max(0, amount - baseAmount);

    if (requestedAmount > 0 && requestedAmount !== amount) {
      console.warn(
        `[EconomySystem] 전달 금액 ${requestedAmount}원 대신 상품 데이터 기준 ${amount}원을 적용합니다.`,
        {
          baseAmount,
          revenueMultiplier,
          bonusAmount
        }
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
      unitPrice,
      baseAmount,
      revenueMultiplier,
      bonusAmount,
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

  toNonNegativeInteger(value) {
    const numberValue = Math.floor(Number(value));

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
