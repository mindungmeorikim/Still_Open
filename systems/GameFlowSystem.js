/*
  GameFlowSystem.js

  담당:
  - 1번 담당자

  역할:
  - 전체 플로우
  - Day 시작
  - 영업 시작
  - 하루 종료
  - 다음 Day 준비
  - Day 반복
  - 무한모드 진입

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE, GAME_CONFIG } from "../core/Constants.js";
import { UIManager } from "../ui/UIManager.js";

export const GameFlowSystem = {
  init() {
    EventBus.on(EVENTS.DAY_START_REQUESTED, () => this.startDay());
    EventBus.on(EVENTS.STORE_OPEN_REQUESTED, () => this.openStore());
    EventBus.on(EVENTS.STORE_CLOSE_REQUESTED, () => this.closeStore());
    EventBus.on(EVENTS.NEXT_DAY_READY, () => this.goToNextDay());
  },

  startDay() {
    GameState.phase = GAME_PHASE.DAY_START;

    UIManager.showMessage(
      `Day ${GameState.day} 시작! 오늘 목표 매출은 ₩${GameState.dailyGoal.targetRevenue.toLocaleString()}입니다.`
    );

    UIManager.render();

    EventBus.emit(EVENTS.DAY_STARTED, {
      day: GameState.day,
      dailyGoal: GameState.dailyGoal,
      difficulty: GameState.difficulty,
      isEndlessMode: GameState.isEndlessMode
    });

    EventBus.emit(EVENTS.ORDER_PHASE_STARTED, {
      day: GameState.day,
      dailyGoal: GameState.dailyGoal
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  openStore() {
    GameState.phase = GAME_PHASE.STORE_RUNNING;

    UIManager.showMessage("편의점 영업을 시작합니다. 손님을 받을 준비를 하세요!");

    UIManager.render();

    EventBus.emit(EVENTS.STORE_OPENED, {
      day: GameState.day,
      phase: GameState.phase,
      difficulty: GameState.difficulty
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
  },

  goToNextDay() {
    GameState.day += 1;

    if (GameState.day > GAME_CONFIG.MAX_STORY_DAY) {
      GameState.isEndlessMode = true;
      GameState.phase = GAME_PHASE.ENDLESS;
    } else {
      GameState.phase = GAME_PHASE.NEXT_DAY;
    }

    this.resetTodayStats();
    this.updateDailyGoal();
    this.increaseDifficulty();

    const modeText = GameState.isEndlessMode ? "무한모드" : "스토리 모드";

    UIManager.showMessage(
      `Day ${GameState.day} 준비 완료! 현재 모드: ${modeText}`
    );

    UIManager.render();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  resetTodayStats() {
    GameState.todayStats = {
      revenue: 0,
      cost: 0,
      profit: 0,

      totalCustomers: 0,
      satisfiedCustomers: 0,
      angryCustomers: 0,
      lostCustomers: 0,

      checkoutSuccessCount: 0,
      restockCount: 0,
      cleaningCount: 0,

      expiredLoss: 0,
      eventPenalty: 0,
      bmBonus: 0
    };
  },

  updateDailyGoal() {
    const baseRevenue = 30000;
    const revenueIncreasePerDay = 15000;

    GameState.dailyGoal = {
      targetRevenue:
        baseRevenue + (GameState.day - 1) * revenueIncreasePerDay,
      targetSatisfaction: 70
    };
  },

  increaseDifficulty() {
    GameState.difficulty.customerSpawnRate = Number(
      (1 + (GameState.day - 1) * 0.1).toFixed(2)
    );

    GameState.difficulty.angryCustomerRate = Number(
      (1 + (GameState.day - 1) * 0.05).toFixed(2)
    );

    GameState.difficulty.stockDecreaseRate = Number(
      (1 + (GameState.day - 1) * 0.05).toFixed(2)
    );

    GameState.difficulty.eventRate = Number(
      (1 + (GameState.day - 1) * 0.05).toFixed(2)
    );
  }
};