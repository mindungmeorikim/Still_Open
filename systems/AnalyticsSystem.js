/*
  AnalyticsSystem.js
  역할: GameAnalytics SDK 로딩, 동의 상태, 공통 이벤트 전송
  원칙: 분석 SDK 실패가 게임 본체 실행을 막지 않도록 모든 호출을 방어적으로 처리합니다.
*/

import {
  ANALYTICS_CONFIG,
  hasValidAnalyticsKeys
} from "../config/analytics.config.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_CONFIG } from "../core/Constants.js";
import { REWARD_CODE_EVENTS } from "./RewardCodeSystem.js";
import {
  UserIdentitySystem,
  USER_IDENTITY_EVENTS
} from "./UserIdentitySystem.js";

const CONSENT_KEY = "still_open_analytics_consent";
const SDK_SCRIPT_ID = "gameanalytics-sdk-script";
const FIRST_EVENT_ID = "game:start";
const STORY_PROGRESSION_ROOT = "main";
const PROGRESSION_STATUS = Object.freeze({
  START: 1,
  COMPLETE: 2,
  FAIL: 3
});
const RESOURCE_FLOW = Object.freeze({
  SOURCE: "Source",
  SINK: "Sink"
});
const CURRENCY_CHANGED_EVENT = "CURRENCY_CHANGED";
const EXPANSION_CONSTRUCTION_STARTED = "EXPANSION_CONSTRUCTION_STARTED";
const STAFF_UNPAID_WAGE_PAID = "STAFF_UNPAID_WAGE_PAID";
const STAFF_HIRED = "STAFF_HIRED";
const CUSTOMER_EVENT_OPENED = "CUSTOMER_EVENT_OPENED";
const CUSTOMER_EVENT_CHOICE_SELECTED = "CUSTOMER_EVENT_CHOICE_SELECTED";
const CUSTOMER_EVENT_RESPONSE_TIMEOUT = "CUSTOMER_EVENT_RESPONSE_TIMEOUT";
const STAFF_ASSIST_TASK_COMPLETED = "STAFF_ASSIST_TASK_COMPLETED";
const ANALYTICS_ERROR_MESSAGE_LIMIT = 500;

const SHOP_SUCCESS_EVENTS = Object.freeze({
  BM_CONTRACT_PURCHASED: "contract",
  BM_PREMIUM_PRODUCT_PURCHASED: "premium_product",
  BM_CONTRACT_UNLOCK_SKIPPED: "contract_skip",
  BM_DIAMOND_PRODUCT_PURCHASED: "diamond_pack",
  BM_GOLD_PRODUCT_PURCHASED: "gold_pack",
  BM_PEAK_COUPON_PURCHASED: "peak_coupon",
  BM_WAREHOUSE_UPGRADED: "warehouse_upgrade",
  BM_SHELF_UPGRADED: "shelf_upgrade",
  BM_PRODUCT_UPGRADED: "product_upgrade",
  BM_STAFF_ABILITY_UPGRADED: "staff_upgrade"
});
const SHOP_FAILURE_EVENTS = Object.freeze([
  "BM_CONTRACT_PURCHASE_FAILED",
  "BM_PREMIUM_PRODUCT_PURCHASE_FAILED",
  "BM_CONTRACT_UNLOCK_SKIP_FAILED",
  "BM_SHOP_PURCHASE_FAILED",
  "BM_PEAK_COUPON_FAILED"
]);

let initializationRequested = false;
let initialized = false;
let sdkLoaded = false;
let sdkReady = false;
let sdkLoadPromise = null;
let readyListenerRegistered = false;
let firstEventSent = false;
let lastErrorMessage = "";
let gameProgressionListenersBound = false;
let economyListenersBound = false;
let shopListenersBound = false;
let communityCouponListenersBound = false;
let errorListenersBound = false;
let gameplayUxListenersBound = false;
const pendingDesignEvents = [];
const pendingProgressionEvents = [];
const pendingResourceEvents = [];
const pendingErrorEvents = [];

// BlueStacks/저사양 WebView에서는 SDK의 이벤트 직렬화·서명·DEV 로그가
// 같은 프레임의 게임 렌더링과 겹치면 순간적인 프레임 드롭이 생길 수 있습니다.
// 분석 이벤트는 한 번에 하나씩 브라우저 유휴 시간에 전송해 게임 렌더링과 분리합니다.
const ANALYTICS_IDLE_TIMEOUT_MS = 2500;
const ANALYTICS_FALLBACK_DELAY_MS = 350;
let analyticsFlushScheduled = false;

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (_error) {
    return false;
  }
}

