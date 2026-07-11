/*
  main.js
  공통 파일 - 임의 수정 금지
  역할: 게임 최초 실행 및 시스템 초기화
*/

import { EventBus } from "./core/EventBus.js";
import { EVENTS, GAME_PHASE } from "./core/Constants.js";
import { GameState } from "./core/GameState.js";

import { UIManager } from "./ui/UIManager.js";
import { GameFlowSystem } from "./systems/GameFlowSystem.js";
import { ResultSystem } from "./systems/ResultSystem.js";
import { UpgradeSystem } from "./systems/UpgradeSystem.js";
import { CustomerSystem } from "./systems/CustomerSystem.js";
import { ExpirationSystem } from "./systems/ExpirationSystem.js";
import { InventorySystem } from "./systems/InventorySystem.js";
import { OrderSystem } from "./systems/OrderSystem.js";
import { ExpansionSystem } from "./systems/ExpansionSystem.js";
import { EconomySystem } from "./systems/EconomySystem.js";
import { RandomEventSystem } from "./systems/RandomEventSystem.js";
import { PlayerMovementSystem } from "./systems/PlayerMovementSystem.js";
import { PlayerActionSystem } from "./systems/PlayerActionSystem.js";
import { BMSystem } from "./systems/BMSystem.js";
import { SanitationSystem } from "./systems/SanitationSystem.js";
import { DailyMissionSystem } from "./systems/DailyMissionSystem.js";
import { StaffAssistSystem } from "./systems/StaffAssistSystem.js";
import { DebugSystem } from "./systems/DebugSystem.js";
import { AudioSystem } from "./systems/AudioSystem.js";
import { PauseSystem } from "./systems/PauseSystem.js";
import { ModalFlowGuardSystem } from "./systems/ModalFlowGuardSystem.js";
import { AnalyticsSystem } from "./systems/AnalyticsSystem.js";
import { StorePlayFeatureSystem } from "./systems/StorePlayFeatureSystem.js";
import {
  UserIdentitySystem,
  USER_IDENTITY_EVENTS
} from "./systems/UserIdentitySystem.js";

import { MobileUI } from "./ui/MobileUI.js";
import { MobileInputSystem } from "./systems/MobileInputSystem.js";

function isCustomerEventModalOpen() {
  return (
    UIManager.eventModal &&
    !UIManager.eventModal.classList.contains("hidden")
  );
}

