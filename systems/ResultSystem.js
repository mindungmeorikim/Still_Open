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
import { EVENTS, GAME_PHASE, GAME_CONFIG } from "../core/Constants.js";
import { UIManager } from "../ui/UIManager.js";
import { getUnlockedProducts } from "../data/ProductData.js";
import { InventorySystem } from "./InventorySystem.js";

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
      this.recordCheckoutSuccess(data, {
        warnOnMissingKey: false,
        duplicateMessage: "[ResultSystem] 이미 집계된 계산입니다."
      });
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

  recordCheckoutSuccess(data = {}, options = {}) {
    const checkoutKey = this.createCheckoutKey(data);

    if (!checkoutKey) {
      if (options.warnOnMissingKey === true) {
        console.warn(
          "[ResultSystem] 계산 성공 수 처리 실패: checkoutId 또는 customerId가 필요합니다.",
          data
        );
      }

      return false;
    }

    if (this.processedCheckoutKeys.has(checkoutKey)) {
      if (options.duplicateMessage) {
        console.warn(options.duplicateMessage, data);
      }

      return false;
    }

    this.processedCheckoutKeys.add(checkoutKey);
    GameState.todayStats.checkoutSuccessCount += 1;

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return true;
  },

  bindCustomerEvents() {
    EventBus.on(EVENTS.CUSTOMER_ENTERED, () => {
      GameState.todayStats.totalCustomers += 1;

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    });

    EventBus.on(EVENTS.CUSTOMER_SATISFIED, (data = {}) => {
      this.recordCheckoutSuccess(data, {
        warnOnMissingKey: false,
        duplicateMessage: null
      });

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
    const staffResult = this.createStaffResultSummary();

    stats.staffWageCost = staffResult.wageCost;
    stats.staffCheckoutCount = staffResult.checkoutCount;
    stats.staffName = staffResult.name;
    stats.staffType = staffResult.type;
    stats.staffExpectedDailyWage = staffResult.wageCost;
    stats.cost += staffResult.wageCost;

    stats.profit =
      stats.revenue -
      stats.cost -
      stats.expiredLoss -
      stats.eventPenalty +
      stats.bmBonus;

    const bmScore = stats.bmBonus;
    const sanitationPenalty = this.getSanitationSettlementPenalty();

    GameState.money += stats.profit;

    const satisfactionChange =
      stats.satisfiedCustomers * 2 -
      stats.angryCustomers * 3 -
      stats.lostCustomers * 5 +
      sanitationPenalty.satisfactionPenalty;

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

    const daySuccess =
      revenueSuccess &&
      satisfactionSuccess &&
      mentalSuccess;

    const infiniteModeProgress = this.updateInfiniteModeProgress(daySuccess);
    const infiniteGameOver = this.evaluateInfiniteModeGameOver({
      daySuccess,
      revenueSuccess,
      satisfactionSuccess,
      mentalSuccess,
      infiniteModeProgress
    });
    const success = daySuccess && !infiniteGameOver.isGameOver;

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
      mentalSuccess,
      sanitationPenalty
    });
    const resultSummaryText = infiniteGameOver.isGameOver
      ? infiniteGameOver.summaryText
      : this.createResultSummaryText(success, {
          revenueSuccess,
          satisfactionSuccess,
          mentalSuccess
        });
    const nextStepText = this.createNextStepText(success, infiniteGameOver);

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
      staff: staffResult,
      sanitation: sanitationPenalty.sanitation,
      sanitationPenalty,

      revenueSuccess,
      satisfactionSuccess,
      mentalSuccess,
      success,
      daySuccess,
      resultChecks,
      resultSummaryText,
      nextStepText,
      infiniteModeProgress,
      infiniteGameOver,

      mvpTestDataApplied: stats.mvpTestDataApplied === true
    };

    UIManager.showResult(resultData);
    UIManager.showMessage(this.createResultMessage(resultData));
    UIManager.render();

    EventBus.emit(EVENTS.RESULT_CALCULATED, resultData);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  isInfiniteModeActive() {
    return GameState.isEndlessMode === true || Number(GameState.day) > GAME_CONFIG.MAX_STORY_DAY;
  },

  ensureInfiniteModeState() {
    if (!GameState.infiniteMode || typeof GameState.infiniteMode !== "object") {
      GameState.infiniteMode = {};
    }

    GameState.infiniteMode.consecutiveFailures = Math.max(
      0,
      Math.floor(Number(GameState.infiniteMode.consecutiveFailures) || 0)
    );
    GameState.infiniteMode.lastCheckedDay = Math.max(
      1,
      Math.floor(Number(GameState.infiniteMode.lastCheckedDay) || GameState.day || 1)
    );
    GameState.infiniteMode.lastGameOverReason = GameState.infiniteMode.lastGameOverReason ?? null;
    GameState.infiniteMode.isGameOver = GameState.infiniteMode.isGameOver === true;

    return GameState.infiniteMode;
  },

  updateInfiniteModeProgress(daySuccess) {
    const infiniteState = this.ensureInfiniteModeState();

    if (!this.isInfiniteModeActive()) {
      infiniteState.consecutiveFailures = 0;
      infiniteState.isGameOver = false;
      infiniteState.lastGameOverReason = null;
      infiniteState.lastCheckedDay = GameState.day;
      return {
        isActive: false,
        consecutiveFailures: infiniteState.consecutiveFailures,
        lastCheckedDay: infiniteState.lastCheckedDay
      };
    }

    if (daySuccess) {
      infiniteState.consecutiveFailures = 0;
    } else {
      infiniteState.consecutiveFailures += 1;
    }

    infiniteState.lastCheckedDay = GameState.day;
    infiniteState.isGameOver = false;
    infiniteState.lastGameOverReason = null;

    return {
      isActive: true,
      consecutiveFailures: infiniteState.consecutiveFailures,
      lastCheckedDay: infiniteState.lastCheckedDay
    };
  },

  evaluateInfiniteModeGameOver(context = {}) {
    const infiniteState = this.ensureInfiniteModeState();
    const isActive = this.isInfiniteModeActive();
    const minimumOrderCost = this.getMinimumOrderCostForCurrentDay();
    const totalInventoryQuantity = this.getTotalInventoryQuantity();
    const hasNoInventory = totalInventoryQuantity <= 0;
    const hasOrderDeadlock =
      minimumOrderCost > 0 &&
      GameState.money < minimumOrderCost &&
      hasNoInventory;
    const reasons = [];

    if (isActive && GameState.mental <= 0) {
      reasons.push({
        code: "mental_zero",
        label: "멘탈 0",
        detailText: "멘탈이 0 이하가 되어 더 이상 영업을 이어갈 수 없습니다."
      });
    }

    if (isActive && GameState.satisfaction <= 0) {
      reasons.push({
        code: "satisfaction_zero",
        label: "만족도 0",
        detailText: "만족도가 0 이하가 되어 손님 신뢰를 잃었습니다."
      });
    }

    if (isActive && context.infiniteModeProgress?.consecutiveFailures >= 3) {
      reasons.push({
        code: "consecutive_failures",
        label: "연속 영업 실패 3회",
        detailText: `무한 모드에서 ${context.infiniteModeProgress.consecutiveFailures}회 연속 영업 실패가 누적되었습니다.`
      });
    }

    if (isActive && hasOrderDeadlock) {
      reasons.push({
        code: "order_deadlock",
        label: "발주 불가",
        detailText: `보유금 ₩${Math.max(0, Math.floor(GameState.money)).toLocaleString("ko-KR")}이 최저 발주 비용 ₩${minimumOrderCost.toLocaleString("ko-KR")}보다 낮고 재고도 없습니다.`
      });
    }

    const isGameOver = reasons.length > 0;

    if (isGameOver) {
      infiniteState.isGameOver = true;
      infiniteState.lastGameOverReason = reasons[0].code;
      infiniteState.lastGameOverDay = GameState.day;
    }

    return {
      isGameOver,
      day: GameState.day,
      reasons,
      primaryReason: reasons[0] ?? null,
      consecutiveFailures: context.infiniteModeProgress?.consecutiveFailures ?? infiniteState.consecutiveFailures,
      minimumOrderCost,
      totalInventoryQuantity,
      money: GameState.money,
      summaryText: isGameOver
        ? `무한 모드 종료: ${reasons[0]?.label ?? "운영 한계"} 조건이 발생했습니다.`
        : ""
    };
  },

  getMinimumOrderCostForCurrentDay() {
    const unlockedProducts = getUnlockedProducts(GameState.day);
    const costs = unlockedProducts
      .map((product) => Math.floor(Number(product.purchasePrice) || 0))
      .filter((cost) => cost > 0);

    if (costs.length === 0) {
      return 0;
    }

    return Math.min(...costs);
  },

  getTotalInventoryQuantity() {
    if (typeof InventorySystem.getInventorySnapshot === "function") {
      const snapshot = InventorySystem.getInventorySnapshot();
      const totalQuantity = Math.floor(Number(snapshot?.totalQuantity) || 0);

      if (totalQuantity >= 0) {
        return totalQuantity;
      }
    }

    if (Array.isArray(InventorySystem.lots)) {
      return InventorySystem.lots.reduce((total, lot) => {
        return total + Math.max(0, Math.floor(Number(lot.quantity) || 0));
      }, 0);
    }

    return 0;
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

  createStaffResultSummary() {
    const staffState = GameState.staff ?? {};
    const hired = staffState.hired ?? null;

    if (!hired) {
      return {
        hired: false,
        name: "",
        type: "",
        checkoutCount: 0,
        hourlyWage: 0,
        shiftHours: 0,
        wageCost: 0
      };
    }

    const hourlyWage = Math.max(0, Number(hired.hourlyWage) || 0);
    const shiftHours = Math.max(0, Number(hired.shiftHours) || 3);
    const wageCost = Math.max(
      0,
      Number(hired.expectedDailyWage) || hourlyWage * shiftHours
    );

    return {
      hired: true,
      id: hired.id ?? null,
      name: hired.name ?? "알바",
      type: hired.type ?? "",
      checkoutCount: Math.max(0, Number(staffState.todayCheckoutCount) || 0),
      hourlyWage,
      shiftHours,
      wageCost
    };
  },

  createResultMessage(resultData) {
    const resultText = resultData.success ? "영업 성공" : "영업 실패";
    const mvpText = resultData.mvpTestDataApplied
      ? " / 임시 MVP 데이터 적용"
      : "";
    const sanitationText = resultData.sanitationPenalty?.applies
      ? ` / 위생 페널티 ${resultData.sanitationPenalty.satisfactionPenalty}`
      : "";

    return (
      `Day ${resultData.day} 정산 완료 | ` +
      `결과: ${resultText} | ` +
      `${resultData.resultSummaryText} | ` +
      `매출 ₩${resultData.revenue.toLocaleString()} / ` +
      `목표 ₩${resultData.targetRevenue.toLocaleString()} | ` +
      `만족도 ${resultData.satisfaction}/${resultData.targetSatisfaction} | ` +
      `멘탈 ${resultData.mental} | ` +
      `병맛 점수 ${resultData.bmScore.toLocaleString()}${sanitationText}${mvpText}`
    );
  },

  getSanitationSettlementPenalty() {
    const source = GameState.sanitation && typeof GameState.sanitation === "object"
      ? GameState.sanitation
      : {};
    const value = this.clamp(
      Math.floor(Number(source.value ?? 100) || 0),
      0,
      100
    );
    const threshold = Math.floor(Number(source.warningThreshold ?? 50) || 50);
    const penalty = Math.floor(Number(source.settlementPenalty ?? -5) || -5);
    const applies = value <= threshold;
    const status = source.status ?? (
      value === 0
        ? "critical"
        : value <= threshold
          ? "warning"
          : value <= 79
            ? "normal"
            : "clean"
    );

    return {
      applies,
      satisfactionPenalty: applies ? penalty : 0,
      sanitation: {
        value,
        status,
        isCleaningNeeded: source.isCleaningNeeded === true || value < 100,
        isCleaning: source.isCleaning === true,
        warningThreshold: threshold
      }
    };
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

  createNextStepText(success, infiniteGameOver = {}) {
    if (infiniteGameOver.isGameOver) {
      return "확인하면 무한 모드 진행 데이터가 초기화되고 타이틀 화면으로 돌아갑니다.";
    }

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
      },
      {
        label: "매장 위생",
        success: data.sanitationPenalty?.applies !== true,
        statusText: data.sanitationPenalty?.applies ? "관리 필요" : "양호",
        valueText: `위생 ${data.sanitationPenalty?.sanitation?.value ?? 100} / 100`,
        detailText: data.sanitationPenalty?.applies
          ? `위생 관리 미흡으로 만족도 ${data.sanitationPenalty.satisfactionPenalty}가 반영되었습니다.`
          : "정산 위생 페널티가 없습니다."
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