function ensureCommandQueue() {
  if (typeof window.GameAnalytics === "function") {
    return window.GameAnalytics;
  }

  const commandQueue = function (...args) {
    commandQueue.q = commandQueue.q || [];
    commandQueue.q.push(args);
  };

  commandQueue.q = [];
  window.GameAnalytics = commandQueue;
  return commandQueue;
}

function callGameAnalytics(command, ...args) {
  try {
    const queue = ensureCommandQueue();
    queue(command, ...args);
    return true;
  } catch (error) {
    lastErrorMessage = String(error?.message ?? error ?? "Unknown analytics error");
    console.warn("[AnalyticsSystem]", command, error);
    return false;
  }
}

function getResolvedSdkUrl() {
  const configuredUrl = String(ANALYTICS_CONFIG.sdkUrl ?? "").trim();

  if (!configuredUrl) {
    return "https://unpkg.com/gameanalytics@5.0.0/dist/GameAnalytics.min.js";
  }

  // GameAnalytics 5.0.0의 비압축 브라우저 빌드는 CryptoJS를 전역 의존성으로 참조합니다.
  // 공식 UMD 배포본인 min.js는 CryptoJS를 함께 포함하므로 브라우저/PWA에서는 min.js를 사용합니다.
  return configuredUrl.replace(
    /\/GameAnalytics\.js(?=([?#]|$))/i,
    "/GameAnalytics.min.js"
  );
}

function loadSdk() {
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    ensureCommandQueue();

    const existingScript = document.getElementById(SDK_SCRIPT_ID);

    if (existingScript?.dataset.loaded === "true") {
      sdkLoaded = true;
      resolve(true);
      return;
    }

    const script = existingScript ?? document.createElement("script");
    script.id = SDK_SCRIPT_ID;
    script.async = true;
    script.src = getResolvedSdkUrl();
    script.crossOrigin = "anonymous";

    script.onload = () => {
      script.dataset.loaded = "true";
      sdkLoaded = true;
      lastErrorMessage = "";
      resolve(true);
    };

    script.onerror = () => {
      lastErrorMessage = "GameAnalytics SDK를 불러오지 못했습니다.";
      sdkLoadPromise = null;
      sdkLoaded = false;
      sdkReady = false;
      initialized = false;
      initializationRequested = false;
      readyListenerRegistered = false;
      firstEventSent = false;
      pendingDesignEvents.length = 0;
      pendingProgressionEvents.length = 0;
      pendingResourceEvents.length = 0;
      pendingErrorEvents.length = 0;

      if (Array.isArray(window.GameAnalytics?.q)) {
        window.GameAnalytics.q.length = 0;
      }

      script.remove();
      reject(new Error(lastErrorMessage));
    };

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });

  sdkLoadPromise.catch((error) => {
    console.warn("[AnalyticsSystem] SDK load failed:", error);
  });

  return sdkLoadPromise;
}

function sendDesignEventNow(eventName, value = null) {
  if (Number.isFinite(value)) {
    return callGameAnalytics("addDesignEvent", eventName, Number(value));
  }

  return callGameAnalytics("addDesignEvent", eventName);
}

function sendResourceEventNow({ flow, currency, amount, itemType, itemId }) {
  return callGameAnalytics(
    "addResourceEvent",
    flow,
    currency,
    amount,
    itemType,
    itemId
  );
}

function sendErrorEventNow({ severity, message }) {
  return callGameAnalytics("addErrorEvent", severity, message);
}

function sendNextQueuedAnalyticsEvent() {
  if (!sdkReady || safeStorageGet(CONSENT_KEY) !== "granted") {
    return false;
  }

  // 한 유휴 구간에는 이벤트 하나만 처리하여 렌더링 프레임을 오래 점유하지 않습니다.
  if (pendingDesignEvents.length > 0) {
    const event = pendingDesignEvents.shift();
    sendDesignEventNow(event.eventName, event.value);
    return true;
  }

  if (pendingProgressionEvents.length > 0) {
    sendProgressionEventNow(pendingProgressionEvents.shift());
    return true;
  }

  if (pendingResourceEvents.length > 0) {
    sendResourceEventNow(pendingResourceEvents.shift());
    return true;
  }

  if (pendingErrorEvents.length > 0) {
    sendErrorEventNow(pendingErrorEvents.shift());
    return true;
  }

  return false;
}

function scheduleAnalyticsFlush() {
  if (
    analyticsFlushScheduled ||
    !sdkReady ||
    safeStorageGet(CONSENT_KEY) !== "granted" ||
    (
      pendingDesignEvents.length === 0 &&
      pendingProgressionEvents.length === 0 &&
      pendingResourceEvents.length === 0 &&
      pendingErrorEvents.length === 0
    )
  ) {
    return;
  }

  analyticsFlushScheduled = true;

  const run = () => {
    analyticsFlushScheduled = false;

    if (!sdkReady || safeStorageGet(CONSENT_KEY) !== "granted") {
      return;
    }

    sendNextQueuedAnalyticsEvent();

    if (
      pendingDesignEvents.length > 0 ||
      pendingProgressionEvents.length > 0 ||
      pendingResourceEvents.length > 0 ||
      pendingErrorEvents.length > 0
    ) {
      scheduleAnalyticsFlush();
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: ANALYTICS_IDLE_TIMEOUT_MS });
    return;
  }

  window.setTimeout(run, ANALYTICS_FALLBACK_DELAY_MS);
}

