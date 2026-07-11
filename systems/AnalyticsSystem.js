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

const CONSENT_KEY = "still_open_analytics_consent";
const SDK_SCRIPT_ID = "gameanalytics-sdk-script";
const FIRST_EVENT_ID = "game:start";
const STORY_PROGRESSION_ROOT = "main";
const PROGRESSION_STATUS = Object.freeze({
  START: 1,
  COMPLETE: 2,
  FAIL: 3
});

let initializationRequested = false;
let initialized = false;
let sdkLoaded = false;
let sdkReady = false;
let sdkLoadPromise = null;
let readyListenerRegistered = false;
let firstEventSent = false;
let lastErrorMessage = "";
let gameProgressionListenersBound = false;
const pendingDesignEvents = [];
const pendingProgressionEvents = [];

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

function flushPendingDesignEvents() {
  while (pendingDesignEvents.length > 0) {
    const event = pendingDesignEvents.shift();
    sendDesignEventNow(event.eventName, event.value);
  }
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

function flushPendingProgressionEvents() {
  while (pendingProgressionEvents.length > 0) {
    sendProgressionEventNow(pendingProgressionEvents.shift());
  }
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

function sendFirstSessionEvent() {
  if (firstEventSent || safeStorageGet(CONSENT_KEY) !== "granted") {
    return;
  }

  firstEventSent = true;
  sendDesignEventNow(FIRST_EVENT_ID);
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

  // SDK의 init 응답 처리와 session_start 생성이 끝난 다음 태스크에서
  // 첫 커스텀 이벤트를 전송해 "SDK is disabled" 타이밍 오류를 방지합니다.
  window.setTimeout(() => {
    if (safeStorageGet(CONSENT_KEY) !== "granted") {
      return;
    }

    sendFirstSessionEvent();
    flushPendingDesignEvents();
    flushPendingProgressionEvents();
  }, 0);
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

    callGameAnalytics("setEnabledInfoLog", ANALYTICS_CONFIG.debug === true);
    callGameAnalytics("setEnabledVerboseLog", ANALYTICS_CONFIG.debug === true);
    callGameAnalytics("configureBuild", ANALYTICS_CONFIG.build);
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

    if (!sdkReady) {
      pendingDesignEvents.push({
        eventName: safeEventName,
        value: safeValue
      });
      return true;
    }

    return sendDesignEventNow(safeEventName, safeValue);
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

    if (!sdkReady) {
      pendingProgressionEvents.push(event);
      return true;
    }

    return sendProgressionEventNow(event);
  }
};
