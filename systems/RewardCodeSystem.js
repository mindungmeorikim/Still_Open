/*
  RewardCodeSystem.js

  커뮤니티 이벤트/쿠폰 코드 보상 지급 MVP입니다.
  현재는 RewardCodeData.js의 mock 데이터로 검증하지만, RewardService.redeem()
  내부를 fetch('/api/reward-code/redeem') 호출로 교체하면 서버 검증 구조로 이전할 수 있습니다.
*/

import { EventBus } from "../core/EventBus.js";
import { EconomySystem } from "./EconomySystem.js";
import {
  findMockRewardCode,
  normalizeRewardCode
} from "../data/RewardCodeData.js";

export const REWARD_CODE_EVENTS = Object.freeze({
  PANEL_OPENED: "REWARD_CODE_PANEL_OPENED",
  SUBMIT_ATTEMPTED: "REWARD_CODE_SUBMIT_ATTEMPTED",
  REDEEM_REQUESTED: "REWARD_CODE_REDEEM_REQUESTED",
  REDEEM_SUCCEEDED: "REWARD_CODE_REDEEM_SUCCEEDED",
  REDEEM_FAILED: "REWARD_CODE_REDEEM_FAILED"
});

const REWARD_CODE_CLAIMS_STORAGE_KEY = "today_normal_open_reward_code_claims_v1";
const DEFAULT_REWARD_CODE_CLAIMS = Object.freeze({
  usedCodes: [],
  claimedCampaigns: {}
});