function normalizeProgressionStatus(status) {
  if (Number.isInteger(status) && status >= 1 && status <= 3) {
    return status;
  }

  const normalized = String(status ?? "").trim().toLowerCase();

  if (normalized === "start") return PROGRESSION_STATUS.START;
  if (normalized === "complete") return PROGRESSION_STATUS.COMPLETE;
  if (normalized === "fail") return PROGRESSION_STATUS.FAIL;

  return null;
}

function normalizeProgressionPart(value) {
  return String(value ?? "").trim();
}

function sendProgressionEventNow({
  status,
  progression01,
  progression02 = "",
  progression03 = "",
  score = null
}) {
  const args = [
    "addProgressionEvent",
    status,
    progression01,
    progression02,
    progression03
  ];

  if (Number.isFinite(score)) {
    args.push(Number(score));
  }

  return callGameAnalytics(...args);
}



function normalizeAnalyticsToken(value, fallback = "unknown") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  return normalized || fallback;
}

function getCurrencyResourceDescriptor(data = {}) {
  const reason = String(data.reason ?? "").trim();
  const meta = data.meta && typeof data.meta === "object" ? data.meta : {};

  if (meta.source === "bm_debug_grant") {
    return null;
  }

  const mappings = {
    diamond_product_purchase: ["IAP", meta.productId ?? "diamond_pack"],
    gold_product_purchase: ["Shop", meta.productId ?? "gold_exchange"],
    gold_product_purchase_refund: ["Compensation", meta.productId ?? "gold_exchange_refund"],
    ad_reward: ["AdReward", meta.rewardId ?? "ad_reward"],
    peak_coupon_purchase: ["Coupon", meta.itemId ?? "peak_coupon"],
    warehouse_upgrade: ["Upgrade", `warehouse_level_${meta.targetLevel ?? "next"}`],
    shelf_upgrade: ["Upgrade", meta.shelfGroupId ?? meta.shelfId ?? "shelf_upgrade"],
    product_upgrade: ["Upgrade", meta.productId ?? "product_upgrade"],
    staff_ability_upgrade: ["Upgrade", `staff_${meta.abilityKey ?? "ability"}`],
    contract_purchase: ["Contract", meta.productId ?? "product_contract"],
    premium_product_purchase: ["Shop", meta.productId ?? "premium_product"],
    contract_unlock_skip: ["Contract", "unlock_skip"],
    daily_mission_reward: ["Mission", `mission_reward_${meta.rewardCount ?? "step"}`],
    daily_attendance_reward: ["DailyReward", meta.rewardId ?? `attendance_${meta.attendanceDay ?? "day"}`],
    reward_inbox_claim: ["Compensation", meta.rewardId ?? "reward_inbox"],
    reward_code: ["CommunityEvent", meta.campaignId ?? "reward_code"],
    diamond_granted: ["Compensation", "diamond_granted"]
  };

  const descriptor = mappings[reason];

  if (!descriptor) {
    return ["Gameplay", normalizeAnalyticsToken(reason, "currency_change")];
  }

  return [descriptor[0], normalizeAnalyticsToken(descriptor[1])];
}

function trackCurrencyChange(data = {}) {
  if (data.success !== true) return;

  const amount = Number(data.amount);
  const currency = data.type === "diamond" ? "Diamond" : data.type === "gold" ? "Gold" : "";
  const flow = data.direction === "spend" ? RESOURCE_FLOW.SINK : data.direction === "add" ? RESOURCE_FLOW.SOURCE : "";
  const descriptor = getCurrencyResourceDescriptor(data);

  if (!currency || !flow || !Number.isFinite(amount) || amount <= 0 || !descriptor) {
    return;
  }

  AnalyticsSystem.trackResourceEvent(flow, currency, amount, descriptor[0], descriptor[1]);

  if (currency === "Diamond" && flow === RESOURCE_FLOW.SINK) {
    trackFirstLoginRewardDiamondSpend(data);
  }
}

