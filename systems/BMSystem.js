/*
  BMSystem.js
  BM 최종본 기준 상점/재화/편의상품/강화 시스템.
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { PRODUCTS, getProductById, PRODUCT_UPGRADE_TYPES, PRODUCT_DISPLAY_CATEGORIES } from "../data/ProductData.js";

export const BM_EVENTS = Object.freeze({
  STATE_CHANGED: "BM_STATE_CHANGED",
  CONTRACT_SHOP_UNLOCKED: "BM_CONTRACT_SHOP_UNLOCKED",
  CONTRACT_PURCHASE_REQUESTED: "BM_CONTRACT_PURCHASE_REQUESTED",
  CONTRACT_PURCHASED: "BM_CONTRACT_PURCHASED",
  CONTRACT_PURCHASE_FAILED: "BM_CONTRACT_PURCHASE_FAILED",
  PREMIUM_PRODUCT_PURCHASE_REQUESTED: "BM_PREMIUM_PRODUCT_PURCHASE_REQUESTED",
  PREMIUM_PRODUCT_PURCHASED: "BM_PREMIUM_PRODUCT_PURCHASED",
  PREMIUM_PRODUCT_PURCHASE_FAILED: "BM_PREMIUM_PRODUCT_PURCHASE_FAILED",
  CONTRACT_UNLOCK_SKIP_REQUESTED: "BM_CONTRACT_UNLOCK_SKIP_REQUESTED",
  CONTRACT_UNLOCK_SKIPPED: "BM_CONTRACT_UNLOCK_SKIPPED",
  CONTRACT_UNLOCK_SKIP_FAILED: "BM_CONTRACT_UNLOCK_SKIP_FAILED",
  DIAMOND_PRODUCT_PURCHASE_REQUESTED: "BM_DIAMOND_PRODUCT_PURCHASE_REQUESTED",
  DIAMOND_PRODUCT_PURCHASED: "BM_DIAMOND_PRODUCT_PURCHASED",
  GOLD_PRODUCT_PURCHASE_REQUESTED: "BM_GOLD_PRODUCT_PURCHASE_REQUESTED",
  GOLD_PRODUCT_PURCHASED: "BM_GOLD_PRODUCT_PURCHASED",
  SHOP_PURCHASE_FAILED: "BM_SHOP_PURCHASE_FAILED",
  AD_REWARD_REQUESTED: "BM_AD_REWARD_REQUESTED",
  AD_REWARD_CLAIMED: "BM_AD_REWARD_CLAIMED",
  AD_REWARD_FAILED: "BM_AD_REWARD_FAILED",
  PEAK_COUPON_PURCHASE_REQUESTED: "BM_PEAK_COUPON_PURCHASE_REQUESTED",
  PEAK_COUPON_PURCHASED: "BM_PEAK_COUPON_PURCHASED",
  PEAK_COUPON_USE_REQUESTED: "BM_PEAK_COUPON_USE_REQUESTED",
  PEAK_COUPON_ACTIVATED: "BM_PEAK_COUPON_ACTIVATED",
  PEAK_COUPON_FAILED: "BM_PEAK_COUPON_FAILED",
  PEAK_COUPON_EXPIRED: "BM_PEAK_COUPON_EXPIRED",
  WAREHOUSE_UPGRADE_REQUESTED: "BM_WAREHOUSE_UPGRADE_REQUESTED",
  WAREHOUSE_UPGRADED: "BM_WAREHOUSE_UPGRADED",
  SHELF_UPGRADE_REQUESTED: "BM_SHELF_UPGRADE_REQUESTED",
  SHELF_UPGRADED: "BM_SHELF_UPGRADED",
  PRODUCT_UPGRADE_REQUESTED: "BM_PRODUCT_UPGRADE_REQUESTED",
  PRODUCT_UPGRADED: "BM_PRODUCT_UPGRADED",
  STAFF_ABILITY_UPGRADE_REQUESTED: "BM_STAFF_ABILITY_UPGRADE_REQUESTED",
  STAFF_ABILITY_UPGRADED: "BM_STAFF_ABILITY_UPGRADED"
});

const BASIC_PRODUCT_IDS = Object.freeze(["potato_chips", "water"]);
const CONTRACT_UNLOCK_BATCH_SIZE = 2;
const CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE = 50;
const CONTRACT_UNLOCK_SKIP_COOLDOWN_DAYS = 3;
const PEAK_COUPON_DIAMOND_PRICE = 20;
const PEAK_COUPON_DISCOUNT_PRICE = 10;
const PEAK_COUPON_DURATION_SECONDS = 60;
const PEAK_COUPON_REVENUE_MULTIPLIER = 1.5;
const STAFF_ABILITY_UPGRADE_DIAMOND_PRICE = 80;
const STAFF_ABILITY_MAX_TOTAL_UPGRADES = 5;
const STAFF_ABILITY_UPGRADE_COOLDOWN_DAYS = 7;

const DIAMOND_PRODUCTS = Object.freeze([
  Object.freeze({ id: "diamond_100", name: "다이아 100개", priceWon: 1000, diamondAmount: 100, discountRate: 0 }),
  Object.freeze({ id: "diamond_3000", name: "다이아 315개", priceWon: 3000, diamondAmount: 315, discountRate: 5 }),
  Object.freeze({ id: "diamond_5000", name: "다이아 525개", priceWon: 5000, diamondAmount: 525, discountRate: 5 }),
  Object.freeze({ id: "diamond_7000", name: "다이아 770개", priceWon: 7000, diamondAmount: 770, discountRate: 10 }),
  Object.freeze({ id: "diamond_9000", name: "다이아 1,035개", priceWon: 9000, diamondAmount: 1035, discountRate: 15 })
]);

const GOLD_PRODUCTS = Object.freeze([
  Object.freeze({ id: "gold_1500", name: "골드 1,500", diamondPrice: 10, goldAmount: 1500 }),
  Object.freeze({ id: "gold_7500", name: "골드 7,500", diamondPrice: 50, goldAmount: 7500 }),
  Object.freeze({ id: "gold_15000", name: "골드 15,000", diamondPrice: 100, goldAmount: 15000 })
]);

const AD_REWARDS = Object.freeze([
  Object.freeze({ id: "ad_diamond_10", name: "광고 보고 다이아 받기", rewardType: "diamond", amount: 10, label: "다이아 10개" }),
  Object.freeze({ id: "ad_gold_1500", name: "광고 보고 골드 받기", rewardType: "gold", amount: 1500, label: "골드 1,500" }),
  Object.freeze({ id: "ad_peak_discount", name: "광고 보고 피크타임 쿠폰 할인 받기", rewardType: "peakCouponDiscount", amount: 1, label: "피크타임 쿠폰 50% 할인" })
]);

const WAREHOUSE_LEVELS = Object.freeze([
  Object.freeze({ level: 0, capacity: 60, costGold: 0, waitDays: 0 }),
  Object.freeze({ level: 1, capacity: 90, costGold: 12000, waitDays: 0 }),
  Object.freeze({ level: 2, capacity: 130, costGold: 27000, waitDays: 1 }),
  Object.freeze({ level: 3, capacity: 180, costGold: 57000, waitDays: 1 }),
  Object.freeze({ level: 4, capacity: 240, costGold: 112500, waitDays: 2 }),
  Object.freeze({ level: 5, capacity: 320, costGold: 195000, waitDays: 2 })
]);

const SHELF_LEVELS = Object.freeze([
  Object.freeze({ level: 0, capacity: 10, costGold: 0 }),
  Object.freeze({ level: 1, capacity: 15, costGold: 9000 }),
  Object.freeze({ level: 2, capacity: 20, costGold: 21000 }),
  Object.freeze({ level: 3, capacity: 30, costGold: 45000 }),
  Object.freeze({ level: 4, capacity: 45, costGold: 90000 }),
  Object.freeze({ level: 5, capacity: 60, costGold: 150000 })
]);

const SHELF_GROUPS = Object.freeze([
  Object.freeze({ id: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF, name: "기본 매대" }),
  Object.freeze({ id: PRODUCT_DISPLAY_CATEGORIES.FRIDGE, name: "냉장고" }),
  Object.freeze({ id: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF, name: "신선 매대" }),
  Object.freeze({ id: PRODUCT_DISPLAY_CATEGORIES.WARMER, name: "온장고" })
]);

const PRODUCT_UPGRADE_CONFIGS = Object.freeze({
  [PRODUCT_UPGRADE_TYPES.NORMAL]: Object.freeze({
    name: "일반 상품",
    multipliers: [1, 1.1, 1.2, 1.3, 1.4, 1.5],
    costMultipliers: [0, 2, 3, 5, 8, 12]
  }),
  [PRODUCT_UPGRADE_TYPES.LATE_FREE_HIGH]: Object.freeze({
    name: "후반 무료 고효율 상품",
    multipliers: [1, 1.12, 1.25, 1.4, 1.55, 1.7],
    costMultipliers: [0, 3, 5, 8, 12, 18]
  }),
  [PRODUCT_UPGRADE_TYPES.PREMIUM_BM]: Object.freeze({
    name: "프리미엄 BM 상품",
    multipliers: [1, 1.2, 1.4, 1.6, 1.8, 2],
    costMultipliers: [0, 4, 7, 11, 16, 24]
  })
});

const unique = (values = []) => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

export const BMSystem = {
  isInitialized: false,
  peakCouponTimerId: null,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.ensureBMState();
    this.unlockAvailableContractsForDay(GameState.day, { emitWhenEmpty: false });

    EventBus.on(EVENTS.DAY_STARTED, (data = {}) => this.handleDayStarted(data));
    EventBus.on(EVENTS.STORE_CLOSED, () => this.deactivatePeakCoupon("store_closed"));
    EventBus.on(BM_EVENTS.CONTRACT_PURCHASE_REQUESTED, (data = {}) => this.emitPurchaseResult(this.purchaseContract(data.productId), BM_EVENTS.CONTRACT_PURCHASED, BM_EVENTS.CONTRACT_PURCHASE_FAILED));
    EventBus.on(BM_EVENTS.PREMIUM_PRODUCT_PURCHASE_REQUESTED, (data = {}) => this.emitPurchaseResult(this.purchasePremiumProduct(data.productId), BM_EVENTS.PREMIUM_PRODUCT_PURCHASED, BM_EVENTS.PREMIUM_PRODUCT_PURCHASE_FAILED));
    EventBus.on(BM_EVENTS.CONTRACT_UNLOCK_SKIP_REQUESTED, () => this.emitPurchaseResult(this.purchaseContractUnlockSkip(), BM_EVENTS.CONTRACT_UNLOCK_SKIPPED, BM_EVENTS.CONTRACT_UNLOCK_SKIP_FAILED));
    EventBus.on(BM_EVENTS.DIAMOND_PRODUCT_PURCHASE_REQUESTED, (data = {}) => this.emitPurchaseResult(this.purchaseDiamondProduct(data.productId), BM_EVENTS.DIAMOND_PRODUCT_PURCHASED, BM_EVENTS.SHOP_PURCHASE_FAILED));
    EventBus.on(BM_EVENTS.GOLD_PRODUCT_PURCHASE_REQUESTED, (data = {}) => this.emitPurchaseResult(this.purchaseGoldProduct(data.productId), BM_EVENTS.GOLD_PRODUCT_PURCHASED, BM_EVENTS.SHOP_PURCHASE_FAILED));
    EventBus.on(BM_EVENTS.AD_REWARD_REQUESTED, (data = {}) => this.emitPurchaseResult(this.claimAdReward(data.rewardId), BM_EVENTS.AD_REWARD_CLAIMED, BM_EVENTS.AD_REWARD_FAILED));
    EventBus.on(BM_EVENTS.PEAK_COUPON_PURCHASE_REQUESTED, () => this.emitPurchaseResult(this.purchasePeakCoupon(), BM_EVENTS.PEAK_COUPON_PURCHASED, BM_EVENTS.PEAK_COUPON_FAILED));
    EventBus.on(BM_EVENTS.PEAK_COUPON_USE_REQUESTED, () => this.emitPurchaseResult(this.usePeakCoupon(), BM_EVENTS.PEAK_COUPON_ACTIVATED, BM_EVENTS.PEAK_COUPON_FAILED));
    EventBus.on(BM_EVENTS.WAREHOUSE_UPGRADE_REQUESTED, () => this.emitPurchaseResult(this.purchaseWarehouseUpgrade(), BM_EVENTS.WAREHOUSE_UPGRADED, BM_EVENTS.SHOP_PURCHASE_FAILED));
    EventBus.on(BM_EVENTS.SHELF_UPGRADE_REQUESTED, (data = {}) => this.emitPurchaseResult(this.purchaseShelfUpgrade(data.shelfGroupId), BM_EVENTS.SHELF_UPGRADED, BM_EVENTS.SHOP_PURCHASE_FAILED));
    EventBus.on(BM_EVENTS.PRODUCT_UPGRADE_REQUESTED, (data = {}) => this.emitPurchaseResult(this.purchaseProductUpgrade(data.productId), BM_EVENTS.PRODUCT_UPGRADED, BM_EVENTS.SHOP_PURCHASE_FAILED));
    EventBus.on(BM_EVENTS.STAFF_ABILITY_UPGRADE_REQUESTED, (data = {}) => this.emitPurchaseResult(this.purchaseStaffAbilityUpgrade(data.abilityKey), BM_EVENTS.STAFF_ABILITY_UPGRADED, BM_EVENTS.SHOP_PURCHASE_FAILED));

    this.emitStateChanged("bm_system_initialized");
  },

  emitPurchaseResult(result, successEvent, failureEvent) {
    EventBus.emit(result.success ? successEvent : failureEvent, result);
    if (result.success) {
      this.emitStateChanged(result.reason ?? "purchase_success", result);
      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    }
    return result;
  },

  ensureBMState() {
    if (!GameState.bm || typeof GameState.bm !== "object") GameState.bm = {};
    const bm = GameState.bm;
    bm.diamond = this.toInt(bm.diamond);
    bm.ownedContractProductIds = unique([...BASIC_PRODUCT_IDS, ...(bm.ownedContractProductIds ?? [])]);
    bm.shopUnlockedContractProductIds = unique(bm.shopUnlockedContractProductIds ?? []);
    bm.purchasedPremiumProductIds = unique(bm.purchasedPremiumProductIds ?? []);
    bm.lastContractUnlockDay = this.toNullableDay(bm.lastContractUnlockDay);
    bm.contractSkipUsedDay = this.toNullableDay(bm.contractSkipUsedDay);
    bm.peakCouponUsedDay = this.toNullableDay(bm.peakCouponUsedDay);
    bm.peakCouponActive = bm.peakCouponActive === true;
    bm.peakCouponMultiplier = bm.peakCouponActive ? PEAK_COUPON_REVENUE_MULTIPLIER : 1;
    bm.adSkipTickets = this.toInt(bm.adSkipTickets ?? GameState.bmWallet?.adSkipTickets);
    bm.peakTimeCoupons = this.toInt(bm.peakTimeCoupons ?? GameState.bmWallet?.peakTimeCoupons);
    bm.coffeeTickets = this.toInt(bm.coffeeTickets ?? GameState.bmWallet?.coffeeTickets);
    bm.freeRechargeClaims = bm.freeRechargeClaims && typeof bm.freeRechargeClaims === "object" ? bm.freeRechargeClaims : {};
    bm.peakCouponDiscountDay = this.toNullableDay(bm.peakCouponDiscountDay);
    bm.peakCouponDiscountUsedDay = this.toNullableDay(bm.peakCouponDiscountUsedDay);
    bm.purchasedDiamondProductIds = unique(bm.purchasedDiamondProductIds ?? []);
    bm.paidWallet = bm.paidWallet && typeof bm.paidWallet === "object" ? bm.paidWallet : { diamond: 0, adSkipTickets: 0, peakTimeCoupons: 0, coffeeTickets: 0 };
    bm.warehouseLevel = Math.min(5, this.toInt(bm.warehouseLevel));
    bm.pendingWarehouseUpgrade = bm.pendingWarehouseUpgrade && typeof bm.pendingWarehouseUpgrade === "object" ? bm.pendingWarehouseUpgrade : null;
    bm.shelfUpgradeLevels = bm.shelfUpgradeLevels && typeof bm.shelfUpgradeLevels === "object" ? bm.shelfUpgradeLevels : {};
    bm.productUpgradeLevels = bm.productUpgradeLevels && typeof bm.productUpgradeLevels === "object" ? bm.productUpgradeLevels : {};
    bm.staffAbilityUpgrade = bm.staffAbilityUpgrade && typeof bm.staffAbilityUpgrade === "object" ? bm.staffAbilityUpgrade : { totalCount: 0, lastUpgradeDay: null, abilities: { warehouse: 0, shelf: 0, cleaning: 0 } };
    bm.staffAbilityUpgrade.totalCount = this.toInt(bm.staffAbilityUpgrade.totalCount);
    bm.staffAbilityUpgrade.lastUpgradeDay = this.toNullableDay(bm.staffAbilityUpgrade.lastUpgradeDay);
    bm.staffAbilityUpgrade.abilities = bm.staffAbilityUpgrade.abilities && typeof bm.staffAbilityUpgrade.abilities === "object" ? bm.staffAbilityUpgrade.abilities : { warehouse: 0, shelf: 0, cleaning: 0 };
    ["warehouse", "shelf", "cleaning"].forEach((key) => {
      bm.staffAbilityUpgrade.abilities[key] = this.toInt(bm.staffAbilityUpgrade.abilities[key]);
    });

    if (!GameState.bmWallet || typeof GameState.bmWallet !== "object") GameState.bmWallet = {};
    GameState.bmWallet.diamonds = bm.diamond;
    GameState.bmWallet.adSkipTickets = bm.adSkipTickets;
    GameState.bmWallet.peakTimeCoupons = bm.peakTimeCoupons;
    GameState.bmWallet.coffeeTickets = bm.coffeeTickets;

    return bm;
  },

  handleDayStarted(data = {}) {
    const day = this.toDay(data.day, GameState.day);
    this.completeDueWarehouseUpgrade(day);
    this.unlockAvailableContractsForDay(day, { emitWhenEmpty: false });
    this.deactivatePeakCoupon("day_started");
  },

  completeDueWarehouseUpgrade(day = GameState.day) {
    const bm = this.ensureBMState();
    const pending = bm.pendingWarehouseUpgrade;
    if (!pending) return false;
    if (this.toDay(pending.completeDay, day) > day) return false;
    bm.warehouseLevel = Math.max(bm.warehouseLevel, this.toInt(pending.targetLevel));
    bm.pendingWarehouseUpgrade = null;
    this.emitStateChanged("warehouse_upgrade_completed");
    return true;
  },

  getDiamondProducts() { return DIAMOND_PRODUCTS.map((item) => ({ ...item })); },
  getGoldProducts() { return GOLD_PRODUCTS.map((item) => ({ ...item })); },
  getAdRewards() { return AD_REWARDS.map((item) => this.createAdRewardState(item)); },
  getWarehouseLevels() { return WAREHOUSE_LEVELS.map((item) => ({ ...item })); },
  getShelfGroups() { return SHELF_GROUPS.map((item) => ({ ...item, ...this.getShelfUpgradeState(item.id) })); },

  purchaseDiamondProduct(productId) {
    const bm = this.ensureBMState();
    const product = DIAMOND_PRODUCTS.find((item) => item.id === productId);
    if (!product) return this.fail("invalid_product", "존재하지 않는 다이아 상품입니다.");
    bm.diamond += product.diamondAmount;
    bm.paidWallet.diamond = this.toInt(bm.paidWallet.diamond) + product.diamondAmount;
    bm.purchasedDiamondProductIds.push(product.id);
    return this.ok("diamond_product_purchased", `${product.name} 테스트 구매 완료`, { product, amount: product.diamondAmount });
  },

  purchaseGoldProduct(productId) {
    const bm = this.ensureBMState();
    const product = GOLD_PRODUCTS.find((item) => item.id === productId);
    if (!product) return this.fail("invalid_product", "존재하지 않는 골드 상품입니다.");
    if (bm.diamond < product.diamondPrice) return this.fail("not_enough_diamond", `다이아가 부족합니다. 필요 다이아: ${product.diamondPrice}`);
    bm.diamond -= product.diamondPrice;
    GameState.money += product.goldAmount;
    return this.ok("gold_product_purchased", `${product.name} 구매 완료`, { product, spentDiamond: product.diamondPrice });
  },

  createAdRewardState(reward) {
    const bm = this.ensureBMState();
    const claimKey = this.getAdRewardClaimKey(reward.id);
    const claimed = bm.freeRechargeClaims[claimKey] === true;
    return {
      ...reward,
      isClaimed: claimed,
      canClaim: !claimed,
      usesSkipTicket: bm.adSkipTickets > 0,
      buttonText: claimed ? "수령 완료" : bm.adSkipTickets > 0 ? "스킵권으로 받기" : "광고 보기(테스트)"
    };
  },

  claimAdReward(rewardId) {
    const bm = this.ensureBMState();
    const reward = AD_REWARDS.find((item) => item.id === rewardId);
    if (!reward) return this.fail("invalid_reward", "존재하지 않는 광고 보상입니다.");
    const claimKey = this.getAdRewardClaimKey(reward.id);
    if (bm.freeRechargeClaims[claimKey] === true) return this.fail("already_claimed", "오늘 이미 받은 광고 보상입니다.");
    const usedSkipTicket = bm.adSkipTickets > 0;
    if (usedSkipTicket) bm.adSkipTickets -= 1;

    if (reward.rewardType === "diamond") bm.diamond += reward.amount;
    if (reward.rewardType === "gold") GameState.money += reward.amount;
    if (reward.rewardType === "peakCouponDiscount") bm.peakCouponDiscountDay = GameState.day;

    bm.freeRechargeClaims[claimKey] = true;
    return this.ok("ad_reward_claimed", `${reward.label} 보상을 받았습니다.${usedSkipTicket ? " 광고 스킵권 1장을 사용했습니다." : ""}`, { reward, usedSkipTicket });
  },

  getAdRewardClaimKey(rewardId) { return `day${GameState.day}:${rewardId}`; },

  purchasePeakCoupon() {
    const bm = this.ensureBMState();
    const price = this.getPeakCouponPurchasePrice();
    if (bm.diamond < price) return this.fail("not_enough_diamond", `다이아가 부족합니다. 필요 다이아: ${price}`);
    bm.diamond -= price;
    bm.peakTimeCoupons += 1;
    if (bm.peakCouponDiscountDay === GameState.day) bm.peakCouponDiscountUsedDay = GameState.day;
    return this.ok("peak_coupon_purchased", `피크타임 쿠폰 1장을 구매했습니다.`, { spentDiamond: price });
  },

  usePeakCoupon() {
    const bm = this.ensureBMState();
    const validation = this.validatePeakCouponUse();
    if (!validation.success) return validation;
    bm.peakTimeCoupons -= 1;
    bm.peakCouponUsedDay = GameState.day;
    bm.peakCouponActive = true;
    bm.peakCouponMultiplier = PEAK_COUPON_REVENUE_MULTIPLIER;
    this.clearPeakCouponTimer();
    this.peakCouponTimerId = setTimeout(() => this.deactivatePeakCoupon("duration_finished"), PEAK_COUPON_DURATION_SECONDS * 1000);
    this.peakCouponTimerId?.unref?.();
    return this.ok("peak_coupon_activated", `피크타임 쿠폰 사용! ${PEAK_COUPON_DURATION_SECONDS}초 동안 매출이 1.5배 적용됩니다.`, { durationSeconds: PEAK_COUPON_DURATION_SECONDS });
  },

  validatePeakCouponUse() {
    const bm = this.ensureBMState();
    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) return this.fail("invalid_phase", "피크타임 쿠폰은 영업 중에만 사용할 수 있습니다.");
    if (bm.peakCouponActive) return this.fail("already_active", "피크타임 쿠폰 효과가 이미 적용 중입니다.");
    if (bm.peakCouponUsedDay === GameState.day) return this.fail("already_used_today", "피크타임 쿠폰은 하루 1회만 사용할 수 있습니다.");
    if (bm.peakTimeCoupons <= 0) return this.fail("no_coupon", "보유한 피크타임 쿠폰이 없습니다. 상점에서 먼저 구매하세요.");
    return { success: true, reason: "available", message: "사용 가능합니다." };
  },

  getPeakCouponPurchasePrice() {
    const bm = this.ensureBMState();
    return bm.peakCouponDiscountDay === GameState.day && bm.peakCouponDiscountUsedDay !== GameState.day
      ? PEAK_COUPON_DISCOUNT_PRICE
      : PEAK_COUPON_DIAMOND_PRICE;
  },

  deactivatePeakCoupon(reason = "expired") {
    const bm = this.ensureBMState();
    this.clearPeakCouponTimer();
    if (!bm.peakCouponActive) return false;
    bm.peakCouponActive = false;
    bm.peakCouponMultiplier = 1;
    EventBus.emit(BM_EVENTS.PEAK_COUPON_EXPIRED, this.ok(reason, "피크타임 쿠폰 효과가 종료되었습니다."));
    this.emitStateChanged("peak_coupon_expired");
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    return true;
  },

  clearPeakCouponTimer() { if (this.peakCouponTimerId) clearTimeout(this.peakCouponTimerId); this.peakCouponTimerId = null; },
  getRevenueMultiplier() { return this.ensureBMState().peakCouponActive ? PEAK_COUPON_REVENUE_MULTIPLIER : 1; },

  purchaseWarehouseUpgrade() {
    const bm = this.ensureBMState();
    this.completeDueWarehouseUpgrade();
    if (bm.pendingWarehouseUpgrade) return this.fail("warehouse_upgrade_pending", "창고 확장이 진행 중입니다. 다음 Day에 완료됩니다.");
    const currentLevel = this.toInt(bm.warehouseLevel);
    const next = WAREHOUSE_LEVELS.find((item) => item.level === currentLevel + 1);
    if (!next) return this.fail("max_level", "창고가 이미 최대 레벨입니다.");
    if (GameState.money < next.costGold) return this.fail("not_enough_gold", `골드가 부족합니다. 필요 골드: ${next.costGold.toLocaleString("ko-KR")}`);
    GameState.money -= next.costGold;
    if (next.waitDays > 0) {
      bm.pendingWarehouseUpgrade = { targetLevel: next.level, startDay: GameState.day, completeDay: GameState.day + next.waitDays };
      return this.ok("warehouse_upgrade_started", `창고 Lv.${next.level} 확장을 시작했습니다. Day ${GameState.day + next.waitDays}에 완료됩니다.`, { next });
    }
    bm.warehouseLevel = next.level;
    return this.ok("warehouse_upgraded", `창고가 Lv.${next.level}로 확장되었습니다.`, { next });
  },

  getWarehouseCapacity() {
    const bm = this.ensureBMState();
    this.completeDueWarehouseUpgrade();
    return WAREHOUSE_LEVELS.find((item) => item.level === bm.warehouseLevel)?.capacity ?? 60;
  },

  getWarehouseUpgradeState() {
    const bm = this.ensureBMState();
    const current = WAREHOUSE_LEVELS.find((item) => item.level === bm.warehouseLevel) ?? WAREHOUSE_LEVELS[0];
    const next = WAREHOUSE_LEVELS.find((item) => item.level === bm.warehouseLevel + 1) ?? null;
    return { current, next, capacity: current.capacity, pending: bm.pendingWarehouseUpgrade, canUpgrade: !!next && !bm.pendingWarehouseUpgrade && GameState.money >= (next?.costGold ?? 0) };
  },

  purchaseShelfUpgrade(shelfGroupId) {
    const group = SHELF_GROUPS.find((item) => item.id === shelfGroupId);
    if (!group) return this.fail("invalid_shelf_group", "존재하지 않는 진열대입니다.");
    const bm = this.ensureBMState();
    const currentLevel = this.toInt(bm.shelfUpgradeLevels[shelfGroupId]);
    const next = SHELF_LEVELS.find((item) => item.level === currentLevel + 1);
    if (!next) return this.fail("max_level", "이미 최대 강화입니다.");
    if (GameState.money < next.costGold) return this.fail("not_enough_gold", `골드가 부족합니다. 필요 골드: ${next.costGold.toLocaleString("ko-KR")}`);
    GameState.money -= next.costGold;
    bm.shelfUpgradeLevels[shelfGroupId] = next.level;
    return this.ok("shelf_upgraded", `${group.name}이 Lv.${next.level}로 강화되었습니다.`, { group, next });
  },

  getShelfUpgradeState(shelfGroupId) {
    const bm = this.ensureBMState();
    const currentLevel = Math.min(5, this.toInt(bm.shelfUpgradeLevels[shelfGroupId]));
    const current = SHELF_LEVELS.find((item) => item.level === currentLevel) ?? SHELF_LEVELS[0];
    const next = SHELF_LEVELS.find((item) => item.level === currentLevel + 1) ?? null;
    return { current, next, currentLevel, capacity: current.capacity, canUpgrade: !!next && GameState.money >= (next?.costGold ?? 0) };
  },

  getShelfCapacity(shelfGroupId) { return this.getShelfUpgradeState(shelfGroupId).capacity; },

  purchaseProductUpgrade(productId) {
    const product = getProductById(productId);
    if (!product) return this.fail("invalid_product", "존재하지 않는 상품입니다.");
    if (!this.canSellProduct(product.id)) return this.fail("product_locked", "판매 가능 상태인 상품만 강화할 수 있습니다.");
    const bm = this.ensureBMState();
    const currentLevel = Math.min(5, this.toInt(bm.productUpgradeLevels[product.id]));
    if (currentLevel >= 5) return this.fail("max_level", "이미 5강입니다.");
    const nextLevel = currentLevel + 1;
    const cost = this.getProductUpgradeCost(product, nextLevel);
    if (GameState.money < cost) return this.fail("not_enough_gold", `골드가 부족합니다. 필요 골드: ${cost.toLocaleString("ko-KR")}`);
    GameState.money -= cost;
    bm.productUpgradeLevels[product.id] = nextLevel;
    return this.ok("product_upgraded", `${product.name}이 ${nextLevel}강이 되었습니다.`, { productId: product.id, nextLevel, cost });
  },

  getProductUpgradeCost(product, nextLevel) {
    const config = PRODUCT_UPGRADE_CONFIGS[product.upgradeType] ?? PRODUCT_UPGRADE_CONFIGS.normal;
    return Math.floor((Number(product.salePrice) || 0) * (config.costMultipliers[nextLevel] ?? 0));
  },

  getProductUpgradeLevel(productId) { return Math.min(5, this.toInt(this.ensureBMState().productUpgradeLevels[productId])); },
  getProductSalePrice(productId) {
    const product = typeof productId === "string" ? getProductById(productId) : productId;
    if (!product) return 0;
    const level = this.getProductUpgradeLevel(product.id);
    const config = PRODUCT_UPGRADE_CONFIGS[product.upgradeType] ?? PRODUCT_UPGRADE_CONFIGS.normal;
    const multiplier = config.multipliers[level] ?? 1;
    return Math.floor((Number(product.salePrice) || 0) * multiplier);
  },

  getProductUpgradeState(productId) {
    const product = getProductById(productId);
    if (!product) return null;
    const level = this.getProductUpgradeLevel(product.id);
    const nextLevel = level < 5 ? level + 1 : null;
    const config = PRODUCT_UPGRADE_CONFIGS[product.upgradeType] ?? PRODUCT_UPGRADE_CONFIGS.normal;
    return { product, level, nextLevel, currentPrice: this.getProductSalePrice(product), nextPrice: nextLevel ? Math.floor(product.salePrice * (config.multipliers[nextLevel] ?? 1)) : this.getProductSalePrice(product), nextCost: nextLevel ? this.getProductUpgradeCost(product, nextLevel) : 0, typeLabel: config.name, canUpgrade: !!nextLevel && this.canSellProduct(product.id) && GameState.money >= (nextLevel ? this.getProductUpgradeCost(product, nextLevel) : 0) };
  },

  purchaseStaffAbilityUpgrade(abilityKey) {
    const key = ["warehouse", "shelf", "cleaning"].includes(abilityKey) ? abilityKey : null;
    if (!key) return this.fail("invalid_ability", "강화할 알바 능력치를 선택해주세요.");
    const bm = this.ensureBMState();
    const state = bm.staffAbilityUpgrade;
    if (!GameState.staff?.hired) return this.fail("no_staff", "고용된 알바가 필요합니다.");
    if (state.totalCount >= STAFF_ABILITY_MAX_TOTAL_UPGRADES) return this.fail("max_level", "알바 강화 가능 횟수를 모두 사용했습니다.");
    if (state.lastUpgradeDay && GameState.day - state.lastUpgradeDay < STAFF_ABILITY_UPGRADE_COOLDOWN_DAYS) return this.fail("cooldown", `알바 강화권은 Day ${state.lastUpgradeDay + STAFF_ABILITY_UPGRADE_COOLDOWN_DAYS}부터 다시 구매할 수 있습니다.`);
    if (bm.diamond < STAFF_ABILITY_UPGRADE_DIAMOND_PRICE) return this.fail("not_enough_diamond", `다이아가 부족합니다. 필요 다이아: ${STAFF_ABILITY_UPGRADE_DIAMOND_PRICE}`);
    bm.diamond -= STAFF_ABILITY_UPGRADE_DIAMOND_PRICE;
    state.totalCount += 1;
    state.lastUpgradeDay = GameState.day;
    state.abilities[key] += 1;
    if (!GameState.staff.hired.stats) GameState.staff.hired.stats = { warehouse: 0, shelf: 0, cleaning: 0 };
    GameState.staff.hired.stats[key] = Math.min(5, this.toInt(GameState.staff.hired.stats[key]) + 1);
    return this.ok("staff_ability_upgraded", `알바 ${this.getStaffAbilityLabel(key)} 능력이 1칸 강화되었습니다.`, { abilityKey: key });
  },

  getStaffAbilityUpgradeState() {
    const bm = this.ensureBMState();
    const state = bm.staffAbilityUpgrade;
    const nextAvailableDay = state.lastUpgradeDay ? state.lastUpgradeDay + STAFF_ABILITY_UPGRADE_COOLDOWN_DAYS : GameState.day;
    return { priceDiamond: STAFF_ABILITY_UPGRADE_DIAMOND_PRICE, maxTotal: STAFF_ABILITY_MAX_TOTAL_UPGRADES, cooldownDays: STAFF_ABILITY_UPGRADE_COOLDOWN_DAYS, totalCount: state.totalCount, lastUpgradeDay: state.lastUpgradeDay, nextAvailableDay, abilities: { ...state.abilities }, canUpgrade: !!GameState.staff?.hired && state.totalCount < STAFF_ABILITY_MAX_TOTAL_UPGRADES && GameState.day >= nextAvailableDay && bm.diamond >= STAFF_ABILITY_UPGRADE_DIAMOND_PRICE };
  },

  getStaffAbilityLabel(key) { return { warehouse: "창고", shelf: "진열대", cleaning: "청소" }[key] ?? key; },

  unlockAvailableContractsForDay(day = GameState.day, options = {}) {
    const bm = this.ensureBMState();
    const safeDay = this.toDay(day, GameState.day);
    const unlockedProductIds = [];
    this.getContractUnlockQueue().forEach((product) => {
      if (product.unlockDay > safeDay) return;
      if (bm.shopUnlockedContractProductIds.includes(product.id)) return;
      bm.shopUnlockedContractProductIds.push(product.id);
      unlockedProductIds.push(product.id);
    });
    if (unlockedProductIds.length > 0) {
      bm.shopUnlockedContractProductIds = unique(bm.shopUnlockedContractProductIds);
      bm.lastContractUnlockDay = safeDay;
      const payload = this.ok("contract_shop_unlocked", `판매권 ${unlockedProductIds.length}종이 상점에 해금되었습니다.`, { unlockedProductIds });
      EventBus.emit(BM_EVENTS.CONTRACT_SHOP_UNLOCKED, payload);
      this.emitStateChanged("contract_shop_unlocked", payload);
    }
    return unlockedProductIds;
  },

  purchaseContract(productId) {
    const product = getProductById(productId);
    const validation = this.validateContractPurchase(product);
    if (!validation.success) return validation;
    GameState.money -= product.contractCost;
    const bm = this.ensureBMState();
    bm.ownedContractProductIds = unique([...bm.ownedContractProductIds, product.id]);
    return this.ok("contract_purchased", `${product.name} 판매권을 구매했습니다.`, { productId: product.id });
  },

  validateContractPurchase(product) {
    if (!product) return this.fail("invalid_product", "존재하지 않는 상품입니다.");
    if (product.isPremiumBM) return this.fail("premium_product", "프리미엄 BM 상품은 프리미엄 상품 탭에서 구매합니다.");
    if (this.isBasicProduct(product.id)) return this.fail("basic_product", "기본 제공 상품은 판매권이 필요 없습니다.");
    if (this.hasProductContract(product.id)) return this.fail("already_owned", "이미 보유 중인 판매권입니다.");
    if (!this.isContractShopUnlocked(product.id)) return this.fail("contract_shop_locked", "아직 상점에 해금되지 않은 판매권입니다.");
    if (GameState.money < product.contractCost) return this.fail("not_enough_gold", `골드가 부족합니다. 필요 골드: ${product.contractCost.toLocaleString("ko-KR")}`);
    return { success: true, reason: "available", message: "구매 가능합니다." };
  },

  purchasePremiumProduct(productId) {
    const product = getProductById(productId);
    const validation = this.validatePremiumProductPurchase(product);
    if (!validation.success) return validation;
    const bm = this.ensureBMState();
    bm.diamond -= product.diamondPrice;
    bm.purchasedPremiumProductIds = unique([...bm.purchasedPremiumProductIds, product.id]);
    return this.ok("premium_product_purchased", `${product.name} 프리미엄 상품을 구매했습니다.`, { productId: product.id });
  },

  validatePremiumProductPurchase(product) {
    if (!product) return this.fail("invalid_product", "존재하지 않는 상품입니다.");
    if (!product.isPremiumBM) return this.fail("not_premium_product", "프리미엄 BM 상품이 아닙니다.");
    if (this.isPremiumProductPurchased(product.id)) return this.fail("already_purchased", "이미 구매한 프리미엄 상품입니다.");
    if (!this.isZoneUnlocked(product.requiredZoneId)) return this.fail("zone_locked", "해당 상품이 배치된 구역 해금이 필요합니다.");
    if (this.ensureBMState().diamond < product.diamondPrice) return this.fail("not_enough_diamond", `다이아가 부족합니다. 필요 다이아: ${product.diamondPrice}`);
    return { success: true, reason: "available", message: "구매 가능합니다." };
  },

  purchaseContractUnlockSkip() {
    const validation = this.validateContractUnlockSkip();
    if (!validation.success) return validation;
    const bm = this.ensureBMState();
    const unlockedProducts = this.getNextContractUnlockProducts();
    const unlockedProductIds = unlockedProducts.map((product) => product.id);
    bm.diamond -= CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE;
    bm.contractSkipUsedDay = GameState.day;
    bm.shopUnlockedContractProductIds = unique([...bm.shopUnlockedContractProductIds, ...unlockedProductIds]);
    bm.lastContractUnlockDay = GameState.day;
    return this.ok("contract_unlock_skipped", `판매권 ${unlockedProductIds.length}종이 상점에 즉시 해금되었습니다.`, { unlockedProductIds });
  },

  validateContractUnlockSkip() {
    const bm = this.ensureBMState();
    const nextProducts = this.getNextContractUnlockProducts();
    if (nextProducts.length === 0) return this.fail("no_contracts_to_unlock", "해금 대기 중인 판매권이 없습니다.");
    if (bm.contractSkipUsedDay && GameState.day - bm.contractSkipUsedDay < CONTRACT_UNLOCK_SKIP_COOLDOWN_DAYS) return this.fail("cooldown", `스킵권은 Day ${bm.contractSkipUsedDay + CONTRACT_UNLOCK_SKIP_COOLDOWN_DAYS}부터 다시 사용할 수 있습니다.`);
    if (bm.diamond < CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE) return this.fail("not_enough_diamond", `다이아가 부족합니다. 필요 다이아: ${CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE}`);
    return { success: true, reason: "available", message: "사용 가능합니다." };
  },

  hasProductContract(productId) { return this.isBasicProduct(productId) || this.ensureBMState().ownedContractProductIds.includes(productId); },
  isContractShopUnlocked(productId) { return this.ensureBMState().shopUnlockedContractProductIds.includes(productId); },
  isPremiumProductPurchased(productId) { return this.ensureBMState().purchasedPremiumProductIds.includes(productId); },
  isZoneUnlocked(requiredZoneId) { return Array.isArray(GameState.expansion?.unlockedZoneIds) && GameState.expansion.unlockedZoneIds.includes(requiredZoneId); },
  canSellProduct(productId) {
    const product = getProductById(productId);
    if (!product) return false;
    if (!this.isZoneUnlocked(product.requiredZoneId)) return false;
    return product.isPremiumBM ? this.isPremiumProductPurchased(product.id) : this.hasProductContract(product.id);
  },
  canOrderProduct(productId) { return this.canSellProduct(productId); },
  getProductLockReason(productId) {
    const product = getProductById(productId);
    if (!product) return { code: "invalid_product", message: "존재하지 않는 상품입니다." };
    if (!this.isZoneUnlocked(product.requiredZoneId)) return { code: "zone_locked", message: "상품이 배치된 구역 해금이 필요합니다." };
    if (product.isPremiumBM) return this.isPremiumProductPurchased(product.id) ? { code: "unlocked", message: "프리미엄 상품 구매 완료" } : { code: "premium_not_purchased", message: `${product.diamondPrice} 다이아 구매 필요` };
    if (this.hasProductContract(product.id)) return { code: "unlocked", message: "판매 가능" };
    if (!this.isContractShopUnlocked(product.id)) return { code: "contract_shop_locked", message: "판매권 상점 해금 대기 중" };
    return { code: "contract_not_owned", message: `${product.contractCost.toLocaleString("ko-KR")} 골드 판매권 구매 필요` };
  },

  getBMState() {
    const bm = this.ensureBMState();
    return {
      day: GameState.day,
      diamond: bm.diamond,
      adSkipTickets: bm.adSkipTickets,
      peakTimeCoupons: bm.peakTimeCoupons,
      coffeeTickets: bm.coffeeTickets,
      ownedContractProductIds: [...bm.ownedContractProductIds],
      shopUnlockedContractProductIds: [...bm.shopUnlockedContractProductIds],
      purchasedPremiumProductIds: [...bm.purchasedPremiumProductIds],
      contractShopProducts: this.getShopUnlockedContractProducts().map((p) => this.createContractProductPayload(p)),
      nextContractUnlockProducts: this.getNextContractUnlockProducts().map((p) => this.createContractProductPayload(p)),
      premiumProducts: this.getPremiumProducts().map((p) => this.createPremiumProductPayload(p)),
      contractUnlockSkip: this.getContractUnlockSkipState(),
      peakCoupon: this.getPeakCouponState(),
      freeRecharge: this.getAdRewards(),
      warehouse: this.getWarehouseUpgradeState(),
      shelfGroups: this.getShelfGroups(),
      staffAbilityUpgrade: this.getStaffAbilityUpgradeState()
    };
  },

  getContractProducts() { return PRODUCTS.filter((p) => !p.isPremiumBM && !this.isBasicProduct(p.id) && this.toInt(p.contractCost) > 0); },
  getContractUnlockQueue() { return this.getContractProducts().sort((a,b) => a.unlockDay !== b.unlockDay ? a.unlockDay - b.unlockDay : PRODUCTS.indexOf(a) - PRODUCTS.indexOf(b)); },
  getShopUnlockedContractProducts() { const ids = new Set(this.ensureBMState().shopUnlockedContractProductIds); return this.getContractUnlockQueue().filter((p) => ids.has(p.id)); },
  getNextContractUnlockProducts() { const bm = this.ensureBMState(); return this.getContractUnlockQueue().filter((p) => !bm.shopUnlockedContractProductIds.includes(p.id)).slice(0, CONTRACT_UNLOCK_BATCH_SIZE); },
  getPremiumProducts() { return PRODUCTS.filter((p) => p.isPremiumBM); },
  getContractUnlockSkipState() { const v = this.validateContractUnlockSkip(); return { priceDiamond: CONTRACT_UNLOCK_SKIP_DIAMOND_PRICE, cooldownDays: CONTRACT_UNLOCK_SKIP_COOLDOWN_DAYS, canUse: v.success, reason: v.reason, message: v.message, nextProducts: this.getNextContractUnlockProducts().map((p) => this.createContractProductPayload(p)) }; },
  getPeakCouponState() { const bm = this.ensureBMState(); const v = this.validatePeakCouponUse(); return { priceDiamond: PEAK_COUPON_DIAMOND_PRICE, purchasePriceDiamond: this.getPeakCouponPurchasePrice(), discountActive: bm.peakCouponDiscountDay === GameState.day && bm.peakCouponDiscountUsedDay !== GameState.day, durationSeconds: PEAK_COUPON_DURATION_SECONDS, revenueMultiplier: PEAK_COUPON_REVENUE_MULTIPLIER, ownedCount: bm.peakTimeCoupons, usedDay: bm.peakCouponUsedDay, isActive: bm.peakCouponActive, canUse: v.success, reason: v.reason, message: v.message }; },

  createContractProductPayload(product) { return product ? { productId: product.id, productName: product.name, finalName: product.finalName, requiredZoneId: product.requiredZoneId, displayCategory: product.displayCategory, contractCost: product.contractCost, unlockDay: product.unlockDay, isOwned: this.hasProductContract(product.id), isShopUnlocked: this.isContractShopUnlocked(product.id) } : null; },
  createPremiumProductPayload(product) { return product ? { productId: product.id, productName: product.name, finalName: product.finalName, requiredZoneId: product.requiredZoneId, displayCategory: product.displayCategory, diamondPrice: product.diamondPrice, isPurchased: this.isPremiumProductPurchased(product.id), isZoneUnlocked: this.isZoneUnlocked(product.requiredZoneId) } : null; },
  emitStateChanged(reason, details = {}) { EventBus.emit(BM_EVENTS.STATE_CHANGED, { reason, ...details, bmState: this.getBMState() }); },
  ok(reason, message, details = {}) { return { success: true, reason, message, day: GameState.day, ...details, bmState: this.getBMState?.() ?? null }; },
  fail(reason, message, details = {}) { return { success: false, reason, message, day: GameState.day, ...details }; },
  isBasicProduct(productId) { return BASIC_PRODUCT_IDS.includes(productId); },
  grantDiamond(amount = 10) { const bm = this.ensureBMState(); bm.diamond += this.toInt(amount); this.emitStateChanged("diamond_granted"); EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState); return this.ok("diamond_granted", `다이아 ${amount}개를 받았습니다.`); },
  getAdDiamondRewardAmount() { return 10; },
  getMentalRecoveryAdAmount() { return 0; },
  isMentalRecoveryAdUsedToday() { return true; },
  recordMentalRecoveryAdUse() { return GameState.day; },
  toInt(value) { return Math.max(0, Math.floor(Number(value) || 0)); },
  toDay(value, fallback = GameState.day) { const day = Math.floor(Number(value)); return Number.isFinite(day) && day >= 1 ? day : fallback; },
  toNullableDay(value) { if (value === null || value === undefined || value === "") return null; return this.toDay(value, null); }
};
