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
import { ExpansionSystem } from "./systems/ExpansionSystem.js"
import { PlayerMovementSystem } from "./systems/PlayerMovementSystem.js";

const shownCustomerEventKeys = new Set();

function isCustomerEventModalOpen() {
  return (
    UIManager.eventModal &&
    !UIManager.eventModal.classList.contains("hidden")
  );
}

function createCustomerEventKey(payload) {
  return `${payload.day}:${payload.customerId}:${payload.eventId}`;
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

  const eventKey = createCustomerEventKey(payload);

  if (shownCustomerEventKeys.has(eventKey)) {
    return;
  }

  shownCustomerEventKeys.add(eventKey);
  CustomerSystem.pauseCustomerWaitTime();

  try {
    UIManager.showCustomerEventModal(
      payload,
      () => {
        CustomerSystem.resumeCustomerWaitTime();
      },
      (choice) => {
        applyCustomerEventChoiceStatEffects(choice);
      }
    );
  } catch (error) {
    CustomerSystem.resumeCustomerWaitTime();
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
  PlayerMovementSystem.init();
  bindCustomerEventModalFlow();
  EventBus.emit(EVENTS.GAME_INIT);
  requestAnimationFrame(gameloop);

  console.log("오늘도 정상영업 v2.3 상품 재고 및 유통기한 시스템 초기화 완료");
}

function gameloop() {
  PlayerMovementSystem.update();
  requestAnimationFrame(gameloop);
}
initGame();
