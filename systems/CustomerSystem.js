/*
  CustomerSystem.js

  담당:
  - 3번 담당자 작업물 병합용 변환
  - v2.2.1 팀장 병합 안정화

  역할:
  - 손님 NPC 생성
  - 손님 타입 결정
  - 손님별 구매 희망 상품 결정
  - 손님 상태 / 구역 / 대기시간 관리
  - 계산 완료 시 만족 손님 처리
  - 대기시간 초과 시 화남 / 이탈 처리
  - 랜덤 이벤트 후보 손님 조회 준비

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
  - GameState.todayStats 직접 수정 금지
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
  - Date.now() 사용 금지
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE, GAME_CONFIG } from "../core/Constants.js";

import {
  CUSTOMER_STATUS,
  CUSTOMER_ZONES,
  CUSTOMER_TYPES,
  CUSTOMER_WANTED_PRODUCTS
} from "../data/CustomerData.js";
import { getDayScenario } from "../data/DayScenarioData.js";
import {
  PRODUCTS,
  getProductById,
  getProductsByCustomerRequestId,
  PRODUCT_SHELF_IDS
} from "../data/ProductData.js";
import { getShelfInstanceIdByProductId } from "../data/ProductShelfMapData.js";
import { getShelfInstanceById } from "../data/ShelfPlacementData.js";
import {
  getNuisanceAssetVariantIdForProfile,
  getNuisanceProfileIdForAssetVariantId,
  getNuisanceProfileIds,
  isNuisanceCustomerAssetVariantId
} from "../data/AssetData.js";
import { RandomEventSystem } from "./RandomEventSystem.js";
import { BMSystem } from "./BMSystem.js";

const NUISANCE_CHECKOUT_DELAY_MS = 5000;
const CUSTOMER_SHELF_ZONE_IDS = new Set(Object.values(PRODUCT_SHELF_IDS));

const STAFF_ENTRY_FIRST_CUSTOMER_DELAY_MS = 2000;
const STAFF_ATTENDANCE_LATE = "late";
const SHELF_STOCK_CONSUMED = "SHELF_STOCK_CONSUMED";
const POSITIVE_CUSTOMER_BONUS_GRANTED = "POSITIVE_CUSTOMER_BONUS_GRANTED";
const CUSTOMER_FLOW_METRICS_UPDATED = "CUSTOMER_FLOW_METRICS_UPDATED";
const CUSTOMER_EVENT_SAFE_WAIT_SECONDS = 2;
const POST_MODAL_GRACE_MS = 1000;
const POSITIVE_GUEST_TIP_GOLD = 300;
const POSITIVE_GUEST_SATISFACTION = 1;
const CUSTOMER_FLOW_TICK = "CUSTOMER_FLOW_TICK";
const CUSTOMER_DEMAND_PHASE_CHANGED = "CUSTOMER_DEMAND_PHASE_CHANGED";
const CUSTOMER_TRAIT_IDS = Object.freeze({
  QUICK: "quick",
  BULK: "bulk",
  CLEAN: "clean",
  VALUE: "value"
});
const CUSTOMER_TRAITS = Object.freeze({
  [CUSTOMER_TRAIT_IDS.QUICK]: Object.freeze({
    id: CUSTOMER_TRAIT_IDS.QUICK,
    label: "급한 손님",
    icon: "⏱️",
    weight: 24,
    patienceMultiplier: 0.78,
    fastCheckoutSeconds: 4,
    fastCheckoutTipGold: 150
  }),
  [CUSTOMER_TRAIT_IDS.BULK]: Object.freeze({
    id: CUSTOMER_TRAIT_IDS.BULK,
    label: "대량 구매",
    icon: "🛒",
    weight: 20,
    minQuantity: 2,
    maxQuantity: 3
  }),
  [CUSTOMER_TRAIT_IDS.CLEAN]: Object.freeze({
    id: CUSTOMER_TRAIT_IDS.CLEAN,
    label: "청결 중시",
    icon: "✨",
    weight: 18,
    sanitationThreshold: 60
  }),
  [CUSTOMER_TRAIT_IDS.VALUE]: Object.freeze({
    id: CUSTOMER_TRAIT_IDS.VALUE,
    label: "추천 상품 선호",
    icon: "💰",
    weight: 22,
    recommendedWeightMultiplier: 1.75
  })
});
const DEMAND_PHASES = Object.freeze([
  Object.freeze({
    id: "opening",
    label: "출근·등교 수요",
    startSeconds: 0,
    productIds: Object.freeze(["coffee", "iced_americano", "triangle_kimbap", "egg_sandwich", "tuna_mayo_sandwich", "banana_milk", "water"]),
    categories: Object.freeze(["drink", "fresh_food"]),
    weightMultiplier: 1.55
  }),
  Object.freeze({
    id: "midday",
    label: "점심 수요",
    startSeconds: 60,
    productIds: Object.freeze(["lunch_box", "pork_cutlet_lunchbox", "spicy_pork_lunchbox", "cheese_kimchi_rice", "cola", "orange_juice", "healthy_salad"]),
    categories: Object.freeze(["ready_meal", "drink"]),
    weightMultiplier: 1.6
  }),
  Object.freeze({
    id: "late",
    label: "야식 수요",
    startSeconds: 120,
    productIds: Object.freeze(["ramen", "udon", "sausage_hotbar", "microwave_hotbar", "tteokbokki", "roasted_sweet_potato", "hoppang", "potato_chips", "chocolate_bar"]),
    categories: Object.freeze(["instant_food", "snack"]),
    weightMultiplier: 1.65
  })
]);
const POSITIVE_GUEST_PROFILES = Object.freeze([
  Object.freeze({ id: "neighbor", label: "동네 단골", dialogue: "동네에 편의점이 생겨서 좋아요. 자주 올게요!", tipGold: 300, satisfaction: 1 }),
  Object.freeze({ id: "clean_praise", label: "청결 칭찬", dialogue: "매장이 깔끔하네요. 기분 좋게 쇼핑했어요!", tipGold: 250, satisfaction: 1, requiresSanitation: 80 }),
  Object.freeze({ id: "quick_support", label: "빠른 응대 칭찬", dialogue: "바쁜데도 빠르게 챙겨주시네요!", tipGold: 200, satisfaction: 1, requiresFastCheckout: true }),
  Object.freeze({ id: "bulk_support", label: "대량 구매 응원", dialogue: "필요한 걸 한 번에 살 수 있어서 좋네요!", tipGold: 350, satisfaction: 1, requiresBulkPurchase: true })
]);
const STORY_BASE_SPAWN_RATE_BY_DAY = Object.freeze({
  1: 1,
  2: 1.15,
  3: 1.3,
  4: 1.5,
  5: 1.75
});
const CUSTOMER_FLOW_PROFILE_BY_DAY = Object.freeze({
  1: Object.freeze({
    targetCount: 18,
    minIntervalMs: 4500,
    maxIntervalMs: 10500,
    burstChance: 0.2,
    burstMinMs: 2000,
    burstMaxMs: 3000,
    maxActive: 3,
    congestionRetryMs: 2000,
    rushCount: 2,
    rushRemainingSecondsMin: 40,
    rushRemainingSecondsMax: 55,
    positiveGuestChance: 0,
    guaranteedPositiveGuest: true
  }),
  2: Object.freeze({
    targetCount: 21,
    minIntervalMs: 4000,
    maxIntervalMs: 8500,
    burstChance: 0.25,
    burstMinMs: 1900,
    burstMaxMs: 2800,
    maxActive: 4,
    congestionRetryMs: 1500,
    rushCount: 3,
    rushRemainingSecondsMin: 35,
    rushRemainingSecondsMax: 60,
    positiveGuestChance: 0.06,
    guaranteedPositiveGuest: false
  }),
  3: Object.freeze({
    targetCount: 24,
    minIntervalMs: 3500,
    maxIntervalMs: 7500,
    burstChance: 0.3,
    burstMinMs: 1700,
    burstMaxMs: 2600,
    maxActive: 5,
    congestionRetryMs: 1000,
    rushCount: 3,
    rushRemainingSecondsMin: 45,
    rushRemainingSecondsMax: 80,
    positiveGuestChance: 0.08,
    guaranteedPositiveGuest: false
  }),
  4: Object.freeze({
    targetCount: 27,
    minIntervalMs: 3200,
    maxIntervalMs: 6800,
    burstChance: 0.34,
    burstMinMs: 1600,
    burstMaxMs: 2400,
    maxActive: 6,
    congestionRetryMs: 900,
    rushCount: 3,
    rushRemainingSecondsMin: 35,
    rushRemainingSecondsMax: 70,
    positiveGuestChance: 0.09,
    guaranteedPositiveGuest: false
  }),
  5: Object.freeze({
    targetCount: 30,
    minIntervalMs: 2800,
    maxIntervalMs: 6200,
    burstChance: 0.38,
    burstMinMs: 1500,
    burstMaxMs: 2300,
    maxActive: 7,
    congestionRetryMs: 800,
    rushCount: 4,
    rushRemainingSecondsMin: 30,
    rushRemainingSecondsMax: 65,
    positiveGuestChance: 0.1,
    guaranteedPositiveGuest: false
  })
});

export const CustomerSystem = {
  customers: [],
  customerIdCounter: 0,
  routeTimerId: null,
  spawnTimerId: null,
  spawnDueAtMs: null,
  spawnRemainingMs: 0,
  initialSpawnTimerId: null,
  initialSpawnDueAtMs: null,
  initialSpawnRemainingMs: 0,
  postModalGraceTimerId: null,
  isWaitTimePaused: false,
  isCustomerFlowPaused: false,
  targetSpawnCount: 0,
  spawnedCustomerCount: 0,
  counterQueueOrderCounter: 0,
  flowElapsedSeconds: 0,
  rushRemainingSeconds: null,
  rushTriggered: false,
  rushSpawnRemaining: 0,
  guaranteedNuisanceSpawnIndex: null,
  guaranteedPositiveGuestSpawnIndex: null,
  positiveGuestCount: 0,
  currentDemandPhaseId: "opening",
  inventoryByProductId: {},
  pendingPickupQuantitiesByProductId: {},

  init() {
    EventBus.on(EVENTS.STORE_OPENED, () => {
      this.startCustomerFlow();
    });

    EventBus.on(EVENTS.CHECKOUT_COMPLETED, (data) => {
      const checkoutData = this.normalizeCheckoutCompletedPayload(data);

      this.handleCheckoutCompleted(checkoutData);
    });

    EventBus.on(EVENTS.INVENTORY_CHANGED, (data) => {
      this.handleInventoryChanged(data);
    });

    EventBus.on(EVENTS.STORE_CLOSED, () => {
      this.closeCustomerFlow();
    });
  },

  startCustomerFlow() {
    this.resetCustomersForDay();

    const profile = this.getCustomerFlowProfile();
    this.targetSpawnCount = this.getSpawnCountByDay();
    this.spawnedCustomerCount = 0;
    this.isCustomerFlowPaused = false;
    this.isWaitTimePaused = false;
    this.flowElapsedSeconds = 0;
    this.rushRemainingSeconds = this.randomBetween(
      profile.rushRemainingSecondsMin,
      profile.rushRemainingSecondsMax
    );
    this.rushTriggered = false;
    this.rushSpawnRemaining = 0;
    this.guaranteedNuisanceSpawnIndex = GameState.day === 1
      ? this.randomIntegerBetween(6, 9)
      : null;
    this.guaranteedPositiveGuestSpawnIndex = profile.guaranteedPositiveGuest
      ? this.pickGuaranteedPositiveGuestIndex()
      : null;
    this.positiveGuestCount = 0;
    this.currentDemandPhaseId = this.getDemandPhaseForElapsed(0).id;
    this.ensureFlowStats();
    this.emitDemandPhaseChanged(this.getDemandPhaseForElapsed(0), true);

    const initialCustomerDelayMs = this.getInitialCustomerDelayMs();

    if (initialCustomerDelayMs > 0) {
      this.scheduleInitialSpawnTimer(initialCustomerDelayMs);
    } else {
      this.spawnNextCustomer();
      this.startSpawnTimer();
    }

    this.startRouteTimer();
  },

  resetCustomersForDay() {
    this.stopPostModalGraceTimer();
    this.stopInitialSpawnTimer();
    this.stopRouteTimer();
    this.stopSpawnTimer();

    this.customers = [];
    this.customerIdCounter = 0;
    this.targetSpawnCount = 0;
    this.spawnedCustomerCount = 0;
    this.counterQueueOrderCounter = 0;
    this.flowElapsedSeconds = 0;
    this.rushRemainingSeconds = null;
    this.rushTriggered = false;
    this.rushSpawnRemaining = 0;
    this.guaranteedNuisanceSpawnIndex = null;
    this.guaranteedPositiveGuestSpawnIndex = null;
    this.positiveGuestCount = 0;
    this.currentDemandPhaseId = "opening";
    this.pendingPickupQuantitiesByProductId = {};
    this.isCustomerFlowPaused = false;
    this.isWaitTimePaused = false;
  },

  handleInventoryChanged(data = {}) {
    const items = Array.isArray(data.items) ? data.items : [];

    this.inventoryByProductId = items.reduce((inventoryMap, item) => {
      inventoryMap[item.productId] = item;
      return inventoryMap;
    }, {});
  },

  getCustomerFlowProfile(day = GameState.day) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const storyProfile = CUSTOMER_FLOW_PROFILE_BY_DAY[safeDay];

    if (storyProfile) {
      return storyProfile;
    }

    const extraDay = Math.max(1, safeDay - 5);

    return {
      targetCount: Math.min(60, 30 + extraDay * 3),
      minIntervalMs: Math.max(1800, 2800 - extraDay * 80),
      maxIntervalMs: Math.max(4200, 6200 - extraDay * 90),
      burstChance: Math.min(0.5, 0.38 + extraDay * 0.015),
      burstMinMs: 1400,
      burstMaxMs: 2200,
      maxActive: Math.min(9, 7 + Math.floor(extraDay / 2)),
      congestionRetryMs: 800,
      rushCount: Math.min(5, 4 + Math.floor(extraDay / 4)),
      rushRemainingSecondsMin: 28,
      rushRemainingSecondsMax: 62,
      positiveGuestChance: Math.min(0.14, 0.1 + extraDay * 0.005),
      guaranteedPositiveGuest: false
    };
  },

  getSpawnCountByDay() {
    const safeDay = Math.max(1, Math.floor(Number(GameState.day) || 1));
    const profile = this.getCustomerFlowProfile(safeDay);
    const configuredRate = Math.max(0, Number(GameState.difficulty?.customerSpawnRate) || 1);
    const storyBaseRate = STORY_BASE_SPAWN_RATE_BY_DAY[safeDay];
    const expansionBonusRate = Number.isFinite(storyBaseRate)
      ? Math.max(0, configuredRate - storyBaseRate)
      : 0;
    const expansionVisitors = Math.round(profile.targetCount * expansionBonusRate);

    return Math.max(6, Math.min(60, profile.targetCount + expansionVisitors));
  },

  getExpectedAverageSalePrice() {
    const wantedProducts = this.getAvailableWantedProducts();
    const wantedProductIds = new Set(
      wantedProducts.map((product) => product.id)
    );
    const salePrices = PRODUCTS
      .filter((product) => {
        return (
          BMSystem.canSellProduct(product.id) &&
          wantedProductIds.has(product.id) ||
          (
            BMSystem.canSellProduct(product.id) &&
            (product.customerRequestIds ?? []).some((requestId) => {
              return wantedProductIds.has(requestId);
            })
          )
        );
      })
      .map((product) => Number(product.salePrice))
      .filter((salePrice) => {
        return Number.isFinite(salePrice) && salePrice > 0;
      });

    if (salePrices.length === 0) {
      return 0;
    }

    const totalSalePrice = salePrices.reduce((total, salePrice) => {
      return total + salePrice;
    }, 0);

    return totalSalePrice / salePrices.length;
  },

  addCustomers(count) {
    const safeCount = Math.max(0, Math.floor(count));

    for (let i = 0; i < safeCount; i += 1) {
      const spawnOrdinal = this.spawnedCustomerCount + i + 1;
      const customer = this.applyNuisanceSpawnEffects(
        this.createCustomer(spawnOrdinal)
      );

      this.customers.push(customer);

      EventBus.emit(EVENTS.CUSTOMER_ENTERED, this.createCustomerPayload(customer));
    }

    this.updateFlowMetrics();
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  spawnNextCustomer() {
    if (this.isCustomerFlowPaused) {
      return false;
    }

    if (this.spawnedCustomerCount >= this.targetSpawnCount) {
      this.stopSpawnTimer();
      return false;
    }

    this.addCustomers(1);
    this.spawnedCustomerCount += 1;

    if (this.rushSpawnRemaining > 0) {
      this.rushSpawnRemaining = Math.max(0, this.rushSpawnRemaining - 1);
    }

    if (this.spawnedCustomerCount >= this.targetSpawnCount) {
      this.stopSpawnTimer();
    }

    return true;
  },

  startSpawnTimer() {
    this.stopSpawnTimer();

    if (this.spawnedCustomerCount >= this.targetSpawnCount) {
      return;
    }

    this.scheduleSpawnTimer(this.getNextSpawnDelayMs());
  },

  scheduleSpawnTimer(delayMs = this.getNextSpawnDelayMs()) {
    this.stopSpawnTimer();

    if (this.spawnedCustomerCount >= this.targetSpawnCount) {
      return;
    }

    const safeDelayMs = Math.max(250, Math.floor(Number(delayMs) || 0));
    this.spawnRemainingMs = safeDelayMs;

    if (this.isCustomerFlowPaused || this.isGamePaused()) {
      return;
    }

    this.spawnDueAtMs = this.getNowMs() + safeDelayMs;
    this.spawnTimerId = setTimeout(() => {
      this.spawnTimerId = null;
      this.spawnDueAtMs = null;
      this.spawnRemainingMs = 0;

      if (this.isCustomerFlowPaused || this.isGamePaused()) {
        this.spawnRemainingMs = safeDelayMs;
        return;
      }

      if (this.shouldHoldCustomersForRush()) {
        this.scheduleSpawnTimer(1000);
        return;
      }

      const delayReason = this.getSpawnDelayReason();

      if (delayReason) {
        const profile = this.getCustomerFlowProfile();
        this.scheduleSpawnTimer(profile.congestionRetryMs);
        return;
      }

      this.spawnNextCustomer();

      if (this.spawnedCustomerCount < this.targetSpawnCount) {
        this.scheduleSpawnTimer(this.getNextSpawnDelayMs());
      }
    }, safeDelayMs);
  },

  pauseSpawnTimer() {
    if (!this.spawnTimerId) {
      return;
    }

    this.spawnRemainingMs = Math.max(
      0,
      Math.ceil((Number(this.spawnDueAtMs) || this.getNowMs()) - this.getNowMs())
    );
    clearTimeout(this.spawnTimerId);
    this.spawnTimerId = null;
    this.spawnDueAtMs = null;
  },

  resumeSpawnTimer() {
    if (
      this.spawnTimerId ||
      this.spawnedCustomerCount >= this.targetSpawnCount ||
      this.isCustomerFlowPaused ||
      this.isGamePaused()
    ) {
      return;
    }

    const delayMs = this.spawnRemainingMs > 0
      ? this.spawnRemainingMs
      : this.getNextSpawnDelayMs();

    this.scheduleSpawnTimer(delayMs);
  },

  scheduleInitialSpawnTimer(delayMs = 0) {
    this.stopInitialSpawnTimer();
    this.initialSpawnRemainingMs = Math.max(0, Math.floor(Number(delayMs) || 0));
    this.resumeInitialSpawnTimer();
  },

  pauseInitialSpawnTimer() {
    if (!this.initialSpawnTimerId) {
      return;
    }

    this.initialSpawnRemainingMs = Math.max(
      0,
      Math.ceil((Number(this.initialSpawnDueAtMs) || this.getNowMs()) - this.getNowMs())
    );
    clearTimeout(this.initialSpawnTimerId);
    this.initialSpawnTimerId = null;
    this.initialSpawnDueAtMs = null;
  },

  resumeInitialSpawnTimer() {
    if (this.initialSpawnTimerId || this.initialSpawnRemainingMs <= 0) {
      return;
    }

    if (this.isGamePaused() || this.isCustomerFlowPaused) {
      return;
    }

    const delayMs = Math.max(0, Math.floor(Number(this.initialSpawnRemainingMs) || 0));
    this.initialSpawnDueAtMs = this.getNowMs() + delayMs;
    this.initialSpawnTimerId = setTimeout(() => {
      this.initialSpawnTimerId = null;
      this.initialSpawnDueAtMs = null;

      if (this.isGamePaused() || this.isCustomerFlowPaused) {
        this.initialSpawnRemainingMs = Math.max(0, delayMs);
        return;
      }

      this.initialSpawnRemainingMs = 0;
      this.spawnNextCustomer();
      this.startSpawnTimer();
    }, delayMs);
  },

  stopInitialSpawnTimer() {
    if (this.initialSpawnTimerId) {
      clearTimeout(this.initialSpawnTimerId);
    }

    this.initialSpawnTimerId = null;
    this.initialSpawnDueAtMs = null;
    this.initialSpawnRemainingMs = 0;
  },

  stopSpawnTimer() {
    if (this.spawnTimerId) {
      clearTimeout(this.spawnTimerId);
    }

    this.spawnTimerId = null;
    this.spawnDueAtMs = null;
    this.spawnRemainingMs = 0;
  },

  shouldDelayFirstCustomerForStaffEntry() {
    return this.getInitialCustomerDelayMs() > 0;
  },

  getInitialCustomerDelayMs() {
    if (!GameState.staff?.hired) {
      return 0;
    }

    const attendanceStatus = GameState.staffAssist?.attendanceStatus ?? null;
    const hasLateArrivalPending =
      attendanceStatus === STAFF_ATTENDANCE_LATE &&
      GameState.staffAssist?.attendanceArrived !== true;

    return hasLateArrivalPending ? 0 : STAFF_ENTRY_FIRST_CUSTOMER_DELAY_MS;
  },

  getSpawnIntervalMsByDay() {
    return this.getNextSpawnDelayMs();
  },

  getNextSpawnDelayMs() {
    const profile = this.getCustomerFlowProfile();
    const useBurstInterval = this.rushSpawnRemaining > 0 || Math.random() < profile.burstChance;

    if (useBurstInterval) {
      return this.randomBetween(profile.burstMinMs, profile.burstMaxMs);
    }

    return this.randomBetween(profile.minIntervalMs, profile.maxIntervalMs);
  },

  getSpawnDelayReason() {
    const profile = this.getCustomerFlowProfile();
    const activeCount = this.getActiveCustomers().length;

    if (activeCount >= profile.maxActive) {
      return "active_customer_limit";
    }

    if (this.getWorkloadPressureScore() >= 2) {
      return "workload_pressure";
    }

    return null;
  },

  getWorkloadPressureScore() {
    let score = 0;
    const waitingCount = this.getWaitingCustomers().length;
    const sanitationValue = Number(GameState.sanitation?.value);

    if (waitingCount >= 2) {
      score += 1;
    }

    if (this.getUrgentShelfCount() > 0) {
      score += 1;
    }

    if (Number.isFinite(sanitationValue) && sanitationValue <= 50) {
      score += 1;
    }

    if (this.hasBlockingModalOpen()) {
      score += 1;
    }

    return score;
  },

  getUrgentShelfCount() {
    const shelfStocks = GameState.shelfStocks && typeof GameState.shelfStocks === "object"
      ? GameState.shelfStocks
      : {};
    let urgentCount = 0;

    Object.values(shelfStocks).forEach((shelfStock) => {
      Object.values(shelfStock?.products ?? {}).forEach((productStock) => {
        const maxStock = Math.max(0, Number(productStock?.maxStock) || 0);
        const currentStock = Math.max(0, Number(productStock?.currentStock) || 0);

        if (maxStock > 0 && currentStock <= Math.max(1, Math.floor(maxStock * 0.3))) {
          urgentCount += 1;
        }
      });
    });

    return urgentCount;
  },

  hasBlockingModalOpen() {
    return Boolean(
      document.querySelector(
        ".modal:not(.hidden):not([hidden]), .bm-shop-result-modal:not(.hidden):not([hidden]), .zone-expansion-condition-modal:not(.hidden):not([hidden])"
      )
    );
  },

  shouldHoldCustomersForRush() {
    if (this.rushTriggered) {
      return false;
    }

    const profile = this.getCustomerFlowProfile();
    const remainingCustomers = this.targetSpawnCount - this.spawnedCustomerCount;
    const rushTriggerElapsedSeconds = Math.max(
      0,
      Number(GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS) - Number(this.rushRemainingSeconds || 0)
    );

    return (
      remainingCustomers <= profile.rushCount &&
      this.flowElapsedSeconds < rushTriggerElapsedSeconds
    );
  },

  updateRushState() {
    if (this.rushTriggered || !Number.isFinite(Number(this.rushRemainingSeconds))) {
      return;
    }

    const rushTriggerElapsedSeconds = Math.max(
      0,
      Number(GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS) - Number(this.rushRemainingSeconds)
    );

    if (this.flowElapsedSeconds < rushTriggerElapsedSeconds) {
      return;
    }

    const profile = this.getCustomerFlowProfile();
    const remainingCustomers = Math.max(0, this.targetSpawnCount - this.spawnedCustomerCount);

    this.rushTriggered = true;
    this.rushSpawnRemaining = Math.min(profile.rushCount, remainingCustomers);

    if (this.rushSpawnRemaining > 0 && !this.isCustomerFlowPaused) {
      this.scheduleSpawnTimer(this.randomBetween(profile.burstMinMs, profile.burstMaxMs));
    }
  },

  ensureFlowStats() {
    const stats = GameState.todayStats && typeof GameState.todayStats === "object"
      ? GameState.todayStats
      : {};

    GameState.todayStats = {
      ...stats,
      customerWaitTimeTotal: Math.max(0, Number(stats.customerWaitTimeTotal) || 0),
      customerWaitSampleCount: Math.max(0, Math.floor(Number(stats.customerWaitSampleCount) || 0)),
      maxCheckoutQueue: Math.max(0, Math.floor(Number(stats.maxCheckoutQueue) || 0)),
      maxActiveCustomers: Math.max(0, Math.floor(Number(stats.maxActiveCustomers) || 0)),
      outOfStockSeconds: Math.max(0, Math.floor(Number(stats.outOfStockSeconds) || 0)),
      nuisanceEventCount: Math.max(0, Math.floor(Number(stats.nuisanceEventCount) || 0)),
      nuisanceTimeoutCount: Math.max(0, Math.floor(Number(stats.nuisanceTimeoutCount) || 0)),
      nuisanceResponseTimeTotalMs: Math.max(0, Number(stats.nuisanceResponseTimeTotalMs) || 0),
      nuisanceResponseCount: Math.max(0, Math.floor(Number(stats.nuisanceResponseCount) || 0)),
      positiveGuestCount: Math.max(0, Math.floor(Number(stats.positiveGuestCount) || 0)),
      popularProductRequestedCount: Math.max(0, Math.floor(Number(stats.popularProductRequestedCount) || 0)),
      popularProductSoldQuantity: Math.max(0, Math.floor(Number(stats.popularProductSoldQuantity) || 0)),
      popularProductLostCustomers: Math.max(0, Math.floor(Number(stats.popularProductLostCustomers) || 0)),
      customerTraitCounts: stats.customerTraitCounts && typeof stats.customerTraitCounts === "object"
        ? { ...stats.customerTraitCounts }
        : {},
      productSalesById: stats.productSalesById && typeof stats.productSalesById === "object"
        ? { ...stats.productSalesById }
        : {},
      productRevenueById: stats.productRevenueById && typeof stats.productRevenueById === "object"
        ? { ...stats.productRevenueById }
        : {}
    };
  },

  updateFlowMetrics() {
    this.ensureFlowStats();
    const waitingCount = this.getWaitingCustomers().length;
    const activeCount = this.getActiveCustomers().length;
    const previousMaxQueue = GameState.todayStats.maxCheckoutQueue;

    GameState.todayStats.maxCheckoutQueue = Math.max(previousMaxQueue, waitingCount);
    GameState.todayStats.maxActiveCustomers = Math.max(
      GameState.todayStats.maxActiveCustomers,
      activeCount
    );

    if (GameState.todayStats.maxCheckoutQueue !== previousMaxQueue) {
      EventBus.emit(CUSTOMER_FLOW_METRICS_UPDATED, {
        day: GameState.day,
        maxCheckoutQueue: GameState.todayStats.maxCheckoutQueue,
        maxActiveCustomers: GameState.todayStats.maxActiveCustomers
      });
    }
  },

  updateOutOfStockMetric(amount = 1) {
    this.ensureFlowStats();

    if (this.getEmptyShelfCount() > 0) {
      GameState.todayStats.outOfStockSeconds += Math.max(0, Number(amount) || 0);
    }
  },

  getEmptyShelfCount() {
    const shelfStocks = GameState.shelfStocks && typeof GameState.shelfStocks === "object"
      ? GameState.shelfStocks
      : {};
    let emptyCount = 0;

    Object.values(shelfStocks).forEach((shelfStock) => {
      Object.values(shelfStock?.products ?? {}).forEach((productStock) => {
        const maxStock = Math.max(0, Number(productStock?.maxStock) || 0);
        const currentStock = Math.max(0, Number(productStock?.currentStock) || 0);

        if (maxStock > 0 && currentStock <= 0) {
          emptyCount += 1;
        }
      });
    });

    return emptyCount;
  },

  pickGuaranteedPositiveGuestIndex() {
    const nuisanceIndex = Number(this.guaranteedNuisanceSpawnIndex);
    const candidates = [3, 4, 5].filter((index) => index !== nuisanceIndex);

    return candidates[this.randomIntegerBetween(0, candidates.length - 1)] ?? 3;
  },

  randomBetween(min, max) {
    const safeMin = Number(min) || 0;
    const safeMax = Number(max) || safeMin;
    const lower = Math.min(safeMin, safeMax);
    const upper = Math.max(safeMin, safeMax);

    return Math.round(lower + Math.random() * (upper - lower));
  },

  randomIntegerBetween(min, max) {
    const lower = Math.ceil(Math.min(Number(min) || 0, Number(max) || 0));
    const upper = Math.floor(Math.max(Number(min) || 0, Number(max) || 0));

    return Math.floor(lower + Math.random() * (upper - lower + 1));
  },

  getDemandPhaseForElapsed(elapsedSeconds = this.flowElapsedSeconds) {
    const safeElapsed = Math.max(0, Number(elapsedSeconds) || 0);
    let phase = DEMAND_PHASES[0];

    DEMAND_PHASES.forEach((candidate) => {
      if (safeElapsed >= candidate.startSeconds) {
        phase = candidate;
      }
    });

    return phase;
  },

  updateDemandPhase() {
    const nextPhase = this.getDemandPhaseForElapsed();

    if (nextPhase.id === this.currentDemandPhaseId) {
      return nextPhase;
    }

    this.currentDemandPhaseId = nextPhase.id;
    this.emitDemandPhaseChanged(nextPhase, false);
    return nextPhase;
  },

  emitDemandPhaseChanged(phase = this.getDemandPhaseForElapsed(), isInitial = false) {
    EventBus.emit(CUSTOMER_DEMAND_PHASE_CHANGED, {
      day: GameState.day,
      phaseId: phase.id,
      label: phase.label,
      elapsedSeconds: this.flowElapsedSeconds,
      isInitial
    });
  },

  pickCustomerTrait(customerType = {}, spawnOrdinal = 1) {
    if (customerType.id === "difficult") {
      return null;
    }

    const traits = Object.values(CUSTOMER_TRAITS).map((trait) => {
      let weight = Math.max(0, Number(trait.weight) || 0);

      if (customerType.id === "hurried" && trait.id === CUSTOMER_TRAIT_IDS.QUICK) {
        weight *= 1.6;
      }

      if (customerType.id === "student" && trait.id === CUSTOMER_TRAIT_IDS.VALUE) {
        weight *= 1.35;
      }

      if (GameState.day === 1 && trait.id === CUSTOMER_TRAIT_IDS.BULK) {
        weight *= 0.55;
      }

      return { trait, weight };
    });
    const noTraitWeight = GameState.day === 1 ? 70 : 45;
    const totalWeight = noTraitWeight + traits.reduce((sum, entry) => sum + entry.weight, 0);
    let target = Math.random() * totalWeight;

    if (target < noTraitWeight) {
      return null;
    }

    target -= noTraitWeight;

    for (const entry of traits) {
      target -= entry.weight;

      if (target <= 0) {
        return entry.trait;
      }
    }

    return traits[(Math.max(1, Number(spawnOrdinal) || 1) - 1) % traits.length]?.trait ?? null;
  },

  getCustomerWantedQuantity(trait = null) {
    if (trait?.id !== CUSTOMER_TRAIT_IDS.BULK) {
      return 1;
    }

    return this.randomIntegerBetween(trait.minQuantity ?? 2, trait.maxQuantity ?? 3);
  },

  getWeightedWantedProduct(candidates = [], customerType = {}, trait = null) {
    const scenario = this.getCurrentDayScenario();
    const recommendedIds = new Set(scenario.recommendedProductIds ?? []);
    const preferredIds = new Set(customerType.preferredProductIds ?? []);
    const demandPhase = this.getDemandPhaseForElapsed();
    const weighted = candidates.map((requestProduct) => {
      const sellableProducts = getProductsByCustomerRequestId(requestProduct.id)
        .filter((product) => this.canCustomerChooseProduct(product));
      const representative = sellableProducts[0] ?? getProductById(requestProduct.id) ?? null;
      let weight = 1;

      if (preferredIds.has(requestProduct.id)) {
        weight *= 1.45;
      }

      if (recommendedIds.has(requestProduct.id)) {
        weight *= 1.85;

        if (trait?.id === CUSTOMER_TRAIT_IDS.VALUE) {
          weight *= trait.recommendedWeightMultiplier ?? 1.75;
        }
      }

      if (demandPhase.productIds.includes(requestProduct.id)) {
        weight *= demandPhase.weightMultiplier;
      } else if (representative && demandPhase.categories.includes(representative.category)) {
        weight *= 1.25;
      }

      return { requestProduct, weight: Math.max(0.05, weight) };
    });
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let target = Math.random() * totalWeight;

    for (const entry of weighted) {
      target -= entry.weight;

      if (target <= 0) {
        return entry.requestProduct;
      }
    }

    return weighted[weighted.length - 1]?.requestProduct ?? candidates[0] ?? CUSTOMER_WANTED_PRODUCTS[0];
  },

  pickPositiveGuestProfile(trait = null, wantedQuantity = 1) {
    const rawSanitationValue = Number(GameState.sanitation?.value);
    const sanitationValue = Math.max(
      0,
      Math.min(100, Number.isFinite(rawSanitationValue) ? rawSanitationValue : 100)
    );
    const eligible = POSITIVE_GUEST_PROFILES.filter((profile) => {
      if (profile.requiresSanitation && sanitationValue < profile.requiresSanitation) return false;
      if (profile.requiresBulkPurchase && wantedQuantity < 2) return false;
      if (profile.requiresFastCheckout && trait?.id !== CUSTOMER_TRAIT_IDS.QUICK) return false;
      return true;
    });

    if (eligible.length === 0) {
      return POSITIVE_GUEST_PROFILES[0];
    }

    return eligible[this.customerIdCounter % eligible.length];
  },

  createCustomer(spawnOrdinal = this.spawnedCustomerCount + 1) {
    const customerType = this.pickCustomerType(spawnOrdinal);
    const customerTrait = this.pickCustomerTrait(customerType, spawnOrdinal);
    const wantedProduct = this.decideWantedProduct(customerType, customerTrait);
    const wantedQuantity = this.getCustomerWantedQuantity(customerTrait);
    const wantedShelfInstance = this.getShelfInstanceForRequest(wantedProduct.id);
    const wantedShelfId = wantedShelfInstance?.shelfId ?? this.getShelfIdForRequest(wantedProduct.id);
    const routeState = this.getRouteStateByStatus(CUSTOMER_STATUS.ENTERING);
    const currentZone = this.getAccessibleCustomerZone(routeState.currentZone);
    const targetZone = this.getAccessibleCustomerZone(wantedShelfId, currentZone);

    this.customerIdCounter += 1;

    const customerId = `customer-${GameState.day}-${this.customerIdCounter}`;
    const nuisanceProfileId = this.pickNuisanceProfileIdForCustomer(
      customerType,
      customerId
    );
    const nuisanceAssetVariantId = nuisanceProfileId
      ? getNuisanceAssetVariantIdForProfile(nuisanceProfileId, customerId)
      : null;
    const isNuisance = this.isNuisanceCustomerTypeOrAsset({
      typeId: customerType.id,
      nuisanceProfileId,
      nuisanceAssetVariantId
    });
    const isPositiveGuest = this.shouldCreatePositiveGuest(
      spawnOrdinal,
      customerType
    );
    const positiveGuestProfile = isPositiveGuest
      ? this.pickPositiveGuestProfile(customerTrait, wantedQuantity)
      : null;
    const entryDialogueText = positiveGuestProfile?.dialogue
      ?? (isPositiveGuest
        ? this.pickPositiveGuestDialogue(this.customerIdCounter)
        : this.pickCustomerEntryDialogue(customerType, this.customerIdCounter));

    if (isPositiveGuest) {
      this.positiveGuestCount += 1;
      this.ensureFlowStats();
      GameState.todayStats.positiveGuestCount += 1;
    }

    this.ensureFlowStats();
    const recommendedIds = new Set(this.getCurrentDayScenario().recommendedProductIds ?? []);

    if (recommendedIds.has(wantedProduct.id)) {
      GameState.todayStats.popularProductRequestedCount += wantedQuantity;
    }

    if (customerTrait?.id) {
      GameState.todayStats.customerTraitCounts[customerTrait.id] =
        Math.max(0, Number(GameState.todayStats.customerTraitCounts[customerTrait.id]) || 0) + 1;
    }

    return {
      id: customerId,

      typeId: customerType.id,
      typeName: customerType.name,
      entryDialogueText,
      isNuisance,
      nuisanceProfileId,
      nuisanceAssetVariantId,
      assetVariantId: nuisanceAssetVariantId,
      nuisanceEventRequired: isNuisance,
      nuisanceEventOpened: false,
      nuisanceEventResolved: false,
      nuisanceCheckoutDelayMs: 0,
      isPositiveGuest,
      positiveGuestProfileId: positiveGuestProfile?.id ?? null,
      positiveGuestProfileLabel: positiveGuestProfile?.label ?? null,
      positiveGuestRequiresFastCheckout: positiveGuestProfile?.requiresFastCheckout === true,
      positiveGuestBonusApplied: false,
      positiveGuestTipGold: isPositiveGuest ? Number(positiveGuestProfile?.tipGold ?? POSITIVE_GUEST_TIP_GOLD) : 0,
      positiveGuestSatisfaction: isPositiveGuest ? Number(positiveGuestProfile?.satisfaction ?? POSITIVE_GUEST_SATISFACTION) : 0,

      traitId: customerTrait?.id ?? null,
      traitLabel: customerTrait?.label ?? null,
      traitIcon: customerTrait?.icon ?? null,
      fastCheckoutSeconds: Number(customerTrait?.fastCheckoutSeconds) || 0,
      fastCheckoutTipGold: Number(customerTrait?.fastCheckoutTipGold) || 0,
      wantedQuantity,
      carriedQuantity: 0,
      cleanlinessConcerned: customerTrait?.id === CUSTOMER_TRAIT_IDS.CLEAN && Number(GameState.sanitation?.value ?? 100) < Number(customerTrait.sanitationThreshold ?? 60),

      patience: Math.max(8, Math.round(customerType.patience * (Number(customerTrait?.patienceMultiplier) || 1))),
      initialPatience: Math.max(8, Math.round(customerType.patience * (Number(customerTrait?.patienceMultiplier) || 1))),
      spendBias: customerType.spendBias,
      eventChance: this.getCustomerEventChance(customerType),

      wantedProductId: wantedProduct.id,
      wantedProductName: BMSystem.getProductDisplayName(wantedProduct),
      wantedShelfId,
      targetShelfInstanceId: wantedShelfInstance?.instanceId ?? null,
      targetX: wantedShelfInstance?.standX ?? null,
      targetY: wantedShelfInstance?.standY ?? null,
      carriedProductId: null,
      carriedProductName: null,
      carriedProductImagePath: null,
      carriedShelfId: null,

      status: routeState.status,
      currentZone,
      targetZone,

      enteringTime: this.getDefaultEnteringTime(),
      shoppingTime: this.getShoppingTimeByCustomerType(customerType),
      waitTime: Math.max(8, Math.round(customerType.patience * (Number(customerTrait?.patienceMultiplier) || 1))),
      waitingElapsedTime: 0,
      queueOrder: null,
      mood: "neutral",

      isSatisfied: false,
      hasReportedAngry: false,
      hasReportedLeft: false,
      nuisanceEffectApplied: false,
      nuisanceTimeoutApplied: false
    };
  },

  applyNuisanceSpawnEffects(customer) {
    // 진상 등장 자체로는 멘탈/만족도를 차감하지 않습니다.
    // 실제 결과는 3초 소프트 타이머와 선택지 효과에서만 발생합니다.
    return customer;
  },

  shouldCreatePositiveGuest(spawnOrdinal, customerType = {}) {
    if (customerType.id === "difficult") {
      return false;
    }

    if (this.guaranteedPositiveGuestSpawnIndex === spawnOrdinal) {
      return true;
    }

    const profile = this.getCustomerFlowProfile();

    return (
      this.positiveGuestCount < 2 &&
      Math.random() < Math.max(0, Number(profile.positiveGuestChance) || 0)
    );
  },

  pickPositiveGuestDialogue(seedValue = 0) {
    const dialogues = [
      "새로 인수하셨나 봐요. 잘 부탁해요!",
      "매장이 깔끔하네요. 자주 올게요!",
      "첫 영업 힘내세요. 계산 천천히 하셔도 돼요!",
      "동네에 편의점이 생겨서 좋네요!"
    ];
    const seed = Math.max(0, Math.floor(Number(seedValue) || 0));

    return dialogues[seed % dialogues.length];
  },

  pickNuisanceProfileIdForCustomer(customerType = {}, seedSource = "") {
    if (customerType.id !== "difficult") {
      return null;
    }

    const profileIds = getNuisanceProfileIds();

    if (profileIds.length === 0) {
      return null;
    }

    const seed = String(seedSource || `${GameState.day}-${this.customerIdCounter}`);
    let hash = 0;

    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }

    return profileIds[hash % profileIds.length] ?? null;
  },

  isNuisanceCustomerTypeOrAsset(customer = {}) {
    const nuisanceAssetVariantId = customer.nuisanceAssetVariantId ?? customer.assetVariantId ?? null;
    const assetProfileId = getNuisanceProfileIdForAssetVariantId(nuisanceAssetVariantId);

    return (
      customer.typeId === "difficult" ||
      customer.customerTypeId === "difficult" ||
      customer.isNuisance === true ||
      Boolean(customer.nuisanceProfileId) ||
      Boolean(assetProfileId) ||
      isNuisanceCustomerAssetVariantId(nuisanceAssetVariantId)
    );
  },

  pickCustomerEntryDialogue(customerType = {}, seedValue = 0) {
    const dialogues = Array.isArray(customerType.entryDialogues)
      ? customerType.entryDialogues.filter((dialogue) => {
          return String(dialogue ?? "").trim().length > 0;
        })
      : [];

    if (dialogues.length === 0) {
      return null;
    }

    const seed = Math.max(0, Math.floor(Number(seedValue) || 0));

    return dialogues[seed % dialogues.length];
  },

  pickCustomerType(spawnOrdinal = this.spawnedCustomerCount + 1) {
    if (
      GameState.day === 1 &&
      Number(spawnOrdinal) === Number(this.guaranteedNuisanceSpawnIndex)
    ) {
      return CUSTOMER_TYPES.find((type) => type.id === "difficult") ?? CUSTOMER_TYPES[0];
    }

    const weightedTypes = CUSTOMER_TYPES.map((type) => {
      if (GameState.day === 1 && type.id === "difficult") {
        return { type, weight: 0 };
      }

      return {
        type,
        weight: this.getCustomerTypeWeight(type)
      };
    }).filter((entry) => {
      return entry.weight > 0;
    });

    const safeWeightedTypes =
      weightedTypes.length > 0
        ? weightedTypes
        : CUSTOMER_TYPES.map((type) => {
            return { type, weight: type.weight };
          });

    const totalWeight = safeWeightedTypes.reduce((sum, entry) => {
      return sum + entry.weight;
    }, 0);

    let target = Math.random() * totalWeight;

    for (const entry of safeWeightedTypes) {
      target -= entry.weight;

      if (target <= 0) {
        return entry.type;
      }
    }

    return safeWeightedTypes[safeWeightedTypes.length - 1].type;
  },

  decideWantedProduct(customerType, customerTrait = null) {
    const availableWantedProducts = this.getAvailableWantedProducts();
    const safeCandidates = availableWantedProducts.length > 0
      ? availableWantedProducts
      : CUSTOMER_WANTED_PRODUCTS;

    return this.getWeightedWantedProduct(safeCandidates, customerType, customerTrait);
  },

  getCurrentDayScenario() {
    if (GameState.dayScenario?.day === GameState.day) {
      return GameState.dayScenario;
    }

    return getDayScenario(GameState.day);
  },

  getCustomerTypeWeight(customerType) {
    const scenario = this.getCurrentDayScenario();
    const scenarioWeight = Number(
      scenario.customerTypeWeights?.[customerType.id]
    );

    if (Number.isFinite(scenarioWeight)) {
      return Math.max(0, scenarioWeight);
    }

    return Math.max(0, Number(customerType.weight) || 0);
  },

  getCustomerEventChance(customerType) {
    const baseChance = Number(customerType.eventChance) || 0;
    const difficultyRate = Number(GameState.difficulty?.eventRate) || 1;
    const scenarioRate =
      Number(this.getCurrentDayScenario().eventRateMultiplier) || 1;

    return Math.min(0.95, baseChance * difficultyRate * scenarioRate);
  },

  getAvailableWantedProducts() {
    const scenario = this.getCurrentDayScenario();
    const scenarioWantedProductIds = new Set(scenario.wantedProductIds ?? []);
    const unlockedProducts = PRODUCTS.filter((product) => {
      return this.canCustomerChooseProduct(product);
    });
    const unlockedRequestIds = new Set();

    unlockedProducts.forEach((product) => {
      unlockedRequestIds.add(product.id);

      (product.customerRequestIds ?? []).forEach((requestId) => {
        unlockedRequestIds.add(requestId);
      });
    });

    const candidates = CUSTOMER_WANTED_PRODUCTS.filter((product) => {
      const isInScenario =
        scenarioWantedProductIds.size === 0 ||
        scenarioWantedProductIds.has(product.id);
      const isUnlocked = unlockedRequestIds.has(product.id);

      return isInScenario && isUnlocked;
    });

    if (candidates.length > 0) {
      return candidates;
    }

    return CUSTOMER_WANTED_PRODUCTS.filter((product) => {
      return unlockedRequestIds.has(product.id);
    });
  },

  startRouteTimer() {
    this.stopRouteTimer();

    /*
      실제 Date 객체는 사용하지 않음.
      1초마다 게임 내 손님 상태만 갱신한다.
    */
    this.routeTimerId = setInterval(() => {
      this.updateCustomersByTick(1);
    }, 1000);
  },

  stopRouteTimer() {
    if (!this.routeTimerId) return;

    clearInterval(this.routeTimerId);
    this.routeTimerId = null;
  },

  pauseCustomerWaitTime() {
    this.stopPostModalGraceTimer();
    this.isWaitTimePaused = true;
    this.isCustomerFlowPaused = true;
    this.pauseInitialSpawnTimer();
    this.pauseSpawnTimer();
  },

  resumeCustomerWaitTime(options = {}) {
    const graceMs = Math.max(0, Math.floor(Number(options.graceMs) || 0));

    this.stopPostModalGraceTimer();

    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) {
      this.isWaitTimePaused = false;
      this.isCustomerFlowPaused = true;
      return;
    }

    if (graceMs > 0) {
      this.isWaitTimePaused = true;
      this.isCustomerFlowPaused = true;
      this.postModalGraceTimerId = window.setTimeout(() => {
        this.postModalGraceTimerId = null;
        this.completeCustomerFlowResume();
      }, graceMs);
      return;
    }

    this.completeCustomerFlowResume();
  },

  completeCustomerFlowResume() {
    this.isWaitTimePaused = false;
    this.isCustomerFlowPaused = GameState.phase !== GAME_PHASE.STORE_RUNNING;

    if (!this.isCustomerFlowPaused) {
      this.resumeInitialSpawnTimer();
      this.resumeSpawnTimer();
    }
  },

  stopPostModalGraceTimer() {
    if (this.postModalGraceTimerId) {
      window.clearTimeout(this.postModalGraceTimerId);
    }

    this.postModalGraceTimerId = null;
  },

  updateCustomersByTick(amount) {
    if (this.isCustomerFlowPaused) {
      return;
    }

    const safeAmount = Math.max(0, Number(amount) || 0);
    let changed = false;

    this.flowElapsedSeconds += safeAmount;
    const demandPhase = this.updateDemandPhase();
    EventBus.emit(CUSTOMER_FLOW_TICK, {
      day: GameState.day,
      elapsedSeconds: this.flowElapsedSeconds,
      amount: safeAmount,
      demandPhaseId: demandPhase.id
    });
    this.updateRushState();
    this.updateOutOfStockMetric(safeAmount);
    this.pendingPickupQuantitiesByProductId = {};

    this.customers = this.customers.map((customer) => {
      if (customer.status === CUSTOMER_STATUS.ENTERING) {
        changed = true;
        return this.decreaseEnteringCustomerTime(customer, amount);
      }

      if (customer.status === CUSTOMER_STATUS.SHOPPING) {
        changed = true;
        return this.decreaseShoppingCustomerTime(customer, amount);
      }

      if (customer.status === CUSTOMER_STATUS.WAITING) {
        if (this.isWaitTimePaused) {
          return customer;
        }

        changed = true;
        return this.decreaseWaitingCustomerTime(customer, amount);
      }

      if (customer.status === CUSTOMER_STATUS.ANGRY) {
        changed = true;
        return this.markCustomerAsLeaving(customer, "angry_leave");
      }

      if (
        customer.status === CUSTOMER_STATUS.LEAVING &&
        Number(customer.leavingRenderTime) > 0
      ) {
        changed = true;
        return {
          ...customer,
          leavingRenderTime: Math.max(
            0,
            Number(customer.leavingRenderTime) - amount
          )
        };
      }

      return customer;
    });

    this.pendingPickupQuantitiesByProductId = {};
    this.updateFlowMetrics();

    if (changed) {
      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    }
  },

  transitionCustomerStatus(customer, nextStatus) {
    const routeState = this.getRouteStateByStatus(nextStatus);
    const preferredShelfId = customer.wantedShelfId ?? routeState.currentZone;
    const currentZone = this.getAccessibleCustomerZone(
      nextStatus === CUSTOMER_STATUS.SHOPPING ? preferredShelfId : routeState.currentZone
    );
    const targetZone = this.getAccessibleCustomerZone(routeState.targetZone, currentZone);

    return {
      ...customer,
      status: routeState.status,
      currentZone,
      targetZone
    };
  },

  getAccessibleCustomerZone(zone, fallbackZone = CUSTOMER_ZONES.DOOR) {
    const accessibleZones = Array.isArray(GameState.expansion?.customerAccessibleZones)
      ? GameState.expansion.customerAccessibleZones
      : [];

    if (
      accessibleZones.length === 0 ||
      accessibleZones.includes(zone) ||
      (this.isShelfZone(zone) && accessibleZones.includes(CUSTOMER_ZONES.SHELF))
    ) {
      return zone;
    }

    if (accessibleZones.includes(fallbackZone)) {
      return fallbackZone;
    }

    return accessibleZones[0] ?? CUSTOMER_ZONES.DOOR;
  },

  isShelfZone(zone) {
    return zone === CUSTOMER_ZONES.SHELF || CUSTOMER_SHELF_ZONE_IDS.has(zone);
  },

  getShelfIdForRequest(requestId) {
    const candidates = this.getPlacedSellableProductsForRequest(requestId);

    return candidates[0]?.shelfId ?? CUSTOMER_ZONES.SHELF;
  },

  getShelfInstanceForRequest(requestId) {
    const candidates = this.getPlacedSellableProductsForRequest(requestId);

    for (const product of candidates) {
      const shelfInstance = this.getShelfInstanceForProduct(product.id);

      if (shelfInstance) {
        return shelfInstance;
      }
    }

    return null;
  },

  isShelfZoneUnlocked(shelf) {
    const unlockedZoneIds = GameState.expansion?.unlockedZoneIds;

    if (!Array.isArray(unlockedZoneIds)) {
      return shelf?.zoneId === "zone_basic";
    }

    return unlockedZoneIds.includes(shelf?.zoneId);
  },

  getShelfInstanceForProduct(productId) {
    const shelfInstanceId = getShelfInstanceIdByProductId(productId);

    if (!shelfInstanceId) {
      return null;
    }

    const shelfInstance = getShelfInstanceById(shelfInstanceId);
    if (!this.isShelfZoneUnlocked(shelfInstance)) {
      return null;
    }
    return shelfInstance;
  },

  getCustomerResponsiveShelfTargetPosition(customer = {}) {
    const shelfInstanceId = customer.targetShelfInstanceId ??
      getShelfInstanceIdByProductId(customer.wantedProductId);
    const shelfInstance = shelfInstanceId ? getShelfInstanceById(shelfInstanceId) : null;

    if (
      shelfInstance &&
      Number.isFinite(Number(shelfInstance.standX)) &&
      Number.isFinite(Number(shelfInstance.standY))
    ) {
      return {
        x: Number(shelfInstance.standX),
        y: Number(shelfInstance.standY)
      };
    }

    const targetX = Number(customer.targetX);
    const targetY = Number(customer.targetY);

    if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
      return {
        x: targetX,
        y: targetY
      };
    }

    return null;
  },

  canCustomerChooseProduct(product) {
    return (
      Boolean(product?.id) &&
      BMSystem.canSellProduct(product.id) &&
      Boolean(this.getShelfInstanceForProduct(product.id))
    );
  },

  getPlacedSellableProductsForRequest(requestId) {
    return getProductsByCustomerRequestId(requestId)
      .filter((product) => {
        return this.canCustomerChooseProduct(product);
      });
  },

  getRouteStateByStatus(status) {
    const routeMap = {
      [CUSTOMER_STATUS.ENTERING]: {
        status: CUSTOMER_STATUS.ENTERING,
        currentZone: CUSTOMER_ZONES.DOOR,
        targetZone: CUSTOMER_ZONES.SHELF
      },
      [CUSTOMER_STATUS.SHOPPING]: {
        status: CUSTOMER_STATUS.SHOPPING,
        currentZone: CUSTOMER_ZONES.SHELF,
        targetZone: CUSTOMER_ZONES.COUNTER
      },
      [CUSTOMER_STATUS.WAITING]: {
        status: CUSTOMER_STATUS.WAITING,
        currentZone: CUSTOMER_ZONES.COUNTER,
        targetZone: CUSTOMER_ZONES.COUNTER
      },
      [CUSTOMER_STATUS.CHECKOUT]: {
        status: CUSTOMER_STATUS.CHECKOUT,
        currentZone: CUSTOMER_ZONES.COUNTER,
        targetZone: CUSTOMER_ZONES.EXIT
      },
      [CUSTOMER_STATUS.LEAVING]: {
        status: CUSTOMER_STATUS.LEAVING,
        currentZone: CUSTOMER_ZONES.EXIT,
        targetZone: CUSTOMER_ZONES.EXIT
      },
      [CUSTOMER_STATUS.ANGRY]: {
        status: CUSTOMER_STATUS.ANGRY,
        currentZone: CUSTOMER_ZONES.COUNTER,
        targetZone: CUSTOMER_ZONES.EXIT
      }
    };

    return routeMap[status] ?? routeMap[CUSTOMER_STATUS.ENTERING];
  },

  getDefaultEnteringTime() {
    return 2;
  },

  decreaseEnteringCustomerTime(customer, amount) {
    const safeAmount = Math.max(0, Number(amount) || 0);
    const rawEnteringTime = Number(customer.enteringTime);
    const currentEnteringTime = Number.isFinite(rawEnteringTime)
      ? Math.max(0, rawEnteringTime)
      : this.getDefaultEnteringTime();
    const nextEnteringTime = Math.max(0, currentEnteringTime - safeAmount);

    if (nextEnteringTime <= 0) {
      return {
        ...this.transitionCustomerStatus(customer, CUSTOMER_STATUS.SHOPPING),
        enteringTime: 0
      };
    }

    return {
      ...customer,
      enteringTime: nextEnteringTime
    };
  },

  getShoppingTimeByCustomerType(customerType) {
    const shoppingTimeMap = {
      hurried: 2,
      office_worker: 2,
      normal: 3,
      student: 3,
      difficult: 4
    };

    return shoppingTimeMap[customerType.id] ?? 3;
  },

  decreaseShoppingCustomerTime(customer, amount) {
    const safeAmount = Math.max(0, Number(amount) || 0);
    const currentShoppingTime = Math.max(0, Number(customer.shoppingTime) || 0);
    const nextShoppingTime = Math.max(0, currentShoppingTime - safeAmount);

    if (nextShoppingTime <= 0) {
      const rawSanitationValue = Number(GameState.sanitation?.value);
      const sanitationValue = Math.max(
        0,
        Math.min(100, Number.isFinite(rawSanitationValue) ? rawSanitationValue : 100)
      );

      if (
        customer.traitId === CUSTOMER_TRAIT_IDS.CLEAN &&
        sanitationValue < Number(CUSTOMER_TRAITS[CUSTOMER_TRAIT_IDS.CLEAN].sanitationThreshold || 60)
      ) {
        return this.markCustomerAsLeaving({
          ...customer,
          shoppingTime: 0,
          cleanlinessConcerned: true
        }, "low_sanitation_clean_customer");
      }

      const requestedQuantity = Math.max(1, Math.floor(Number(customer.wantedQuantity) || 1));
      let carriedQuantity = requestedQuantity;
      let carriedProduct = this.findStockedProductForRequest(
        customer.wantedProductId,
        carriedQuantity,
        customer.id
      );

      if (!carriedProduct && carriedQuantity > 1) {
        carriedQuantity = 1;
        carriedProduct = this.findStockedProductForRequest(
          customer.wantedProductId,
          carriedQuantity,
          customer.id
        );
      }

      if (!carriedProduct) {
        return this.markCustomerAsLeaving({
          ...customer,
          shoppingTime: 0
        }, "wanted_product_out_of_stock");
      }

      this.reservePickupQuantity(carriedProduct.id, carriedQuantity);

      this.consumeShelfStockForProduct(carriedProduct.id, carriedQuantity, {
        customerId: customer.id,
        shelfInstanceId: carriedProduct.shelfInstanceId ?? customer.targetShelfInstanceId ?? null
      });

      const waitingCustomer = {
        ...this.transitionCustomerStatus(customer, CUSTOMER_STATUS.WAITING),
        shoppingTime: 0,
        carriedProductId: carriedProduct.id,
        carriedProductName: BMSystem.getProductDisplayName(carriedProduct),
        carriedProductImagePath: carriedProduct.imagePath,
        carriedShelfId: carriedProduct.shelfId ?? customer.wantedShelfId ?? null,
        carriedQuantity,
        targetShelfInstanceId: carriedProduct.shelfInstanceId ?? customer.targetShelfInstanceId ?? null,
        targetX: null,
        targetY: null
      };

      return this.assignCounterQueueOrder(waitingCustomer);
    }

    return {
      ...customer,
      shoppingTime: nextShoppingTime
    };
  },

  assignCounterQueueOrder(customer) {
    if (Number.isFinite(Number(customer.queueOrder))) {
      return customer;
    }

    this.counterQueueOrderCounter += 1;

    return {
      ...customer,
      queueOrder: this.counterQueueOrderCounter
    };
  },

  decreaseWaitingCustomerTime(customer, amount) {
    const safeAmount = Math.max(0, Number(amount) || 0);
    const nextWaitTime = Math.max(0, customer.waitTime - safeAmount);

    const updatedCustomer = {
      ...customer,
      waitTime: nextWaitTime,
      waitingElapsedTime: Math.max(0, Number(customer.waitingElapsedTime) || 0) + safeAmount,
      mood: this.getMoodByWaitingPressure(customer, nextWaitTime)
    };

    if (nextWaitTime <= 0) {
      return this.markCustomerAsAngry(updatedCustomer, "wait_timeout");
    }

    return updatedCustomer;
  },

  findStockedProductForRequest(requestId, quantity = 1, customerId = null) {
    const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const candidates = this.getPlacedSellableProductsForRequest(requestId)
      .map((product) => {
        const stockQuantity = Number(
          this.inventoryByProductId[product.id]?.quantity
        ) || 0;
        const reservedQuantity =
          this.getReservedCarriedQuantity(product.id, customerId) +
          this.getPendingPickupQuantity(product.id);
        const inventoryAvailableQuantity = Math.max(0, stockQuantity - reservedQuantity);
        const shelfAvailability = this.getShelfAvailabilityForProduct(product.id);

        return {
          ...product,
          shelfInstanceId: shelfAvailability.shelfInstanceId,
          shelfAvailableQuantity: shelfAvailability.availableQuantity,
          availableQuantity: Math.min(
            inventoryAvailableQuantity,
            shelfAvailability.availableQuantity
          ),
          nextExpireDay:
            this.inventoryByProductId[product.id]?.nextExpireDay ??
            Number.POSITIVE_INFINITY
        };
      })
      .filter((product) => {
        return product.availableQuantity >= safeQuantity;
      })
      .sort((first, second) => {
        if (first.nextExpireDay !== second.nextExpireDay) {
          return first.nextExpireDay - second.nextExpireDay;
        }

        return first.name.localeCompare(second.name);
      });

    return candidates[0] ?? null;
  },

  getShelfAvailabilityForProduct(productId) {
  const resolvedProductId = String(productId ?? "")
    .trim()
    .replace(/-/g, "_");

  if (!resolvedProductId) {
    return {
      availableQuantity: 0,
      shelfInstanceId: null
    };
  }

  const shelfStocks = GameState.shelfStocks ?? {};
  const mappedShelfInstanceId = getShelfInstanceIdByProductId(resolvedProductId);

  if (mappedShelfInstanceId) {
    const shelfStock = shelfStocks[mappedShelfInstanceId];

    if (shelfStock?.products?.[resolvedProductId]) {
      return {
        availableQuantity: Math.max(
          0,
          Math.floor(
            Number(
              shelfStock.products[resolvedProductId].currentStock
            ) || 0
          )
        ),
        shelfInstanceId: mappedShelfInstanceId
      };
    }
  }

  for (const [instanceId, shelfStock] of Object.entries(shelfStocks)) {
    const productStock = shelfStock?.products?.[resolvedProductId];

    if (productStock) {
      return {
        availableQuantity: Math.max(
          0,
          Math.floor(Number(productStock.currentStock) || 0)
        ),
        shelfInstanceId: instanceId
      };
    }
  }

  return {
    availableQuantity: 0,
    shelfInstanceId: mappedShelfInstanceId ?? null
  };
},

  consumeShelfStockForProduct(productId, quantity = 1, options = {}) {
    const resolvedProductId = String(productId ?? "").trim().replace(/-/g, "_");
    const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

    if (!resolvedProductId) {
      return;
    }

    EventBus.emit(SHELF_STOCK_CONSUMED, {
      day: GameState.day,
      productId: resolvedProductId,
      quantity: safeQuantity,
      shelfInstanceId: options.shelfInstanceId ?? getShelfInstanceIdByProductId(resolvedProductId),
      customerId: options.customerId ?? null,
      source: "customer_pickup"
    });
  },

  getPendingPickupQuantity(productId) {
    const resolvedProductId = String(productId ?? "").trim().replace(/-/g, "_");

    if (!resolvedProductId) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(Number(this.pendingPickupQuantitiesByProductId[resolvedProductId]) || 0)
    );
  },

  reservePickupQuantity(productId, quantity = 1) {
    const resolvedProductId = String(productId ?? "").trim().replace(/-/g, "_");
    const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));

    if (!resolvedProductId) {
      return 0;
    }

    const nextQuantity = this.getPendingPickupQuantity(resolvedProductId) + safeQuantity;
    this.pendingPickupQuantitiesByProductId[resolvedProductId] = nextQuantity;

    return nextQuantity;
  },

  getReservedCarriedQuantity(productId, exceptCustomerId = null) {
    return this.customers.reduce((total, customer) => {
      if (
        customer.id === exceptCustomerId ||
        customer.carriedProductId !== productId ||
        customer.isSatisfied ||
        customer.hasReportedLeft ||
        customer.status === CUSTOMER_STATUS.LEAVING
      ) {
        return total;
      }

      return total + Math.max(1, Math.floor(Number(customer.carriedQuantity) || 1));
    }, 0);
  },

  getMoodByWaitingPressure(customer, waitTime) {
    const patience = Math.max(1, Number(customer.patience) || 1);
    const waitRatio = Math.max(0, waitTime) / patience;
    const angryThreshold = customer.typeId === "difficult" ? 0.6 : 0.25;

    if (waitRatio <= angryThreshold) {
      return "angry";
    }

    if (waitRatio <= 0.5) {
      return "impatient";
    }

    return customer.mood === "angry" ? "impatient" : "neutral";
  },

  markCustomerAsAngry(customer, reason = "unknown") {
    if (customer.hasReportedAngry) {
      return customer;
    }

    const angryCustomer = {
      ...customer,
      status: CUSTOMER_STATUS.ANGRY,
      mood: "angry",
      currentZone: CUSTOMER_ZONES.COUNTER,
      targetZone: CUSTOMER_ZONES.EXIT,
      hasReportedAngry: true
    };

    EventBus.emit(EVENTS.CUSTOMER_ANGRY, {
      ...this.createCustomerPayload(angryCustomer),
      reason
    });

    return angryCustomer;
  },

  markCustomerAsLeaving(customer, reason = "unknown") {
    if (customer.hasReportedLeft) {
      return customer;
    }

    const isWantedProductOutOfStock =
      reason === "wanted_product_out_of_stock";
    const isLowSanitationCleanCustomer =
      reason === "low_sanitation_clean_customer";
    const shouldShowDepartureBubble =
      isWantedProductOutOfStock || isLowSanitationCleanCustomer;

    const measuredCustomer = this.recordCustomerWaitMetric(customer);
    const leavingCustomer = {
      ...measuredCustomer,
      status: CUSTOMER_STATUS.LEAVING,
      currentZone: shouldShowDepartureBubble
        ? CUSTOMER_ZONES.DOOR
        : CUSTOMER_ZONES.EXIT,
      targetZone: CUSTOMER_ZONES.EXIT,
      leaveReason: reason,
      ...(shouldShowDepartureBubble
        ? {
            leavingRenderTime: 2,
            bubbleText: isLowSanitationCleanCustomer
              ? "매장이 조금 지저분하네요. 다음에 다시 올게요."
              : "앗, 찾던 상품이 없네… 다음에 올게요."
          }
        : {}),
      hasReportedLeft: true
    };

    if (isWantedProductOutOfStock) {
      const recommendedIds = new Set(this.getCurrentDayScenario().recommendedProductIds ?? []);

      if (recommendedIds.has(leavingCustomer.wantedProductId)) {
        this.ensureFlowStats();
        GameState.todayStats.popularProductLostCustomers += 1;
      }
    }

    EventBus.emit(EVENTS.CUSTOMER_LEFT, {
      ...this.createCustomerPayload(leavingCustomer),
      reason
    });

    return leavingCustomer;
  },

  handleCheckoutCompleted(data = {}) {
    const customer = this.getCheckoutCustomerForCompletion(data);

    if (!customer) {
      console.warn("[CustomerSystem] 계산 가능한 손님이 없습니다.");
      return;
    }

    if (
      data.wantedProductId &&
      data.wantedProductId !== customer.wantedProductId
    ) {
      console.warn(
        `[CustomerSystem] Checkout product mismatch: expected ${customer.wantedProductId}, received ${data.wantedProductId}`
      );
    }

    this.enrichCheckoutPayload(data, customer);

    const measuredCustomer = this.recordCustomerWaitMetric(customer);
    const qualifiesForPositiveProfile =
      measuredCustomer.positiveGuestRequiresFastCheckout !== true ||
      Number(measuredCustomer.waitingElapsedTime) <= Math.max(1, Number(measuredCustomer.fastCheckoutSeconds) || 4);
    const shouldGrantPositiveBonus =
      measuredCustomer.isPositiveGuest === true &&
      measuredCustomer.positiveGuestBonusApplied !== true &&
      qualifiesForPositiveProfile;
    const checkedOutCustomer = {
      ...measuredCustomer,
      status: CUSTOMER_STATUS.LEAVING,
      currentZone: CUSTOMER_ZONES.EXIT,
      targetZone: CUSTOMER_ZONES.EXIT,
      isSatisfied: true,
      mood: "neutral",
      positiveGuestBonusApplied:
        measuredCustomer.positiveGuestBonusApplied === true || shouldGrantPositiveBonus,

      /*
        CUSTOMER_LEFT는 이탈/손실 손님 통계로 사용하기 때문에
        만족한 손님은 CUSTOMER_LEFT를 emit하지 않는다.
      */
      hasReportedLeft: true
    };

    this.replaceCustomer(checkedOutCustomer);

    if (shouldGrantPositiveBonus) {
      const tipGold = Math.max(0, Number(checkedOutCustomer.positiveGuestTipGold) || 0);
      const satisfaction = Math.max(
        0,
        Number(checkedOutCustomer.positiveGuestSatisfaction) || 0
      );

      if (tipGold > 0) {
        EventBus.emit(EVENTS.REVENUE_CHANGED, {
          day: GameState.day,
          amount: tipGold,
          source: "positive_customer_tip",
          customerId: checkedOutCustomer.id
        });
      }

      EventBus.emit(POSITIVE_CUSTOMER_BONUS_GRANTED, {
        day: GameState.day,
        customerId: checkedOutCustomer.id,
        customerTypeId: checkedOutCustomer.typeId,
        tipGold,
        satisfaction,
        message: `단골 손님이 응원 팁 ₩${tipGold.toLocaleString("ko-KR")}을 남겼어요!`
      });
    }

    const fastCheckoutTipGold =
      checkedOutCustomer.traitId === CUSTOMER_TRAIT_IDS.QUICK &&
      Number(checkedOutCustomer.waitingElapsedTime) <= Math.max(1, Number(checkedOutCustomer.fastCheckoutSeconds) || 4)
        ? Math.max(0, Number(checkedOutCustomer.fastCheckoutTipGold) || 0)
        : 0;

    if (fastCheckoutTipGold > 0) {
      EventBus.emit(EVENTS.REVENUE_CHANGED, {
        day: GameState.day,
        amount: fastCheckoutTipGold,
        source: "quick_customer_tip",
        customerId: checkedOutCustomer.id
      });
      EventBus.emit(POSITIVE_CUSTOMER_BONUS_GRANTED, {
        day: GameState.day,
        customerId: checkedOutCustomer.id,
        customerTypeId: checkedOutCustomer.typeId,
        tipGold: fastCheckoutTipGold,
        satisfaction: 0,
        message: `빠른 계산에 고마워하며 팁 ₩${fastCheckoutTipGold.toLocaleString("ko-KR")}을 남겼어요!`
      });
    }

    EventBus.emit(EVENTS.CUSTOMER_SATISFIED, {
      ...this.createCustomerPayload(checkedOutCustomer),
      checkoutId: data.checkoutId ?? null,
      productId: data.productId ?? null,
      productName: data.productName ?? null,
      quantity: data.quantity ?? 1,
      checkoutAmount: data.amount ?? 0
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  recordCustomerWaitMetric(customer = {}) {
    if (customer.waitMetricRecorded === true) {
      return customer;
    }

    const waitSeconds = Math.max(0, Number(customer.waitingElapsedTime) || 0);

    if (waitSeconds > 0) {
      this.ensureFlowStats();
      GameState.todayStats.customerWaitTimeTotal += waitSeconds;
      GameState.todayStats.customerWaitSampleCount += 1;
    }

    return {
      ...customer,
      waitMetricRecorded: true
    };
  },

  enrichCheckoutPayload(data = {}, customer = null) {
    if (!customer) {
      return data;
    }

    const quantity = Math.max(
      1,
      Math.floor(Number(data.quantity) || Number(customer.carriedQuantity) || Number(customer.wantedQuantity) || 1)
    );
    const carriedProduct =
      getProductById(customer.carriedProductId) ??
      this.findStockedProductForRequest(
        customer.wantedProductId,
        quantity,
        customer.id
      );

    data.day = Math.max(1, Math.floor(Number(data.day) || GameState.day || 1));
    data.customerId = data.customerId ?? customer.id;
    data.wantedProductId = data.wantedProductId ?? customer.wantedProductId;
    data.checkoutId =
      data.checkoutId ??
      `checkout-${data.day}-${customer.id}`;
    data.quantity = quantity;

    if (carriedProduct) {
      const shouldNormalizeAmount = !data.productId;

      data.productId = data.productId ?? carriedProduct.id;
      data.productName = data.productName ?? BMSystem.getProductDisplayName(carriedProduct);

      if (
        shouldNormalizeAmount ||
        !Number.isFinite(Number(data.amount)) ||
        Number(data.amount) <= 0
      ) {
        data.amount = BMSystem.getProductSalePrice(carriedProduct) * quantity;
      }
    }

    return data;
  },

  normalizeCheckoutCompletedPayload(data = {}) {
    if (data.day === undefined || data.day === null) {
      data.day = GameState.day;
    }

    return data;
  },

  getCheckoutCustomerForCompletion(data = {}) {
    if (data.customerId) {
      const customer = this.getCustomerById(data.customerId);

      if (customer && this.isCheckoutCandidate(customer)) {
        return customer;
      }

      console.warn(
        `[CustomerSystem] Checkout customer not found or unavailable: ${data.customerId}`
      );

      return null;
    }

    return this.getNextCheckoutCustomer();
  },

  closeCustomerFlow() {
    this.stopInitialSpawnTimer();
    this.stopRouteTimer();
    this.stopSpawnTimer();
    this.isCustomerFlowPaused = true;
    this.isWaitTimePaused = false;

    this.customers.forEach((customer) => {
      const shouldReportLeave =
        customer.status !== CUSTOMER_STATUS.LEAVING &&
        !customer.isSatisfied &&
        !customer.hasReportedLeft;

      if (shouldReportLeave) {
        this.markCustomerAsLeaving(customer, "store_closed");
      }
    });

    this.customers = [];
    this.pendingPickupQuantitiesByProductId = {};

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  replaceCustomer(updatedCustomer) {
    this.customers = this.customers.map((customer) => {
      if (customer.id !== updatedCustomer.id) {
        return customer;
      }

      return updatedCustomer;
    });
  },

  getCustomerById(customerId) {
    if (!customerId) {
      return null;
    }

    return this.customers.find((customer) => {
      return customer.id === customerId;
    }) ?? null;
  },

  createCustomerPayload(customer) {
    const shelfTargetPosition = this.getCustomerResponsiveShelfTargetPosition(customer);

    return {
      day: GameState.day,

      customerId: customer.id,
      customerTypeId: customer.typeId,
      customerTypeName: customer.typeName,
      entryDialogueText: customer.entryDialogueText ?? null,
      traitId: customer.traitId ?? null,
      traitLabel: customer.traitLabel ?? null,
      traitIcon: customer.traitIcon ?? null,
      wantedQuantity: Math.max(1, Math.floor(Number(customer.wantedQuantity) || 1)),
      carriedQuantity: Math.max(0, Math.floor(Number(customer.carriedQuantity) || 0)),
      positiveGuestProfileId: customer.positiveGuestProfileId ?? null,
      positiveGuestProfileLabel: customer.positiveGuestProfileLabel ?? null,

      wantedProductId: customer.wantedProductId,
      wantedProductName: customer.wantedProductName,
      carriedProductId: customer.carriedProductId ?? null,
      carriedProductName: customer.carriedProductName ?? null,
      carriedProductImagePath: customer.carriedProductImagePath ?? null,
      wantedShelfId: customer.wantedShelfId ?? null,
      carriedShelfId: customer.carriedShelfId ?? null,
      targetShelfInstanceId: customer.targetShelfInstanceId ?? null,
      targetX: shelfTargetPosition?.x ?? customer.targetX ?? null,
      targetY: shelfTargetPosition?.y ?? customer.targetY ?? null,

      status: customer.status,
      currentZone: customer.currentZone,
      targetZone: customer.targetZone,
      waitTime: customer.waitTime,
      initialPatience: Math.max(1, Number(customer.initialPatience) || 1),
      waitingElapsedTime: Math.max(0, Number(customer.waitingElapsedTime) || 0),
      patienceRatio: Math.max(
        0,
        Math.min(
          1,
          (Number(customer.waitTime) || 0) /
            Math.max(1, Number(customer.initialPatience) || 1)
        )
      ),
      mood: customer.mood,
      isPositiveGuest: customer.isPositiveGuest === true,
      positiveGuestTipGold: Math.max(0, Number(customer.positiveGuestTipGold) || 0),
      positiveGuestSatisfaction: Number(customer.positiveGuestSatisfaction) || 0,
      nuisanceEffectApplied: customer.nuisanceEffectApplied === true,
      nuisanceTimeoutApplied: customer.nuisanceTimeoutApplied === true,
      isNuisance: this.isNuisanceCustomerTypeOrAsset(customer),
      nuisanceProfileId: customer.nuisanceProfileId ?? null,
      nuisanceAssetVariantId: customer.nuisanceAssetVariantId ?? customer.assetVariantId ?? null,
      assetVariantId: customer.assetVariantId ?? customer.nuisanceAssetVariantId ?? null,
      nuisanceEventRequired: customer.nuisanceEventRequired === true,
      nuisanceEventOpened: customer.nuisanceEventOpened === true,
      nuisanceEventResolved: customer.nuisanceEventResolved === true,
      nuisanceCheckoutDelayMs: Number(customer.nuisanceCheckoutDelayMs) || 0
    };
  },

  createRenderableCustomerPayload(customer) {
    const shelfTargetPosition = this.getCustomerResponsiveShelfTargetPosition(customer);

    return {
      customerId: customer.id,
      typeId: customer.typeId,
      typeName: customer.typeName,
      entryDialogueText: customer.entryDialogueText ?? null,
      traitId: customer.traitId ?? null,
      traitLabel: customer.traitLabel ?? null,
      traitIcon: customer.traitIcon ?? null,
      wantedQuantity: Math.max(1, Math.floor(Number(customer.wantedQuantity) || 1)),
      carriedQuantity: Math.max(0, Math.floor(Number(customer.carriedQuantity) || 0)),
      positiveGuestProfileId: customer.positiveGuestProfileId ?? null,
      positiveGuestProfileLabel: customer.positiveGuestProfileLabel ?? null,
      wantedProductId: customer.wantedProductId,
      wantedProductName: customer.wantedProductName,
      carriedProductId: customer.carriedProductId ?? null,
      carriedProductName: customer.carriedProductName ?? null,
      carriedProductImagePath:
        customer.carriedProductImagePath ??
        getProductById(customer.carriedProductId)?.imagePath ??
        null,
      wantedShelfId: customer.wantedShelfId ?? null,
      carriedShelfId: customer.carriedShelfId ?? null,
      targetShelfInstanceId: customer.targetShelfInstanceId ?? null,
      targetX: shelfTargetPosition?.x ?? customer.targetX ?? null,
      targetY: shelfTargetPosition?.y ?? customer.targetY ?? null,
      status: customer.status,
      currentZone: customer.currentZone,
      targetZone: customer.targetZone,
      waitTime: customer.waitTime,
      initialPatience: Math.max(1, Number(customer.initialPatience) || 1),
      waitingElapsedTime: Math.max(0, Number(customer.waitingElapsedTime) || 0),
      patienceRatio: Math.max(
        0,
        Math.min(
          1,
          (Number(customer.waitTime) || 0) /
            Math.max(1, Number(customer.initialPatience) || 1)
        )
      ),
      mood: customer.mood,
      isPositiveGuest: customer.isPositiveGuest === true,
      positiveGuestTipGold: Math.max(0, Number(customer.positiveGuestTipGold) || 0),
      positiveGuestSatisfaction: Number(customer.positiveGuestSatisfaction) || 0,
      queueOrder: customer.queueOrder,
      isSatisfied: customer.isSatisfied,
      leaveReason: customer.leaveReason ?? null,
      leavingRenderTime: customer.leavingRenderTime ?? 0,
      bubbleText: customer.bubbleText ?? null,
      isNuisance: this.isNuisanceCustomerTypeOrAsset(customer),
      nuisanceProfileId: customer.nuisanceProfileId ?? null,
      nuisanceAssetVariantId: customer.nuisanceAssetVariantId ?? customer.assetVariantId ?? null,
      assetVariantId: customer.assetVariantId ?? customer.nuisanceAssetVariantId ?? null,
      nuisanceEventRequired: customer.nuisanceEventRequired === true,
      nuisanceEventOpened: customer.nuisanceEventOpened === true,
      nuisanceEventResolved: customer.nuisanceEventResolved === true
    };
  },

  getRenderableCustomers() {
    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) {
      return [];
    }

    return this.customers
      .filter((customer) => {
        const shouldRenderLeavingCustomer =
          customer.status === CUSTOMER_STATUS.LEAVING &&
          Number(customer.leavingRenderTime) > 0;

        return (
          shouldRenderLeavingCustomer ||
          (
            customer.status !== CUSTOMER_STATUS.LEAVING &&
            !customer.hasReportedLeft
          )
        );
      })
      .map((customer) => {
        return this.createRenderableCustomerPayload(customer);
      });
  },

  getCustomersByStatus(status) {
    return this.customers.filter((customer) => {
      return customer.status === status;
    });
  },

  getCustomersByZone(zone) {
    return this.customers.filter((customer) => {
      return customer.currentZone === zone;
    });
  },

  getCustomersNearDoor() {
    return this.getCustomersByZone(CUSTOMER_ZONES.DOOR);
  },

  getCustomersNearShelf() {
    return this.customers.filter((customer) => {
      return this.isShelfZone(customer.currentZone);
    });
  },

  getWaitingCustomers() {
    return this.customers.filter((customer) => {
      return this.isCheckoutReadyCustomer(customer);
    });
  },

  isCheckoutReadyCustomer(customer) {
    if (!this.isCheckoutCandidate(customer)) {
      return false;
    }

    if (
      customer.status !== CUSTOMER_STATUS.WAITING ||
      customer.currentZone !== CUSTOMER_ZONES.COUNTER ||
      !customer.carriedProductId
    ) {
      return false;
    }

    const stockQuantity = Number(
      this.inventoryByProductId[customer.carriedProductId]?.quantity
    ) || 0;

    return stockQuantity > 0;
  },

  /*
    v2.2.1 병합 안정화:
    계산 대상 손님 조회 범위를 보완한다.

    우선순위:
    1. 계산대에서 waiting 상태인 손님
    2. 계산대 근처에 있는 active 손님
    3. shopping 상태 손님
    4. entering 상태 손님

    이유:
    - 테스트 타이밍에 따라 손님이 아직 waiting 상태가 아닐 수 있음
    - 팀원 시스템 연결 전까지 계산 이벤트가 먼저 발생해도 NPC 만족 처리가 가능해야 함
  */
  getCheckoutCandidates() {
    return this.customers.filter((customer) => {
      return this.isCheckoutReadyCustomer(customer);
    });
  },

  isCheckoutCandidate(customer) {
    if (!customer) {
      return false;
    }

    return (
      !customer.isSatisfied &&
      !customer.hasReportedLeft &&
      customer.status !== CUSTOMER_STATUS.LEAVING
    );
  },

  getNextCheckoutCustomer() {
    const waitingCustomer = this.getWaitingCustomers()[0];

    if (waitingCustomer) {
      return waitingCustomer;
    }

    return null;
  },

  markCustomerAsCheckout(customerId) {
    const customer = this.getCustomerById(customerId);

    if (!this.isCheckoutCandidate(customer)) {
      return null;
    }

    const checkoutCustomer = this.transitionCustomerStatus(
      customer,
      CUSTOMER_STATUS.CHECKOUT
    );

    this.replaceCustomer(checkoutCustomer);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return this.createCustomerPayload(checkoutCustomer);
  },

  handleStockShortageForCustomer(customerId, reason = "stock_shortage") {
    const customer = this.getCustomerById(customerId);

    if (!this.isCheckoutCandidate(customer)) {
      return null;
    }

    /*
      Prepared for a future EventBus contract with checkout or inventory systems.
      This is intentionally not wired to InventorySystem or PlayerActionSystem yet.
    */
    const updatedCustomer =
      customer.typeId === "difficult"
        ? this.markCustomerAsAngry(customer, reason)
        : this.markCustomerAsLeaving(customer, reason);

    this.replaceCustomer(updatedCustomer);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return this.createCustomerPayload(updatedCustomer);
  },

  getAngryCustomers() {
    return this.getCustomersByStatus(CUSTOMER_STATUS.ANGRY);
  },

  getActiveCustomers() {
    return this.customers.filter((customer) => {
      return (
        customer.status !== CUSTOMER_STATUS.LEAVING &&
        !customer.isSatisfied &&
        !customer.hasReportedLeft
      );
    });
  },

  getCheckoutCustomerPayload() {
    const customer = this.getNextCheckoutCustomer();

    if (!customer) {
      return null;
    }

    return this.createCustomerPayload(customer);
  },

  getAvailableEventsForCustomer(customer) {
    return RandomEventSystem.getAvailableEventsForCustomer(customer, GameState.day);
  },

  canTriggerCustomerEvent(customer, randomValue = Math.random()) {
    const event = this.pickCustomerEvent(customer, randomValue);

    if (!event) {
      return false;
    }

    return RandomEventSystem.canTriggerEvent(customer, event, randomValue);
  },

  pickCustomerEvent(customer, randomValue = Math.random()) {
    return RandomEventSystem.pickEventForCustomer(customer, randomValue);
  },

  markCustomerNuisanceEvent(customerId, eventDetail = {}) {
    if (!customerId || eventDetail.isNuisance !== true) {
      return null;
    }

    const customer = this.getCustomerById(customerId);

    if (!customer) {
      return null;
    }

    const nuisanceProfileId =
      eventDetail.nuisanceProfileId ??
      customer.nuisanceProfileId ??
      getNuisanceProfileIdForAssetVariantId(
        customer.nuisanceAssetVariantId ?? customer.assetVariantId
      ) ??
      null;
    const nuisanceAssetVariantId =
      customer.nuisanceAssetVariantId ??
      customer.assetVariantId ??
      getNuisanceAssetVariantIdForProfile(nuisanceProfileId, customer.id);
    const updatedCustomer = {
      ...customer,
      isNuisance: true,
      nuisanceProfileId,
      nuisanceAssetVariantId,
      assetVariantId: nuisanceAssetVariantId ?? customer.assetVariantId ?? null,
      nuisanceEventRequired: true,
      nuisanceEventOpened: true,
      nuisanceEventResolved: customer.nuisanceEventResolved === true,
      nuisanceCheckoutDelayMs: 0
    };

    this.replaceCustomer(updatedCustomer);

    return updatedCustomer;
  },

  resolveNuisanceEventForCustomer(customerId, eventPayload = {}) {
    if (!customerId) {
      return null;
    }

    const customer = this.getCustomerById(customerId);

    if (!customer || !this.isNuisanceCustomerTypeOrAsset(customer)) {
      return null;
    }

    const updatedCustomer = {
      ...customer,
      isNuisance: true,
      nuisanceProfileId:
        eventPayload.nuisanceProfileId ?? customer.nuisanceProfileId ?? null,
      nuisanceEventRequired: true,
      nuisanceEventOpened: true,
      nuisanceEventResolved: true,
      // 선택지 처리 후 진상 손님은 공통적으로 5초 응대 후딜을 가진다.
      nuisanceCheckoutDelayMs: NUISANCE_CHECKOUT_DELAY_MS
    };

    this.replaceCustomer(updatedCustomer);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return this.createCustomerPayload(updatedCustomer);
  },

  isNuisanceEventPendingForCustomer(customerId) {
    const customer = this.getCustomerById(customerId);

    return this.needsNuisanceEventBeforeCheckout(customer);
  },

  needsNuisanceEventBeforeCheckout(customer) {
    return (
      this.isCheckoutReadyCustomer(customer) &&
      this.isNuisanceCustomerTypeOrAsset(customer) &&
      customer.nuisanceEventResolved !== true
    );
  },

  getGuaranteedNuisanceEventTargetCustomer() {
    const candidates = this.getWaitingCustomers()
      .filter((customer) => {
        const hasSafeCounterWait =
          Math.max(0, Number(customer.waitingElapsedTime) || 0) >=
          CUSTOMER_EVENT_SAFE_WAIT_SECONDS;
        const hasRequiredDayOneCheckout =
          GameState.day !== 1 ||
          Math.max(0, Number(GameState.todayStats?.checkoutSuccessCount) || 0) >= 1;

        return (
          this.needsNuisanceEventBeforeCheckout(customer) &&
          hasSafeCounterWait &&
          hasRequiredDayOneCheckout &&
          RandomEventSystem.getGuaranteedNuisanceEventsForCustomer(
            customer,
            GameState.day
          ).length > 0
        );
      })
      .sort((first, second) => {
        const firstOrder = Number(first.queueOrder);
        const secondOrder = Number(second.queueOrder);
        const firstSortOrder = Number.isFinite(firstOrder)
          ? firstOrder
          : Number.POSITIVE_INFINITY;
        const secondSortOrder = Number.isFinite(secondOrder)
          ? secondOrder
          : Number.POSITIVE_INFINITY;

        return firstSortOrder - secondSortOrder;
      });

    return candidates[0] ?? null;
  },

  createGuaranteedNuisanceEventPayload() {
    const customer = this.getGuaranteedNuisanceEventTargetCustomer();

    if (!customer) {
      return null;
    }

    const eventCandidates = RandomEventSystem.getGuaranteedNuisanceEventsForCustomer(
      customer,
      GameState.day
    );

    for (const eventDetail of eventCandidates) {
      const eventCustomer =
        this.markCustomerNuisanceEvent(customer.id, eventDetail) ?? customer;
      const payload = RandomEventSystem.createEventPayload(eventCustomer, eventDetail, {
        forceEnableChoices: true
      });

      if (payload) {
        return payload;
      }
    }

    return null;
  },

  getRandomEventTargetCustomer() {
    const candidates = this.getWaitingCustomers().filter((customer) => {
      return this.getAvailableEventsForCustomer(customer).length > 0;
    });

    return RandomEventSystem.pickEventTargetCustomer(candidates, GameState.day);
  },

  createRandomEventCandidatePayload() {
    const guaranteedNuisancePayload = this.createGuaranteedNuisanceEventPayload();

    if (guaranteedNuisancePayload) {
      return guaranteedNuisancePayload;
    }

    const customer = this.getRandomEventTargetCustomer();

    if (!customer) {
      return null;
    }

    const eventDetail = this.pickCustomerEvent(customer);

    if (!eventDetail) {
      return null;
    }

    const eventCustomer =
      this.markCustomerNuisanceEvent(customer.id, eventDetail) ?? customer;

    return RandomEventSystem.createEventPayload(eventCustomer, eventDetail);
  },

  getNowMs() {
    return Math.floor(window.performance?.now?.() ?? 0);
  },

  isGamePaused() {
    return Boolean(document.body?.classList?.contains("is-game-paused"));
  }
};
