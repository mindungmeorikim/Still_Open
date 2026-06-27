/*
  ResultSystem.js

  담당:
  - 1번 담당자

  역할:
  - 하루 종료 후 매출, 비용, 순이익 정산
  - 만족도, 멘탈 점수 반영
  - 팀원 시스템 이벤트를 받아 todayStats에 누적
  - 정산 결과 이벤트 전달

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { UIManager } from "../ui/UIManager.js";

export const ResultSystem = {
  init() {
    EventBus.on(EVENTS.DAY_ENDED, () => this.calculateResult());

    this.bindPlayerEvents();
    this.bindCustomerEvents();
    this.bindEconomyEvents();
  },

  bindPlayerEvents() {
    EventBus.on(EVENTS.CHECKOUT_COMPLETED, (data) => {
      GameState.todayStats.checkoutSuccessCount += 1;

      if (data.amount) {
        GameState.todayStats.revenue += this.toNumber(data.amount);
      }

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.RESTOCK_COMPLETED, () => {
      GameState.todayStats.restockCount += 1;

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.CLEANING_COMPLETED, () => {
      GameState.todayStats.cleaningCount += 1;

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });
  },

  bindCustomerEvents() {
    EventBus.on(EVENTS.CUSTOMER_ENTERED, () => {
      GameState.todayStats.totalCustomers += 1;

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.CUSTOMER_SATISFIED, () => {
      GameState.todayStats.satisfiedCustomers += 1;

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.CUSTOMER_ANGRY, () => {
      GameState.todayStats.angryCustomers += 1;

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.CUSTOMER_LEFT, () => {
      GameState.todayStats.lostCustomers += 1;

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });
  },

  bindEconomyEvents() {
    EventBus.on(EVENTS.REVENUE_CHANGED, (data) => {
      GameState.todayStats.revenue += this.toNumber(data.amount);

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.COST_CHANGED, (data) => {
      GameState.todayStats.cost += this.toNumber(data.amount);

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.EXPIRED_LOSS_RECORDED, (data) => {
      GameState.todayStats.expiredLoss += this.toNumber(data.amount);

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.EVENT_PENALTY_RECORDED, (data) => {
      GameState.todayStats.eventPenalty += this.toNumber(data.amount);

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.BM_BONUS_APPLIED, (data) => {
      GameState.todayStats.bmBonus += this.toNumber(data.amount);

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });
  },

  calculateResult() {
    const stats = GameState.todayStats;

    stats.profit =
      stats.revenue -
      stats.cost -
      stats.expiredLoss -
      stats.eventPenalty +
      stats.bmBonus;

    GameState.money += stats.profit;

    const satisfactionChange =
      stats.satisfiedCustomers * 2 -
      stats.angryCustomers * 3 -
      stats.lostCustomers * 5;

    const mentalChange =
      stats.checkoutSuccessCount -
      stats.angryCustomers * 5 -
      Math.floor(stats.eventPenalty * 0.01);

    GameState.satisfaction = this.clamp(
      GameState.satisfaction + satisfactionChange,
      0,
      100
    );

    GameState.mental = this.clamp(
      GameState.mental + mentalChange,
      0,
      100
    );

    GameState.phase = GAME_PHASE.RESULT;

    const resultData = {
      day: GameState.day,
      revenue: stats.revenue,
      cost: stats.cost,
      expiredLoss: stats.expiredLoss,
      eventPenalty: stats.eventPenalty,
      bmBonus: stats.bmBonus,
      profit: stats.profit,
      money: GameState.money,
      satisfaction: GameState.satisfaction,
      mental: GameState.mental,
      totalCustomers: stats.totalCustomers,
      satisfiedCustomers: stats.satisfiedCustomers,
      angryCustomers: stats.angryCustomers,
      lostCustomers: stats.lostCustomers,
      checkoutSuccessCount: stats.checkoutSuccessCount,
      restockCount: stats.restockCount,
      cleaningCount: stats.cleaningCount,
      success: stats.revenue >= GameState.dailyGoal.targetRevenue
    };

    UIManager.showResult(resultData);
    UIManager.render();

    EventBus.emit(EVENTS.RESULT_CALCULATED, resultData);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  toNumber(value) {
    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      return 0;
    }

    return numberValue;
  },

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
};