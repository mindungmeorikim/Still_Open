/*
  UserIdentitySystem.js

  역할:
  - 로그인/플랫폼 SDK 사용자 ID가 있으면 우선 사용한다.
  - SDK 사용자 ID가 없으면 설치 단위 익명 ID를 생성한다.
  - 첫 로그인 지원금 보상을 사용자 ID 범위로 1회만 생성/수령 처리한다.

  주의:
  - 서버 검증이 없는 현재 빌드에서는 앱 데이터 삭제/다른 기기까지 완전히 막을 수 없다.
  - 추후 로그인 SDK가 연결되면 window.StillOpenSDK.getUserId() 또는
    window.__STILL_OPEN_USER_ID__ 어댑터에 계정 ID를 공급하면 된다.
*/

import { EventBus } from "../core/EventBus.js";
import {
  RewardInboxSystem,
  REWARD_INBOX_EVENTS
} from "./RewardInboxSystem.js";

export const USER_IDENTITY_EVENTS = Object.freeze({
  READY: "USER_IDENTITY_READY",
  FIRST_LOGIN_REWARD_GRANTED: "FIRST_LOGIN_REWARD_GRANTED",
  FIRST_LOGIN_REWARD_CLAIMED: "FIRST_LOGIN_REWARD_CLAIMED"
});

const SAVE_GAME_LOADED = "SAVE_GAME_LOADED";
const NEW_GAME_STATE_RESET = "NEW_GAME_STATE_RESET";
const INSTALL_ID_KEY = "still_open_install_user_id_v1";
const FIRST_LOGIN_REWARD_BASE_ID = "first_login_diamond_30";
const FIRST_LOGIN_REWARD_CLAIM_KEY_PREFIX = "still_open_first_login_reward_claimed_v1";
const FIRST_LOGIN_REWARD_GRANTED_KEY_PREFIX = "still_open_first_login_reward_granted_v1";
const FIRST_LOGIN_REWARD_SOURCE = "first_login_reward";
const FIRST_LOGIN_REWARD_AMOUNT = 30;

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (_error) {
    return false;
  }
}

function normalizeUserId(value) {
  const normalized = String(value ?? "").trim();

  if (!normalized || normalized === "undefined" || normalized === "null") {
    return "";
  }

  return normalized.slice(0, 128);
}

