/*
  main.js
  공통 파일 - 임의 수정 금지
  역할: 게임 최초 실행 및 시스템 초기화
*/

import { EventBus } from "./core/EventBus.js";
import { EVENTS } from "./core/Constants.js";
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
import { ResponsiveLayoutSystem } from "./systems/ResponsiveLayoutSystem.js";

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
const NUISANCE_EVENT_MENTAL_PENALTY = 3;
const NUISANCE_RESPONSE_TIMEOUT_SATISFACTION_PENALTY = 5;
const nuisanceEventEffectKeys = new Set();
const nuisanceTimeoutEffectKeys = new Set();
let isCustomerEventFlowStarting = false;

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

function applyNuisanceEventModalOpenPenalty(payload = {}) {
  if (payload.isNuisance !== true) {
    return;
  }

  const effectKey = createCustomerEventEffectKey(payload, "modal-open");

  if (nuisanceEventEffectKeys.has(effectKey)) {
    return;
  }

  nuisanceEventEffectKeys.add(effectKey);
  GameState.mental = clampPlayerStat(GameState.mental - NUISANCE_EVENT_MENTAL_PENALTY);
  EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
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
  UIManager.showMessage("진상 대응이 늦어 손님 만족도가 감소했습니다.", {
    duration: 3200
  });
  EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
}

function showCustomerEventCandidate() {
  if (isCustomerEventFlowStarting || isCustomerEventModalOpen()) {
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
        CustomerSystem.resumeCustomerWaitTime();
        GameFlowSystem.resumeDayTimer();
      },
      (choice, eventPayload) => {
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

        return effectResult;
      },
      applyNuisanceResponseTimeout
    );

    if (isCustomerEventModalOpen()) {
      setCustomerEventModalActive(true);
      applyNuisanceEventModalOpenPenalty(payload);
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
  ResponsiveLayoutSystem.init();
  UIManager.init();
  ResponsiveLayoutSystem.subscribe(() => {
    UIManager.updateWorldCameraTransform?.();
    UIManager.refreshTutorialAnchoredLayout?.();
  });
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
  MobileUI.init();
  MobileInputSystem.init();
  bindCustomerEventModalFlow();
  bindCustomerStockShortagePenalty();
  EventBus.emit(EVENTS.GAME_INIT);
  requestAnimationFrame(gameloop);
}

function gameloop() {
  MobileInputSystem.update();
  PlayerMovementSystem.update();
  requestAnimationFrame(gameloop);
}
initGame();
