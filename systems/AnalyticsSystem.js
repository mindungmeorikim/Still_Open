/*
  AnalyticsSystem.js
  역할: GameAnalytics SDK 로딩, 동의 상태, 공통 이벤트 전송
  원칙: 분석 SDK 실패가 게임 본체 실행을 막지 않도록 모든 호출을 방어적으로 처리합니다.
*/

import {
  ANALYTICS_CONFIG,
  hasValidAnalyticsKeys
} from "../config/analytics.config.js";

const CONSENT_KEY = "still_open_analytics_consent";
const SDK_SCRIPT_ID = "gameanalytics-sdk-script";
const FIRST_EVENT_ID = "game:start";

let initialized = false;
let sdkLoaded = false;
let sdkLoadPromise = null;
let firstEventQueued = false;
let lastErrorMessage = "";

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

function loadSdk() {
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    ensureCommandQueue();

    const existingScript = document.getElementById(SDK_SCRIPT_ID);

    if (existingScript?.dataset.loaded === "true") {
      resolve(true);
      return;
    }

    const script = existingScript ?? document.createElement("script");
    script.id = SDK_SCRIPT_ID;
    script.async = true;
    script.src = ANALYTICS_CONFIG.sdkUrl;
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
      initialized = false;
      firstEventQueued = false;

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

function queueFirstSessionEvent() {
  if (firstEventQueued) {
    return;
  }

  firstEventQueued = true;
  callGameAnalytics("addDesignEvent", FIRST_EVENT_ID);
}

export const AnalyticsSystem = {
  init() {
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
      initialized,
      sdkLoaded,
      environment: ANALYTICS_CONFIG.environment,
      lastErrorMessage
    });
  },

  initialize() {
    if (initialized) {
      callGameAnalytics("setEnabledEventSubmission", true);
      return true;
    }

    if (this.getConsent() !== "granted" || !this.isConfigured()) {
      return false;
    }

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
    callGameAnalytics(
      "initialize",
      ANALYTICS_CONFIG.gameKey,
      ANALYTICS_CONFIG.secretKey
    );

    initialized = true;
    queueFirstSessionEvent();
    return true;
  },

  setConsent(granted) {
    const consent = granted === true ? "granted" : "denied";
    safeStorageSet(CONSENT_KEY, consent);

    if (consent === "granted") {
      if (initialized) {
        callGameAnalytics("setEnabledEventSubmission", true);
        return true;
      }

      return this.initialize();
    }

    if (initialized) {
      callGameAnalytics("setEnabledEventSubmission", false);
    }

    return true;
  },

  trackDesignEvent(eventName, value = null) {
    if (this.getConsent() !== "granted" || !initialized) {
      return false;
    }

    const safeEventName = String(eventName ?? "").trim();

    if (!safeEventName) {
      return false;
    }

    if (Number.isFinite(value)) {
      return callGameAnalytics("addDesignEvent", safeEventName, Number(value));
    }

    return callGameAnalytics("addDesignEvent", safeEventName);
  }
};
