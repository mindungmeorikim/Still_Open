/*
  DailyRewardSystem.js

  역할:
  - 7일 출석 보상 수령 상태 관리
  - KST 기준 하루 1회 보상 지급
  - 7일차 수령 후 다음 수령 가능일에 1일차부터 새 주기 시작

  저장 방식:
  - 출석 진행도와 BM성 보상 지갑은 localStorage에 별도 저장
  - 골드는 GameState.money에 즉시 반영
  - 다이아는 BMSystem이 사용하는 GameState.bm.diamond에 즉시 반영
  - 티켓류는 GameState.bmWallet에도 미러링하여 추후 상점/BM UI에서 재사용 가능
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import {
  DAILY_REWARD_CYCLE_DAYS,
  getDailyRewardByDay
} from "../data/DailyRewardData.js";

const ATTENDANCE_STORAGE_KEY = "today_normal_open_daily_reward_v1";
const BM_WALLET_STORAGE_KEY = "today_normal_open_bm_wallet_v1";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const DEFAULT_ATTENDANCE_STATE = Object.freeze({
  lastClaimedDateKey: null,
  cycleClaimCount: 0,
  totalClaimCount: 0,
  cycleNumber: 1
});

const DEFAULT_BM_WALLET = Object.freeze({
  diamonds: 0,
  coffeeTickets: 0,
  adSkipTickets: 0,
  peakTimeCoupons: 0
});

export const DailyRewardSystem = {
  isInitialized: false,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.syncGameStateWallet();
  },

  getTodayClaimInfo(date = new Date()) {
    const todayKey = this.getKstDateKey(date);
    const state = this.readAttendanceState();
    const alreadyClaimedToday = state.lastClaimedDateKey === todayKey;
    const baseCycleClaimCount = state.cycleClaimCount >= DAILY_REWARD_CYCLE_DAYS
      ? 0
      : this.toIntegerInRange(state.cycleClaimCount, 0, DAILY_REWARD_CYCLE_DAYS);
    const attendanceDay = alreadyClaimedToday
      ? Math.max(1, this.toIntegerInRange(state.cycleClaimCount, 1, DAILY_REWARD_CYCLE_DAYS))
      : baseCycleClaimCount + 1;
    const reward = getDailyRewardByDay(attendanceDay);

    return {
      canClaim: !alreadyClaimedToday,
      alreadyClaimedToday,
      todayKey,
      attendanceDay,
      reward,
      state
    };
  },

  claimToday(date = new Date()) {
    const claimInfo = this.getTodayClaimInfo(date);

    if (!claimInfo.canClaim) {
      return {
        success: false,
        reason: "already_claimed_today",
        message: "오늘 출석 보상은 이미 받았습니다.",
        ...claimInfo
      };
    }

    const rewardResult = this.applyReward(claimInfo.reward);
    const previousState = claimInfo.state;
    const isNewCycle = previousState.cycleClaimCount >= DAILY_REWARD_CYCLE_DAYS;
    const nextCycleClaimCount = claimInfo.attendanceDay;
    const nextState = {
      ...DEFAULT_ATTENDANCE_STATE,
      ...previousState,
      lastClaimedDateKey: claimInfo.todayKey,
      cycleClaimCount: nextCycleClaimCount,
      totalClaimCount: Math.max(0, Math.floor(Number(previousState.totalClaimCount) || 0)) + 1,
      cycleNumber: isNewCycle
        ? Math.max(1, Math.floor(Number(previousState.cycleNumber) || 1)) + 1
        : Math.max(1, Math.floor(Number(previousState.cycleNumber) || 1))
    };

    this.writeAttendanceState(nextState);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return {
      success: true,
      message: `${claimInfo.reward.displayName}이 지급되었습니다.`,
      attendanceDay: claimInfo.attendanceDay,
      reward: claimInfo.reward,
      rewardResult,
      state: nextState
    };
  },

  applyReward(reward = {}) {
    const amount = Math.max(0, Math.floor(Number(reward.amount) || 0));

    if (amount <= 0) {
      return {
        success: false,
        reason: "invalid_reward_amount"
      };
    }

    if (reward.type === "gold") {
      GameState.money = Math.max(0, Math.floor(Number(GameState.money) || 0)) + amount;
      return {
        success: true,
        type: reward.type,
        amount,
        money: GameState.money
      };
    }

    const wallet = this.readWallet();

    if (reward.type === "diamond") {
      const bm = this.ensureGameStateBM();
      bm.diamond += amount;
      wallet.diamonds = bm.diamond;
    } else if (reward.type === "coffeeTicket") {
      wallet.coffeeTickets += amount;
      const bm = this.ensureGameStateBM();
      bm.coffeeTickets = Math.max(0, Math.floor(Number(bm.coffeeTickets) || 0)) + amount;
    } else if (reward.type === "adSkipTicket") {
      wallet.adSkipTickets += amount;
      const bm = this.ensureGameStateBM();
      bm.adSkipTickets = Math.max(0, Math.floor(Number(bm.adSkipTickets) || 0)) + amount;
    } else if (reward.type === "peakTimeCoupon") {
      wallet.peakTimeCoupons += amount;
      const bm = this.ensureGameStateBM();
      bm.peakTimeCoupons = Math.max(0, Math.floor(Number(bm.peakTimeCoupons) || 0)) + amount;
    } else {
      return {
        success: false,
        reason: "unknown_reward_type",
        type: reward.type
      };
    }

    this.writeWallet(wallet);
    this.syncGameStateWallet(wallet);

    return {
      success: true,
      type: reward.type,
      amount,
      wallet,
      bm: GameState.bm ?? null
    };
  },

  getKstDateKey(date = new Date()) {
    const dateValue = date instanceof Date ? date : new Date(date);
    const kstDate = new Date(dateValue.getTime() + KST_OFFSET_MS);

    return kstDate.toISOString().slice(0, 10);
  },

  readAttendanceState() {
    const state = this.readJson(ATTENDANCE_STORAGE_KEY, DEFAULT_ATTENDANCE_STATE);

    return {
      ...DEFAULT_ATTENDANCE_STATE,
      ...state,
      cycleClaimCount: this.toIntegerInRange(
        state.cycleClaimCount,
        0,
        DAILY_REWARD_CYCLE_DAYS
      ),
      totalClaimCount: Math.max(0, Math.floor(Number(state.totalClaimCount) || 0)),
      cycleNumber: Math.max(1, Math.floor(Number(state.cycleNumber) || 1))
    };
  },

  writeAttendanceState(state) {
    this.writeJson(ATTENDANCE_STORAGE_KEY, state);
  },

  readWallet() {
    const wallet = this.readJson(BM_WALLET_STORAGE_KEY, DEFAULT_BM_WALLET);

    return {
      diamonds: Math.max(0, Math.floor(Number(wallet.diamonds) || 0)),
      coffeeTickets: Math.max(0, Math.floor(Number(wallet.coffeeTickets) || 0)),
      adSkipTickets: Math.max(0, Math.floor(Number(wallet.adSkipTickets) || 0)),
      peakTimeCoupons: Math.max(0, Math.floor(Number(wallet.peakTimeCoupons) || 0))
    };
  },

  writeWallet(wallet) {
    this.writeJson(BM_WALLET_STORAGE_KEY, wallet);
  },

  syncGameStateWallet(wallet = this.readWallet()) {
    const normalizedWallet = {
      ...DEFAULT_BM_WALLET,
      ...wallet
    };

    if (GameState.bm && typeof GameState.bm === "object") {
      normalizedWallet.diamonds = Math.max(0, Math.floor(Number(GameState.bm.diamond) || 0));
      normalizedWallet.adSkipTickets = Math.max(normalizedWallet.adSkipTickets, Math.floor(Number(GameState.bm.adSkipTickets) || 0));
      normalizedWallet.peakTimeCoupons = Math.max(normalizedWallet.peakTimeCoupons, Math.floor(Number(GameState.bm.peakTimeCoupons) || 0));
      normalizedWallet.coffeeTickets = Math.max(normalizedWallet.coffeeTickets, Math.floor(Number(GameState.bm.coffeeTickets) || 0));
      GameState.bm.adSkipTickets = normalizedWallet.adSkipTickets;
      GameState.bm.peakTimeCoupons = normalizedWallet.peakTimeCoupons;
      GameState.bm.coffeeTickets = normalizedWallet.coffeeTickets;
    }

    GameState.bmWallet = normalizedWallet;

    return GameState.bmWallet;
  },

  ensureGameStateBM() {
    if (!GameState.bm || typeof GameState.bm !== "object") {
      GameState.bm = {};
    }

    GameState.bm.diamond = Math.max(
      0,
      Math.floor(Number(GameState.bm.diamond) || 0)
    );

    return GameState.bm;
  },

  readJson(key, fallback) {
    if (!this.canUseLocalStorage()) {
      return { ...fallback };
    }

    try {
      const raw = window.localStorage.getItem(key);

      if (!raw) {
        return { ...fallback };
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") {
        return { ...fallback };
      }

      return parsed;
    } catch (error) {
      console.warn(`[DailyRewardSystem] ${key} 파싱 실패`, error);
      return { ...fallback };
    }
  },

  writeJson(key, payload) {
    if (!this.canUseLocalStorage()) {
      return false;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn(`[DailyRewardSystem] ${key} 저장 실패`, error);
      return false;
    }
  },

  canUseLocalStorage() {
    return typeof window !== "undefined" && !!window.localStorage;
  },

  toIntegerInRange(value, min, max) {
    const numberValue = Math.floor(Number(value));

    if (!Number.isFinite(numberValue)) {
      return min;
    }

    return Math.min(max, Math.max(min, numberValue));
  }
};
