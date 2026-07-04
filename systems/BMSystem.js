/*
  BMSystem.js

  역할:
  - BM 상태 초기화
  - 상품 판매권 상점 해금 관리
  - 판매권 보유/구역 해금/프리미엄 구매 여부 판정
  - 판매권 구매 요청 처리

  규칙:
  - 다른 시스템 직접 호출 금지
  - 날짜 계산은 GameState.day 기준 사용
  - new Date(), Date.now() 사용 금지
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { PRODUCTS, getProductById } from "../data/ProductData.js";

export const BM_EVENTS = Object.freeze({
  STATE_CHANGED: "BM_STATE_CHANGED",
  CONTRACT_SHOP_UNLOCKED: "BM_CONTRACT_SHOP_UNLOCKED",
  CONTRACT_PURCHASE_REQUESTED: "BM_CONTRACT_PURCHASE_REQUESTED",
  CONTRACT_PURCHASED: "BM_CONTRACT_PURCHASED",
  CONTRACT_PURCHASE_FAILED: "BM_CONTRACT_PURCHASE_FAILED",
  PREMIUM_PRODUCT_PURCHASE_REQUESTED: "BM_PREMIUM_PRODUCT_PURCHASE_REQUESTED",
  PREMIUM_PRODUCT_PURCHASED: "BM_PREMIUM_PRODUCT_PURCHASED",
  PREMIUM_PRODUCT_PURCHASE_FAILED: "BM_PREMIUM_PRODUCT_PURCHASE_FAILED",
  DIAMOND_REWARD_GRANTED: "BM_DIAMOND_REWARD_GRANTED",
  DIAMOND_REWARD_FAILED: "BM_DIAMOND_REWARD_FAILED",
  CONTRACT_UNLOCK_SKIP_REQUESTED: "BM_CONTRACT_UNLOCK_SKIP_REQUESTED",
  CONTRACT_UNLOCK_SKIPPED: "BM_CONTRACT_UNLOCK_SKIPPED",
  CONTRACT_UNLOCK_SKIP_FAILED: "BM_CONTRACT_UNLOCK_SKIP_FAILED",
  PEAK_COUPON_USE_REQUESTED: "BM_PEAK_COUPON_USE_REQUESTED",
  PEAK_COUPON_ACTIVATED: "BM_PEAK_COUPON_ACTIVATED",
  PEAK_COUPON_FAILED: "BM_PEAK_COUPON_FAILED",
  PEAK_COUPON_EXPIRED: "BM_PEAK_COUPON_EXPIRED"
});

const BASIC_PRODUCT_IDS = Object.freeze(["potato_chips", "water"]);
const AD_DIAMOND_REWARD_AMOUNT = 10;
const MENTAL_RECOVERY_AD_AMOUNT = 20;
const CONTRACT_UNLOCK_BATCH_SIZE = 2;
const CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE = 50;
const CONTRACT_UNLOCK_SKIP_COOLDOWN_DAYS = 3;
const PEAK_COUPON_DIAMOND_PRICE = 20;
const PEAK_COUPON_DURATION_SECONDS = 60;
const PEAK_COUPON_REVENUE_MULTIPLIER = 1.5;

const createUniqueArray = (values = []) => {
  return [...new Set(
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
  )];
};

export const BMSystem = {
  isInitialized: false,
  peakCouponTimerId: null,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.ensureBMState();
    this.unlockAvailableContractsForDay(GameState.day, {
      source: "bm_system_init",
      emitWhenEmpty: false
    });

    EventBus.on(EVENTS.DAY_STARTED, (data = {}) => {
      this.handleDayStarted(data);
    });

    EventBus.on(BM_EVENTS.CONTRACT_PURCHASE_REQUESTED, (data = {}) => {
      this.handleContractPurchaseRequested(data);
    });

    EventBus.on(BM_EVENTS.PREMIUM_PRODUCT_PURCHASE_REQUESTED, (data = {}) => {
      this.handlePremiumProductPurchaseRequested(data);
    });

    EventBus.on(BM_EVENTS.CONTRACT_UNLOCK_SKIP_REQUESTED, (data = {}) => {
      this.handleContractUnlockSkipRequested(data);
    });

    EventBus.on(BM_EVENTS.PEAK_COUPON_USE_REQUESTED, (data = {}) => {
      this.handlePeakCouponUseRequested(data);
    });

    EventBus.on(EVENTS.STORE_CLOSED, () => {
      this.deactivatePeakCoupon("store_closed");
    });

    this.emitStateChanged("bm_system_initialized");
  },

  ensureBMState() {
    if (!GameState.bm || typeof GameState.bm !== "object") {
      GameState.bm = {};
    }

    const bm = GameState.bm;

    bm.diamond = this.toNonNegativeInteger(bm.diamond);
    bm.ownedContractProductIds = createUniqueArray([
      ...BASIC_PRODUCT_IDS,
      ...(bm.ownedContractProductIds ?? [])
    ]);
    bm.shopUnlockedContractProductIds = createUniqueArray(
      bm.shopUnlockedContractProductIds ?? []
    );
    bm.purchasedPremiumProductIds = createUniqueArray(
      bm.purchasedPremiumProductIds ?? []
    );
    bm.lastContractUnlockDay =
      bm.lastContractUnlockDay === null || bm.lastContractUnlockDay === undefined
        ? null
        : this.toDayNumber(bm.lastContractUnlockDay, null);
    bm.contractSkipUsedDay =
      bm.contractSkipUsedDay === null || bm.contractSkipUsedDay === undefined
        ? null
        : this.toDayNumber(bm.contractSkipUsedDay, null);
    bm.peakCouponUsedDay =
      bm.peakCouponUsedDay === null || bm.peakCouponUsedDay === undefined
        ? null
        : this.toDayNumber(bm.peakCouponUsedDay, null);
    bm.mentalRecoveryAdUsedDay =
      bm.mentalRecoveryAdUsedDay === null || bm.mentalRecoveryAdUsedDay === undefined
        ? null
        : this.toDayNumber(bm.mentalRecoveryAdUsedDay, null);
    bm.peakCouponActive = bm.peakCouponActive === true;
    bm.peakCouponMultiplier = bm.peakCouponActive
      ? PEAK_COUPON_REVENUE_MULTIPLIER
      : 1;

    return bm;
  },

  handleDayStarted(data = {}) {
    const day = this.toDayNumber(data.day, GameState.day);

    this.unlockAvailableContractsForDay(day, {
      source: "day_started",
      emitWhenEmpty: false
    });
  },

  unlockAvailableContractsForDay(day = GameState.day, options = {}) {
    const bm = this.ensureBMState();
    const safeDay = this.toDayNumber(day, GameState.day);
    const unlockedProductIds = [];

    this.getContractUnlockQueue().forEach((product) => {
      if (product.unlockDay > safeDay) return;
      if (bm.shopUnlockedContractProductIds.includes(product.id)) return;

      bm.shopUnlockedContractProductIds.push(product.id);
      unlockedProductIds.push(product.id);
    });

    if (unlockedProductIds.length > 0) {
      bm.shopUnlockedContractProductIds = createUniqueArray(
        bm.shopUnlockedContractProductIds
      );
      bm.lastContractUnlockDay = safeDay;

      const payload = this.createStatePayload("contract_shop_unlocked", {
        source: options.source ?? "unlock_available_contracts",
        unlockedProductIds,
        unlockedProducts: unlockedProductIds.map((productId) => {
          return this.createContractProductPayload(getProductById(productId));
        })
      });

      EventBus.emit(BM_EVENTS.CONTRACT_SHOP_UNLOCKED, payload);
      this.emitStateChanged("contract_shop_unlocked", payload);
      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
      return unlockedProductIds;
    }

    if (options.emitWhenEmpty === true) {
      this.emitStateChanged("no_contract_shop_unlocks", {
        source: options.source ?? "unlock_available_contracts",
        unlockedProductIds
      });
    }

    return unlockedProductIds;
  },

  handleContractPurchaseRequested(data = {}) {
    const productId = data.productId;
    const result = this.purchaseContract(productId, {
      source: data.source ?? "contract_purchase_requested"
    });

    if (result.success) {
      EventBus.emit(BM_EVENTS.CONTRACT_PURCHASED, result);
      return result;
    }

    EventBus.emit(BM_EVENTS.CONTRACT_PURCHASE_FAILED, result);
    return result;
  },

  handlePremiumProductPurchaseRequested(data = {}) {
    const productId = data.productId;
    const result = this.purchasePremiumProduct(productId, {
      source: data.source ?? "premium_product_purchase_requested"
    });

    if (result.success) {
      EventBus.emit(BM_EVENTS.PREMIUM_PRODUCT_PURCHASED, result);
      return result;
    }

    EventBus.emit(BM_EVENTS.PREMIUM_PRODUCT_PURCHASE_FAILED, result);
    return result;
  },

  handleContractUnlockSkipRequested(data = {}) {
    const result = this.purchaseContractUnlockSkip({
      source: data.source ?? "contract_unlock_skip_requested"
    });

    if (result.success) {
      EventBus.emit(BM_EVENTS.CONTRACT_UNLOCK_SKIPPED, result);
      return result;
    }

    EventBus.emit(BM_EVENTS.CONTRACT_UNLOCK_SKIP_FAILED, result);
    return result;
  },

  handlePeakCouponUseRequested(data = {}) {
    const result = this.usePeakCoupon({
      source: data.source ?? "peak_coupon_use_requested"
    });

    if (result.success) {
      EventBus.emit(BM_EVENTS.PEAK_COUPON_ACTIVATED, result);
      return result;
    }

    EventBus.emit(BM_EVENTS.PEAK_COUPON_FAILED, result);
    return result;
  },

  grantDiamond(amount = AD_DIAMOND_REWARD_AMOUNT, options = {}) {
    const bm = this.ensureBMState();
    const rewardAmount = this.toNonNegativeInteger(amount);

    if (rewardAmount <= 0) {
      const result = this.createDiamondRewardResult(false, "invalid_amount", {
        message: "받을 수 있는 다이아 보상이 없습니다.",
        source: options.source ?? "grant_diamond",
        amount: 0,
        remainingDiamond: bm.diamond
      });

      EventBus.emit(BM_EVENTS.DIAMOND_REWARD_FAILED, result);
      return result;
    }

    bm.diamond += rewardAmount;

    const result = this.createDiamondRewardResult(true, "granted", {
      message: `다이아 ${rewardAmount.toLocaleString("ko-KR")}개를 받았습니다.`,
      source: options.source ?? "grant_diamond",
      amount: rewardAmount,
      remainingDiamond: bm.diamond
    });

    EventBus.emit(BM_EVENTS.DIAMOND_REWARD_GRANTED, result);
    this.emitStateChanged("diamond_reward_granted", result);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return result;
  },

  getAdDiamondRewardAmount() {
    return AD_DIAMOND_REWARD_AMOUNT;
  },

  getMentalRecoveryAdAmount() {
    return MENTAL_RECOVERY_AD_AMOUNT;
  },

  isMentalRecoveryAdUsedToday(day = GameState.day) {
    const bm = this.ensureBMState();
    const safeDay = this.toDayNumber(day, GameState.day);

    return bm.mentalRecoveryAdUsedDay === safeDay;
  },

  recordMentalRecoveryAdUse(day = GameState.day) {
    const bm = this.ensureBMState();

    bm.mentalRecoveryAdUsedDay = this.toDayNumber(day, GameState.day);

    return bm.mentalRecoveryAdUsedDay;
  },

  purchaseContract(productId, options = {}) {
    const bm = this.ensureBMState();
    const product = getProductById(productId);
    const validation = this.validateContractPurchase(product);

    if (!validation.success) {
      return this.createPurchaseResult(false, product, validation.reason, {
        message: validation.message,
        source: options.source ?? "purchase_contract"
      });
    }

    const contractCost = this.toNonNegativeInteger(product.contractCost);

    GameState.money -= contractCost;
    bm.ownedContractProductIds = createUniqueArray([
      ...bm.ownedContractProductIds,
      product.id
    ]);

    const result = this.createPurchaseResult(true, product, "purchased", {
      message: `${product.name} 판매권을 구매했습니다.`,
      source: options.source ?? "purchase_contract",
      spentGold: contractCost,
      remainingMoney: GameState.money
    });

    this.emitStateChanged("contract_purchased", result);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return result;
  },

  validateContractPurchase(product) {
    if (!product) {
      return {
        success: false,
        reason: "invalid_product",
        message: "존재하지 않는 상품입니다."
      };
    }

    if (product.isPremiumBM === true) {
      return {
        success: false,
        reason: "premium_product",
        message: "프리미엄 BM 상품은 골드 판매권 구매 대상이 아닙니다."
      };
    }

    if (this.isBasicProduct(product.id)) {
      return {
        success: false,
        reason: "basic_product",
        message: "기본 제공 상품은 별도 판매권이 필요 없습니다."
      };
    }

    if (this.hasProductContract(product.id)) {
      return {
        success: false,
        reason: "already_owned",
        message: "이미 보유 중인 판매권입니다."
      };
    }

    if (!this.isContractShopUnlocked(product.id)) {
      return {
        success: false,
        reason: "contract_shop_locked",
        message: "아직 상점에 해금되지 않은 판매권입니다."
      };
    }

    const contractCost = this.toNonNegativeInteger(product.contractCost);

    if (contractCost <= 0) {
      return {
        success: false,
        reason: "invalid_contract_cost",
        message: "판매권 가격이 설정되지 않은 상품입니다."
      };
    }

    if (GameState.money < contractCost) {
      return {
        success: false,
        reason: "not_enough_gold",
        message: `골드가 부족합니다. 필요 골드: ${contractCost.toLocaleString("ko-KR")}`
      };
    }

    return {
      success: true,
      reason: "available",
      message: "판매권 구매가 가능합니다."
    };
  },

  purchasePremiumProduct(productId, options = {}) {
    const bm = this.ensureBMState();
    const product = getProductById(productId);
    const validation = this.validatePremiumProductPurchase(product);

    if (!validation.success) {
      return this.createPremiumPurchaseResult(false, product, validation.reason, {
        message: validation.message,
        source: options.source ?? "purchase_premium_product"
      });
    }

    const diamondPrice = this.toNonNegativeInteger(product.diamondPrice);

    bm.diamond -= diamondPrice;
    bm.purchasedPremiumProductIds = createUniqueArray([
      ...bm.purchasedPremiumProductIds,
      product.id
    ]);

    const result = this.createPremiumPurchaseResult(true, product, "purchased", {
      message: `${product.name} 프리미엄 상품을 구매했습니다.`,
      source: options.source ?? "purchase_premium_product",
      spentDiamond: diamondPrice,
      remainingDiamond: bm.diamond
    });

    this.emitStateChanged("premium_product_purchased", result);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return result;
  },

  validatePremiumProductPurchase(product) {
    if (!product) {
      return {
        success: false,
        reason: "invalid_product",
        message: "존재하지 않는 상품입니다."
      };
    }

    if (product.isPremiumBM !== true) {
      return {
        success: false,
        reason: "not_premium_product",
        message: "프리미엄 BM 상품이 아닙니다."
      };
    }

    if (this.isPremiumProductPurchased(product.id)) {
      return {
        success: false,
        reason: "already_purchased",
        message: "이미 구매한 프리미엄 상품입니다."
      };
    }

    if (!this.isZoneUnlocked(product.requiredZoneId)) {
      return {
        success: false,
        reason: "zone_locked",
        message: "해당 상품이 배치된 구역 해금이 필요합니다."
      };
    }

    const diamondPrice = this.toNonNegativeInteger(product.diamondPrice);

    if (diamondPrice <= 0) {
      return {
        success: false,
        reason: "invalid_diamond_price",
        message: "프리미엄 상품 다이아 가격이 설정되지 않았습니다."
      };
    }

    const bm = this.ensureBMState();

    if (bm.diamond < diamondPrice) {
      return {
        success: false,
        reason: "not_enough_diamond",
        message: `다이아가 부족합니다. 필요 다이아: ${diamondPrice.toLocaleString("ko-KR")}`
      };
    }

    return {
      success: true,
      reason: "available",
      message: "프리미엄 상품 구매가 가능합니다."
    };
  },

  purchaseContractUnlockSkip(options = {}) {
    const bm = this.ensureBMState();
    const validation = this.validateContractUnlockSkip();

    if (!validation.success) {
      return this.createContractUnlockSkipResult(false, validation.reason, {
        message: validation.message,
        source: options.source ?? "purchase_contract_unlock_skip"
      });
    }

    const unlockedProducts = this.getNextContractUnlockProducts();
    const unlockedProductIds = unlockedProducts.map((product) => product.id);

    bm.diamond -= CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE;
    bm.contractSkipUsedDay = GameState.day;
    bm.shopUnlockedContractProductIds = createUniqueArray([
      ...bm.shopUnlockedContractProductIds,
      ...unlockedProductIds
    ]);
    bm.lastContractUnlockDay = GameState.day;

    const result = this.createContractUnlockSkipResult(true, "skipped", {
      message: `판매권 ${unlockedProductIds.length}종이 상점에 즉시 해금되었습니다.`,
      source: options.source ?? "purchase_contract_unlock_skip",
      spentDiamond: CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE,
      remainingDiamond: bm.diamond,
      unlockedProductIds,
      unlockedProducts: unlockedProducts.map((product) => {
        return this.createContractProductPayload(product);
      })
    });

    EventBus.emit(BM_EVENTS.CONTRACT_SHOP_UNLOCKED, result);
    this.emitStateChanged("contract_unlock_skipped", result);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return result;
  },

  validateContractUnlockSkip() {
    const bm = this.ensureBMState();
    const nextProducts = this.getNextContractUnlockProducts();

    if (nextProducts.length === 0) {
      return {
        success: false,
        reason: "no_contracts_to_unlock",
        message: "해금 대기 중인 판매권이 없습니다."
      };
    }

    if (
      bm.contractSkipUsedDay !== null &&
      GameState.day - bm.contractSkipUsedDay < CONTRACT_UNLOCK_SKIP_COOLDOWN_DAYS
    ) {
      const nextAvailableDay =
        bm.contractSkipUsedDay + CONTRACT_UNLOCK_SKIP_COOLDOWN_DAYS;

      return {
        success: false,
        reason: "cooldown",
        message: `스킵권은 Day ${nextAvailableDay}부터 다시 사용할 수 있습니다.`
      };
    }

    if (bm.diamond < CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE) {
      return {
        success: false,
        reason: "not_enough_diamond",
        message: `다이아가 부족합니다. 필요 다이아: ${CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE}`
      };
    }

    return {
      success: true,
      reason: "available",
      message: "판매권 해금 대기일 스킵권을 사용할 수 있습니다."
    };
  },

  usePeakCoupon(options = {}) {
    const bm = this.ensureBMState();
    const validation = this.validatePeakCouponUse();

    if (!validation.success) {
      return this.createPeakCouponResult(false, validation.reason, {
        message: validation.message,
        source: options.source ?? "use_peak_coupon"
      });
    }

    bm.diamond -= PEAK_COUPON_DIAMOND_PRICE;
    bm.peakCouponUsedDay = GameState.day;
    bm.peakCouponActive = true;
    bm.peakCouponMultiplier = PEAK_COUPON_REVENUE_MULTIPLIER;

    this.clearPeakCouponTimer();

    const durationSeconds = Math.max(
      1,
      Math.floor(Number(options.durationSeconds) || PEAK_COUPON_DURATION_SECONDS)
    );

    this.peakCouponTimerId = setTimeout(() => {
      this.deactivatePeakCoupon("duration_finished");
    }, durationSeconds * 1000);
    this.peakCouponTimerId?.unref?.();

    const result = this.createPeakCouponResult(true, "activated", {
      message: `피크타임 쿠폰 사용! ${durationSeconds}초 동안 매출이 1.5배 적용됩니다.`,
      source: options.source ?? "use_peak_coupon",
      spentDiamond: PEAK_COUPON_DIAMOND_PRICE,
      remainingDiamond: bm.diamond,
      durationSeconds,
      revenueMultiplier: PEAK_COUPON_REVENUE_MULTIPLIER
    });

    this.emitStateChanged("peak_coupon_activated", result);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return result;
  },

  validatePeakCouponUse() {
    const bm = this.ensureBMState();

    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) {
      return {
        success: false,
        reason: "invalid_phase",
        message: "피크타임 쿠폰은 영업 중에만 사용할 수 있습니다."
      };
    }

    if (bm.peakCouponActive === true) {
      return {
        success: false,
        reason: "already_active",
        message: "피크타임 쿠폰 효과가 이미 적용 중입니다."
      };
    }

    if (bm.peakCouponUsedDay === GameState.day) {
      return {
        success: false,
        reason: "already_used_today",
        message: "피크타임 쿠폰은 하루 1회만 사용할 수 있습니다."
      };
    }

    if (bm.diamond < PEAK_COUPON_DIAMOND_PRICE) {
      return {
        success: false,
        reason: "not_enough_diamond",
        message: `다이아가 부족합니다. 필요 다이아: ${PEAK_COUPON_DIAMOND_PRICE}`
      };
    }

    return {
      success: true,
      reason: "available",
      message: "피크타임 쿠폰을 사용할 수 있습니다."
    };
  },

  deactivatePeakCoupon(reason = "expired") {
    const bm = this.ensureBMState();

    this.clearPeakCouponTimer();

    if (bm.peakCouponActive !== true) {
      return false;
    }

    bm.peakCouponActive = false;
    bm.peakCouponMultiplier = 1;

    const result = this.createPeakCouponResult(true, reason, {
      message: "피크타임 쿠폰 효과가 종료되었습니다.",
      source: reason,
      durationSeconds: 0,
      revenueMultiplier: 1
    });

    EventBus.emit(BM_EVENTS.PEAK_COUPON_EXPIRED, result);
    this.emitStateChanged("peak_coupon_expired", result);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return true;
  },

  clearPeakCouponTimer() {
    if (!this.peakCouponTimerId) return;

    clearTimeout(this.peakCouponTimerId);
    this.peakCouponTimerId = null;
  },

  getRevenueMultiplier() {
    const bm = this.ensureBMState();

    return bm.peakCouponActive === true
      ? PEAK_COUPON_REVENUE_MULTIPLIER
      : 1;
  },

  hasProductContract(productId) {
    const bm = this.ensureBMState();

    if (this.isBasicProduct(productId)) {
      return true;
    }

    return bm.ownedContractProductIds.includes(productId);
  },

  isContractShopUnlocked(productId) {
    const bm = this.ensureBMState();

    return bm.shopUnlockedContractProductIds.includes(productId);
  },

  isPremiumProductPurchased(productId) {
    const bm = this.ensureBMState();

    return bm.purchasedPremiumProductIds.includes(productId);
  },

  isZoneUnlocked(requiredZoneId) {
    if (!requiredZoneId) {
      return false;
    }

    const unlockedZoneIds = Array.isArray(GameState.expansion?.unlockedZoneIds)
      ? GameState.expansion.unlockedZoneIds
      : [];

    return unlockedZoneIds.includes(requiredZoneId);
  },

  canSellProduct(productId) {
    const product = getProductById(productId);

    if (!product) return false;
    if (!this.isZoneUnlocked(product.requiredZoneId)) return false;

    if (product.isPremiumBM === true) {
      return this.isPremiumProductPurchased(product.id);
    }

    return this.hasProductContract(product.id);
  },

  canOrderProduct(productId) {
    return this.canSellProduct(productId);
  },

  getProductLockReason(productId) {
    const product = getProductById(productId);

    if (!product) {
      return {
        code: "invalid_product",
        message: "존재하지 않는 상품입니다."
      };
    }

    if (!this.isZoneUnlocked(product.requiredZoneId)) {
      return {
        code: "zone_locked",
        message: "상품이 배치된 구역 해금이 필요합니다."
      };
    }

    if (product.isPremiumBM === true) {
      if (this.isPremiumProductPurchased(product.id)) {
        return {
          code: "unlocked",
          message: "프리미엄 상품 구매 완료"
        };
      }

      return {
        code: "premium_not_purchased",
        message: `${product.diamondPrice.toLocaleString("ko-KR")} 다이아 구매 필요`
      };
    }

    if (this.hasProductContract(product.id)) {
      return {
        code: "unlocked",
        message: "판매 가능"
      };
    }

    if (!this.isContractShopUnlocked(product.id)) {
      return {
        code: "contract_shop_locked",
        message: "판매권 상점 해금 대기 중"
      };
    }

    return {
      code: "contract_not_owned",
      message: `${product.contractCost.toLocaleString("ko-KR")} 골드 판매권 구매 필요`
    };
  },

  getBMState() {
    const bm = this.ensureBMState();

    return {
      day: GameState.day,
      diamond: bm.diamond,
      ownedContractProductIds: [...bm.ownedContractProductIds],
      shopUnlockedContractProductIds: [...bm.shopUnlockedContractProductIds],
      purchasedPremiumProductIds: [...bm.purchasedPremiumProductIds],
      lastContractUnlockDay: bm.lastContractUnlockDay,
      contractSkipUsedDay: bm.contractSkipUsedDay,
      peakCouponUsedDay: bm.peakCouponUsedDay,
      mentalRecoveryAdUsedDay: bm.mentalRecoveryAdUsedDay,
      contractShopProducts: this.getShopUnlockedContractProducts().map((product) => {
        return this.createContractProductPayload(product);
      }),
      ownedContractProducts: this.getOwnedContractProducts().map((product) => {
        return this.createContractProductPayload(product);
      }),
      nextContractUnlockProducts: this.getNextContractUnlockProducts().map((product) => {
        return this.createContractProductPayload(product);
      }),
      premiumProducts: this.getPremiumProducts().map((product) => {
        return this.createPremiumProductPayload(product);
      }),
      contractUnlockSkip: this.getContractUnlockSkipState(),
      peakCoupon: this.getPeakCouponState()
    };
  },

  getContractProducts() {
    return PRODUCTS.filter((product) => {
      return (
        product.isPremiumBM !== true &&
        !this.isBasicProduct(product.id) &&
        this.toNonNegativeInteger(product.contractCost) > 0
      );
    });
  },

  getContractUnlockQueue() {
    return this.getContractProducts().sort((first, second) => {
      if (first.unlockDay !== second.unlockDay) {
        return first.unlockDay - second.unlockDay;
      }

      return PRODUCTS.indexOf(first) - PRODUCTS.indexOf(second);
    });
  },

  getShopUnlockedContractProducts() {
    const bm = this.ensureBMState();
    const unlockedIds = new Set(bm.shopUnlockedContractProductIds);

    return this.getContractUnlockQueue().filter((product) => {
      return unlockedIds.has(product.id);
    });
  },

  getOwnedContractProducts() {
    const bm = this.ensureBMState();
    const ownedIds = new Set(bm.ownedContractProductIds);

    return PRODUCTS.filter((product) => {
      return ownedIds.has(product.id);
    });
  },

  getNextContractUnlockProducts() {
    const bm = this.ensureBMState();

    return this.getContractUnlockQueue()
      .filter((product) => {
        return !bm.shopUnlockedContractProductIds.includes(product.id);
      })
      .slice(0, CONTRACT_UNLOCK_BATCH_SIZE);
  },

  getPremiumProducts() {
    return PRODUCTS.filter((product) => {
      return product.isPremiumBM === true;
    });
  },

  getContractUnlockSkipState() {
    const bm = this.ensureBMState();
    const nextProducts = this.getNextContractUnlockProducts();
    const validation = this.validateContractUnlockSkip();

    return {
      priceDiamond: CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE,
      cooldownDays: CONTRACT_UNLOCK_SKIP_COOLDOWN_DAYS,
      lastUsedDay: bm.contractSkipUsedDay,
      canUse: validation.success,
      reason: validation.reason,
      message: validation.message,
      nextProductIds: nextProducts.map((product) => product.id),
      nextProducts: nextProducts.map((product) => {
        return this.createContractProductPayload(product);
      })
    };
  },

  getPeakCouponState() {
    const bm = this.ensureBMState();
    const validation = this.validatePeakCouponUse();

    return {
      priceDiamond: PEAK_COUPON_DIAMOND_PRICE,
      durationSeconds: PEAK_COUPON_DURATION_SECONDS,
      revenueMultiplier: PEAK_COUPON_REVENUE_MULTIPLIER,
      usedDay: bm.peakCouponUsedDay,
      isActive: bm.peakCouponActive === true,
      canUse: validation.success,
      reason: validation.reason,
      message: validation.message
    };
  },

  createStatePayload(reason, details = {}) {
    return {
      reason,
      ...details,
      bmState: this.getBMState()
    };
  },

  createPurchaseResult(success, product, reason, details = {}) {
    return {
      success,
      reason,
      day: GameState.day,
      productId: product?.id ?? null,
      productName: product?.name ?? "",
      contractCost: this.toNonNegativeInteger(product?.contractCost),
      ...details,
      bmState: this.getBMState()
    };
  },

  createPremiumPurchaseResult(success, product, reason, details = {}) {
    return {
      success,
      reason,
      day: GameState.day,
      productId: product?.id ?? null,
      productName: product?.name ?? "",
      diamondPrice: this.toNonNegativeInteger(product?.diamondPrice),
      ...details,
      bmState: this.getBMState()
    };
  },

  createContractUnlockSkipResult(success, reason, details = {}) {
    return {
      success,
      reason,
      day: GameState.day,
      priceDiamond: CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE,
      ...details,
      bmState: this.getBMState()
    };
  },

  createPeakCouponResult(success, reason, details = {}) {
    return {
      success,
      reason,
      day: GameState.day,
      priceDiamond: PEAK_COUPON_DIAMOND_PRICE,
      ...details,
      bmState: this.getBMState()
    };
  },

  createDiamondRewardResult(success, reason, details = {}) {
    return {
      success,
      reason,
      day: GameState.day,
      ...details,
      bmState: this.getBMState()
    };
  },

  createContractProductPayload(product) {
    if (!product) return null;

    return {
      productId: product.id,
      productName: product.name,
      finalName: product.finalName,
      requiredZoneId: product.requiredZoneId,
      displayCategory: product.displayCategory,
      contractCost: this.toNonNegativeInteger(product.contractCost),
      unlockDay: this.toDayNumber(product.unlockDay, GameState.day),
      isOwned: this.hasProductContract(product.id),
      isShopUnlocked: this.isContractShopUnlocked(product.id)
    };
  },

  createPremiumProductPayload(product) {
    if (!product) return null;

    return {
      productId: product.id,
      productName: product.name,
      finalName: product.finalName,
      requiredZoneId: product.requiredZoneId,
      displayCategory: product.displayCategory,
      diamondPrice: this.toNonNegativeInteger(product.diamondPrice),
      isPurchased: this.isPremiumProductPurchased(product.id),
      isZoneUnlocked: this.isZoneUnlocked(product.requiredZoneId)
    };
  },

  emitStateChanged(reason, details = {}) {
    EventBus.emit(BM_EVENTS.STATE_CHANGED, this.createStatePayload(reason, details));
  },

  isBasicProduct(productId) {
    return BASIC_PRODUCT_IDS.includes(productId);
  },

  toNonNegativeInteger(value) {
    const numberValue = Math.floor(Number(value) || 0);

    return Math.max(0, numberValue);
  },

  toDayNumber(value, fallback = GameState.day) {
    const day = Math.floor(Number(value));

    if (!Number.isFinite(day) || day < 1) {
      return fallback;
    }

    return day;
  }
};