function clampPlayerStat(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function applyCustomerEventChoiceStatEffects(choice = {}) {
  const effects = choice.effects ?? {};
  const satisfaction = Number(effects.satisfaction);
  const mental = Number(effects.mental);
  let hasChanged = false;

  if (Number.isFinite(satisfaction)) {
    GameState.satisfaction = clampPlayerStat(GameState.satisfaction + satisfaction);
    hasChanged = true;
  }

  if (Number.isFinite(mental)) {
    GameState.mental = clampPlayerStat(GameState.mental + mental);
    hasChanged = true;
  }

  if (hasChanged) {
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  }
}

const SANITATION_CUSTOMER_EVENT_TRIGGERED = "CUSTOMER_RANDOM_EVENT_TRIGGERED";
const CUSTOMER_EVENT_OPENED = "CUSTOMER_EVENT_OPENED";
const CUSTOMER_EVENT_CHOICE_SELECTED = "CUSTOMER_EVENT_CHOICE_SELECTED";
const CUSTOMER_EVENT_RESPONSE_TIMEOUT = "CUSTOMER_EVENT_RESPONSE_TIMEOUT";
const POSITIVE_CUSTOMER_BONUS_GRANTED = "POSITIVE_CUSTOMER_BONUS_GRANTED";
const NUISANCE_RESPONSE_TIMEOUT_SATISFACTION_PENALTY = 1;
const CUSTOMER_EVENT_CLOSE_GRACE_MS = 1000;
const nuisanceTimeoutEffectKeys = new Set();
let isCustomerEventFlowStarting = false;
let customerEventResumeTimerId = null;

function setCustomerEventModalActive(isActive) {
  document.body?.classList?.toggle(
    "is-customer-event-modal-active",
    isActive === true
  );
  PauseSystem.updatePauseUi?.();
}

function createCustomerEventEffectKey(payload = {}, suffix = "effect") {
  return [
    payload.day ?? GameState.day,
    payload.customerId ?? "unknown",
    payload.eventInstanceId ?? payload.eventId ?? "event",
    suffix
  ].join(":");
}

function applyNuisanceResponseTimeout(payload = {}) {
  if (payload.isNuisance !== true) {
    return;
  }

  const effectKey = createCustomerEventEffectKey(payload, "timeout");

  if (nuisanceTimeoutEffectKeys.has(effectKey)) {
    return;
  }

  nuisanceTimeoutEffectKeys.add(effectKey);
  GameState.satisfaction = clampPlayerStat(
    GameState.satisfaction - NUISANCE_RESPONSE_TIMEOUT_SATISFACTION_PENALTY
  );
  GameState.todayStats.nuisanceTimeoutCount = Math.max(
    0,
    Number(GameState.todayStats.nuisanceTimeoutCount) || 0
  ) + 1;
  UIManager.showMessage("손님의 인내심이 떨어졌습니다. 만족도 -1", {
    duration: 3200
  });
  EventBus.emit(CUSTOMER_EVENT_RESPONSE_TIMEOUT, {
    ...payload,
    satisfactionPenalty: NUISANCE_RESPONSE_TIMEOUT_SATISFACTION_PENALTY
  });
  EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
}

function hasBlockingModalOpen() {
  return [...document.querySelectorAll(".modal:not(.hidden):not([hidden])")].some((modal) => {
    return (
      modal.id !== "customer-event-modal" &&
      modal.getAttribute("aria-hidden") !== "true"
    );
  });
}

function canOpenCustomerEventModal() {
  return (
    GameState.phase === GAME_PHASE.STORE_RUNNING &&
    PauseSystem.isPaused !== true &&
    UIManager.isTutorialVisible?.() !== true &&
    !hasBlockingModalOpen()
  );
}

function resumeCustomerEventFlowAfterGrace() {
  if (customerEventResumeTimerId) {
    window.clearTimeout(customerEventResumeTimerId);
  }

  CustomerSystem.resumeCustomerWaitTime({
    graceMs: CUSTOMER_EVENT_CLOSE_GRACE_MS
  });
  customerEventResumeTimerId = window.setTimeout(() => {
    customerEventResumeTimerId = null;

    if (
      GameState.phase === GAME_PHASE.STORE_RUNNING &&
      PauseSystem.isPaused !== true &&
      !hasBlockingModalOpen() &&
      !isCustomerEventModalOpen()
    ) {
      GameFlowSystem.resumeDayTimer();
    }
  }, CUSTOMER_EVENT_CLOSE_GRACE_MS);
}

function showCustomerEventCandidate() {
  if (
    isCustomerEventFlowStarting ||
    isCustomerEventModalOpen() ||
    !canOpenCustomerEventModal()
  ) {
    return;
  }

  const payload = CustomerSystem.createRandomEventCandidatePayload();

  if (!payload || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    return;
  }

  isCustomerEventFlowStarting = true;

  try {
    EventBus.emit(SANITATION_CUSTOMER_EVENT_TRIGGERED, payload);
    CustomerSystem.pauseCustomerWaitTime();
    GameFlowSystem.pauseDayTimer();

    UIManager.showCustomerEventModal(
      payload,
      () => {
        setCustomerEventModalActive(false);
        resumeCustomerEventFlowAfterGrace();
      },
      (choice, eventPayload, responseMeta = {}) => {
        const effectResult = RandomEventSystem.applyCustomerEventChoiceEffects(
          eventPayload,
          choice
        );

        CustomerSystem.resolveNuisanceEventForCustomer?.(
          eventPayload.customerId,
          eventPayload
        );

        if (effectResult.success) {
          applyCustomerEventChoiceStatEffects(choice);
        }

        const responseTimeMs = Math.max(0, Number(responseMeta.responseTimeMs) || 0);
        GameState.todayStats.nuisanceResponseTimeTotalMs = Math.max(
          0,
          Number(GameState.todayStats.nuisanceResponseTimeTotalMs) || 0
        ) + responseTimeMs;
        GameState.todayStats.nuisanceResponseCount = Math.max(
          0,
          Number(GameState.todayStats.nuisanceResponseCount) || 0
        ) + 1;
        EventBus.emit(CUSTOMER_EVENT_CHOICE_SELECTED, {
          ...eventPayload,
          choiceId: choice.choiceId ?? null,
          responseTimeMs,
          timedOut: responseMeta.timedOut === true
        });

        return effectResult;
      },
      applyNuisanceResponseTimeout
    );

    if (isCustomerEventModalOpen()) {
      setCustomerEventModalActive(true);
      GameState.todayStats.nuisanceEventCount = Math.max(
        0,
        Number(GameState.todayStats.nuisanceEventCount) || 0
      ) + 1;
      EventBus.emit(CUSTOMER_EVENT_OPENED, payload);
    } else {
      setCustomerEventModalActive(false);
      CustomerSystem.resumeCustomerWaitTime();
      GameFlowSystem.resumeDayTimer();
    }

    isCustomerEventFlowStarting = false;
  } catch (error) {
    isCustomerEventFlowStarting = false;
    setCustomerEventModalActive(false);
    CustomerSystem.resumeCustomerWaitTime();
    GameFlowSystem.resumeDayTimer();
    throw error;
  }
}

function bindPositiveCustomerBonus() {
  EventBus.on(POSITIVE_CUSTOMER_BONUS_GRANTED, (payload = {}) => {
    const satisfactionBonus = Number(
      payload.satisfactionBonus ?? payload.satisfaction
    ) || 0;

    if (satisfactionBonus !== 0) {
      GameState.satisfaction = clampPlayerStat(GameState.satisfaction + satisfactionBonus);
    }

    UIManager.showMessage(
      payload.message || `단골 손님이 팁 ${Number(payload.tipGold || 0).toLocaleString("ko-KR")}원을 남겼어요!`,
      { duration: 3000 }
    );
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  });
}

function bindFirstLoginRewardUx() {
  EventBus.on(USER_IDENTITY_EVENTS.FIRST_LOGIN_REWARD_GRANTED, () => {
    UIManager.showMessage("신규 점주 지원금이 보상함에 도착했어요! 다이아 30개를 수령해보세요.", {
      duration: 4200
    });
  });

  EventBus.on(USER_IDENTITY_EVENTS.FIRST_LOGIN_REWARD_CLAIMED, () => {
    UIManager.showMessage("신규 점주 지원금 다이아 30개를 받았어요! 상점에서 성장 아이템이나 편의 기능에 사용할 수 있어요.", {
      duration: 4200
    });
  });
}

function bindCustomerEventModalFlow() {
  EventBus.on(EVENTS.GAME_STATE_CHANGED, () => {
    showCustomerEventCandidate();
  });
}

function bindCustomerStockShortagePenalty() {
  EventBus.on(EVENTS.CUSTOMER_LEFT, (data = {}) => {
    if (data.reason !== "wanted_product_out_of_stock") {
      return;
    }

    GameState.mental = clampPlayerStat(GameState.mental - 1);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  });
}

function initGame() {
  UIManager.init();
  GameFlowSystem.init();
  ResultSystem.init();
  UpgradeSystem.init();
  CustomerSystem.init();
  ExpirationSystem.init();
  InventorySystem.init();
  OrderSystem.init();
  ExpansionSystem.init();
  EconomySystem.init();
  BMSystem.init();
  DailyMissionSystem.init();
  SanitationSystem.init();
  PlayerMovementSystem.init();
  PlayerActionSystem.init();
  StaffAssistSystem.init();
  DebugSystem.init();
  AudioSystem.init();
  PauseSystem.init();
  ModalFlowGuardSystem.init();
  StorePlayFeatureSystem.init();
  UserIdentitySystem.init();
  AnalyticsSystem.init();
  MobileUI.init();
  MobileInputSystem.init();
  bindCustomerEventModalFlow();
  bindCustomerStockShortagePenalty();
  bindPositiveCustomerBonus();
  bindFirstLoginRewardUx();
  UIManager.showAnalyticsConsentIfNeeded();
  EventBus.emit(EVENTS.GAME_INIT);
  requestAnimationFrame(gameloop);
}

function gameloop() {
  MobileInputSystem.update();
  PlayerMovementSystem.update();
  requestAnimationFrame(gameloop);
}
initGame();
