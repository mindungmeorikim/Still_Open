/*
  SanitationSystem.js

  v7.0.6 MVP:
  - Keep sanitation as a 0~100 management stat.
  - Notify UI through local EventBus event names without adding core constants.
  - Apply customer satisfaction pressure only through settlement, never game over.
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";

export const SANITATION_EVENTS = Object.freeze({
  CHANGED: "SANITATION_CHANGED",
  MESSAGE_REQUESTED: "SANITATION_MESSAGE_REQUESTED",
  CLEANING_REQUESTED: "SANITATION_CLEANING_REQUESTED",
  CLEANING_STARTED: "SANITATION_CLEANING_STARTED",
  CLEANING_COMPLETED: "SANITATION_CLEANING_COMPLETED",
  CLEANING_FAILED: "SANITATION_CLEANING_FAILED",
  CUSTOMER_EVENT_TRIGGERED: "CUSTOMER_RANDOM_EVENT_TRIGGERED"
});

const DEFAULT_SANITATION = 100;
const CLEANING_RECOVERY = 25;
const CUSTOMER_MESS_PENALTY = 5;
const CLEANING_DURATION_MS = 5000;
const WARNING_THRESHOLD = 50;
const WARNING_RESET_THRESHOLD = 60;
const SETTLEMENT_SATISFACTION_PENALTY = -5;

export const SanitationSystem = {
  isInitialized: false,
  value: DEFAULT_SANITATION,
  isCleaningNeeded: false,
  isCleaning: false,
  warningArmed: true,
  cleaningTimerId: null,
  cleaningDurationMs: CLEANING_DURATION_MS,
  processedDisruptionKeys: new Set(),

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.hydrate(GameState.sanitation);
    this.bindCustomerEvents();
    this.bindCleaningRequests();
    this.emitChanged("init");
  },

  bindCleaningRequests() {
    EventBus.on(SANITATION_EVENTS.CLEANING_REQUESTED, (data = {}) => {
      this.startCleaning({
        source: data.source ?? "sanitation_cleaning_request",
        actorType: data.actorType ?? "player"
      });
    });
  },

  bindCustomerEvents() {
    EventBus.on(EVENTS.CUSTOMER_ENTERED, (data = {}) => {
      if (data.customerTypeId !== "difficult") {
        return;
      }

      this.applyCustomerMess(data, "difficult_customer_entered");
    });

    EventBus.on(EVENTS.CUSTOMER_ANGRY, (data = {}) => {
      if (data.customerTypeId !== "difficult") {
        return;
      }

      this.applyCustomerMess(data, "difficult_customer_angry");
    });

    EventBus.on(SANITATION_EVENTS.CUSTOMER_EVENT_TRIGGERED, (data = {}) => {
      const isNegativeEvent = data.eventType === "negative";
      const isDifficultCustomer = data.customerTypeId === "difficult";

      if (!isNegativeEvent && !isDifficultCustomer) {
        return;
      }

      this.applyCustomerMess(data, "customer_negative_event");
    });
  },

  getState() {
    return {
      value: this.value,
      status: this.getStatus(this.value),
      isCleaningNeeded: this.isCleaningNeeded,
      isCleaning: this.isCleaning,
      warningArmed: this.warningArmed,
      cleaningDurationMs: this.cleaningDurationMs,
      settlementPenalty: this.getSettlementPenalty()
    };
  },

  getStatus(value = this.value) {
    const sanitation = this.clampSanitation(value);

    if (sanitation === 0) return "critical";
    if (sanitation <= 50) return "warning";
    if (sanitation <= 79) return "normal";
    return "clean";
  },

  decreaseSanitation(amount, reason = "unknown") {
    const safeAmount = this.normalizeAmount(amount);

    if (safeAmount <= 0) {
      return this.createMutationResult(false, reason, 0, this.value);
    }

    const previousValue = this.value;
    const nextValue = this.clampSanitation(previousValue - safeAmount);

    this.value = nextValue;

    if (nextValue < DEFAULT_SANITATION) {
      this.isCleaningNeeded = true;
    }

    this.updateWarningState(previousValue, nextValue);
    this.emitChanged(reason, {
      previousValue,
      amount: -safeAmount
    });

    return this.createMutationResult(previousValue !== nextValue, reason, -safeAmount, previousValue);
  },

  increaseSanitation(amount, reason = "unknown") {
    const safeAmount = this.normalizeAmount(amount);

    if (safeAmount <= 0) {
      return this.createMutationResult(false, reason, 0, this.value);
    }

    const previousValue = this.value;
    const nextValue = this.clampSanitation(previousValue + safeAmount);

    this.value = nextValue;

    if (nextValue >= DEFAULT_SANITATION) {
      this.isCleaningNeeded = false;
    }

    this.updateWarningState(previousValue, nextValue);
    this.emitChanged(reason, {
      previousValue,
      amount: safeAmount
    });

    return this.createMutationResult(previousValue !== nextValue, reason, safeAmount, previousValue);
  },

  startCleaning(options = {}) {
    if (this.isCleaning) {
      const result = {
        success: false,
        reason: "already_cleaning",
        message: "이미 청소 중입니다.",
        state: this.getState()
      };

      EventBus.emit(SANITATION_EVENTS.CLEANING_FAILED, result);
      return result;
    }

    if (!this.isCleaningNeeded) {
      const result = {
        success: false,
        reason: "no_cleaning_needed",
        message: "지금은 청소할 곳이 없습니다.",
        state: this.getState()
      };

      EventBus.emit(SANITATION_EVENTS.CLEANING_FAILED, result);
      return result;
    }

    this.isCleaning = true;
    this.emitChanged("cleaning_started", { source: options.source ?? "unknown" });
    EventBus.emit(SANITATION_EVENTS.CLEANING_STARTED, {
      day: this.getCurrentDay(),
      durationMs: this.cleaningDurationMs,
      source: options.source ?? "unknown",
      state: this.getState()
    });
    EventBus.emit(SANITATION_EVENTS.MESSAGE_REQUESTED, {
      message: "청소 중...",
      duration: this.cleaningDurationMs
    });

    this.scheduleCleaningCompletion();

    return {
      success: true,
      reason: "started",
      durationMs: this.cleaningDurationMs,
      state: this.getState()
    };
  },

  completeCleaning(reason = "cleaning_completed") {
    const wasCleaning = this.isCleaning;
    const previousValue = this.value;

    this.clearCleaningTimer();
    this.value = this.clampSanitation(this.value + CLEANING_RECOVERY);
    this.isCleaning = false;
    this.isCleaningNeeded = this.value < DEFAULT_SANITATION;
    this.updateWarningState(previousValue, this.value);

    const payload = {
      day: this.getCurrentDay(),
      reason,
      wasCleaning,
      previousValue,
      value: this.value,
      recoveredAmount: this.value - previousValue,
      state: this.getState()
    };

    EventBus.emit(EVENTS.CLEANING_COMPLETED, {
      ...payload,
      source: "sanitation_cleaning_zone"
    });
    EventBus.emit(SANITATION_EVENTS.CLEANING_COMPLETED, payload);
    EventBus.emit(SANITATION_EVENTS.MESSAGE_REQUESTED, {
      message: "청소 완료!",
      duration: 2600
    });
    this.emitChanged(reason, {
      previousValue,
      amount: this.value - previousValue
    });

    return {
      success: true,
      reason,
      state: this.getState()
    };
  },

  reset() {
    this.clearCleaningTimer();
    this.value = DEFAULT_SANITATION;
    this.isCleaningNeeded = false;
    this.isCleaning = false;
    this.warningArmed = true;
    this.processedDisruptionKeys.clear();
    this.emitChanged("reset");

    return this.getState();
  },

  hydrate(savedData = null) {
    this.clearCleaningTimer();

    const sourceData = savedData && typeof savedData === "object"
      ? savedData
      : {};
    const restoredValue = sourceData.value ?? sourceData.sanitation;

    this.value = this.clampSanitation(restoredValue, DEFAULT_SANITATION);
    this.isCleaningNeeded = sourceData.isCleaningNeeded === true ||
      (sourceData.isCleaningNeeded !== false && this.value < DEFAULT_SANITATION);
    this.isCleaning = sourceData.isCleaning === true && this.isCleaningNeeded;
    this.warningArmed = sourceData.warningArmed === undefined
      ? this.value >= WARNING_RESET_THRESHOLD
      : sourceData.warningArmed === true;
    this.processedDisruptionKeys = new Set(
      Array.isArray(sourceData.processedDisruptionKeys)
        ? sourceData.processedDisruptionKeys.filter(Boolean).map(String)
        : []
    );

    if (this.isCleaning) {
      this.scheduleCleaningCompletion();
      EventBus.emit(SANITATION_EVENTS.CLEANING_STARTED, {
        day: this.getCurrentDay(),
        durationMs: this.cleaningDurationMs,
        source: "hydrate",
        state: this.getState()
      });
    }

    this.emitChanged("hydrate");
    return this.getState();
  },

  serialize() {
    return {
      value: this.value,
      status: this.getStatus(this.value),
      isCleaningNeeded: this.isCleaningNeeded,
      isCleaning: this.isCleaning,
      warningArmed: this.warningArmed,
      processedDisruptionKeys: [...this.processedDisruptionKeys].slice(-30)
    };
  },

  getSettlementPenalty() {
    const applies = this.value <= WARNING_THRESHOLD;

    return {
      applies,
      satisfactionPenalty: applies ? SETTLEMENT_SATISFACTION_PENALTY : 0,
      reason: applies ? "위생 관리 미흡으로 만족도 -5" : "",
      sanitationValue: this.value,
      status: this.getStatus(this.value)
    };
  },

  applyCustomerMess(data = {}, reason = "customer_mess") {
    const key = this.createDisruptionKey(data, reason);

    if (this.processedDisruptionKeys.has(key)) {
      return false;
    }

    this.processedDisruptionKeys.add(key);

    const result = this.decreaseSanitation(CUSTOMER_MESS_PENALTY, reason);

    if (result.changed) {
      EventBus.emit(SANITATION_EVENTS.MESSAGE_REQUESTED, {
        message: "진상 손님이 매장을 어지럽혔습니다. 위생 -5",
        duration: 3200
      });
    }

    return result.changed;
  },

  createDisruptionKey(data = {}, reason = "customer_mess") {
    const day = Math.max(1, Math.floor(Number(data.day) || this.getCurrentDay()));
    const customerId = data.customerId ?? data.id ?? null;
    const eventInstanceId = data.eventInstanceId ?? null;
    const eventId = data.eventId ?? null;
    const stableId = customerId ?? eventInstanceId ?? eventId ?? reason;

    return `${day}:${stableId}`;
  },

  updateWarningState(previousValue, nextValue) {
    if (nextValue <= WARNING_THRESHOLD && this.warningArmed) {
      this.warningArmed = false;
      EventBus.emit(SANITATION_EVENTS.MESSAGE_REQUESTED, {
        message: "매장 위생이 위험합니다. 청결 관리에 신경 써주세요!",
        duration: 3600,
        delayMs: 700
      });
    }

    if (nextValue >= WARNING_RESET_THRESHOLD) {
      this.warningArmed = true;
    }
  },

  scheduleCleaningCompletion() {
    this.clearCleaningTimer();
    this.cleaningTimerId = window.setTimeout(() => {
      this.cleaningTimerId = null;
      this.completeCleaning();
    }, this.cleaningDurationMs);
  },

  clearCleaningTimer() {
    if (!this.cleaningTimerId) return;

    window.clearTimeout(this.cleaningTimerId);
    this.cleaningTimerId = null;
  },

  emitChanged(reason = "unknown", detail = {}) {
    const state = this.getState();

    this.syncGameStateSanitation(state);

    EventBus.emit(SANITATION_EVENTS.CHANGED, {
      day: this.getCurrentDay(),
      reason,
      ...detail,
      state
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  syncGameStateSanitation(state = this.getState()) {
    GameState.sanitation = {
      value: state.value,
      status: state.status,
      isCleaningNeeded: state.isCleaningNeeded,
      isCleaning: state.isCleaning,
      warningArmed: state.warningArmed,
      cleaningDurationMs: state.cleaningDurationMs,
      settlementPenalty: state.settlementPenalty,
      processedDisruptionKeys: [...this.processedDisruptionKeys].slice(-30)
    };
  },

  createMutationResult(changed, reason, amount, previousValue) {
    return {
      success: true,
      changed,
      reason,
      amount,
      previousValue,
      value: this.value,
      state: this.getState()
    };
  },

  getCurrentDay() {
    return Math.max(1, Math.floor(Number(GameState.day) || 1));
  },

  normalizeAmount(amount) {
    const numberValue = Math.floor(Number(amount));

    if (!Number.isFinite(numberValue)) {
      return 0;
    }

    return Math.max(0, numberValue);
  },

  clampSanitation(value, fallback = this.value) {
    const numberValue = Math.floor(Number(value));

    if (!Number.isFinite(numberValue)) {
      return this.clampSanitation(fallback, DEFAULT_SANITATION);
    }

    return Math.max(0, Math.min(100, numberValue));
  }
};
