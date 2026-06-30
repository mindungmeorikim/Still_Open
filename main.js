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

function showCustomerEventCandidate() {
  if (isCustomerEventModalOpen()) {
    return;
  }

  const payload = CustomerSystem.createRandomEventCandidatePayload();

  if (!payload || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    return;
  }

  CustomerSystem.pauseCustomerWaitTime();
  GameFlowSystem.pauseDayTimer();

  try {
    UIManager.showCustomerEventModal(
      payload,
      () => {
        CustomerSystem.resumeCustomerWaitTime();
        GameFlowSystem.resumeDayTimer();
      },
      (choice, eventPayload) => {
        const effectResult = RandomEventSystem.applyCustomerEventChoiceEffects(
          eventPayload,
          choice
        );

        if (effectResult.success) {
          applyCustomerEventChoiceStatEffects(choice);
        }

        return effectResult;
      }
    );
  } catch (error) {
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
  PlayerMovementSystem.init();
  PlayerActionSystem.init();
  bindCustomerEventModalFlow();
  EventBus.emit(EVENTS.GAME_INIT);
  requestAnimationFrame(gameloop);

  console.log("오늘도 정상영업 v3.1 발주/택배/상호작용 시스템 초기화 완료");
}

function gameloop() {
  PlayerMovementSystem.update();
  requestAnimationFrame(gameloop);
}
initGame();
