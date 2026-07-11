/*
  StorePlayFeatureSystem.js

  목적:
  - 기존 UI 틀을 유지하면서 영업 중 목표와 가벼운 매장 돌발 상황을 관리한다.
  - 별도 대형 모달을 만들지 않고 기존 미션 UI, 토스트, 매장 오브젝트를 재사용한다.
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { getDayScenario } from "../data/DayScenarioData.js";
import { EconomySystem } from "./EconomySystem.js";

export const STORE_PLAY_FEATURE_EVENTS = Object.freeze({
  STATE_CHANGED: "STORE_PLAY_FEATURE_STATE_CHANGED",
  MESSAGE_REQUESTED: "STORE_PLAY_FEATURE_MESSAGE_REQUESTED",
  SHIFT_GOAL_CHANGED: "STORE_SHIFT_GOAL_CHANGED",
  SHIFT_GOAL_COMPLETED: "STORE_SHIFT_GOAL_COMPLETED",
  INCIDENT_STARTED: "STORE_INCIDENT_STARTED",
  INCIDENT_UPDATED: "STORE_INCIDENT_UPDATED",
  INCIDENT_RESOLVED: "STORE_INCIDENT_RESOLVED",
  INCIDENT_FAILED: "STORE_INCIDENT_FAILED",
  INCIDENT_RESOLVE_REQUESTED: "STORE_INCIDENT_RESOLVE_REQUESTED",
  SANITATION_PENALTY_REQUESTED: "STORE_INCIDENT_SANITATION_PENALTY_REQUESTED"
});

const CUSTOMER_FLOW_TICK = "CUSTOMER_FLOW_TICK";
const CUSTOMER_DEMAND_PHASE_CHANGED = "CUSTOMER_DEMAND_PHASE_CHANGED";
const SANITATION_CLEANING_COMPLETED = "SANITATION_CLEANING_COMPLETED";
const SHIFT_GOAL_REWARD_GOLD = 200;
const MAX_INCIDENTS_PER_DAY = 1;

const SHIFT_GOAL_TEMPLATES = Object.freeze({
  recommended_sale: Object.freeze({
    id: "recommended_sale",
    title: "추천 상품 판매",
    description: "오늘의 추천 상품을 판매하세요.",
    progressEvent: "recommended_sale"
  }),
  restock: Object.freeze({
    id: "restock",
    title: "진열대 보충",
    description: "영업 중 진열대를 보충하세요.",
    progressEvent: "restock"
  }),
  cleaning: Object.freeze({
    id: "cleaning",
    title: "매장 청소",
    description: "영업 중 청소를 완료하세요.",
    progressEvent: "cleaning"
  })
});

const INCIDENT_DEFINITIONS = Object.freeze({
  floor_spill: Object.freeze({
    id: "floor_spill",
    title: "바닥에 음료가 쏟아졌어요!",
    shortLabel: "바닥 오염",
    targetType: "cleaning",
    sanitationPenalty: 15,
    warningSeconds: 0
  }),
  fridge_door: Object.freeze({
    id: "fridge_door",
    title: "냉장고 문이 열려 있어요!",
    shortLabel: "냉장고 문",
    targetType: "fridge",
    sanitationPenalty: 10,
    warningSeconds: 12
  })
});

export const StorePlayFeatureSystem = {
  isInitialized: false,
  lastFlowElapsedSeconds: 0,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.ensureState();

    EventBus.on(EVENTS.DAY_STARTED, (data = {}) => {
      this.resetForDay(data.day ?? GameState.day, "day_started");
    });

    EventBus.on(EVENTS.STORE_OPENED, () => {
      this.startShiftFeatures();
    });

    EventBus.on(EVENTS.STORE_CLOSED, () => {
      this.finishOpenIncidentAtClose();
    });

    EventBus.on(EVENTS.CHECKOUT_COMPLETED, (data = {}) => {
      this.handleCheckoutCompleted(data);
    });

    EventBus.on(EVENTS.RESTOCK_COMPLETED, () => {
      this.addShiftGoalProgress("restock", 1);
    });

    EventBus.on(EVENTS.CLEANING_COMPLETED, () => {
      this.addShiftGoalProgress("cleaning", 1);
    });

    EventBus.on(SANITATION_CLEANING_COMPLETED, () => {
      const incident = this.getActiveIncident();

      if (incident?.id === "floor_spill") {
        this.resolveActiveIncident("cleaning_completed");
      }
    });

    EventBus.on(CUSTOMER_FLOW_TICK, (data = {}) => {
      this.handleCustomerFlowTick(data);
    });

    EventBus.on(CUSTOMER_DEMAND_PHASE_CHANGED, (data = {}) => {
      const state = this.ensureState();
      state.demandPhaseId = data.phaseId ?? state.demandPhaseId;
      state.demandPhaseLabel = data.label ?? state.demandPhaseLabel;
      this.emitStateChanged("demand_phase_changed");
    });

    EventBus.on(STORE_PLAY_FEATURE_EVENTS.INCIDENT_RESOLVE_REQUESTED, (data = {}) => {
      this.handleIncidentResolveRequested(data);
    });

    EventBus.on("NEW_GAME_STATE_RESET", () => {
      this.resetForDay(1, "new_game_reset");
    });
  },

  ensureState(day = GameState.day) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const current = GameState.storePlayFeatures;

    if (!current || typeof current !== "object" || Number(current.day) !== safeDay) {
      GameState.storePlayFeatures = {
        day: safeDay,
        demandPhaseId: "opening",
        demandPhaseLabel: "영업 초반",
        shiftGoal: null,
        activeIncident: null,
        incidentHistory: [],
        incidentTriggerChecked: false,
        incidentTriggerElapsedSeconds: this.getIncidentTriggerElapsedSeconds(safeDay)
      };
    } else {
      current.incidentHistory = Array.isArray(current.incidentHistory)
        ? current.incidentHistory
        : [];
      current.incidentTriggerElapsedSeconds = Math.max(
        45,
        Number(current.incidentTriggerElapsedSeconds) || this.getIncidentTriggerElapsedSeconds(safeDay)
      );
    }

    this.ensureTodayStats();
    return GameState.storePlayFeatures;
  },

  ensureTodayStats() {
    const stats = GameState.todayStats && typeof GameState.todayStats === "object"
      ? GameState.todayStats
      : {};

    GameState.todayStats = {
      ...stats,
      storeIncidentStartedCount: Math.max(0, Math.floor(Number(stats.storeIncidentStartedCount) || 0)),
      storeIncidentResolvedCount: Math.max(0, Math.floor(Number(stats.storeIncidentResolvedCount) || 0)),
      storeIncidentFailedCount: Math.max(0, Math.floor(Number(stats.storeIncidentFailedCount) || 0)),
      shiftGoalCompleted: stats.shiftGoalCompleted === true,
      shiftGoalRewardGold: Math.max(0, Math.floor(Number(stats.shiftGoalRewardGold) || 0))
    };
  },

  resetForDay(day = GameState.day, reason = "reset") {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));

    GameState.storePlayFeatures = {
      day: safeDay,
      demandPhaseId: "opening",
      demandPhaseLabel: "영업 초반",
      shiftGoal: null,
      activeIncident: null,
      incidentHistory: [],
      incidentTriggerChecked: false,
      incidentTriggerElapsedSeconds: this.getIncidentTriggerElapsedSeconds(safeDay)
    };
    this.lastFlowElapsedSeconds = 0;
    this.ensureTodayStats();
    this.emitStateChanged(reason);
  },

  startShiftFeatures() {
    const state = this.ensureState();
    this.lastFlowElapsedSeconds = 0;

    if (!state.shiftGoal || state.shiftGoal.day !== GameState.day) {
      state.shiftGoal = this.createShiftGoal(GameState.day);
    }

    state.activeIncident = null;
    state.incidentHistory = [];
    state.incidentTriggerChecked = false;
    state.incidentTriggerElapsedSeconds = this.getIncidentTriggerElapsedSeconds(GameState.day);

    this.emitShiftGoalChanged("store_opened");
    this.emitStateChanged("store_opened");

    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.MESSAGE_REQUESTED, {
      message: `영업 중 목표: ${state.shiftGoal.title} · 달성 보상 ₩${SHIFT_GOAL_REWARD_GOLD.toLocaleString("ko-KR")}`,
      duration: 3600
    });
  },

  createShiftGoal(day = GameState.day) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    let template = SHIFT_GOAL_TEMPLATES.recommended_sale;
    let target = 3;

    if (safeDay === 2) {
      template = SHIFT_GOAL_TEMPLATES.restock;
      target = 1;
    } else if (safeDay === 3) {
      template = SHIFT_GOAL_TEMPLATES.cleaning;
      target = 1;
    } else if (safeDay >= 4) {
      const cycle = (safeDay - 4) % 3;
      template = [
        SHIFT_GOAL_TEMPLATES.recommended_sale,
        SHIFT_GOAL_TEMPLATES.restock,
        SHIFT_GOAL_TEMPLATES.cleaning
      ][cycle];
      target = template.id === "recommended_sale"
        ? Math.min(6, 4 + Math.floor((safeDay - 4) / 3))
        : template.id === "restock"
          ? Math.min(3, 1 + Math.floor((safeDay - 4) / 6))
          : 1;
    }

    return {
      ...template,
      day: safeDay,
      progress: 0,
      target,
      rewardGold: SHIFT_GOAL_REWARD_GOLD,
      isComplete: false,
      rewardGranted: false
    };
  },

  getState() {
    const state = this.ensureState();

    return {
      day: state.day,
      demandPhaseId: state.demandPhaseId,
      demandPhaseLabel: state.demandPhaseLabel,
      shiftGoal: state.shiftGoal ? { ...state.shiftGoal } : null,
      activeIncident: state.activeIncident ? { ...state.activeIncident } : null,
      incidentHistory: state.incidentHistory.map((item) => ({ ...item }))
    };
  },

  getShiftGoalState() {
    const goal = this.ensureState().shiftGoal;

    if (!goal) return null;

    const progress = Math.max(0, Math.floor(Number(goal.progress) || 0));
    const target = Math.max(1, Math.floor(Number(goal.target) || 1));

    return {
      ...goal,
      progress,
      target,
      isComplete: goal.isComplete === true || progress >= target,
      progressText: `${Math.min(progress, target).toLocaleString("ko-KR")} / ${target.toLocaleString("ko-KR")}`
    };
  },

  handleCheckoutCompleted(data = {}) {
    const scenario = GameState.dayScenario?.day === GameState.day
      ? GameState.dayScenario
      : getDayScenario(GameState.day);
    const recommendedIds = new Set(scenario.recommendedProductIds ?? []);
    const productId = data.productId ?? data.wantedProductId;
    const quantity = Math.max(1, Math.floor(Number(data.quantity) || 1));

    if (recommendedIds.has(productId)) {
      this.addShiftGoalProgress("recommended_sale", quantity);
    }
  },

  addShiftGoalProgress(progressEvent, amount = 1) {
    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) return false;

    const state = this.ensureState();
    const goal = state.shiftGoal;

    if (!goal || goal.isComplete === true || goal.progressEvent !== progressEvent) {
      return false;
    }

    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));

    if (safeAmount <= 0) return false;

    goal.progress = Math.min(
      Math.max(1, Math.floor(Number(goal.target) || 1)),
      Math.max(0, Math.floor(Number(goal.progress) || 0)) + safeAmount
    );

    if (goal.progress >= goal.target) {
      this.completeShiftGoal();
    } else {
      this.emitShiftGoalChanged("progress_changed");
    }

    return true;
  },

  completeShiftGoal() {
    const state = this.ensureState();
    const goal = state.shiftGoal;

    if (!goal || goal.rewardGranted === true) {
      return false;
    }

    goal.progress = Math.max(1, Math.floor(Number(goal.target) || 1));
    goal.isComplete = true;

    const rewardResult = EconomySystem.addGold(
      Math.max(0, Math.floor(Number(goal.rewardGold) || SHIFT_GOAL_REWARD_GOLD)),
      "shift_goal_reward",
      {
        day: GameState.day,
        goalId: goal.id,
        source: "store_play_feature"
      }
    );

    if (rewardResult?.success === false) {
      return false;
    }

    goal.rewardGranted = true;
    this.ensureTodayStats();
    GameState.todayStats.shiftGoalCompleted = true;
    GameState.todayStats.shiftGoalRewardGold = Math.max(
      0,
      Math.floor(Number(goal.rewardGold) || SHIFT_GOAL_REWARD_GOLD)
    );

    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.SHIFT_GOAL_COMPLETED, {
      day: GameState.day,
      goal: { ...goal },
      rewardGold: GameState.todayStats.shiftGoalRewardGold
    });
    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.MESSAGE_REQUESTED, {
      message: `영업 중 목표 달성! ${goal.title} · 보너스 ₩${GameState.todayStats.shiftGoalRewardGold.toLocaleString("ko-KR")}`,
      duration: 3600
    });
    this.emitShiftGoalChanged("completed");
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return true;
  },

  handleCustomerFlowTick(data = {}) {
    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) return;

    const elapsedSeconds = Math.max(0, Number(data.elapsedSeconds) || 0);
    const deltaSeconds = Math.max(0, elapsedSeconds - this.lastFlowElapsedSeconds);
    this.lastFlowElapsedSeconds = elapsedSeconds;

    this.updateActiveIncident(deltaSeconds);
    this.maybeStartIncident(elapsedSeconds);
  },

  getIncidentTriggerElapsedSeconds(day = GameState.day) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const base = safeDay === 1 ? 100 : safeDay === 2 ? 78 : 68;
    const variance = ((safeDay * 17) % 19) - 9;

    return Math.max(55, Math.min(125, base + variance));
  },

  shouldStartIncident(day = GameState.day) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));

    if (safeDay >= 2) {
      return true;
    }

    return Math.random() < 0.4;
  },

  maybeStartIncident(elapsedSeconds) {
    const state = this.ensureState();

    if (
      state.incidentTriggerChecked ||
      state.activeIncident ||
      state.incidentHistory.length >= MAX_INCIDENTS_PER_DAY ||
      elapsedSeconds < state.incidentTriggerElapsedSeconds
    ) {
      return;
    }

    const sanitation = GameState.sanitation ?? {};

    if (sanitation.isCleaning === true) {
      state.incidentTriggerElapsedSeconds += 5;
      return;
    }

    state.incidentTriggerChecked = true;

    if (!this.shouldStartIncident(GameState.day)) {
      this.emitStateChanged("incident_skipped");
      return;
    }

    const incidentId = this.pickIncidentId(GameState.day);
    this.startIncident(incidentId, elapsedSeconds);
  },

  pickIncidentId(day = GameState.day) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));

    if (safeDay <= 2) return "floor_spill";
    return safeDay % 2 === 1 ? "fridge_door" : "floor_spill";
  },

  startIncident(incidentId, elapsedSeconds = 0) {
    const definition = INCIDENT_DEFINITIONS[incidentId];

    if (!definition) return false;

    const state = this.ensureState();

    if (state.activeIncident) return false;

    const incident = {
      ...definition,
      day: GameState.day,
      startedAtElapsedSeconds: Math.max(0, Number(elapsedSeconds) || 0),
      remainingWarningSeconds: Math.max(0, Number(definition.warningSeconds) || 0),
      penaltyApplied: false,
      status: "active"
    };

    state.activeIncident = incident;
    this.ensureTodayStats();
    GameState.todayStats.storeIncidentStartedCount += 1;

    if (incident.id === "floor_spill") {
      incident.penaltyApplied = true;
      EventBus.emit(STORE_PLAY_FEATURE_EVENTS.SANITATION_PENALTY_REQUESTED, {
        day: GameState.day,
        incidentId: incident.id,
        amount: incident.sanitationPenalty,
        reason: "store_incident_floor_spill"
      });
    }

    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.INCIDENT_STARTED, {
      day: GameState.day,
      incident: { ...incident }
    });
    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.MESSAGE_REQUESTED, {
      message: incident.id === "floor_spill"
        ? "바닥에 음료가 쏟아졌어요! 오염된 구역으로 이동해 청소해주세요."
        : "냉장고 문이 열려 있어요! 냉장고 가까이에서 상호작용해주세요.",
      duration: 4200
    });
    this.emitStateChanged("incident_started");
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return true;
  },

  updateActiveIncident(deltaSeconds = 0) {
    const state = this.ensureState();
    const incident = state.activeIncident;

    if (!incident || incident.id !== "fridge_door" || incident.penaltyApplied === true) {
      return;
    }

    incident.remainingWarningSeconds = Math.max(
      0,
      Number(incident.remainingWarningSeconds) - Math.max(0, Number(deltaSeconds) || 0)
    );

    if (incident.remainingWarningSeconds <= 0) {
      incident.remainingWarningSeconds = 0;
      incident.penaltyApplied = true;
      EventBus.emit(STORE_PLAY_FEATURE_EVENTS.SANITATION_PENALTY_REQUESTED, {
        day: GameState.day,
        incidentId: incident.id,
        amount: incident.sanitationPenalty,
        reason: "store_incident_fridge_door_timeout"
      });
      EventBus.emit(STORE_PLAY_FEATURE_EVENTS.MESSAGE_REQUESTED, {
        message: "냉장고 문을 늦게 닫아 위생이 10 감소했습니다. 문은 계속 닫을 수 있어요.",
        duration: 3800
      });
    }

    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.INCIDENT_UPDATED, {
      day: GameState.day,
      incident: { ...incident }
    });
    this.emitStateChanged("incident_updated");
  },

  handleIncidentResolveRequested(data = {}) {
    const incident = this.getActiveIncident();

    if (!incident) return false;

    const requestedType = String(data.targetType ?? data.incidentId ?? "");
    const matchesFridge = incident.id === "fridge_door" && ["fridge", "fridge_door"].includes(requestedType);

    if (!matchesFridge) return false;

    return this.resolveActiveIncident(data.source ?? "player_interaction");
  },

  resolveActiveIncident(source = "resolved") {
    const state = this.ensureState();
    const incident = state.activeIncident;

    if (!incident) return false;

    const resolved = {
      ...incident,
      status: "resolved",
      resolvedSource: source
    };

    state.activeIncident = null;
    state.incidentHistory.push(resolved);
    this.ensureTodayStats();
    GameState.todayStats.storeIncidentResolvedCount += 1;

    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.INCIDENT_RESOLVED, {
      day: GameState.day,
      incident: { ...resolved }
    });
    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.MESSAGE_REQUESTED, {
      message: resolved.id === "fridge_door"
        ? "냉장고 문을 닫았습니다."
        : "바닥 오염을 깨끗하게 정리했습니다.",
      duration: 2600
    });
    this.emitStateChanged("incident_resolved");
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return true;
  },

  finishOpenIncidentAtClose() {
    const state = this.ensureState();
    const incident = state.activeIncident;

    if (!incident) return;

    const failed = {
      ...incident,
      status: "failed",
      failedReason: "store_closed"
    };

    state.activeIncident = null;
    state.incidentHistory.push(failed);
    this.ensureTodayStats();
    GameState.todayStats.storeIncidentFailedCount += 1;

    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.INCIDENT_FAILED, {
      day: GameState.day,
      incident: { ...failed }
    });
    this.emitStateChanged("incident_failed_at_close");
  },

  getActiveIncident() {
    return this.ensureState().activeIncident;
  },

  emitShiftGoalChanged(reason = "changed") {
    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.SHIFT_GOAL_CHANGED, {
      reason,
      day: GameState.day,
      shiftGoal: this.getShiftGoalState()
    });
    this.emitStateChanged(`shift_goal_${reason}`);
  },

  emitStateChanged(reason = "changed") {
    EventBus.emit(STORE_PLAY_FEATURE_EVENTS.STATE_CHANGED, {
      reason,
      day: GameState.day,
      storePlayFeatureState: this.getState()
    });
  }
};
