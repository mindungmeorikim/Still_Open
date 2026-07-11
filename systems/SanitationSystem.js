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
import {
  CLEANING_ZONE_ORDER,
  DEFAULT_CLEANING_ZONE_ID,
  getCleaningPointByZoneId,
  getUnlockedCleaningZoneIds
} from "../data/CleaningPointData.js";

export const SANITATION_EVENTS = Object.freeze({
  CHANGED: "SANITATION_CHANGED",
  MESSAGE_REQUESTED: "SANITATION_MESSAGE_REQUESTED",
  CLEANING_REQUESTED: "SANITATION_CLEANING_REQUESTED",
  CLEANING_STARTED: "SANITATION_CLEANING_STARTED",
  CLEANING_COMPLETED: "SANITATION_CLEANING_COMPLETED",
  CLEANING_FAILED: "SANITATION_CLEANING_FAILED",
  CUSTOMER_EVENT_TRIGGERED: "CUSTOMER_RANDOM_EVENT_TRIGGERED"
});

const SAVE_GAME_LOADED = "SAVE_GAME_LOADED";
const DEFAULT_SANITATION = 100;
const CLEANING_RECOVERY = 25;
const CUSTOMER_MESS_PENALTY = 5;
const CLEANING_DURATION_MS = 5000;
const WARNING_THRESHOLD = 50;
const WARNING_RESET_THRESHOLD = 60;
const SETTLEMENT_SATISFACTION_PENALTY = -5;
const SANITATION_AREA_PRESSURE_STEP = 0.25;
const SANITATION_AREA_PRESSURE_MAX = 1.75;
const CUSTOMER_TRAFFIC_MESS_PROFILE_BY_DAY = Object.freeze({
  1: Object.freeze({ milestones: [12], penalty: 10 }),
  2: Object.freeze({ milestones: [8, 16], penalty: 30 }),
  3: Object.freeze({ milestones: [6, 12, 18], penalty: 20 }),
  4: Object.freeze({ milestones: [5, 10, 15, 20, 25], penalty: 15 }),
  5: Object.freeze({ milestones: [4, 8, 12, 16, 20, 24, 28], penalty: 15 })
});

