/*
  GameState.js
  공통 파일 - 임의 수정 금지
  역할: 게임 전체 상태 저장
*/

import { GAME_PHASE, GAME_CONFIG } from "./Constants.js";

export const GameState = {
  phase: GAME_PHASE.READY,

  day: 1,
  isEndlessMode: false,

  money: GAME_CONFIG.START_MONEY,
  mental: GAME_CONFIG.START_MENTAL,
  satisfaction: GAME_CONFIG.START_SATISFACTION,

  dailyGoal: {
    targetRevenue: 30000,
    targetSatisfaction: 70
  },

  todayStats: {
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
  },

  upgrades: [],

  difficulty: {
    customerSpawnRate: 1,
    angryCustomerRate: 1,
    stockDecreaseRate: 1,
    eventRate: 1
  }
};