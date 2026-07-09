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
    targetRevenue: 25000,
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

  bm: {
    diamond: 0,
    adSkipTickets: 0,
    peakTimeCoupons: 0,
    coffeeTickets: 0,
    ownedContractProductIds: ["potato_chips", "water"],
    shopUnlockedContractProductIds: [],
    purchasedPremiumProductIds: [],
    lastContractUnlockDay: null,
    contractSkipUsedDay: null,
    peakCouponUsedDay: null,
    peakCouponActive: false,
    peakCouponMultiplier: 1,
    freeRechargeClaims: {},
    peakCouponDiscountDay: null,
    peakCouponDiscountUsedDay: null,
    purchasedDiamondProductIds: [],
    paidWallet: {
      diamond: 0,
      adSkipTickets: 0,
      peakTimeCoupons: 0,
      coffeeTickets: 0
    },
    warehouseLevel: 0,
    pendingWarehouseUpgrade: null,
    shelfUpgradeLevels: {},
    productUpgradeLevels: {},
    staffAbilityUpgrade: {
      totalCount: 0,
      lastUpgradeDay: null,
      abilities: {
        warehouse: 0,
        shelf: 0,
        cleaning: 0
      }
    }
  },

  dailyMissions: null,

  expansion: {
    unlockedZoneIds: ["zone_basic"],
    movementBounds: [],
    customerAccessibleZones: ["door", "shelf", "counter", "exit"],
    constructionZoneId: null,
    constructionStartDay: null,
    constructionCompleteDay: null
  },

  difficulty: {
    customerSpawnRate: 1,
    angryCustomerRate: 1,
    stockDecreaseRate: 1,
    eventRate: 1
  }
};
