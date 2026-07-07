/*
  RewardInboxSystem.js

  Local reward inbox MVP.
  The inbox must not ship with default gifts. Future reward grants should be
  added explicitly through backend/operator data or addInboxReward().
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import { getProductById } from "../data/ProductData.js";
import { cloneRewardInboxMockRewards } from "../data/RewardInboxData.js";
import { EconomySystem } from "./EconomySystem.js";
import { BMSystem } from "./BMSystem.js";

export const REWARD_INBOX_EVENTS = Object.freeze({
  UPDATED: "REWARD_INBOX_UPDATED",
  CLAIMED: "REWARD_INBOX_CLAIMED",
  CLAIM_FAILED: "REWARD_INBOX_CLAIM_FAILED"
});

const SUPPORTED_REWARD_TYPES = new Set([
  "gold",
  "diamond",
  "skip_ticket",
  "contract_ticket",
  "item"
]);

const LEGACY_BUNDLED_REWARD_IDS = new Set([
  "launch_reward_dia_100",
  "community_event_dia_300",
  "maintenance_reward_gold_5000_dia_50"
]);

const unique = (values = []) => [...new Set(
  values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
)];

export const RewardInboxService = {
  fetchRewards() {
    return cloneRewardInboxMockRewards();
  }
};

export const RewardInboxSystem = {
  isInitialized: false,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.writeState(this.mergeDefaultRewards(this.getState()), {
      emit: false
    });
  },

  getAllInboxRewards() {
    return this.getState().rewards
      .map((reward) => ({
        ...reward,
        rewards: reward.rewards.map((entry) => ({ ...entry })),
        isExpired: this.isRewardExpired(reward)
      }))
      .sort((a, b) => {
        if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;
        return this.getTimeValue(b.createdAt) - this.getTimeValue(a.createdAt);
      });
  },

  getInboxRewards() {
    return this.getAllInboxRewards().filter((reward) => reward.claimed !== true);
  },

  getClaimableRewardCount() {
    return this.getInboxRewards().filter((reward) => {
      return reward.claimed !== true && reward.isExpired !== true;
    }).length;
  },

  addInboxReward(reward) {
    const normalizedReward = this.normalizeReward(reward);

    if (!normalizedReward) {
      return this.emitClaimFailed("invalid_reward", "유효하지 않은 보상입니다.", {
        rewardId: reward?.id ?? null
      });
    }

    const nextState = this.mergeRewards(this.getState(), [normalizedReward]);
    this.writeState(nextState);

    return {
      success: true,
      reason: "reward_added",
      reward: normalizedReward,
      inbox: this.getState()
    };
  },

  claimReward(rewardId) {
    const state = this.getState();
    const targetId = String(rewardId ?? "").trim();
    const rewardIndex = state.rewards.findIndex((reward) => reward.id === targetId);

    if (rewardIndex < 0) {
      return this.emitClaimFailed("reward_not_found", "존재하지 않는 보상입니다.", {
        rewardId: targetId
      });
    }

    const reward = state.rewards[rewardIndex];

    if (reward.claimed === true) {
      return this.emitClaimFailed("already_claimed", "이미 수령한 보상입니다.", {
        rewardId: targetId
      });
    }

    if (this.isRewardExpired(reward)) {
      return this.emitClaimFailed("reward_expired", "만료된 보상입니다.", {
        rewardId: targetId
      });
    }

    const validation = this.validateRewardEntries(reward);

    if (!validation.success) {
      return this.emitClaimFailed(validation.reason, validation.message, {
        rewardId: targetId,
        reward
      });
    }

    const grantResults = [];

    for (const entry of reward.rewards) {
      const grantResult = this.grantRewardEntry(entry, reward);

      if (!grantResult.success) {
        return this.emitClaimFailed(grantResult.reason ?? "grant_failed", grantResult.message ?? "보상 지급에 실패했습니다.", {
          rewardId: targetId,
          reward,
          grantResults
        });
      }

      grantResults.push(grantResult);
    }

    const claimedReward = {
      ...reward,
      claimed: true,
      claimedAt: new Date().toISOString()
    };
    const currentState = this.getState();
    const currentRewardIndex = currentState.rewards.findIndex((item) => item.id === targetId);
    const nextRewards = [...currentState.rewards];
    nextRewards[currentRewardIndex >= 0 ? currentRewardIndex : rewardIndex] = claimedReward;
    const nextState = this.normalizeState({
      ...currentState,
      rewards: nextRewards
    });

    this.writeState(nextState, { emit: false });

    const result = {
      success: true,
      reason: "reward_inbox_claimed",
      rewardId: targetId,
      reward: claimedReward,
      grantResults,
      message: `${claimedReward.title} 보상을 수령했습니다.`,
      inbox: this.getState()
    };

    EventBus.emit(REWARD_INBOX_EVENTS.CLAIMED, result);
    this.emitUpdated("reward_claimed", result);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return result;
  },

  claimAllRewards() {
    const claimableRewards = this.getInboxRewards().filter((reward) => {
      return reward.claimed !== true && reward.isExpired !== true;
    });
    const results = claimableRewards.map((reward) => this.claimReward(reward.id));
    const claimedCount = results.filter((result) => result.success).length;

    return {
      success: claimedCount > 0,
      reason: claimedCount > 0 ? "reward_inbox_claim_all" : "no_claimable_rewards",
      claimedCount,
      results,
      inbox: this.getState(),
      message: claimedCount > 0
        ? `${claimedCount}개의 보상을 수령했습니다.`
        : "수령 가능한 보상이 없습니다."
    };
  },

  isRewardClaimed(rewardId) {
    const targetId = String(rewardId ?? "").trim();
    return this.getState().rewards.some((reward) => reward.id === targetId && reward.claimed === true);
  },

  getState() {
    const currentState = GameState.rewardInbox && typeof GameState.rewardInbox === "object"
      ? GameState.rewardInbox
      : this.createDefaultState();

    GameState.rewardInbox = this.normalizeState(currentState);

    return GameState.rewardInbox;
  },

  writeState(state = {}, options = {}) {
    GameState.rewardInbox = this.normalizeState(state);

    if (options.emit !== false) {
      this.emitUpdated(options.reason ?? "reward_inbox_updated");
    }

    return GameState.rewardInbox;
  },

  createDefaultState() {
    return {
      rewards: [],
      items: {}
    };
  },

  mergeRewards(state = this.createDefaultState(), rewards = []) {
    const baseState = this.normalizeState(state);
    const rewardMap = new Map(baseState.rewards.map((reward) => [reward.id, reward]));

    rewards.forEach((reward) => {
      const normalizedReward = this.normalizeReward(reward);
      if (!normalizedReward) return;

      const existingReward = rewardMap.get(normalizedReward.id);
      rewardMap.set(normalizedReward.id, {
        ...normalizedReward,
        claimed: existingReward?.claimed === true,
        claimedAt: existingReward?.claimedAt ?? normalizedReward.claimedAt
      });
    });

    return this.normalizeState({
      ...baseState,
      rewards: [...rewardMap.values()]
    });
  },

  mergeDefaultRewards(state = this.createDefaultState()) {
    return this.mergeRewards(state, RewardInboxService.fetchRewards());
  },

  normalizeState(state = {}) {
    const source = state && typeof state === "object" ? state : {};
    const rewards = Array.isArray(source.rewards)
      ? source.rewards
        .map((reward) => this.normalizeReward(reward))
        .filter((reward) => reward && !LEGACY_BUNDLED_REWARD_IDS.has(reward.id))
      : [];
    const items = source.items && typeof source.items === "object"
      ? Object.fromEntries(
        Object.entries(source.items)
          .map(([itemId, amount]) => [
            String(itemId ?? "").trim(),
            this.toNonNegativeInteger(amount)
          ])
          .filter(([itemId, amount]) => itemId && amount > 0)
      )
      : {};

    return {
      rewards,
      items
    };
  },

  normalizeReward(reward = {}) {
    if (!reward || typeof reward !== "object") return null;

    const id = String(reward.id ?? "").trim();
    const rewards = Array.isArray(reward.rewards)
      ? reward.rewards.map((entry) => this.normalizeRewardEntry(entry)).filter(Boolean)
      : [];

    if (!id || rewards.length === 0) return null;

    return {
      id,
      title: String(reward.title ?? "보상").trim() || "보상",
      message: String(reward.message ?? "").trim(),
      rewards,
      source: String(reward.source ?? "local").trim() || "local",
      createdAt: this.normalizeDateString(reward.createdAt) ?? new Date().toISOString(),
      expiresAt: this.normalizeDateString(reward.expiresAt),
      claimed: reward.claimed === true,
      claimedAt: reward.claimed === true ? this.normalizeDateString(reward.claimedAt) : null
    };
  },

  normalizeRewardEntry(entry = {}) {
    if (!entry || typeof entry !== "object") return null;

    const type = String(entry.type ?? "").trim().toLowerCase();
    const amount = this.toNonNegativeInteger(entry.amount ?? 1);

    if (!SUPPORTED_REWARD_TYPES.has(type) || amount <= 0) return null;

    return {
      ...entry,
      type,
      amount,
      itemId: entry.itemId ? String(entry.itemId).trim() : null,
      productId: entry.productId ? String(entry.productId).trim() : null,
      productIds: Array.isArray(entry.productIds) ? unique(entry.productIds) : []
    };
  },

  validateRewardEntries(reward = {}) {
    if (!Array.isArray(reward.rewards) || reward.rewards.length === 0) {
      return {
        success: false,
        reason: "empty_reward",
        message: "지급할 보상이 없습니다."
      };
    }

    for (const entry of reward.rewards) {
      const validation = this.validateRewardEntry(entry);
      if (!validation.success) return validation;
    }

    return {
      success: true
    };
  },

  validateRewardEntry(entry = {}) {
    if (!SUPPORTED_REWARD_TYPES.has(entry.type)) {
      return {
        success: false,
        reason: "unsupported_reward_type",
        message: "지원하지 않는 보상 타입입니다."
      };
    }

    if (this.toNonNegativeInteger(entry.amount) <= 0) {
      return {
        success: false,
        reason: "invalid_reward_amount",
        message: "보상 수량이 올바르지 않습니다."
      };
    }

    if (entry.type === "contract_ticket") {
      const productIds = this.getRewardProductIds(entry);
      const hasInvalidProduct = productIds.some((productId) => !getProductById(productId));

      if (productIds.length === 0 || hasInvalidProduct) {
        return {
          success: false,
          reason: "invalid_contract_ticket",
          message: "판매권 보상 상품 정보가 올바르지 않습니다."
        };
      }
    }

    if (entry.type === "item" && !this.resolveItemRewardTarget(entry)) {
      return {
        success: false,
        reason: "unsupported_item_reward",
        message: "지원하지 않는 아이템 보상입니다."
      };
    }

    return {
      success: true
    };
  },

  grantRewardEntry(entry = {}, reward = {}) {
    const amount = this.toNonNegativeInteger(entry.amount);
    const meta = {
      source: "reward_inbox",
      rewardId: reward.id,
      rewardSource: reward.source
    };

    if (entry.type === "gold") {
      return EconomySystem.addGold(amount, "reward_inbox_claim", meta);
    }

    if (entry.type === "diamond") {
      return EconomySystem.addDiamond(amount, "reward_inbox_claim", meta);
    }

    if (entry.type === "skip_ticket") {
      const bm = BMSystem.ensureBMState();
      bm.adSkipTickets = this.toNonNegativeInteger(bm.adSkipTickets) + amount;
      this.syncBMWalletTickets(bm);
      BMSystem.emitStateChanged("reward_inbox_skip_ticket_granted", { rewardId: reward.id, amount });

      return {
        success: true,
        type: entry.type,
        amount,
        rewardId: reward.id,
        balance: bm.adSkipTickets
      };
    }

    if (entry.type === "contract_ticket") {
      const bm = BMSystem.ensureBMState();
      const productIds = this.getRewardProductIds(entry);
      bm.ownedContractProductIds = unique([...(bm.ownedContractProductIds ?? []), ...productIds]);
      BMSystem.emitStateChanged("reward_inbox_contract_ticket_granted", { rewardId: reward.id, productIds });

      return {
        success: true,
        type: entry.type,
        amount: productIds.length,
        rewardId: reward.id,
        productIds
      };
    }

    if (entry.type === "item") {
      return this.grantItemReward(entry, reward);
    }

    return {
      success: false,
      reason: "unsupported_reward_type",
      message: "지원하지 않는 보상 타입입니다."
    };
  },

  grantItemReward(entry = {}, reward = {}) {
    const target = this.resolveItemRewardTarget(entry);
    const amount = this.toNonNegativeInteger(entry.amount);

    if (!target) {
      return {
        success: false,
        reason: "unsupported_item_reward",
        message: "지원하지 않는 아이템 보상입니다."
      };
    }

    if (target.kind === "bm_counter") {
      const bm = BMSystem.ensureBMState();
      bm[target.field] = this.toNonNegativeInteger(bm[target.field]) + amount;
      this.syncBMWalletTickets(bm);
      BMSystem.emitStateChanged("reward_inbox_item_granted", {
        rewardId: reward.id,
        itemId: target.itemId,
        amount
      });

      return {
        success: true,
        type: "item",
        itemId: target.itemId,
        amount,
        rewardId: reward.id,
        balance: bm[target.field]
      };
    }

    const state = this.getState();
    state.items[target.itemId] = this.toNonNegativeInteger(state.items[target.itemId]) + amount;
    this.writeState(state, { emit: false });

    return {
      success: true,
      type: "item",
      itemId: target.itemId,
      amount,
      rewardId: reward.id,
      balance: state.items[target.itemId]
    };
  },

  resolveItemRewardTarget(entry = {}) {
    const itemId = String(entry.itemId ?? "").trim();
    const itemAliases = {
      ad_skip_ticket: { kind: "bm_counter", field: "adSkipTickets", itemId: "ad_skip_ticket" },
      skip_ticket: { kind: "bm_counter", field: "adSkipTickets", itemId: "ad_skip_ticket" },
      peak_time_coupon: { kind: "bm_counter", field: "peakTimeCoupons", itemId: "peak_time_coupon" },
      coffee_ticket: { kind: "bm_counter", field: "coffeeTickets", itemId: "coffee_ticket" }
    };

    if (itemAliases[itemId]) return itemAliases[itemId];

    if (itemId) {
      return {
        kind: "reward_inbox_item",
        itemId
      };
    }

    return null;
  },

  getRewardProductIds(entry = {}) {
    return unique([
      ...(Array.isArray(entry.productIds) ? entry.productIds : []),
      entry.productId
    ]);
  },

  syncBMWalletTickets(bm = GameState.bm) {
    if (!GameState.bmWallet || typeof GameState.bmWallet !== "object") {
      GameState.bmWallet = {};
    }

    GameState.bmWallet.adSkipTickets = this.toNonNegativeInteger(bm.adSkipTickets);
    GameState.bmWallet.peakTimeCoupons = this.toNonNegativeInteger(bm.peakTimeCoupons);
    GameState.bmWallet.coffeeTickets = this.toNonNegativeInteger(bm.coffeeTickets);
  },

  isRewardExpired(reward = {}, now = new Date()) {
    if (!reward.expiresAt) return false;

    const expiresAt = new Date(reward.expiresAt);
    const nowDate = now instanceof Date ? now : new Date(now);

    if (Number.isNaN(expiresAt.getTime()) || Number.isNaN(nowDate.getTime())) {
      return true;
    }

    return expiresAt.getTime() < nowDate.getTime();
  },

  emitUpdated(reason = "reward_inbox_updated", details = {}) {
    EventBus.emit(REWARD_INBOX_EVENTS.UPDATED, {
      reason,
      ...details,
      inbox: this.getState()
    });
  },

  emitClaimFailed(reason, message, details = {}) {
    const result = {
      success: false,
      reason,
      message,
      ...details,
      inbox: this.getState()
    };

    EventBus.emit(REWARD_INBOX_EVENTS.CLAIM_FAILED, result);

    return result;
  },

  normalizeDateString(value) {
    if (value === null || value === undefined || value === "") return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString();
  },

  getTimeValue(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  },

  toNonNegativeInteger(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }
};