function trackFirstLoginRewardDiamondSpend(data = {}) {
  if (!UserIdentitySystem.hasClaimedFirstLoginReward()) return;

  const markerKey = UserIdentitySystem.getScopedStorageKey(
    "first_login_reward_first_diamond_spend_v1"
  );

  if (safeStorageGet(markerKey) === "tracked") return;

  safeStorageSet(markerKey, "tracked");
  AnalyticsSystem.trackDesignEvent(
    `first_login_reward:first_spend:${normalizeAnalyticsToken(data.reason, "unknown")}`,
    Number(data.amount) || null
  );
}

function trackOrderCost(data = {}) {
  if (data.reason !== "order") return;
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) return;

  AnalyticsSystem.trackResourceEvent(
    RESOURCE_FLOW.SINK,
    "Gold",
    amount,
    "Order",
    normalizeAnalyticsToken(data.orderId, "product_order")
  );
}

function trackResultEconomy(data = {}) {
  const revenue = Number(data.revenue);
  const expiredLoss = Number(data.expiredLoss);
  const eventPenalty = Number(data.eventPenalty);
  const bmBonus = Number(data.bmBonus);
  const wagePaid = Number(data.staff?.wagePaid ?? data.staff?.wageSettlement?.paidAmount);

  if (Number.isFinite(revenue) && revenue > 0) {
    AnalyticsSystem.trackResourceEvent(RESOURCE_FLOW.SOURCE, "Gold", revenue, "Gameplay", "day_settlement");
  }
  if (Number.isFinite(expiredLoss) && expiredLoss > 0) {
    AnalyticsSystem.trackResourceEvent(RESOURCE_FLOW.SINK, "Gold", expiredLoss, "Gameplay", "expired_loss");
  }
  if (Number.isFinite(eventPenalty) && eventPenalty > 0) {
    AnalyticsSystem.trackResourceEvent(RESOURCE_FLOW.SINK, "Gold", eventPenalty, "Gameplay", "event_penalty");
  }
  if (Number.isFinite(bmBonus) && bmBonus > 0) {
    AnalyticsSystem.trackResourceEvent(RESOURCE_FLOW.SOURCE, "Gold", bmBonus, "Gameplay", "bm_bonus");
  }
  if (Number.isFinite(wagePaid) && wagePaid > 0) {
    AnalyticsSystem.trackResourceEvent(RESOURCE_FLOW.SINK, "Gold", wagePaid, "Wage", "daily_staff_wage");
  }

  const gameOver = data.infiniteGameOver;
  if (gameOver?.isGameOver === true) {
    const reason = normalizeAnalyticsToken(gameOver.primaryReason?.code, "unknown");
    AnalyticsSystem.trackDesignEvent(`gameover:${reason}`, Number(data.day));
  }
}

function trackRecoveryUpgradeCost(data = {}) {
  const upgrade = data.upgrade ?? {};
  const amount = Number(upgrade.costAmount);
  const costType = String(upgrade.costType ?? "free").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0 || costType === "free") return;

  const currency = costType === "diamond" ? "Diamond" : costType === "gold" ? "Gold" : "";
  if (!currency) return;

  AnalyticsSystem.trackResourceEvent(
    RESOURCE_FLOW.SINK,
    currency,
    amount,
    "Upgrade",
    normalizeAnalyticsToken(upgrade.id ?? "mental_recovery")
  );
}

function trackExpansionConstruction(data = {}) {
  const amount = Number(data.unlockCost);
  if (!Number.isFinite(amount) || amount <= 0) return;

  AnalyticsSystem.trackResourceEvent(
    RESOURCE_FLOW.SINK,
    "Gold",
    amount,
    "Expansion",
    normalizeAnalyticsToken(data.zoneId, "zone")
  );
}

function trackExpansionCompletion(data = {}) {
  if (data.instantComplete !== true) return;

  const spentGold = Number(data.spentGold);
  const spentDiamond = Number(data.spentDiamond);
  const zoneId = normalizeAnalyticsToken(data.zoneId, "zone");

  if (Number.isFinite(spentGold) && spentGold > 0) {
    AnalyticsSystem.trackResourceEvent(RESOURCE_FLOW.SINK, "Gold", spentGold, "Expansion", zoneId);
  }
  if (Number.isFinite(spentDiamond) && spentDiamond > 0) {
    AnalyticsSystem.trackResourceEvent(RESOURCE_FLOW.SINK, "Diamond", spentDiamond, "Expansion", `${zoneId}_instant`);
  }
}