export const SanitationSystem = {
  isInitialized: false,
  value: DEFAULT_SANITATION,
  isCleaningNeeded: false,
  isCleaning: false,
  warningArmed: true,
  cleaningTimerId: null,
  cleaningRemainingMs: 0,
  cleaningDurationMs: CLEANING_DURATION_MS,
  activeCleaningDurationMs: null,
  currentCleaningActorType: null,
  dirtyZoneId: DEFAULT_CLEANING_ZONE_ID,
  dirtySpotId: getCleaningPointByZoneId(DEFAULT_CLEANING_ZONE_ID).id,
  processedDisruptionKeys: new Set(),

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.hydrate(GameState.sanitation);
    this.bindCustomerEvents();
    this.bindCleaningRequests();
    this.bindSaveEvents();
    this.emitChanged("init");
  },

  bindSaveEvents() {
    EventBus.on(SAVE_GAME_LOADED, (data = {}) => {
      const savedSanitation = data.gameState?.sanitation ?? GameState.sanitation;
      this.hydrate(savedSanitation);
    });
  },

  bindCleaningRequests() {
    EventBus.on(SANITATION_EVENTS.CLEANING_REQUESTED, (data = {}) => {
      this.startCleaning({
        source: data.source ?? "sanitation_cleaning_request",
        actorType: data.actorType ?? "player",
        targetZoneId: data.targetZoneId ?? data.dirtyZoneId ?? null
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

    EventBus.on(EVENTS.CHECKOUT_COMPLETED, (data = {}) => {
      this.applyCustomerTrafficMess(data);
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
    const activeCleaningPoint = this.getActiveCleaningPoint();

    return {
      value: this.value,
      status: this.getStatus(this.value),
      isCleaningNeeded: this.isCleaningNeeded,
      isCleaning: this.isCleaning,
      currentCleaningActorType: this.currentCleaningActorType,
      warningArmed: this.warningArmed,
      cleaningDurationMs: this.activeCleaningDurationMs ?? this.cleaningDurationMs,
      dirtyZoneId: activeCleaningPoint.zoneId,
      dirtySpotId: activeCleaningPoint.id,
      activeCleaningPoint,
      unlockedCleaningZoneCount: this.getUnlockedCleaningZoneIds().length,
      sanitationPressureMultiplier: this.getAreaPressureMultiplier(),
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
      this.ensureDirtyCleaningPoint(reason);
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
      this.clearDirtyCleaningPoint();
    } else {
      this.isCleaningNeeded = true;
      this.advanceDirtyCleaningPoint(reason);
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

    const durationMs = this.getAssistedCleaningDurationMs(this.cleaningDurationMs, options.actorType);
    const activeCleaningPoint = this.ensureDirtyCleaningPoint(options.targetZoneId ?? options.source ?? "cleaning_started");

    this.isCleaning = true;
    this.activeCleaningDurationMs = durationMs;
    this.currentCleaningActorType = options.actorType ?? "player";
    this.emitChanged("cleaning_started", {
      source: options.source ?? "unknown",
      actorType: this.currentCleaningActorType,
      activeCleaningPoint
    });
    EventBus.emit(SANITATION_EVENTS.CLEANING_STARTED, {
      day: this.getCurrentDay(),
      durationMs,
      dirtyZoneId: activeCleaningPoint.zoneId,
      dirtySpotId: activeCleaningPoint.id,
      activeCleaningPoint,
      source: options.source ?? "unknown",
      actorType: this.currentCleaningActorType,
      state: this.getState()
    });
    EventBus.emit(SANITATION_EVENTS.MESSAGE_REQUESTED, {
      message: `${activeCleaningPoint.label} 청소 중...`,
      duration: durationMs
    });

    this.scheduleCleaningCompletion(durationMs);

    return {
      success: true,
      reason: "started",
      durationMs,
      state: this.getState()
    };
  },

  completeCleaning(reason = "cleaning_completed") {
    const wasCleaning = this.isCleaning;
    const previousValue = this.value;
    const cleanedPoint = this.getActiveCleaningPoint();
    const completedActorType = this.currentCleaningActorType ?? "player";

    this.clearCleaningTimer();
    this.value = this.clampSanitation(this.value + CLEANING_RECOVERY);
    this.isCleaning = false;
    this.activeCleaningDurationMs = null;
    this.currentCleaningActorType = null;
    this.isCleaningNeeded = this.value < DEFAULT_SANITATION;

    if (this.isCleaningNeeded) {
      this.advanceDirtyCleaningPoint(reason);
    } else {
      this.clearDirtyCleaningPoint();
    }

    this.updateWarningState(previousValue, this.value);

    if (!wasCleaning) {
      this.emitChanged(reason, {
        previousValue,
        amount: this.value - previousValue
      });

      return {
        success: false,
        reason: "not_cleaning",
        state: this.getState()
      };
    }

    const payload = {
      day: this.getCurrentDay(),
      reason,
      previousValue,
      value: this.value,
      recoveredAmount: this.value - previousValue,
      cleanedZoneId: cleanedPoint.zoneId,
      cleanedSpotId: cleanedPoint.id,
      cleanedPoint,
      actorType: completedActorType,
      activeCleaningPoint: this.getActiveCleaningPoint(),
      state: this.getState()
    };

    EventBus.emit(EVENTS.CLEANING_COMPLETED, {
      ...payload,
      source: "sanitation_cleaning_zone"
    });
    EventBus.emit(SANITATION_EVENTS.CLEANING_COMPLETED, payload);
    EventBus.emit(SANITATION_EVENTS.MESSAGE_REQUESTED, {
      message: `${cleanedPoint.label} 청소 완료!`,
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
    this.activeCleaningDurationMs = null;
    this.currentCleaningActorType = null;
    this.clearDirtyCleaningPoint();
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
    this.setDirtyCleaningPoint(
      sourceData.dirtyZoneId ?? sourceData.activeCleaningPoint?.zoneId ?? DEFAULT_CLEANING_ZONE_ID
    );

    if (this.isCleaningNeeded) {
      this.ensureDirtyCleaningPoint(sourceData.dirtyZoneId ?? "hydrate");
    } else {
      this.clearDirtyCleaningPoint();
    }

    this.isCleaning = sourceData.isCleaning === true && this.isCleaningNeeded;
    this.warningArmed = sourceData.warningArmed === undefined
      ? this.value >= WARNING_RESET_THRESHOLD
      : sourceData.warningArmed === true;
    this.activeCleaningDurationMs = sourceData.cleaningDurationMs ?? this.cleaningDurationMs;
    this.currentCleaningActorType = this.isCleaning
      ? (sourceData.currentCleaningActorType ?? "player")
      : null;
    this.processedDisruptionKeys = new Set(
      Array.isArray(sourceData.processedDisruptionKeys)
        ? sourceData.processedDisruptionKeys.filter(Boolean).map(String)
        : []
    );

    if (this.isCleaning) {
      this.scheduleCleaningCompletion();
      EventBus.emit(SANITATION_EVENTS.CLEANING_STARTED, {
        day: this.getCurrentDay(),
        durationMs: this.activeCleaningDurationMs ?? this.cleaningDurationMs,
        source: "hydrate",
        actorType: this.currentCleaningActorType ?? "player",
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
      currentCleaningActorType: this.currentCleaningActorType,
      warningArmed: this.warningArmed,
      cleaningDurationMs: this.activeCleaningDurationMs ?? this.cleaningDurationMs,
      dirtyZoneId: this.getActiveCleaningPoint().zoneId,
      dirtySpotId: this.getActiveCleaningPoint().id,
      activeCleaningPoint: this.getActiveCleaningPoint(),
      unlockedCleaningZoneCount: this.getUnlockedCleaningZoneIds().length,
      sanitationPressureMultiplier: this.getAreaPressureMultiplier(),
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

  getCustomerTrafficMessProfile(day = this.getCurrentDay()) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const storyProfile = CUSTOMER_TRAFFIC_MESS_PROFILE_BY_DAY[safeDay];

    if (storyProfile) {
      return storyProfile;
    }

    const checkoutStep = Math.max(3, 4 - Math.floor((safeDay - 6) / 3));
    const maxCheckoutCount = Math.max(30, Number(GameState.todayStats?.totalCustomers) || 45);
    const milestones = [];

    for (let count = checkoutStep; count <= maxCheckoutCount; count += checkoutStep) {
      milestones.push(count);
    }

    return {
      milestones,
      penalty: Math.min(20, 15 + Math.floor((safeDay - 6) / 4))
    };
  },

  applyCustomerTrafficMess(data = {}) {
    const day = this.getCurrentDay();
    const checkoutCount = Math.max(0, Math.floor(
      Number(GameState.todayStats?.checkoutSuccessCount) || 0
    ));
    const profile = this.getCustomerTrafficMessProfile(day);

    if (checkoutCount <= 0 || !profile.milestones.includes(checkoutCount)) {
      return false;
    }

    const disruptionKey = `${day}:customer_traffic:${checkoutCount}`;

    if (this.processedDisruptionKeys.has(disruptionKey)) {
      return false;
    }

    this.processedDisruptionKeys.add(disruptionKey);
    const pressureMultiplier = this.getAreaPressureMultiplier();
    const basePenalty = Math.max(1, Math.floor(Number(profile.penalty) || 0));
    const penalty = Math.max(basePenalty, Math.ceil(basePenalty * pressureMultiplier));
    const dirtyPoint = this.ensureDirtyCleaningPoint(disruptionKey);
    const result = this.decreaseSanitation(penalty, "customer_traffic_mess");

    if (result.changed) {
      EventBus.emit(SANITATION_EVENTS.MESSAGE_REQUESTED, {
        message: `손님이 몰려 ${dirtyPoint.label}이 어질러졌습니다. 위생 -${penalty}`,
        duration: 3000,
        customerId: data.customerId ?? null,
        checkoutCount
      });
    }

    return result.changed;
  },

  applyCustomerMess(data = {}, reason = "customer_mess") {
    const key = this.createDisruptionKey(data, reason);

    if (this.processedDisruptionKeys.has(key)) {
      return false;
    }

    this.processedDisruptionKeys.add(key);

    const eventPenalty = Math.floor(Number(data.sanitationPenalty) || 0);
    const basePenalty = Math.max(CUSTOMER_MESS_PENALTY, eventPenalty);
    const pressureMultiplier = this.getAreaPressureMultiplier();
    const penalty = Math.max(basePenalty, Math.ceil(basePenalty * pressureMultiplier));
    const dirtyPoint = this.ensureDirtyCleaningPoint(key);
    const result = this.decreaseSanitation(penalty, reason);

    if (result.changed) {
      EventBus.emit(SANITATION_EVENTS.MESSAGE_REQUESTED, {
        message: `${dirtyPoint.label}이 어질러졌습니다. 위생 -${penalty}`,
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

  scheduleCleaningCompletion(durationMs = this.activeCleaningDurationMs ?? this.cleaningDurationMs) {
    const safeDurationMs = Math.max(1000, Math.floor(Number(durationMs) || this.cleaningDurationMs));
    const tickMs = 250;

    this.clearCleaningTimer();
    this.activeCleaningDurationMs = safeDurationMs;
    this.cleaningRemainingMs = safeDurationMs;
    this.cleaningTimerId = window.setInterval(() => {
      if (this.isGamePaused()) {
        return;
      }

      this.cleaningRemainingMs = Math.max(0, this.cleaningRemainingMs - tickMs);

      if (this.cleaningRemainingMs > 0) {
        return;
      }

      window.clearInterval(this.cleaningTimerId);
      this.cleaningTimerId = null;
      this.cleaningRemainingMs = 0;
      this.completeCleaning();
    }, tickMs);
  },

  isGamePaused() {
    return Boolean(document.body?.classList?.contains("is-game-paused"));
  },

  getStaffAssistPower(type = "cleaning") {
    const staff = GameState.staff?.hired;
    const unpaidWage = Math.max(0, Math.floor(Number(GameState.staff?.unpaidWage) || 0));
    const isWageSuspended = unpaidWage > 0 || GameState.staff?.wageSuspended === true;

    if (!staff || isWageSuspended) {
      return 0;
    }

    const base = Math.max(0, Math.floor(Number(staff.stats?.[type]) || 0));
    const bonus = Math.max(0, Math.floor(Number(GameState.bm?.staffAbilityUpgrade?.abilities?.[type]) || 0));

    return Math.min(5, base + bonus);
  },

  getAssistedCleaningDurationMs(baseDurationMs = this.cleaningDurationMs, actorType = "player") {
    if (actorType !== "player") {
      return Math.max(1000, Math.floor(Number(baseDurationMs) || this.cleaningDurationMs));
    }

    const safeBaseDuration = Math.max(1000, Math.floor(Number(baseDurationMs) || this.cleaningDurationMs));
    const assistPower = this.getStaffAssistPower("cleaning");
    const reductionRate = Math.min(0.4, assistPower * 0.08);
    const reducedDuration = Math.round(safeBaseDuration * (1 - reductionRate));

    return Math.max(1800, reducedDuration);
  },

  clearCleaningTimer() {
    if (!this.cleaningTimerId) {
      this.cleaningRemainingMs = 0;
      return;
    }

    window.clearInterval(this.cleaningTimerId);
    this.cleaningTimerId = null;
    this.cleaningRemainingMs = 0;
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
      currentCleaningActorType: state.currentCleaningActorType,
      warningArmed: state.warningArmed,
      cleaningDurationMs: state.cleaningDurationMs,
      dirtyZoneId: state.dirtyZoneId,
      dirtySpotId: state.dirtySpotId,
      activeCleaningPoint: state.activeCleaningPoint,
      unlockedCleaningZoneCount: state.unlockedCleaningZoneCount,
      sanitationPressureMultiplier: state.sanitationPressureMultiplier,
      settlementPenalty: state.settlementPenalty,
      processedDisruptionKeys: [...this.processedDisruptionKeys].slice(-30)
    };
  },

  getUnlockedCleaningZoneIds() {
    return getUnlockedCleaningZoneIds(GameState.expansion?.unlockedZoneIds);
  },

  getAreaPressureMultiplier() {
    const unlockedCount = Math.max(1, this.getUnlockedCleaningZoneIds().length);
    const multiplier = 1 + (unlockedCount - 1) * SANITATION_AREA_PRESSURE_STEP;

    return Math.min(SANITATION_AREA_PRESSURE_MAX, Number(multiplier.toFixed(2)));
  },

  getActiveCleaningPoint() {
    const unlockedZoneIds = this.getUnlockedCleaningZoneIds();
    const zoneId = unlockedZoneIds.includes(this.dirtyZoneId)
      ? this.dirtyZoneId
      : unlockedZoneIds[0] ?? DEFAULT_CLEANING_ZONE_ID;

    return getCleaningPointByZoneId(zoneId);
  },

  setDirtyCleaningPoint(zoneId = DEFAULT_CLEANING_ZONE_ID) {
    const unlockedZoneIds = this.getUnlockedCleaningZoneIds();
    const normalizedZoneId = unlockedZoneIds.includes(zoneId)
      ? zoneId
      : unlockedZoneIds[0] ?? DEFAULT_CLEANING_ZONE_ID;
    const point = getCleaningPointByZoneId(normalizedZoneId);

    this.dirtyZoneId = point.zoneId;
    this.dirtySpotId = point.id;

    return point;
  },

  clearDirtyCleaningPoint() {
    return this.setDirtyCleaningPoint(DEFAULT_CLEANING_ZONE_ID);
  },

  ensureDirtyCleaningPoint(seed = "dirty") {
    const unlockedZoneIds = this.getUnlockedCleaningZoneIds();

    if (this.isCleaningNeeded && unlockedZoneIds.includes(this.dirtyZoneId)) {
      return this.getActiveCleaningPoint();
    }

    const zoneId = this.pickDirtyZoneId(seed, unlockedZoneIds);

    return this.setDirtyCleaningPoint(zoneId);
  },

  advanceDirtyCleaningPoint(seed = "cleaning_completed") {
    const unlockedZoneIds = this.getUnlockedCleaningZoneIds();

    if (unlockedZoneIds.length <= 1) {
      return this.setDirtyCleaningPoint(unlockedZoneIds[0] ?? DEFAULT_CLEANING_ZONE_ID);
    }

    const currentIndex = unlockedZoneIds.indexOf(this.dirtyZoneId);
    const nextIndex = currentIndex >= 0
      ? (currentIndex + 1) % unlockedZoneIds.length
      : this.getStableIndexFromSeed(seed, unlockedZoneIds.length);

    return this.setDirtyCleaningPoint(unlockedZoneIds[nextIndex]);
  },

  pickDirtyZoneId(seed = "dirty", unlockedZoneIds = this.getUnlockedCleaningZoneIds()) {
    const allowedZoneIds = unlockedZoneIds.length > 0
      ? unlockedZoneIds
      : [DEFAULT_CLEANING_ZONE_ID];
    const explicitZoneId = CLEANING_ZONE_ORDER.find((zoneId) => String(seed ?? "").includes(zoneId));

    if (explicitZoneId && allowedZoneIds.includes(explicitZoneId)) {
      return explicitZoneId;
    }

    return allowedZoneIds[this.getStableIndexFromSeed(seed, allowedZoneIds.length)];
  },

  getStableIndexFromSeed(seed = "dirty", modulo = 1) {
    const safeModulo = Math.max(1, Math.floor(Number(modulo) || 1));
    const text = String(seed ?? "dirty");
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }

    return hash % safeModulo;
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
