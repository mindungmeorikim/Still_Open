/*
  GameFlowSystem.js

  담당:
  - 1번 담당자

  역할:
  - 전체 플로우
  - Day 시작
  - 영업 시작
  - 하루 종료

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { UIManager } from "../ui/UIManager.js";

export const GameFlowSystem = {
  init() {
    EventBus.on(EVENTS.DAY_START_REQUESTED, () => this.startDay());
    EventBus.on(EVENTS.STORE_OPEN_REQUESTED, () => this.openStore());
    EventBus.on(EVENTS.STORE_CLOSE_REQUESTED, () => this.closeStore());
  },

  startDay() {
    GameState.phase = GAME_PHASE.DAY_START;

    UIManager.showMessage(
      `Day ${GameState.day} 시작! 오늘 목표 매출은 ₩${GameState.dailyGoal.targetRevenue.toLocaleString()}입니다.`
    );

    UIManager.render();

    EventBus.emit(EVENTS.DAY_STARTED, {
      day: GameState.day,
      dailyGoal: GameState.dailyGoal
    });

    EventBus.emit(EVENTS.ORDER_PHASE_STARTED, {
      day: GameState.day
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  openStore() {
    GameState.phase = GAME_PHASE.STORE_RUNNING;

    UIManager.showMessage("편의점 영업을 시작합니다. 손님을 받을 준비를 하세요!");

    UIManager.render();

    EventBus.emit(EVENTS.STORE_OPENED, {
      day: GameState.day,
      phase: GameState.phase
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  closeStore() {
    GameState.phase = GAME_PHASE.DAY_END;

    UIManager.showMessage("하루 영업을 종료합니다. 정산을 준비합니다.");

    UIManager.render();

    EventBus.emit(EVENTS.STORE_CLOSED, {
      day: GameState.day,
      phase: GameState.phase
    });

    EventBus.emit(EVENTS.DAY_ENDED, {
      day: GameState.day,
      todayStats: GameState.todayStats
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  }
};