function trackUnpaidWage(data = {}) {
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) return;
  AnalyticsSystem.trackResourceEvent(RESOURCE_FLOW.SINK, "Gold", amount, "Wage", "unpaid_wage");
}

function getShopResultItemId(data = {}, fallback = "purchase") {
  return normalizeAnalyticsToken(
    data.productId ??
      data.product?.id ??
      data.rewardId ??
      data.abilityKey ??
      data.shelfGroupId ??
      data.shelfId ??
      data.reason,
    fallback
  );
}

function bindEconomyEvents() {
  if (economyListenersBound) return;
  economyListenersBound = true;

  EventBus.on(CURRENCY_CHANGED_EVENT, trackCurrencyChange);
  EventBus.on(EVENTS.COST_CHANGED, trackOrderCost);
  EventBus.on(EVENTS.RESULT_CALCULATED, trackResultEconomy);
  EventBus.on(EVENTS.UPGRADE_SELECTED, trackRecoveryUpgradeCost);
  EventBus.on(EXPANSION_CONSTRUCTION_STARTED, trackExpansionConstruction);
  EventBus.on(EVENTS.EXPANSION_COMPLETED, trackExpansionCompletion);
  EventBus.on(STAFF_UNPAID_WAGE_PAID, trackUnpaidWage);
}

function bindShopEvents() {
  if (shopListenersBound) return;
  shopListenersBound = true;

  Object.entries(SHOP_SUCCESS_EVENTS).forEach(([eventName, fallback]) => {
    EventBus.on(eventName, (data = {}) => {
      AnalyticsSystem.trackDesignEvent(`shop:purchase:complete:${getShopResultItemId(data, fallback)}`);
    });
  });

  SHOP_FAILURE_EVENTS.forEach((eventName) => {
    EventBus.on(eventName, (data = {}) => {
      const reason = normalizeAnalyticsToken(data.reason, "unknown");
      AnalyticsSystem.trackDesignEvent(`shop:purchase:fail:${reason}`);
    });
  });
}

const COMMUNITY_COUPON_FAILURE_REASON = Object.freeze({
  invalid_code: "invalid",
  expired_code: "expired",
  already_used: "already_used",
  grant_failed: "grant_failed",
  unsupported_reward_type: "grant_failed"
});

function getCommunityCampaignId(data = {}) {
  return normalizeAnalyticsToken(data.campaignId, "unknown_campaign");
}

function bindCommunityCouponEvents() {
  if (communityCouponListenersBound) return;
  communityCouponListenersBound = true;

  EventBus.on(REWARD_CODE_EVENTS.PANEL_OPENED, () => {
    AnalyticsSystem.trackDesignEvent("community_event:coupon:view");
  });

  EventBus.on(REWARD_CODE_EVENTS.SUBMIT_ATTEMPTED, () => {
    AnalyticsSystem.trackDesignEvent("community_event:coupon:submit");
  });

  EventBus.on(REWARD_CODE_EVENTS.REDEEM_SUCCEEDED, (data = {}) => {
    const campaignId = getCommunityCampaignId(data);
    const rewardAmount = Number(data.reward?.amount);

    AnalyticsSystem.trackDesignEvent(`community_event:coupon:success:${campaignId}`);
    AnalyticsSystem.trackDesignEvent(
      `community_event:coupon:reward:claim:${campaignId}`,
      Number.isFinite(rewardAmount) && rewardAmount > 0 ? rewardAmount : null
    );
  });

  EventBus.on(REWARD_CODE_EVENTS.REDEEM_FAILED, (data = {}) => {
    const rawReason = String(data.reason ?? "").trim();
    const reason = COMMUNITY_COUPON_FAILURE_REASON[rawReason] ?? "unknown";
    AnalyticsSystem.trackDesignEvent(`community_event:coupon:fail:${reason}`);
  });
}

function sanitizeErrorMessage(value) {
  return String(value ?? "Unknown error")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[?&](?:key|secret|token|receipt|email)=[^&\s]+/gi, "")
    .slice(0, ANALYTICS_ERROR_MESSAGE_LIMIT);
}