const unique = (values = []) => [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

export const RewardService = {
  redeem({ code, now = new Date() } = {}) {
    const normalizedCode = normalizeRewardCode(code);
    const rewardCode = findMockRewardCode(normalizedCode);

    if (!normalizedCode || !rewardCode) {
      return {
        success: false,
        reason: "invalid_code",
        message: "유효하지 않은 코드입니다."
      };
    }

    if (this.isExpired(rewardCode, now)) {
      return {
        success: false,
        reason: "expired_code",
        message: "만료된 코드입니다.",
        code: normalizedCode
      };
    }

    return {
      success: true,
      code: normalizedCode,
      rewardCode: { ...rewardCode, code: normalizedCode }
    };
  },

  isExpired(rewardCode = {}, now = new Date()) {
    if (!rewardCode.expiresAt) return false;

    const expiresAt = new Date(rewardCode.expiresAt);
    const nowDate = now instanceof Date ? now : new Date(now);

    if (Number.isNaN(expiresAt.getTime()) || Number.isNaN(nowDate.getTime())) {
      return true;
    }

    return expiresAt.getTime() < nowDate.getTime();
  }
};

export const RewardCodeSystem = {
  isInitialized: false,
  memoryClaims: {
    usedCodes: [],
    claimedCampaigns: {}
  },

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    EventBus.on(REWARD_CODE_EVENTS.REDEEM_REQUESTED, (data = {}) => {
      this.redeemCode(data.code, data);
    });
  },

  redeemCode(inputCode, options = {}) {
    const code = normalizeRewardCode(inputCode);
    const serviceResult = RewardService.redeem({
      code,
      now: options.now ?? new Date()
    });

    if (!serviceResult.success) {
      return this.emitFailed(serviceResult.reason, serviceResult.message, {
        code
      });
    }

    const rewardCode = serviceResult.rewardCode;
    const claims = this.readClaims();

    if (this.isCodeUsed(claims, code) || this.isCampaignLimitReached(claims, rewardCode)) {
      return this.emitFailed("already_used", "이미 사용한 코드입니다.", {
        code,
        campaignId: rewardCode.campaignId ?? null
      });
    }

    const currencyResult = this.grantReward(rewardCode);

    if (!currencyResult.success) {
      return this.emitFailed(currencyResult.reason ?? "grant_failed", currencyResult.message ?? "보상 지급에 실패했습니다.", {
        code,
        rewardCode
      });
    }

    const nextClaims = this.markClaimed(claims, rewardCode);
    this.writeClaims(nextClaims);

    const result = {
      success: true,
      reason: "reward_code_redeemed",
      code,
      campaignId: rewardCode.campaignId ?? null,
      reward: {
        type: rewardCode.rewardType,
        amount: rewardCode.amount
      },
      currencyResult,
      claims: nextClaims,
      message: this.createSuccessMessage(rewardCode)
    };

    EventBus.emit(REWARD_CODE_EVENTS.REDEEM_SUCCEEDED, result);

    return result;
  },

  grantReward(rewardCode = {}) {
    const amount = Math.max(0, Math.floor(Number(rewardCode.amount) || 0));
    const meta = {
      source: "reward_code",
      code: normalizeRewardCode(rewardCode.code),
      campaignId: rewardCode.campaignId ?? null,
      maxUsePerUser: rewardCode.maxUsePerUser ?? 1
    };

    if (rewardCode.rewardType === "diamond") {
      return EconomySystem.addDiamond(amount, "reward_code", meta);
    }

    if (rewardCode.rewardType === "gold") {
      return EconomySystem.addGold(amount, "reward_code", meta);
    }

    return {
      success: false,
      reason: "unsupported_reward_type",
      message: "지원하지 않는 보상 타입입니다.",
      rewardType: rewardCode.rewardType
    };
  },

  createSuccessMessage(rewardCode = {}) {
    const amount = Math.max(0, Math.floor(Number(rewardCode.amount) || 0));

    if (rewardCode.rewardType === "diamond") {
      return `다이아 ${amount.toLocaleString("ko-KR")}개를 받았습니다!`;
    }

    if (rewardCode.rewardType === "gold") {
      return `골드 ${amount.toLocaleString("ko-KR")}개를 받았습니다!`;
    }

    return "보상을 받았습니다!";
  },

  emitFailed(reason, message, details = {}) {
    const result = {
      success: false,
      reason,
      message,
      ...details
    };

    EventBus.emit(REWARD_CODE_EVENTS.REDEEM_FAILED, result);

    return result;
  },

  isCodeUsed(claims = {}, code) {
    return unique(claims.usedCodes).includes(normalizeRewardCode(code));
  },

  isCampaignLimitReached(claims = {}, rewardCode = {}) {
    const campaignId = String(rewardCode.campaignId ?? "").trim();
    if (!campaignId) return false;

    const maxUsePerUser = Math.max(1, Math.floor(Number(rewardCode.maxUsePerUser) || 1));
    const claimedCount = Math.max(0, Math.floor(Number(claims.claimedCampaigns?.[campaignId]) || 0));

    return claimedCount >= maxUsePerUser;
  },

  markClaimed(claims = {}, rewardCode = {}) {
    const code = normalizeRewardCode(rewardCode.code);
    const campaignId = String(rewardCode.campaignId ?? "").trim();
    const claimedCampaigns = {
      ...(claims.claimedCampaigns && typeof claims.claimedCampaigns === "object" ? claims.claimedCampaigns : {})
    };

    if (campaignId) {
      claimedCampaigns[campaignId] = Math.max(0, Math.floor(Number(claimedCampaigns[campaignId]) || 0)) + 1;
    }

    return {
      usedCodes: unique([...(claims.usedCodes ?? []), code]),
      claimedCampaigns
    };
  },

  getState() {
    return this.readClaims();
  },

  readClaims() {
    if (!this.canUseLocalStorage()) {
      return this.normalizeClaims(this.memoryClaims);
    }

    const claims = this.readJson(REWARD_CODE_CLAIMS_STORAGE_KEY, DEFAULT_REWARD_CODE_CLAIMS);
    return this.normalizeClaims(claims);
  },

  writeClaims(claims = {}) {
    const normalizedClaims = this.normalizeClaims(claims);

    if (!this.canUseLocalStorage()) {
      this.memoryClaims = normalizedClaims;
      return true;
    }

    this.memoryClaims = normalizedClaims;

    return this.writeJson(REWARD_CODE_CLAIMS_STORAGE_KEY, normalizedClaims);
  },

  normalizeClaims(claims = {}) {
    const claimedCampaigns = claims.claimedCampaigns && typeof claims.claimedCampaigns === "object"
      ? claims.claimedCampaigns
      : {};

    return {
      usedCodes: unique(claims.usedCodes),
      claimedCampaigns: Object.fromEntries(
        Object.entries(claimedCampaigns).map(([campaignId, count]) => [
          campaignId,
          Math.max(0, Math.floor(Number(count) || 0))
        ])
      )
    };
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
      console.warn(`[RewardCodeSystem] ${key} parse failed`, error);
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
      console.warn(`[RewardCodeSystem] ${key} save failed`, error);
      return false;
    }
  },

  canUseLocalStorage() {
    return typeof window !== "undefined" && !!window.localStorage;
  }
};
