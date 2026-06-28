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
  - Day별 목표/난이도 밸런스 관리
  - 스토리 모드 클리어
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
import { getDayScenario } from "../data/DayScenarioData.js";

export const GameFlowSystem = {
  orderReadyDay: null,

  expansionEffects: {
    customerSpawnRateBonus: 0,
    targetRevenueBonus: 0,
    storeSizeBonus: 0
  },

  /*
    임시 밸런스 데이터
    추후 플레이 테스트 후 수정 가능

    Day 1~5는 스토리 모드 기준 고정값
    Day 6부터는 무한모드 공식 계산 사용
  */
  dayBalanceTable: {
    1: {
      targetRevenue: 30000,
      targetSatisfaction: 70,
      difficulty: {
        customerSpawnRate: 1.0,
        angryCustomerRate: 1.0,
        stockDecreaseRate: 1.0,
        eventRate: 1.0
      }
    },
    2: {
      targetRevenue: 45000,
      targetSatisfaction: 70,
      difficulty: {
        customerSpawnRate: 1.15,
        angryCustomerRate: 1.05,
        stockDecreaseRate: 1.05,
        eventRate: 1.05
      }
    },
    3: {
      targetRevenue: 60000,
      targetSatisfaction: 72,
      difficulty: {
        customerSpawnRate: 1.3,
        angryCustomerRate: 1.12,
        stockDecreaseRate: 1.1,
        eventRate: 1.1
      }
    },
    4: {
      targetRevenue: 80000,
      targetSatisfaction: 75,
      difficulty: {
        customerSpawnRate: 1.5,
        angryCustomerRate: 1.2,
        stockDecreaseRate: 1.18,
        eventRate: 1.18
      }
    },
    5: {
      targetRevenue: 100000,
      targetSatisfaction: 78,
      difficulty: {
        customerSpawnRate: 1.75,
        angryCustomerRate: 1.3,
        stockDecreaseRate: 1.28,
        eventRate: 1.3
      }
    }
  },

  init() {
    this.applyDayBalance();

    EventBus.on(EVENTS.DAY_START_REQUESTED, () => this.startDay());
    EventBus.on(EVENTS.STORE_OPEN_REQUESTED, () => this.openStore());
    EventBus.on(EVENTS.STORE_CLOSE_REQUESTED, () => this.closeStore());
    EventBus.on(EVENTS.NEXT_DAY_READY, () => this.goToNextDay());
    EventBus.on(EVENTS.STOCK_ORGANIZED, (data) => {
      this.handleStockOrganized(data);
    });
    EventBus.on(EVENTS.EXPANSION_COMPLETED, (data) => {
      this.applyExpansionEffects(data);
    });
  },

  applyExpansionEffects(data = {}) {
    this.expansionEffects = this.normalizeExpansionEffects(data.effects);
    this.applyDayBalance();

    UIManager.showMessage(
      `확장 효과 적용: 목표 매출 +₩${this.expansionEffects.targetRevenueBonus.toLocaleString()} / 손님 방문 +${Math.round(this.expansionEffects.customerSpawnRateBonus * 100)}%`
    );

    UIManager.render();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  normalizeExpansionEffects(effects = {}) {
    return {
      customerSpawnRateBonus: this.toNumber(effects.customerSpawnRateBonus),
      targetRevenueBonus: this.toNumber(effects.targetRevenueBonus),
      storeSizeBonus: this.toNumber(effects.storeSizeBonus)
    };
  },

  startDay() {
    if (
      GameState.phase === GAME_PHASE.STORE_RUNNING ||
      GameState.phase === GAME_PHASE.DAY_END ||
      GameState.phase === GAME_PHASE.RESULT ||
      GameState.phase === GAME_PHASE.UPGRADE
    ) {
      UIManager.showMessage("이미 Day가 진행 중입니다. 현재 단계를 먼저 완료해주세요.");
      return;
    }

    this.orderReadyDay = null;
    GameState.phase = GAME_PHASE.ORDER;

    const modeText = GameState.isEndlessMode ? "무한모드" : "스토리 모드";
    const dayScenario = this.getCurrentDayScenario();

    UIManager.showMessage(
      `Day ${GameState.day} 시작! 현재 모드: ${modeText} / 발주와 재고 정리를 먼저 진행해주세요.`
    );

    UIManager.render();

    EventBus.emit(EVENTS.DAY_STARTED, {
      day: GameState.day,
      dailyGoal: GameState.dailyGoal,
      difficulty: GameState.difficulty,
      isEndlessMode: GameState.isEndlessMode,
      dayScenario
    });

    EventBus.emit(EVENTS.ORDER_PHASE_STARTED, {
      day: GameState.day,
      dailyGoal: GameState.dailyGoal,
      difficulty: GameState.difficulty,
      isEndlessMode: GameState.isEndlessMode,
      dayScenario
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  openStore() {
    if (GameState.phase === GAME_PHASE.ORDER) {
      UIManager.showMessage("발주 확정과 재고 정리를 완료해야 편의점을 오픈할 수 있습니다.");
      return;
    }

    if (GameState.phase !== GAME_PHASE.DAY_START) {
      UIManager.showMessage("Day 시작 후에 영업을 시작할 수 있습니다.");
      return;
    }

    if (!this.isOrderReadyForCurrentDay()) {
      UIManager.showMessage("발주 확정과 재고 정리를 완료해야 편의점을 오픈할 수 있습니다.");
      return;
    }

    GameState.phase = GAME_PHASE.STORE_RUNNING;

    UIManager.showMessage("편의점 영업을 시작합니다. 손님을 받을 준비를 하세요!");

    UIManager.render();

    EventBus.emit(EVENTS.STORE_OPENED, {
      day: GameState.day,
      phase: GameState.phase,
      dailyGoal: GameState.dailyGoal,
      difficulty: GameState.difficulty,
      isEndlessMode: GameState.isEndlessMode
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  closeStore() {
    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) {
      UIManager.showMessage("영업 중일 때만 하루를 종료할 수 있습니다.");
      return;
    }

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
    const clearedStoryMode =
      GameState.day === GAME_CONFIG.MAX_STORY_DAY && !GameState.isEndlessMode;

    GameState.day += 1;
    this.orderReadyDay = null;

    if (GameState.day > GAME_CONFIG.MAX_STORY_DAY) {
      GameState.isEndlessMode = true;
      GameState.phase = GAME_PHASE.ENDLESS;
    } else {
      GameState.phase = GAME_PHASE.NEXT_DAY;
    }

    this.resetTodayStats();
    this.applyDayBalance();

    const modeText = GameState.isEndlessMode ? "무한모드" : "스토리 모드";

    if (clearedStoryMode) {
      UIManager.showMessage(
        `스토리 모드 클리어! Day ${GameState.day}부터 무한모드에 진입합니다. 목표 매출 ₩${GameState.dailyGoal.targetRevenue.toLocaleString()}`
      );
    } else {
      UIManager.showMessage(
        `Day ${GameState.day} 준비 완료! 현재 모드: ${modeText} / 목표 매출 ₩${GameState.dailyGoal.targetRevenue.toLocaleString()}`
      );
    }

    UIManager.render();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handleStockOrganized(data = {}) {
    if (data.day !== GameState.day) {
      return;
    }

    this.orderReadyDay = GameState.day;

    if (GameState.phase === GAME_PHASE.ORDER) {
      GameState.phase = GAME_PHASE.DAY_START;
    }

    UIManager.showMessage("재고 정리 완료! 이제 편의점을 오픈할 수 있습니다.");
    UIManager.render();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  isOrderReadyForCurrentDay() {
    return this.orderReadyDay === GameState.day;
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

  applyDayBalance() {
    const balance = this.getDayBalance(GameState.day);
    const expansionEffects = this.expansionEffects;

    GameState.dailyGoal = {
      targetRevenue:
        balance.targetRevenue + expansionEffects.targetRevenueBonus,
      targetSatisfaction: balance.targetSatisfaction
    };

    GameState.difficulty = {
      customerSpawnRate:
        balance.difficulty.customerSpawnRate +
        expansionEffects.customerSpawnRateBonus,
      angryCustomerRate: balance.difficulty.angryCustomerRate,
      stockDecreaseRate: balance.difficulty.stockDecreaseRate,
      eventRate: balance.difficulty.eventRate
    };
  },

  getDayBalance(day) {
    if (this.dayBalanceTable[day]) {
      return this.dayBalanceTable[day];
    }

    return this.getEndlessModeBalance(day);
  },

  getEndlessModeBalance(day) {
    const extraDay = day - GAME_CONFIG.MAX_STORY_DAY;

    return {
      targetRevenue: 100000 + extraDay * 25000,
      targetSatisfaction: Math.min(90, 78 + extraDay),
      difficulty: {
        customerSpawnRate: Number((1.75 + extraDay * 0.12).toFixed(2)),
        angryCustomerRate: Number((1.3 + extraDay * 0.07).toFixed(2)),
        stockDecreaseRate: Number((1.28 + extraDay * 0.06).toFixed(2)),
        eventRate: Number((1.3 + extraDay * 0.07).toFixed(2))
      }
    };
  },

  getCurrentDayScenario() {
    return getDayScenario(GameState.day);
  },

  toNumber(value) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return 0;
    }

    return numberValue;
  }
};