function bindGlobalErrorEvents() {
  if (errorListenersBound || typeof window === "undefined") return;
  errorListenersBound = true;

  window.addEventListener("error", (event) => {
    const source = String(event?.filename ?? "");
    if (/gameanalytics/i.test(source)) return;

    const location = source ? `${source.split("/").pop()}:${event?.lineno ?? 0}` : "runtime";
    AnalyticsSystem.trackErrorEvent("Error", `${event?.message ?? "Window error"} @ ${location}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = reason?.message ?? reason ?? "Unhandled promise rejection";
    if (/gameanalytics/i.test(String(message))) return;
    AnalyticsSystem.trackErrorEvent("Error", `UnhandledPromise: ${message}`);
  });
}

function getNormalizedDay(value) {
  const day = Math.floor(Number(value));
  return Number.isFinite(day) && day > 0 ? day : null;
}

function getStoryDayId(day) {
  return `day_${String(day).padStart(2, "0")}`;
}

function trackStoreOpenedProgression(data = {}) {
  const day = getNormalizedDay(data.day);

  if (!day) {
    return;
  }

  const isEndlessMode = data.isEndlessMode === true || day > GAME_CONFIG.MAX_STORY_DAY;

  if (isEndlessMode) {
    AnalyticsSystem.trackDesignEvent("endless:day:start", day);
    return;
  }

  AnalyticsSystem.trackProgressionEvent(
    PROGRESSION_STATUS.START,
    STORY_PROGRESSION_ROOT,
    getStoryDayId(day)
  );
}

function trackResultProgression(data = {}) {
  const day = getNormalizedDay(data.day);

  if (!day) {
    return;
  }

  const success = data.success === true;
  const isEndlessMode = day > GAME_CONFIG.MAX_STORY_DAY;

  if (isEndlessMode) {
    AnalyticsSystem.trackDesignEvent(
      success ? "endless:day:complete" : "endless:day:fail",
      day
    );
    return;
  }

  AnalyticsSystem.trackProgressionEvent(
    success ? PROGRESSION_STATUS.COMPLETE : PROGRESSION_STATUS.FAIL,
    STORY_PROGRESSION_ROOT,
    getStoryDayId(day)
  );
}

function bindGameProgressionEvents() {
  if (gameProgressionListenersBound) {
    return;
  }

  gameProgressionListenersBound = true;
  EventBus.on(EVENTS.STORE_OPENED, trackStoreOpenedProgression);
  EventBus.on(EVENTS.RESULT_CALCULATED, trackResultProgression);
}

function trackCustomerFlowMetrics(data = {}) {
  const metrics = data.customerFlowMetrics ?? {};
  const staff = data.staff ?? {};
  const entries = [
    ["ux:customer_wait:avg_seconds", Number(metrics.averageWaitSeconds)],
    ["ux:checkout_queue:max", Number(metrics.maxCheckoutQueue)],
    ["ux:active_customers:max", Number(metrics.maxActiveCustomers)],
    ["ux:stockout:seconds", Number(metrics.outOfStockSeconds)],
    ["ux:nuisance:count", Number(metrics.nuisanceEventCount)],
    ["ux:nuisance:timeout_count", Number(metrics.nuisanceTimeoutCount)],
    ["ux:nuisance:avg_response_ms", Number(metrics.averageNuisanceResponseMs)],
    ["ux:positive_guest:count", Number(metrics.positiveGuestCount)],
    ["ux:staff:warehouse_help", Number(staff.warehouseHelpCount)],
    ["ux:staff:shelf_help", Number(staff.shelfHelpCount)],
    ["ux:staff:cleaning_help", Number(staff.cleaningHelpCount)]
  ];

  entries.forEach(([eventName, value]) => {
    if (Number.isFinite(value) && value >= 0) {
      AnalyticsSystem.trackDesignEvent(eventName, value);
    }
  });
}

function bindGameplayUxEvents() {
  if (gameplayUxListenersBound) return;
  gameplayUxListenersBound = true;

  EventBus.on(EVENTS.RESULT_CALCULATED, trackCustomerFlowMetrics);

  EventBus.on(EVENTS.CUSTOMER_LEFT, (data = {}) => {
    AnalyticsSystem.trackDesignEvent(
      `customer:left:${normalizeAnalyticsToken(data.reason, "unknown")}`
    );
  });

  EventBus.on(CUSTOMER_EVENT_OPENED, (data = {}) => {
    AnalyticsSystem.trackDesignEvent(
      `nuisance:opened:${normalizeAnalyticsToken(data.eventId, "event")}`
    );
  });

  EventBus.on(CUSTOMER_EVENT_CHOICE_SELECTED, (data = {}) => {
    const eventId = normalizeAnalyticsToken(data.eventId, "event");
    const choiceId = normalizeAnalyticsToken(data.choiceId, "choice");
    AnalyticsSystem.trackDesignEvent(
      `nuisance:choice:${eventId}:${choiceId}`,
      Math.max(0, Number(data.responseTimeMs) || 0)
    );
  });

  EventBus.on(CUSTOMER_EVENT_RESPONSE_TIMEOUT, (data = {}) => {
    AnalyticsSystem.trackDesignEvent(
      `nuisance:timeout:${normalizeAnalyticsToken(data.eventId, "event")}`
    );
  });

  EventBus.on(STAFF_HIRED, (data = {}) => {
    AnalyticsSystem.trackDesignEvent(
      `staff:hired:${normalizeAnalyticsToken(
        data.candidateId ?? data.staff?.id ?? data.staffId ?? data.id,
        "staff"
      )}`,
      Number(data.day) || null
    );
  });

  EventBus.on(STAFF_ASSIST_TASK_COMPLETED, (data = {}) => {
    if (data.success !== true) return;
    AnalyticsSystem.trackDesignEvent(
      `staff:assist:${normalizeAnalyticsToken(data.type, "task")}`,
      Number(data.quantity ?? data.recoveredAmount) || null
    );
  });

  EventBus.on(USER_IDENTITY_EVENTS.FIRST_LOGIN_REWARD_GRANTED, (data = {}) => {
    AnalyticsSystem.trackDesignEvent(
      `first_login_reward:granted:${normalizeAnalyticsToken(data.identitySource, "unknown")}`,
      Number(data.amount) || null
    );
  });

  EventBus.on(USER_IDENTITY_EVENTS.FIRST_LOGIN_REWARD_CLAIMED, (data = {}) => {
    AnalyticsSystem.trackDesignEvent(
      `first_login_reward:claimed:${normalizeAnalyticsToken(data.identitySource, "unknown")}`,
      Number(data.amount) || null
    );
  });
}

function queueFirstSessionEvent() {
  if (firstEventSent || safeStorageGet(CONSENT_KEY) !== "granted") {
    return;
  }

  firstEventSent = true;
  // 첫 이벤트는 다른 대기 이벤트보다 먼저 처리합니다.
  pendingDesignEvents.unshift({
    eventName: FIRST_EVENT_ID,
    value: null
  });
}

function markSdkReady() {
  if (sdkReady) {
    return;
  }

  sdkReady = true;
  initialized = true;
  lastErrorMessage = "";

  if (readyListenerRegistered) {
    callGameAnalytics("removeRemoteConfigsListener", sdkReadyListener);
    readyListenerRegistered = false;
  }

  // SDK의 init 응답과 session_start 생성이 끝난 뒤에도 같은 렌더링 프레임에서
  // 커스텀 이벤트를 실행하지 않습니다. 유휴 시간 큐에서 순차 전송합니다.
  queueFirstSessionEvent();
  scheduleAnalyticsFlush();
}

const sdkReadyListener = Object.freeze({
  onRemoteConfigsUpdated() {
    markSdkReady();
  }
});

function registerSdkReadyListener() {
  if (readyListenerRegistered) {
    return;
  }

  readyListenerRegistered = true;
  callGameAnalytics("addRemoteConfigsListener", sdkReadyListener);
}

export const AnalyticsSystem = {
  init() {
    bindGameProgressionEvents();
    bindEconomyEvents();
    bindShopEvents();
    bindCommunityCouponEvents();
    bindGlobalErrorEvents();
    bindGameplayUxEvents();

    if (this.getConsent() === "granted") {
      this.initialize();
    }
  },

  getConsent() {
    const value = safeStorageGet(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  },

  isConfigured() {
    return hasValidAnalyticsKeys();
  },

  isInitialized() {
    return initialized;
  },

  getStatus() {
    return Object.freeze({
      consent: this.getConsent(),
      configured: this.isConfigured(),
      initializationRequested,
      initialized,
      sdkLoaded,
      sdkReady,
      environment: ANALYTICS_CONFIG.environment,
      lastErrorMessage
    });
  },

  initialize() {
    if (sdkReady) {
      callGameAnalytics("setEnabledEventSubmission", true);
      return true;
    }

    if (initializationRequested) {
      return true;
    }

    if (this.getConsent() !== "granted" || !this.isConfigured()) {
      return false;
    }

    initializationRequested = true;
    ensureCommandQueue();
    loadSdk();

    // DEV 환경에서도 SDK의 대용량 JSON 로그는 끕니다.
    // BlueStacks/Android WebView 콘솔 출력이 게임 렌더링을 막는 현상을 방지합니다.
    callGameAnalytics("setEnabledInfoLog", false);
    callGameAnalytics("setEnabledVerboseLog", false);
    callGameAnalytics("configureBuild", ANALYTICS_CONFIG.build);
    callGameAnalytics("configureUserId", UserIdentitySystem.getUserId());
    callGameAnalytics(
      "configureAvailableResourceCurrencies",
      [...ANALYTICS_CONFIG.resourceCurrencies]
    );
    callGameAnalytics(
      "configureAvailableResourceItemTypes",
      [...ANALYTICS_CONFIG.resourceItemTypes]
    );

    // init 완료 시 SDK가 호출하는 공식 remote-config ready listener를 먼저 등록합니다.
    // 콜백은 remote config 사용 여부와 관계없이 init 응답 처리 과정에서 실행됩니다.
    registerSdkReadyListener();

    callGameAnalytics(
      "initialize",
      ANALYTICS_CONFIG.gameKey,
      ANALYTICS_CONFIG.secretKey
    );

    return true;
  },

  setConsent(granted) {
    const consent = granted === true ? "granted" : "denied";
    safeStorageSet(CONSENT_KEY, consent);

    if (consent === "granted") {
      if (sdkReady) {
        callGameAnalytics("setEnabledEventSubmission", true);
        return true;
      }

      return this.initialize();
    }

    pendingDesignEvents.length = 0;
    pendingProgressionEvents.length = 0;
    pendingResourceEvents.length = 0;
    pendingErrorEvents.length = 0;

    if (initializationRequested) {
      callGameAnalytics("setEnabledEventSubmission", false);
    }

    return true;
  },

  trackDesignEvent(eventName, value = null) {
    if (this.getConsent() !== "granted" || !initializationRequested) {
      return false;
    }

    const safeEventName = String(eventName ?? "").trim();

    if (!safeEventName) {
      return false;
    }

    const safeValue = Number.isFinite(value) ? Number(value) : null;

    pendingDesignEvents.push({
      eventName: safeEventName,
      value: safeValue
    });

    scheduleAnalyticsFlush();
    return true;
  },

  trackProgressionEvent(
    status,
    progression01,
    progression02 = "",
    progression03 = "",
    score = null
  ) {
    if (this.getConsent() !== "granted" || !initializationRequested) {
      return false;
    }

    const safeStatus = normalizeProgressionStatus(status);
    const safeProgression01 = normalizeProgressionPart(progression01);
    const safeProgression02 = normalizeProgressionPart(progression02);
    const safeProgression03 = normalizeProgressionPart(progression03);
    const safeScore = Number.isFinite(score) ? Number(score) : null;

    if (!safeStatus || !safeProgression01) {
      return false;
    }

    const event = {
      status: safeStatus,
      progression01: safeProgression01,
      progression02: safeProgression02,
      progression03: safeProgression03,
      score: safeScore
    };

    pendingProgressionEvents.push(event);
    scheduleAnalyticsFlush();
    return true;
  },

  trackResourceEvent(flow, currency, amount, itemType, itemId) {
    if (this.getConsent() !== "granted" || !initializationRequested) {
      return false;
    }

    const safeFlow = flow === RESOURCE_FLOW.SOURCE || flow === RESOURCE_FLOW.SINK ? flow : null;
    const safeCurrency = String(currency ?? "").trim();
    const safeAmount = Number(amount);
    const safeItemType = String(itemType ?? "").trim();
    const safeItemId = normalizeAnalyticsToken(itemId, "unknown");

    if (
      !safeFlow ||
      !ANALYTICS_CONFIG.resourceCurrencies.includes(safeCurrency) ||
      !Number.isFinite(safeAmount) ||
      safeAmount <= 0 ||
      !ANALYTICS_CONFIG.resourceItemTypes.includes(safeItemType) ||
      !safeItemId
    ) {
      return false;
    }

    pendingResourceEvents.push({
      flow: safeFlow,
      currency: safeCurrency,
      amount: safeAmount,
      itemType: safeItemType,
      itemId: safeItemId
    });
    scheduleAnalyticsFlush();
    return true;
  },

  trackErrorEvent(severity, message) {
    if (this.getConsent() !== "granted" || !initializationRequested) {
      return false;
    }

    const allowed = new Set(["Debug", "Info", "Warning", "Error", "Critical"]);
    const safeSeverity = allowed.has(String(severity)) ? String(severity) : "Error";
    const safeMessage = sanitizeErrorMessage(message);

    if (!safeMessage) return false;

    pendingErrorEvents.push({ severity: safeSeverity, message: safeMessage });
    scheduleAnalyticsFlush();
    return true;
  }
};