function createFallbackInstallId() {
  if (typeof window.crypto?.randomUUID === "function") {
    return `install_${window.crypto.randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 12);
  return `install_${Date.now().toString(36)}_${randomPart}`;
}

function createStableHash(value) {
  const text = String(value ?? "");
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export const UserIdentitySystem = {
  isInitialized: false,
  userId: "",
  identitySource: "",

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.resolveIdentity();

    EventBus.on(NEW_GAME_STATE_RESET, () => {
      this.ensureFirstLoginReward("new_game");
    });

    EventBus.on(SAVE_GAME_LOADED, () => {
      this.ensureFirstLoginReward("save_loaded");
    });

    EventBus.on(REWARD_INBOX_EVENTS.CLAIMED, (result = {}) => {
      this.handleRewardClaimed(result);
    });
  },

  resolveIdentity() {
    const externalIdentity = this.getExternalIdentity();

    if (externalIdentity.userId) {
      this.userId = externalIdentity.userId;
      this.identitySource = externalIdentity.source;
    } else {
      this.userId = this.getOrCreateInstallId();
      this.identitySource = "install";
    }

    EventBus.emit(USER_IDENTITY_EVENTS.READY, this.getSnapshot());
    return this.getSnapshot();
  },

  getExternalIdentity() {
    const candidates = [
      ["still_open_sdk", () => window.StillOpenSDK?.getUserId?.()],
      ["still_open_sdk", () => window.StillOpenSDK?.userId],
      ["platform_sdk", () => window.GameSDK?.getUserId?.()],
      ["platform_sdk", () => window.GameSDK?.userId],
      ["bridge", () => window.__STILL_OPEN_USER_ID__],
      ["bridge", () => window.stillOpenUserId]
    ];

    for (const [source, resolver] of candidates) {
      try {
        const resolvedValue = resolver();

        // 비동기 SDK는 로그인 완료 시 __STILL_OPEN_USER_ID__를 동기 값으로
        // 주입하도록 어댑터에서 연결한다. Promise 자체를 ID로 저장하지 않는다.
        if (resolvedValue && typeof resolvedValue.then === "function") {
          continue;
        }

        const userId = normalizeUserId(resolvedValue);
        if (userId) return { userId, source };
      } catch (_error) {
        // SDK 미연결/권한 오류는 설치 ID fallback으로 처리한다.
      }
    }

    return { userId: "", source: "" };
  },

  getOrCreateInstallId() {
    const storedId = normalizeUserId(safeStorageGet(INSTALL_ID_KEY));
    if (storedId) return storedId;

    const createdId = createFallbackInstallId();
    safeStorageSet(INSTALL_ID_KEY, createdId);
    return createdId;
  },

  getUserId() {
    if (!this.userId) this.resolveIdentity();
    return this.userId;
  },

  getIdentitySource() {
    if (!this.identitySource) this.resolveIdentity();
    return this.identitySource;
  },

  getSnapshot() {
    return Object.freeze({
      userId: this.userId,
      source: this.identitySource,
      isAccountScoped: this.identitySource !== "install"
    });
  },

  getScopedStorageKey(key) {
    const scopeHash = createStableHash(this.getUserId());
    return `still_open_user_scope:${scopeHash}:${String(key ?? "key")}`;
  },

  getFirstLoginRewardId() {
    return `${FIRST_LOGIN_REWARD_BASE_ID}_${createStableHash(this.getUserId())}`;
  },

  getFirstLoginRewardClaimKey() {
    return `${FIRST_LOGIN_REWARD_CLAIM_KEY_PREFIX}:${createStableHash(this.getUserId())}`;
  },

  getFirstLoginRewardGrantedKey() {
    return `${FIRST_LOGIN_REWARD_GRANTED_KEY_PREFIX}:${createStableHash(this.getUserId())}`;
  },

  hasClaimedFirstLoginReward() {
    return safeStorageGet(this.getFirstLoginRewardClaimKey()) === "claimed";
  },

  hasGrantedFirstLoginReward() {
    return safeStorageGet(this.getFirstLoginRewardGrantedKey()) === "granted";
  },

  markFirstLoginRewardGranted() {
    return safeStorageSet(this.getFirstLoginRewardGrantedKey(), "granted");
  },

  markFirstLoginRewardClaimed() {
    this.markFirstLoginRewardGranted();
    return safeStorageSet(this.getFirstLoginRewardClaimKey(), "claimed");
  },

  ensureFirstLoginReward(trigger = "runtime") {
    const rewardId = this.getFirstLoginRewardId();
    const currentInbox = RewardInboxSystem.getState();
    const filteredRewards = currentInbox.rewards.filter((reward) => {
      return reward.source !== FIRST_LOGIN_REWARD_SOURCE || reward.id === rewardId;
    });

    if (filteredRewards.length !== currentInbox.rewards.length) {
      RewardInboxSystem.writeState({
        ...currentInbox,
        rewards: filteredRewards
      }, {
        reason: "first_login_reward_identity_scope_changed"
      });
    }

    if (this.hasClaimedFirstLoginReward() || RewardInboxSystem.isRewardClaimed(rewardId)) {
      this.markFirstLoginRewardClaimed();
      return {
        success: false,
        reason: "already_claimed",
        rewardId
      };
    }

    const existingReward = RewardInboxSystem.getAllInboxRewards().find((reward) => {
      return reward.id === rewardId;
    });

    if (existingReward) {
      this.markFirstLoginRewardGranted();
      return {
        success: true,
        reason: "already_pending",
        reward: existingReward
      };
    }

    if (this.hasGrantedFirstLoginReward()) {
      return {
        success: false,
        reason: "already_granted",
        rewardId
      };
    }

    const result = RewardInboxSystem.addInboxReward({
      id: rewardId,
      title: "신규 점주 지원금",
      message: "오늘도 정상영업에 오신 것을 환영합니다! 첫 매장 운영을 위한 다이아 30개를 드립니다.",
      source: FIRST_LOGIN_REWARD_SOURCE,
      createdAt: new Date().toISOString(),
      rewards: [
        {
          type: "diamond",
          amount: FIRST_LOGIN_REWARD_AMOUNT,
          label: `다이아 ${FIRST_LOGIN_REWARD_AMOUNT}개`
        }
      ]
    });

    if (result.success) {
      this.markFirstLoginRewardGranted();
      EventBus.emit(USER_IDENTITY_EVENTS.FIRST_LOGIN_REWARD_GRANTED, {
        trigger,
        rewardId,
        amount: FIRST_LOGIN_REWARD_AMOUNT,
        identitySource: this.getIdentitySource(),
        isAccountScoped: this.getIdentitySource() !== "install"
      });
    }

    return result;
  },

  handleRewardClaimed(result = {}) {
    const reward = result.reward ?? {};
    const rewardId = String(result.rewardId ?? reward.id ?? "");

    if (rewardId !== this.getFirstLoginRewardId()) {
      return;
    }

    this.markFirstLoginRewardClaimed();
    EventBus.emit(USER_IDENTITY_EVENTS.FIRST_LOGIN_REWARD_CLAIMED, {
      rewardId,
      amount: FIRST_LOGIN_REWARD_AMOUNT,
      identitySource: this.getIdentitySource(),
      isAccountScoped: this.getIdentitySource() !== "install"
    });
  }
};
