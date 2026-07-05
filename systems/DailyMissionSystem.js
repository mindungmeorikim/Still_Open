/*
  DailyMissionSystem.js
  - 일일 미션 7종 중 매일 3개 선정
  - 1개/2개/3개 완료 보상 지급
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { DAILY_MISSIONS, DAILY_MISSION_REWARDS } from "../data/DailyMissionData.js";
import { getDayScenario } from "../data/DayScenarioData.js";

export const DAILY_MISSION_EVENTS = Object.freeze({
  STATE_CHANGED: "DAILY_MISSION_STATE_CHANGED",
  REWARD_CLAIMED: "DAILY_MISSION_REWARD_CLAIMED",
  REWARD_FAILED: "DAILY_MISSION_REWARD_FAILED"
});

const END_PHASES = new Set([
  GAME_PHASE.DAY_END,
  GAME_PHASE.RESULT,
  GAME_PHASE.UPGRADE,
  GAME_PHASE.NEXT_DAY,
  GAME_PHASE.ENDLESS
]);

const createDayMissionIds = (day) => {
  const ids = DAILY_MISSIONS.map((mission) => mission.id);
  let seed = Math.max(1, Math.floor(Number(day) || 1)) * 9301 + 49297;
  const picked = [];
  const pool = [...ids];

  while (picked.length < 3 && pool.length > 0) {
    seed = (seed * 233280 + 12345) % 2147483647;
    const index = seed % pool.length;
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
};

export const DailyMissionSystem = {
  isInitialized: false,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.ensureState();

    EventBus.on(EVENTS.DAY_STARTED, (data = {}) => this.handleDayStarted(data));
    EventBus.on(EVENTS.CHECKOUT_COMPLETED, () => this.handleProgressChanged("checkout"));
    EventBus.on(EVENTS.RESTOCK_COMPLETED, () => this.handleProgressChanged("restock"));
    EventBus.on(EVENTS.CLEANING_COMPLETED, () => this.handleProgressChanged("cleaning"));
    EventBus.on(EVENTS.REVENUE_CHANGED, (data = {}) => this.handleRevenueChanged(data));
    EventBus.on(EVENTS.CUSTOMER_ANGRY, () => this.handleProgressChanged("customer_angry"));
    EventBus.on(EVENTS.STORE_CLOSED, () => this.handleProgressChanged("store_closed"));
    EventBus.on(EVENTS.RESULT_CALCULATED, () => this.handleProgressChanged("result_calculated"));
  },

  ensureState(day = GameState.day) {
    if (!GameState.dailyMissions || typeof GameState.dailyMissions !== "object") {
      GameState.dailyMissions = {};
    }

    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const state = GameState.dailyMissions;

    if (state.day !== safeDay || !Array.isArray(state.activeMissionIds)) {
      GameState.dailyMissions = {
        day: safeDay,
        activeMissionIds: createDayMissionIds(safeDay),
        claimedRewardCounts: [],
        recommendedProductSaleCount: 0,
        nuisanceBadEndCount: 0,
        lastUpdatedReason: "day_initialized"
      };
    } else {
      state.claimedRewardCounts = Array.isArray(state.claimedRewardCounts)
        ? [...new Set(state.claimedRewardCounts.map((count) => Math.floor(Number(count) || 0)).filter((count) => count > 0))]
        : [];
      state.recommendedProductSaleCount = Math.max(0, Math.floor(Number(state.recommendedProductSaleCount) || 0));
      state.nuisanceBadEndCount = Math.max(0, Math.floor(Number(state.nuisanceBadEndCount) || 0));
    }

    return GameState.dailyMissions;
  },

  handleDayStarted(data = {}) {
    this.ensureState(data.day ?? GameState.day);
    this.emitStateChanged("day_started");
  },

  handleProgressChanged(reason = "progress_changed") {
    this.ensureState();
    this.emitStateChanged(reason);
  },

  handleRevenueChanged(data = {}) {
    const state = this.ensureState(data.day ?? GameState.day);
    const scenario = getDayScenario(GameState.day);
    const recommendedIds = new Set(scenario.recommendedProductIds ?? []);
    const productId = data.productId ?? data.wantedProductId;

    if (recommendedIds.has(productId)) {
      state.recommendedProductSaleCount += Math.max(1, Math.floor(Number(data.quantity) || 1));
    }

    this.emitStateChanged("recommended_sale_changed");
  },

  getState() {
    const state = this.ensureState();
    const missions = state.activeMissionIds
      .map((missionId) => DAILY_MISSIONS.find((mission) => mission.id === missionId))
      .filter(Boolean)
      .map((mission) => this.createMissionPayload(mission));
    const completedCount = missions.filter((mission) => mission.isComplete).length;
    const rewards = DAILY_MISSION_REWARDS.map((reward) => {
      const claimed = state.claimedRewardCounts.includes(reward.count);
      return {
        ...reward,
        canClaim: completedCount >= reward.count && !claimed,
        isClaimed: claimed
      };
    });

    return {
      day: state.day,
      activeMissionIds: [...state.activeMissionIds],
      missions,
      completedCount,
      totalCount: missions.length,
      rewards,
      recommendedProductSaleCount: state.recommendedProductSaleCount,
      claimedRewardCounts: [...state.claimedRewardCounts]
    };
  },

  createMissionPayload(mission) {
    const progress = this.getMissionProgress(mission);
    const target = Math.max(1, Math.floor(Number(mission.target) || 1));
    return {
      ...mission,
      progress,
      target,
      isComplete: progress >= target,
      progressText: `${Math.min(progress, target).toLocaleString("ko-KR")} / ${target.toLocaleString("ko-KR")}`
    };
  },

  getMissionProgress(mission) {
    const stats = GameState.todayStats ?? {};
    const state = this.ensureState();

    switch (mission.progressKey) {
      case "checkoutSuccessCount":
        return Math.max(0, Math.floor(Number(stats.checkoutSuccessCount) || 0));
      case "restockCount":
        return Math.max(0, Math.floor(Number(stats.restockCount) || 0));
      case "cleaningCount":
        return Math.max(0, Math.floor(Number(stats.cleaningCount) || 0));
      case "recommendedProductSaleCount":
        return Math.max(0, Math.floor(Number(state.recommendedProductSaleCount) || 0));
      case "mentalAtClose":
        return END_PHASES.has(GameState.phase) ? Math.max(0, Math.floor(Number(GameState.mental) || 0)) : 0;
      case "revenuePercent": {
        const target = Math.max(1, Math.floor(Number(GameState.dailyGoal?.targetRevenue) || 1));
        const revenue = Math.max(0, Math.floor(Number(stats.revenue) || 0));
        return Math.floor((revenue / target) * 100);
      }
      case "nuisanceSafe":
        return END_PHASES.has(GameState.phase) && Math.max(0, Math.floor(Number(stats.angryCustomers) || 0)) <= 0 ? 1 : 0;
      default:
        return 0;
    }
  },

  claimReward(count) {
    const state = this.ensureState();
    const rewardCount = Math.max(1, Math.floor(Number(count) || 0));
    const reward = DAILY_MISSION_REWARDS.find((item) => item.count === rewardCount);
    const current = this.getState();

    if (!reward) {
      return this.emitRewardFailed("invalid_reward", "존재하지 않는 일일 미션 보상입니다.");
    }

    if (state.claimedRewardCounts.includes(rewardCount)) {
      return this.emitRewardFailed("already_claimed", "이미 받은 일일 미션 보상입니다.");
    }

    if (current.completedCount < rewardCount) {
      return this.emitRewardFailed("not_enough_completed", `${rewardCount}개 미션 완료가 필요합니다.`);
    }

    if (reward.type === "gold") {
      GameState.money = Math.max(0, Math.floor(Number(GameState.money) || 0)) + reward.amount;
    } else if (reward.type === "diamond") {
      if (!GameState.bm || typeof GameState.bm !== "object") GameState.bm = {};
      GameState.bm.diamond = Math.max(0, Math.floor(Number(GameState.bm.diamond) || 0)) + reward.amount;
    }

    state.claimedRewardCounts.push(rewardCount);
    state.claimedRewardCounts = [...new Set(state.claimedRewardCounts)].sort((a, b) => a - b);

    const result = {
      success: true,
      day: GameState.day,
      reward,
      message: `일일 미션 ${rewardCount}개 완료 보상 ${reward.label}을 받았습니다.`,
      dailyMissionState: this.getState()
    };

    EventBus.emit(DAILY_MISSION_EVENTS.REWARD_CLAIMED, result);
    this.emitStateChanged("reward_claimed");
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return result;
  },

  emitRewardFailed(reason, message) {
    const result = {
      success: false,
      reason,
      message,
      dailyMissionState: this.getState()
    };
    EventBus.emit(DAILY_MISSION_EVENTS.REWARD_FAILED, result);
    return result;
  },

  emitStateChanged(reason) {
    EventBus.emit(DAILY_MISSION_EVENTS.STATE_CHANGED, {
      reason,
      day: GameState.day,
      dailyMissionState: this.getState()
    });
  }
};
