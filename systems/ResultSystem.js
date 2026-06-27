/*
  ResultSystem.js

  담당:
  - 1번 담당자

  역할:
  - 하루 종료 후 매출, 비용, 순이익 정산
  - 만족도, 멘탈 점수 반영
  - 정산 결과 이벤트 전달

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { UIManager } from "../ui/UIManager.js";

export const ResultSystem = {
  init() {
    EventBus.on(EVENTS.DAY_ENDED, () => this.calculateResult());
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
      success: stats.revenue >= GameState.dailyGoal.targetRevenue
    };

    UIManager.showResult(resultData);
    UIManager.render();

    EventBus.emit(EVENTS.RESULT_CALCULATED, resultData);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
};