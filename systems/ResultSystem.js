/*
  ResultSystem.js

  담당:
  - 1번 담당자

  역할:
  - 하루 종료 후 매출, 비용, 순이익 정산
  - 만족도, 멘탈 점수 반영
  - 목표 매출 / 목표 만족도 기준 성공 실패 판정
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
  calculatedResultDay: null,
  processedCheckoutKeys: new Set(),

  init() {
    EventBus.on(EVENTS.DAY_ENDED, () => this.calculateResult());

    this.bindPlayerEvents();
    this.bindCustomerEvents();
    this.bindEconomyEvents();
  },

  bindPlayerEvents() {
    EventBus.on(EVENTS.DAY_STARTED, () => {
      this.processedCheckoutKeys.clear();
    });

    EventBus.on(EVENTS.CHECKOUT_COMPLETED, (data = {}) => {
      const checkoutKey = this.createCheckoutKey(data);

      if (!checkoutKey) {
        console.warn("[ResultSystem] 계산 성공 수 처리 실패: checkoutId 또는 customerId가 필요합니다.", data);
        return;
      }

      if (this.processedCheckoutKeys.has(checkoutKey)) {
        console.warn("[ResultSystem] 이미 집계된 계산입니다.", data);
        return;
      }

      this.processedCheckoutKeys.add(checkoutKey);
      GameState.todayStats.checkoutSuccessCount += 1;

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

  createCheckoutKey(data = {}) {
    const day = Math.max(1, Math.floor(Number(data.day) || GameState.day || 1));

    if (data.checkoutId !== undefined && data.checkoutId !== null) {
      const checkoutId = String(data.checkoutId).trim();

      if (checkoutId) {
        return `${day}:checkout:${checkoutId}`;
      }
    }

    if (data.customerId !== undefined && data.customerId !== null) {
      const customerId = String(data.customerId).trim();

      if (customerId) {
        return `${day}:customer:${customerId}`;
      }
    }

    return null;
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
    if (
      this.calculatedResultDay === GameState.day &&
      GameState.phase === GAME_PHASE.RESULT
    ) {
      return;
    }

    this.calculatedResultDay = GameState.day;

    if (this.shouldApplyMvpTestData()) {
      this.applyMvpTestData();
    }

    const stats = GameState.todayStats;

    stats.profit =
      stats.revenue -
      stats.cost -
      stats.expiredLoss -
      stats.eventPenalty +
      stats.bmBonus;

    const bmScore = stats.bmBonus;

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

    const revenueSuccess =
      stats.revenue >= GameState.dailyGoal.targetRevenue;

    const satisfactionSuccess =
      GameState.satisfaction >= GameState.dailyGoal.targetSatisfaction;

    const mentalSuccess =
      GameState.mental > 0;

    const success =
      revenueSuccess &&
      satisfactionSuccess &&
      mentalSuccess;

    const revenueGap = stats.revenue - GameState.dailyGoal.targetRevenue;
    const satisfactionGap =
      GameState.satisfaction - GameState.dailyGoal.targetSatisfaction;
    const mentalGoal = 1;
    const mentalGap = GameState.mental - mentalGoal;
    const resultChecks = this.createResultChecks({
      revenue: stats.revenue,
      targetRevenue: GameState.dailyGoal.targetRevenue,
      revenueGap,
      satisfaction: GameState.satisfaction,
      targetSatisfaction: GameState.dailyGoal.targetSatisfaction,
      satisfactionGap,
      mental: GameState.mental,
      mentalGoal,
      mentalGap,
      revenueSuccess,
      satisfactionSuccess,
      mentalSuccess
    });
    const resultSummaryText = this.createResultSummaryText(success, {
      revenueSuccess,
      satisfactionSuccess,
      mentalSuccess
    });
    const nextStepText = this.createNextStepText(success);

    const resultData = {
      day: GameState.day,

      revenue: stats.revenue,
      targetRevenue: GameState.dailyGoal.targetRevenue,
      revenueGap,

      cost: stats.cost,
      expiredLoss: stats.expiredLoss,
      eventPenalty: stats.eventPenalty,
      bmBonus: stats.bmBonus,
      bmScore,
      profit: stats.profit,
      money: GameState.money,

      satisfaction: GameState.satisfaction,
      targetSatisfaction: GameState.dailyGoal.targetSatisfaction,
      satisfactionGap,
      mental: GameState.mental,
      mentalGoal,
      mentalGap,

      totalCustomers: stats.totalCustomers,
      satisfiedCustomers: stats.satisfiedCustomers,
      angryCustomers: stats.angryCustomers,
      lostCustomers: stats.lostCustomers,

      checkoutSuccessCount: stats.checkoutSuccessCount,
      restockCount: stats.restockCount,
      cleaningCount: stats.cleaningCount,

      revenueSuccess,
      satisfactionSuccess,
      mentalSuccess,
      success,
      resultChecks,
      resultSummaryText,
      nextStepText,

      mvpTestDataApplied: stats.mvpTestDataApplied === true
    };

    UIManager.showResult(resultData);
    UIManager.showMessage(this.createResultMessage(resultData));
    UIManager.render();

    EventBus.emit(EVENTS.RESULT_CALCULATED, resultData);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  shouldApplyMvpTestData() {
    const stats = GameState.todayStats;

    return (
      stats.revenue === 0 &&
      stats.cost === 0 &&
      stats.totalCustomers === 0 &&
      stats.checkoutSuccessCount === 0 &&
      stats.expiredLoss === 0 &&
      stats.eventPenalty === 0 &&
      stats.bmBonus === 0
    );
  },

  applyMvpTestData() {
    /*
      임시 MVP 테스트 데이터
      추후 CustomerSystem / InventorySystem / EconomySystem 연결 후 제거 가능

      목적:
      - NPC, 재고, 경제 시스템이 아직 완성되지 않아도
        Day 종료 → 정산 → 업그레이드 → 다음 Day 흐름이 눈에 보이게 작동하도록 함
    */

    const targetRevenue = GameState.dailyGoal.targetRevenue;
    const day = GameState.day;

    GameState.todayStats.revenue = Math.floor(targetRevenue * 1.05);
    GameState.todayStats.cost = Math.floor(targetRevenue * 0.35);

    GameState.todayStats.totalCustomers = 6 + day * 2;
    GameState.todayStats.satisfiedCustomers = 5 + day;
    GameState.todayStats.angryCustomers = Math.max(1, Math.floor(day * 0.5));
    GameState.todayStats.lostCustomers = 1;

    GameState.todayStats.checkoutSuccessCount = 5 + day;
    GameState.todayStats.restockCount = 2;
    GameState.todayStats.cleaningCount = 1;

    GameState.todayStats.expiredLoss = Math.floor(day * 500);
    GameState.todayStats.eventPenalty = Math.floor(day * 300);
    GameState.todayStats.bmBonus = 0;

    GameState.todayStats.mvpTestDataApplied = true;
  },

  createResultMessage(resultData) {
    const resultText = resultData.success ? "영업 성공" : "영업 실패";
    const mvpText = resultData.mvpTestDataApplied
      ? " / 임시 MVP 데이터 적용"
      : "";

    return (
      `Day ${resultData.day} 정산 완료 | ` +
      `결과: ${resultText} | ` +
      `${resultData.resultSummaryText} | ` +
      `매출 ₩${resultData.revenue.toLocaleString()} / ` +
      `목표 ₩${resultData.targetRevenue.toLocaleString()} | ` +
      `만족도 ${resultData.satisfaction}/${resultData.targetSatisfaction} | ` +
      `멘탈 ${resultData.mental} | ` +
      `병맛 점수 ${resultData.bmScore.toLocaleString()}${mvpText}`
    );
  },

  createResultSummaryText(success, checks = {}) {
    if (success) {
      return "오늘 영업 목표를 모두 지켰습니다. 다음 날 장사 준비로 넘어갑니다.";
    }

    const failedLabels = [];

    if (!checks.revenueSuccess) failedLabels.push("매출");
    if (!checks.satisfactionSuccess) failedLabels.push("만족도");
    if (!checks.mentalSuccess) failedLabels.push("멘탈");

    return `${failedLabels.join(", ")} 조건을 놓쳤습니다. 업그레이드로 내일 다시 만회해봅시다.`;
  },

  createNextStepText(success) {
    return success
      ? "정산 확인 후 오늘의 보상 업그레이드를 선택하고 다음 Day로 진행합니다."
      : "정산 확인 후 보완용 업그레이드를 선택하고 다음 Day에서 재도전합니다.";
  },

  createResultChecks(data = {}) {
    return [
      {
        label: "목표 매출",
        success: data.revenueSuccess,
        statusText: data.revenueSuccess ? "달성" : "미달",
        valueText: `₩${data.revenue.toLocaleString()} / ₩${data.targetRevenue.toLocaleString()}`,
        detailText: data.revenueSuccess
          ? `목표보다 ₩${Math.max(0, data.revenueGap).toLocaleString()} 더 벌었습니다.`
          : `목표까지 ₩${Math.abs(data.revenueGap).toLocaleString()} 부족합니다.`
      },
      {
        label: "만족도",
        success: data.satisfactionSuccess,
        statusText: data.satisfactionSuccess ? "유지" : "주의",
        valueText: `${data.satisfaction} / ${data.targetSatisfaction}`,
        detailText: data.satisfactionSuccess
          ? "손님 반응이 목표 기준을 넘었습니다."
          : `목표보다 ${Math.abs(data.satisfactionGap)} 낮습니다. 고객 응대가 필요합니다.`
      },
      {
        label: "멘탈",
        success: data.mentalSuccess,
        statusText: data.mentalSuccess ? "버팀" : "방전",
        valueText: `${data.mental} / 100`,
        detailText: data.mentalSuccess
          ? "오늘도 멘탈을 붙잡고 버텼습니다."
          : "멘탈이 0이 되었습니다. 내일은 더 짧고 정확하게 움직여야 합니다."
      }
    ];
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
