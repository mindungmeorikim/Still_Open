/*
  SaveSystem.js

  역할:
  - localStorage 기반 저장/불러오기
  - 타이틀 화면 이어하기 버튼에서 사용할 저장 데이터 상태 제공
  - 저장 데이터 파싱 실패/구버전 데이터에 대한 방어 처리

  규칙:
  - index.html, main.js, core/GameState.js, core/EventBus.js, core/Constants.js 직접 수정 금지
  - 실제 광고 SDK/서버 저장 연동 없음
  - 저장 가능한 안전 구간 중심으로 자동 저장
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE, GAME_CONFIG } from "../core/Constants.js";
import { PRODUCTS } from "../data/ProductData.js";
import { InventorySystem } from "./InventorySystem.js";
import { ExpansionSystem } from "./ExpansionSystem.js";
import { DailyRewardSystem } from "./DailyRewardSystem.js";
import { RewardCodeSystem, REWARD_CODE_EVENTS } from "./RewardCodeSystem.js";
import { RewardInboxSystem, REWARD_INBOX_EVENTS } from "./RewardInboxSystem.js";

const SAVE_KEY = "today_normal_open_save_v1";
const SETTINGS_KEY = "today_normal_open_settings_v1";
const SAVE_VERSION = "v7.6.1";
const SAVE_GAME_LOADED = "SAVE_GAME_LOADED";
const NEW_GAME_STATE_RESET = "NEW_GAME_STATE_RESET";
const EXPANSION_CONSTRUCTION_STARTED = "EXPANSION_CONSTRUCTION_STARTED";
const INFINITE_MODE_START_DAY = GAME_CONFIG.MAX_STORY_DAY + 1;
const BASIC_BM_PRODUCT_IDS = Object.freeze(["potato_chips", "water"]);
const SAVEABLE_PHASES = new Set([
  GAME_PHASE.READY,
  GAME_PHASE.DAY_START,
  GAME_PHASE.ORDER,
  GAME_PHASE.RESULT,
  GAME_PHASE.UPGRADE,
  GAME_PHASE.NEXT_DAY,
  GAME_PHASE.ENDLESS
]);

export const SaveSystem = {
  isInitialized: false,
  saveTimerId: null,
  lastSaveStatus: null,
  isResettingNewGame: false,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;

    EventBus.on(EVENTS.DAY_STARTED, () => {
      this.saveNow("day_started");
    });

    EventBus.on(EVENTS.ORDER_CONFIRMED, () => {
      this.requestAutosave("order_confirmed");
    });

    EventBus.on(EVENTS.ORDER_DELIVERED, () => {
      this.requestAutosave("order_delivered");
    });

    EventBus.on(EVENTS.GAME_STATE_CHANGED, () => {
      this.requestAutosave("game_state_changed");
    });

    EventBus.on(EVENTS.STOCK_ORGANIZED, () => {
      this.requestAutosave("stock_organized");
    });

    EventBus.on(EXPANSION_CONSTRUCTION_STARTED, () => {
      this.saveNow("expansion_construction_started", { allowUnsafePhase: true });
    });

    EventBus.on(EVENTS.EXPANSION_COMPLETED, () => {
      this.saveNow("expansion_completed", { allowUnsafePhase: true });
    });

    EventBus.on(EVENTS.UPGRADE_SELECTED, () => {
      this.requestAutosave("upgrade_selected");
    });

    EventBus.on(REWARD_CODE_EVENTS.REDEEM_SUCCEEDED, () => {
      this.requestAutosave("reward_code_redeemed");
    });

    EventBus.on(REWARD_INBOX_EVENTS.UPDATED, () => {
      this.requestAutosave("reward_inbox_updated");
    });
  },

  hasSaveData() {
    const saveData = this.readSaveData();

    return saveData !== null && this.isMeaningfulSaveData(saveData);
  },

  getSaveSummary() {
    const saveData = this.readSaveData();

    if (!saveData || !this.isMeaningfulSaveData(saveData)) {
      return null;
    }

    const day = Math.max(1, Math.floor(Number(saveData.gameState?.day) || 1));
    const money = Math.max(0, Math.floor(Number(saveData.gameState?.money) || 0));
    const savedAt = saveData.savedAt ?? null;

    const isEndlessMode = saveData.gameState?.isEndlessMode === true || day > GAME_CONFIG.MAX_STORY_DAY;
    const storyCleared = saveData.gameState?.storyCleared === true || isEndlessMode;

    return {
      day,
      money,
      savedAt,
      version: saveData.version ?? "unknown",
      isEndlessMode,
      storyCleared
    };
  },

  requestAutosave(reason = "autosave") {
    if (this.isResettingNewGame) {
      this.lastSaveStatus = {
        success: false,
        reason: "new_game_reset_ignored"
      };

      return false;
    }

    if (!this.canAutosaveCurrentPhase()) {
      return false;
    }

    if (this.saveTimerId) {
      window.clearTimeout(this.saveTimerId);
    }

    this.saveTimerId = window.setTimeout(() => {
      this.saveTimerId = null;
      this.saveNow(reason);
    }, 80);

    return true;
  },

  saveNow(reason = "manual", options = {}) {
    if (this.isResettingNewGame) {
      this.lastSaveStatus = {
        success: false,
        reason: "new_game_reset_ignored"
      };

      return this.lastSaveStatus;
    }

    if (!this.canUseLocalStorage()) {
      this.lastSaveStatus = {
        success: false,
        reason: "local_storage_unavailable"
      };

      return this.lastSaveStatus;
    }

    if (!this.canAutosaveCurrentPhase() && options.allowUnsafePhase !== true) {
      this.lastSaveStatus = {
        success: false,
        reason: "unsafe_phase",
        phase: GameState.phase
      };

      return this.lastSaveStatus;
    }

    const payload = this.createSavePayload(reason);

    if (!this.isMeaningfulSaveData(payload)) {
      this.lastSaveStatus = {
        success: false,
        reason: "empty_snapshot_ignored",
        phase: payload.gameState?.phase,
        day: payload.gameState?.day
      };

      return this.lastSaveStatus;
    }

    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));

      this.lastSaveStatus = {
        success: true,
        reason,
        savedAt: payload.savedAt,
        day: payload.gameState.day
      };

      return this.lastSaveStatus;
    } catch (error) {
      console.warn("[SaveSystem] 저장 실패", error);

      this.lastSaveStatus = {
        success: false,
        reason: "write_failed",
        error
      };

      return this.lastSaveStatus;
    }
  },

  loadGame() {
    const saveData = this.readSaveData();

    if (!saveData) {
      return {
        success: false,
        reason: "no_save_data",
        message: "저장 데이터가 없습니다."
      };
    }

    const validation = this.validateSaveData(saveData);

    if (!validation.isValid) {
      return {
        success: false,
        reason: validation.reason,
        message: validation.message
      };
    }

    if (!this.isMeaningfulSaveData(saveData)) {
      this.clearSaveData();

      return {
        success: false,
        reason: "empty_save_data",
        message: "이어갈 저장 데이터가 없습니다. 새로 시작해주세요."
      };
    }

    this.applyGameStateSnapshot(saveData.gameState);
    this.applyInventorySnapshot(saveData.inventory);
    this.applyExpansionSnapshot(saveData.expansion);
    this.applyExternalProgressSnapshots(saveData.gameState);

    const runtimeSnapshot = this.createRuntimeSnapshotForLoad(saveData);
    this.applyRuntimeSnapshots(runtimeSnapshot);

    EventBus.emit(SAVE_GAME_LOADED, runtimeSnapshot);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return {
      success: true,
      reason: "loaded",
      message: `Day ${GameState.day} 저장 데이터를 불러왔습니다.`,
      saveData
    };
  },

  clearSaveData() {
    if (!this.canUseLocalStorage()) {
      return false;
    }

    try {
      window.localStorage.removeItem(SAVE_KEY);
      return true;
    } catch (error) {
      console.warn("[SaveSystem] 저장 데이터 삭제 실패", error);
      return false;
    }
  },

  resetNewGameState() {
    const paidCarryover = this.createPaidBMCarryoverSnapshot(GameState.bm);
    const accountWalletCarryover = this.createAccountBMWalletCarryoverSnapshot(GameState.bm);
    this.clearSaveData();
    this.isResettingNewGame = true;

    this.applyGameStateSnapshot(this.createDefaultGameStateSnapshot());
    this.applyPaidBMCarryover(paidCarryover);
    this.applyAccountBMWalletCarryover(accountWalletCarryover);
    DailyRewardSystem.resetForNewGame(GameState.bmWallet);
    this.applyInventorySnapshot({ lots: [], lotSequence: 0, initializedProductIds: [] });
    this.applyExpansionSnapshot({ unlockedZoneIds: ["zone_basic"], constructionZoneId: null });
    this.resetRuntimeSnapshotsForNewRun();

    EventBus.emit(NEW_GAME_STATE_RESET, {
      day: GameState.day,
      reason: "new_game"
    });
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    this.isResettingNewGame = false;
  },

  resetInfiniteModeRun() {
    if (!this.canUseLocalStorage()) {
      return {
        success: false,
        reason: "local_storage_unavailable",
        message: "저장소를 사용할 수 없어 무한 모드를 초기화하지 못했습니다."
      };
    }

    this.isResettingNewGame = true;

    const paidCarryover = this.createPaidBMCarryoverSnapshot(GameState.bm);
    const accountWalletCarryover = this.createAccountBMWalletCarryoverSnapshot(GameState.bm);
    this.applyGameStateSnapshot(this.createInfiniteModeStartSnapshot());
    this.applyPaidBMCarryover(paidCarryover);
    this.applyAccountBMWalletCarryover(accountWalletCarryover);
    this.applyInventorySnapshot(this.createInfiniteModeStartInventorySnapshot());
    this.applyExpansionSnapshot({
      unlockedZoneIds: ["zone_basic"],
      constructionZoneId: null
    });
    this.resetRuntimeSnapshotsForNewRun();

    this.isResettingNewGame = false;

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    const saveStatus = this.saveNow("infinite_mode_game_over_checkpoint");

    this.lastSaveStatus = {
      ...saveStatus,
      success: saveStatus.success === true,
      reason: "infinite_mode_game_over_checkpoint",
      day: INFINITE_MODE_START_DAY,
      storyCleared: true,
      message: "무한 모드가 Day 6 초기 상태로 리셋되었습니다."
    };

    return this.lastSaveStatus;
  },

  readSaveData() {
    if (!this.canUseLocalStorage()) {
      return null;
    }

    try {
      const rawData = window.localStorage.getItem(SAVE_KEY);

      if (!rawData) {
        return null;
      }

      const parsedData = JSON.parse(rawData);

      if (!parsedData || typeof parsedData !== "object") {
        return null;
      }

      return parsedData;
    } catch (error) {
      console.warn("[SaveSystem] 저장 데이터 파싱 실패. 손상된 데이터를 무시합니다.", error);
      return null;
    }
  },

  canUseLocalStorage() {
    return typeof window !== "undefined" && !!window.localStorage;
  },

  canAutosaveCurrentPhase() {
    return SAVEABLE_PHASES.has(GameState.phase);
  },

  createSavePayload(reason = "manual") {
    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      reason,
      gameState: this.createGameStateSnapshot(),
      inventory: this.createInventorySnapshot(),
      expansion: this.createExpansionSnapshot(),
      flow: this.createFlowSnapshot(),
      order: this.createOrderSnapshot(),
      shelfStocks: this.createShelfStocksSnapshot(),
      boxState: this.createBoxStateSnapshot(),
      upgradeFlow: this.createUpgradeFlowSnapshot(),
      settings: this.readSettings()
    };
  },

  createGameStateSnapshot() {
    return this.deepClone({
      phase: this.normalizeSavedPhase(GameState.phase),
      day: this.toPositiveInteger(GameState.day, 1),
      isEndlessMode: GameState.isEndlessMode === true,
      storyCleared: GameState.storyCleared === true || GameState.isEndlessMode === true || GameState.day > GAME_CONFIG.MAX_STORY_DAY,
      money: this.toNonNegativeInteger(GameState.money),
      mental: this.clampStat(GameState.mental, GAME_CONFIG.START_MENTAL),
      satisfaction: this.clampStat(GameState.satisfaction, GAME_CONFIG.START_SATISFACTION),
      dailyGoal: GameState.dailyGoal,
      todayStats: GameState.todayStats,
      upgrades: Array.isArray(GameState.upgrades) ? GameState.upgrades : [],
      upgradeEffects: GameState.upgradeEffects ?? null,
      difficulty: GameState.difficulty,
      infiniteMode: GameState.infiniteMode ?? null,
      dayScenario: GameState.dayScenario ?? null,
      bm: this.normalizeBMSnapshot(GameState.bm),
      dailyMissions: GameState.dailyMissions ?? null,
      dailyReward: this.createDailyRewardSnapshot(),
      rewardClaims: this.normalizeRewardClaimsSnapshot(RewardCodeSystem.getState()),
      rewardInbox: this.normalizeRewardInboxSnapshot(RewardInboxSystem.getState()),
      sanitation: this.normalizeSanitationSnapshot(GameState.sanitation),
      staff: GameState.staff ?? null,
      player: GameState.player ?? null,
      expansion: GameState.expansion ?? null
    });
  },

  createDefaultGameStateSnapshot() {
    return {
      phase: GAME_PHASE.READY,
      day: 1,
      isEndlessMode: false,
      storyCleared: false,
      money: GAME_CONFIG.START_MONEY,
      mental: GAME_CONFIG.START_MENTAL,
      satisfaction: GAME_CONFIG.START_SATISFACTION,
      dailyGoal: {
        targetRevenue: 25000,
        targetSatisfaction: 70
      },
      todayStats: this.createEmptyTodayStats(),
      upgrades: [],
      upgradeEffects: null,
      difficulty: {
        customerSpawnRate: 1,
        angryCustomerRate: 1,
        stockDecreaseRate: 1,
        eventRate: 1
      },
      infiniteMode: {
        consecutiveFailures: 0,
        isGameOver: false,
        lastGameOverReason: null,
        lastCheckedDay: 1
      },
      dayScenario: null,
      bm: this.createDefaultBMSnapshot(),
      dailyMissions: null,
      dailyReward: this.createDefaultDailyRewardSnapshot(),
      rewardClaims: this.createDefaultRewardClaimsSnapshot(),
      rewardInbox: this.createDefaultRewardInboxSnapshot(),
      sanitation: this.createDefaultSanitationSnapshot(),
      staff: null,
      player: {
        x: 610,
        y: 640,
        speed: 4,
        direction: "down"
      },
      shelfStocks: {},
      orderSnapshot: this.createDefaultOrderSnapshot(),
      upgradeFlow: this.createDefaultUpgradeFlowSnapshot(),
      expansion: {
        unlockedZoneIds: ["zone_basic"],
        movementBounds: [],
        customerAccessibleZones: ["door", "shelf", "counter", "exit"],
        constructionZoneId: null,
        lastUpdatedDay: 1
      }
    };
  },

  createInfiniteModeStartSnapshot() {
    return {
      ...this.createDefaultGameStateSnapshot(),
      phase: GAME_PHASE.ENDLESS,
      day: INFINITE_MODE_START_DAY,
      isEndlessMode: true,
      storyCleared: true,
      dailyGoal: this.createInfiniteModeStartDailyGoal(),
      difficulty: this.createInfiniteModeStartDifficulty(),
      infiniteMode: {
        consecutiveFailures: 0,
        isGameOver: false,
        lastGameOverReason: null,
        lastGameOverDay: null,
        lastCheckedDay: INFINITE_MODE_START_DAY
      },
      expansion: {
        unlockedZoneIds: ["zone_basic"],
        movementBounds: [],
        customerAccessibleZones: ["door", "shelf", "counter", "exit"],
        constructionZoneId: null,
        lastUpdatedDay: INFINITE_MODE_START_DAY
      }
    };
  },

  createInfiniteModeStartDailyGoal() {
    const extraDay = INFINITE_MODE_START_DAY - GAME_CONFIG.MAX_STORY_DAY;

    return {
      targetRevenue: 90000 + extraDay * 20000,
      targetSatisfaction: Math.min(90, 78 + extraDay)
    };
  },

  normalizeLoadedDailyGoal(snapshot = {}, day = 1) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const targetRevenue = Math.max(
      0,
      Math.floor(Number(source.targetRevenue) || 0)
    );

    return {
      targetRevenue: this.migrateLegacyTargetRevenue(targetRevenue, safeDay),
      targetSatisfaction: this.clampStat(source.targetSatisfaction, 70)
    };
  },

  migrateLegacyTargetRevenue(targetRevenue, day = 1) {
    const safeTargetRevenue = Math.max(0, Math.floor(Number(targetRevenue) || 0));
    const currentBase = this.getCurrentBaseTargetRevenue(day);
    const legacyBase = this.getLegacyBaseTargetRevenue(day);

    if (safeTargetRevenue <= 0) {
      return currentBase;
    }

    if (safeTargetRevenue === legacyBase) {
      return currentBase;
    }

    const legacyBonus = safeTargetRevenue - legacyBase;

    if (legacyBonus > 0 && legacyBonus <= 50000) {
      return currentBase + legacyBonus;
    }

    return safeTargetRevenue;
  },

  getCurrentBaseTargetRevenue(day = 1) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const storyTargets = {
      1: 25000,
      2: 40000,
      3: 55000,
      4: 72000,
      5: 90000
    };

    if (storyTargets[safeDay]) {
      return storyTargets[safeDay];
    }

    const extraDay = safeDay - GAME_CONFIG.MAX_STORY_DAY;
    return 90000 + extraDay * 20000;
  },

  getLegacyBaseTargetRevenue(day = 1) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const legacyStoryTargets = {
      1: 30000,
      2: 45000,
      3: 60000,
      4: 80000,
      5: 100000
    };

    if (legacyStoryTargets[safeDay]) {
      return legacyStoryTargets[safeDay];
    }

    const extraDay = safeDay - GAME_CONFIG.MAX_STORY_DAY;
    return 100000 + extraDay * 25000;
  },

  createInfiniteModeStartDifficulty() {
    const extraDay = INFINITE_MODE_START_DAY - GAME_CONFIG.MAX_STORY_DAY;

    return {
      customerSpawnRate: Number((1.75 + extraDay * 0.12).toFixed(2)),
      angryCustomerRate: Number((1.3 + extraDay * 0.07).toFixed(2)),
      stockDecreaseRate: Number((1.28 + extraDay * 0.06).toFixed(2)),
      eventRate: Number((1.3 + extraDay * 0.07).toFixed(2))
    };
  },

  createInfiniteModeStartInventorySnapshot() {
    return {
      lots: [],
      lotSequence: 0,
      initializedProductIds: PRODUCTS
        .filter((product) => product.unlockDay <= INFINITE_MODE_START_DAY)
        .map((product) => product.id)
    };
  },

  createEmptyTodayStats() {
    return {
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
      bmBonus: 0,
      customerWaitTimeTotal: 0,
      customerWaitSampleCount: 0,
      maxCheckoutQueue: 0,
      maxActiveCustomers: 0,
      outOfStockSeconds: 0,
      nuisanceEventCount: 0,
      nuisanceTimeoutCount: 0,
      nuisanceResponseTimeTotalMs: 0,
      nuisanceResponseCount: 0,
      positiveGuestCount: 0
    };
  },

  normalizeSavedPhase(phase) {
    if (SAVEABLE_PHASES.has(phase)) {
      return phase;
    }

    return GameState.day > 1 ? GAME_PHASE.NEXT_DAY : GAME_PHASE.READY;
  },

  createInventorySnapshot() {
    return {
      lots: Array.isArray(InventorySystem.lots)
        ? this.deepClone(InventorySystem.lots)
        : [],
      lotSequence: this.toNonNegativeInteger(InventorySystem.lotSequence),
      initializedProductIds: InventorySystem.initializedProductIds instanceof Set
        ? [...InventorySystem.initializedProductIds]
        : []
    };
  },

  createExpansionSnapshot() {
    const unlockedZoneIds = ExpansionSystem.unlockedZoneIds instanceof Set
      ? [...ExpansionSystem.unlockedZoneIds]
      : Array.isArray(GameState.expansion?.unlockedZoneIds)
        ? [...GameState.expansion.unlockedZoneIds]
        : ["zone_basic"];

    return {
      unlockedZoneIds,
      constructionZoneId: ExpansionSystem.constructionZoneId ?? null,
      constructionStartedAt: ExpansionSystem.constructionStartedAt ?? GameState.expansion?.constructionStartedAt ?? null,
      constructionCompletesAt: ExpansionSystem.constructionCompletesAt ?? GameState.expansion?.constructionCompletesAt ?? null
    };
  },

  normalizePlayerSnapshot(player = {}, defaultPlayer = { x: 610, y: 640, speed: 4, direction: "down" }) {
    const source = player && typeof player === "object" ? this.deepClone(player) : {};
    const nextPlayer = {
      ...defaultPlayer,
      ...source
    };
    const x = Number(nextPlayer.x);
    const y = Number(nextPlayer.y);
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    const isLegacyStartPosition =
      (roundedX === 600 && roundedY === 705) ||
      (roundedX === 610 && roundedY === 548) ||
      (roundedX === 610 && roundedY === 650);

    if (isLegacyStartPosition) {
      nextPlayer.x = defaultPlayer.x;
      nextPlayer.y = defaultPlayer.y;
    } else {
      nextPlayer.x = Number.isFinite(x) ? x : defaultPlayer.x;
      nextPlayer.y = Number.isFinite(y) ? y : defaultPlayer.y;
    }

    const speed = Number(nextPlayer.speed);
    nextPlayer.speed = Number.isFinite(speed) && speed > 0
      ? speed
      : defaultPlayer.speed;
    nextPlayer.direction = nextPlayer.direction
      ? String(nextPlayer.direction)
      : defaultPlayer.direction;

    return nextPlayer;
  },

  createFlowSnapshot() {
    const source = GameState.flowSnapshot && typeof GameState.flowSnapshot === "object"
      ? GameState.flowSnapshot
      : {};
    const inferredOrderReadyDay = GameState.phase === GAME_PHASE.DAY_START
      ? GameState.day
      : source.orderReadyDay;

    return this.normalizeFlowSnapshot({
      ...source,
      orderReadyDay: inferredOrderReadyDay,
      remainingDaySeconds: source.remainingDaySeconds ?? GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS,
      isStoreOpen: false,
      savedPhase: GameState.phase
    });
  },

  createDefaultFlowSnapshot() {
    return {
      orderReadyDay: null,
      remainingDaySeconds: GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS,
      isStoreOpen: false,
      isClosing: false,
      isDayTimerPaused: false,
      staffAutoCheckoutElapsedSeconds: 0,
      savedPhase: GAME_PHASE.READY
    };
  },

  normalizeFlowSnapshot(snapshot = {}) {
    const defaults = this.createDefaultFlowSnapshot();
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const remainingDaySeconds = Math.max(
      0,
      Math.floor(Number(source.remainingDaySeconds ?? defaults.remainingDaySeconds) || defaults.remainingDaySeconds)
    );

    return {
      ...defaults,
      orderReadyDay: this.toNullablePositiveInteger(source.orderReadyDay),
      remainingDaySeconds,
      isStoreOpen: source.isStoreOpen === true,
      isClosing: source.isClosing === true,
      isDayTimerPaused: source.isDayTimerPaused === true,
      staffAutoCheckoutElapsedSeconds: this.toNonNegativeInteger(source.staffAutoCheckoutElapsedSeconds),
      savedPhase: source.savedPhase ?? defaults.savedPhase
    };
  },

  createOrderSnapshot() {
    const source = GameState.orderSnapshot && typeof GameState.orderSnapshot === "object"
      ? GameState.orderSnapshot
      : this.createDefaultOrderSnapshot();

    return this.normalizeOrderSnapshot(source);
  },

  createDefaultOrderSnapshot() {
    return {
      orderSequence: 0,
      pendingDelivery: null
    };
  },

  normalizeOrderSnapshot(snapshot = {}) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};

    return {
      orderSequence: this.toNonNegativeInteger(source.orderSequence),
      pendingDelivery: this.normalizePendingDeliverySnapshot(source.pendingDelivery)
    };
  },

  normalizePendingDeliverySnapshot(snapshot = null) {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    const orderId = String(snapshot.orderId ?? "").trim();
    const day = this.toPositiveInteger(snapshot.day, GameState.day || 1);
    const items = Array.isArray(snapshot.items)
      ? snapshot.items
          .map((item) => {
            const productId = String(item?.productId ?? "").trim().replace(/-/g, "_");
            const quantity = this.toNonNegativeInteger(item?.quantity);

            if (!productId || quantity <= 0) {
              return null;
            }

            return {
              ...this.deepClone(item),
              productId,
              quantity,
              isSorted: item?.isSorted === true
            };
          })
          .filter(Boolean)
      : [];

    if (!orderId || items.length === 0) {
      return null;
    }

    const isFullySorted = items.every((item) => item.isSorted === true);

    if (isFullySorted || snapshot.isCompleted === true) {
      return null;
    }

    return {
      orderId,
      day,
      items,
      totalCost: this.toNonNegativeInteger(snapshot.totalCost),
      isArrived: snapshot.isArrived === true
    };
  },

  createShelfStocksSnapshot() {
    return this.normalizeShelfStocksSnapshot(GameState.shelfStocks ?? {});
  },

  normalizeShelfStocksSnapshot(snapshot = {}) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const normalizedEntries = Object.entries(source)
      .map(([instanceId, stock]) => {
        const resolvedInstanceId = String(instanceId ?? "").trim();
        const products = stock?.products && typeof stock.products === "object"
          ? stock.products
          : {};
        const normalizedProducts = Object.fromEntries(
          Object.entries(products)
            .map(([productId, productStock]) => {
              const resolvedProductId = String(productId ?? productStock?.productId ?? "").trim().replace(/-/g, "_");
              const currentStock = this.toNonNegativeInteger(productStock?.currentStock);
              const maxStock = this.toPositiveInteger(productStock?.maxStock, 8);

              if (!resolvedProductId) {
                return null;
              }

              return [
                resolvedProductId,
                {
                  productId: resolvedProductId,
                  currentStock: Math.min(currentStock, maxStock),
                  maxStock
                }
              ];
            })
            .filter(Boolean)
        );

        if (!resolvedInstanceId) {
          return null;
        }

        return [
          resolvedInstanceId,
          {
            products: normalizedProducts,
            shelfId: stock?.shelfId ?? null,
            reason: stock?.reason ?? "save_snapshot"
          }
        ];
      })
      .filter(Boolean);

    return Object.fromEntries(normalizedEntries);
  },

  createBoxStateSnapshot() {
    return this.normalizeBoxStateSnapshot({
      warehouseBoxState: GameState.warehouseBoxState,
      deliveryBoxState: GameState.deliveryBoxState,
      deliveryBoxInteractionSuppressed: GameState.deliveryBoxInteractionSuppressed,
      warehouseBoxPosition: GameState.warehouseBoxPosition,
      playerCarryingBoxType: GameState.player?.carryingBoxType ?? null
    });
  },

  normalizeBoxStateSnapshot(snapshot = {}) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const positionSource = source.warehouseBoxPosition && typeof source.warehouseBoxPosition === "object"
      ? source.warehouseBoxPosition
      : null;

    return {
      warehouseBoxState: source.warehouseBoxState === "open" ? "open" : "closed",
      deliveryBoxState: source.deliveryBoxState === "carrying" ? "carrying" : null,
      deliveryBoxInteractionSuppressed: source.deliveryBoxInteractionSuppressed === true,
      warehouseBoxPosition: positionSource
        ? {
            x: Number(positionSource.x) || 210,
            y: Number(positionSource.y) || 575,
            width: Number(positionSource.width) || 120,
            height: Number(positionSource.height) || 90,
            interactionDistance: Number(positionSource.interactionDistance) || 120
          }
        : null,
      playerCarryingBoxType: source.playerCarryingBoxType ? String(source.playerCarryingBoxType) : null
    };
  },

  createUpgradeFlowSnapshot() {
    const source = GameState.upgradeFlow && typeof GameState.upgradeFlow === "object"
      ? GameState.upgradeFlow
      : this.createDefaultUpgradeFlowSnapshot();

    return this.normalizeUpgradeFlowSnapshot(source);
  },

  createDefaultUpgradeFlowSnapshot() {
    return {
      lastResultData: null,
      isUpgradeSelected: false,
      selectedUpgrade: null
    };
  },

  normalizeUpgradeFlowSnapshot(snapshot = {}) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};

    return {
      lastResultData: source.lastResultData ? this.deepClone(source.lastResultData) : null,
      isUpgradeSelected: source.isUpgradeSelected === true,
      selectedUpgrade: source.selectedUpgrade ? this.deepClone(source.selectedUpgrade) : null
    };
  },

  createRuntimeSnapshotForLoad(saveData = {}) {
    return {
      reason: "save_loaded",
      saveData,
      gameState: saveData.gameState ?? {},
      flow: this.normalizeFlowSnapshot(saveData.flow ?? saveData.gameState?.flowSnapshot ?? {}),
      order: this.normalizeOrderSnapshot(saveData.order ?? saveData.gameState?.orderSnapshot ?? {}),
      shelfStocks: this.normalizeShelfStocksSnapshot(saveData.shelfStocks ?? saveData.gameState?.shelfStocks ?? {}),
      boxState: this.normalizeBoxStateSnapshot(saveData.boxState ?? saveData.gameState?.boxState ?? {}),
      upgradeFlow: this.normalizeUpgradeFlowSnapshot(saveData.upgradeFlow ?? saveData.gameState?.upgradeFlow ?? {})
    };
  },

  applyRuntimeSnapshots(runtimeSnapshot = {}) {
    GameState.flowSnapshot = this.normalizeFlowSnapshot(runtimeSnapshot.flow);
    GameState.orderSnapshot = this.normalizeOrderSnapshot(runtimeSnapshot.order);
    GameState.shelfStocks = this.normalizeShelfStocksSnapshot(runtimeSnapshot.shelfStocks);
    GameState.upgradeFlow = this.normalizeUpgradeFlowSnapshot(runtimeSnapshot.upgradeFlow);

    const boxState = this.normalizeBoxStateSnapshot(runtimeSnapshot.boxState);
    GameState.warehouseBoxState = boxState.warehouseBoxState;
    GameState.deliveryBoxState = boxState.deliveryBoxState;
    GameState.deliveryBoxInteractionSuppressed = boxState.deliveryBoxInteractionSuppressed;

    if (boxState.warehouseBoxPosition) {
      GameState.warehouseBoxPosition = boxState.warehouseBoxPosition;
    }

    if (!GameState.player || typeof GameState.player !== "object") {
      GameState.player = { x: 610, y: 640, speed: 4, direction: "down" };
    }

    GameState.player.carryingBoxType = boxState.playerCarryingBoxType;
  },

  resetRuntimeSnapshotsForNewRun() {
    GameState.flowSnapshot = this.createDefaultFlowSnapshot();
    GameState.orderSnapshot = this.createDefaultOrderSnapshot();
    GameState.shelfStocks = {};
    GameState.upgradeFlow = this.createDefaultUpgradeFlowSnapshot();
    GameState.warehouseBoxState = "closed";
    GameState.deliveryBoxState = null;
    GameState.deliveryBoxInteractionSuppressed = false;

    if (GameState.player && typeof GameState.player === "object") {
      delete GameState.player.carryingBoxType;
    }
  },

  applyGameStateSnapshot(snapshot = {}) {
    const defaultSnapshot = this.createDefaultGameStateSnapshot();
    const nextState = {
      ...defaultSnapshot,
      ...this.deepClone(snapshot)
    };

    GameState.phase = this.normalizeLoadedPhase(nextState.phase);
    GameState.day = this.toPositiveInteger(nextState.day, 1);
    GameState.isEndlessMode = nextState.isEndlessMode === true;
    GameState.storyCleared = nextState.storyCleared === true || GameState.isEndlessMode === true || GameState.day > GAME_CONFIG.MAX_STORY_DAY;
    GameState.money = this.toNonNegativeInteger(nextState.money);
    GameState.mental = this.clampStat(nextState.mental, GAME_CONFIG.START_MENTAL);
    GameState.satisfaction = this.clampStat(
      nextState.satisfaction,
      GAME_CONFIG.START_SATISFACTION
    );
    GameState.dailyGoal = this.normalizeLoadedDailyGoal(
      nextState.dailyGoal ?? defaultSnapshot.dailyGoal,
      GameState.day
    );
    GameState.todayStats = {
      ...this.createEmptyTodayStats(),
      ...this.deepClone(nextState.todayStats ?? {})
    };
    GameState.upgrades = Array.isArray(nextState.upgrades)
      ? this.deepClone(nextState.upgrades)
      : [];
    GameState.difficulty = this.deepClone(nextState.difficulty ?? defaultSnapshot.difficulty);
    GameState.infiniteMode = this.normalizeInfiniteModeSnapshot(
      nextState.infiniteMode ?? defaultSnapshot.infiniteMode
    );
    GameState.dayScenario = nextState.dayScenario ?? null;
    GameState.bm = this.normalizeBMSnapshot(nextState.bm ?? defaultSnapshot.bm);
    this.syncBMWalletFromBMSnapshot(GameState.bm);
    GameState.dailyMissions = nextState.dailyMissions ?? null;
    RewardInboxSystem.writeState(
      RewardInboxSystem.mergeDefaultRewards(
        this.normalizeRewardInboxSnapshot(nextState.rewardInbox ?? defaultSnapshot.rewardInbox)
      ),
      { emit: false }
    );
    GameState.sanitation = this.normalizeSanitationSnapshot(
      nextState.sanitation ?? defaultSnapshot.sanitation
    );
    GameState.expansion = this.deepClone(nextState.expansion ?? defaultSnapshot.expansion);
    GameState.player = this.normalizePlayerSnapshot(
      nextState.player ?? defaultSnapshot.player,
      defaultSnapshot.player
    );
    GameState.shelfStocks = this.normalizeShelfStocksSnapshot(nextState.shelfStocks ?? GameState.shelfStocks ?? {});
    GameState.orderSnapshot = this.normalizeOrderSnapshot(nextState.orderSnapshot ?? GameState.orderSnapshot ?? this.createDefaultOrderSnapshot());
    GameState.upgradeFlow = this.normalizeUpgradeFlowSnapshot(nextState.upgradeFlow ?? GameState.upgradeFlow ?? this.createDefaultUpgradeFlowSnapshot());

    if (nextState.upgradeEffects) {
      GameState.upgradeEffects = this.deepClone(nextState.upgradeEffects);
    } else {
      delete GameState.upgradeEffects;
    }

    if (nextState.staff) {
      GameState.staff = this.deepClone(nextState.staff);
    } else {
      delete GameState.staff;
    }
  },

  applyInventorySnapshot(snapshot = {}) {
    const lots = Array.isArray(snapshot.lots) ? snapshot.lots : [];
    const initializedProductIds = Array.isArray(snapshot.initializedProductIds)
      ? snapshot.initializedProductIds
      : PRODUCTS.filter((product) => product.unlockDay <= GameState.day).map((product) => product.id);

    InventorySystem.lots = this.deepClone(lots).filter((lot) => {
      return lot && lot.productId && this.toNonNegativeInteger(lot.quantity) > 0;
    });
    InventorySystem.lotSequence = this.toNonNegativeInteger(snapshot.lotSequence);
    InventorySystem.initializedProductIds = new Set(initializedProductIds);

    if (typeof InventorySystem.emitInventoryChanged === "function") {
      InventorySystem.emitInventoryChanged("save_loaded");
    }
  },

  applyExpansionSnapshot(snapshot = {}) {
    const fallbackIds = Array.isArray(GameState.expansion?.unlockedZoneIds)
      ? GameState.expansion.unlockedZoneIds
      : ["zone_basic"];
    const unlockedZoneIds = Array.isArray(snapshot.unlockedZoneIds)
      ? snapshot.unlockedZoneIds
      : fallbackIds;

    ExpansionSystem.unlockedZoneIds = new Set(
      unlockedZoneIds.length > 0 ? unlockedZoneIds : ["zone_basic"]
    );
    ExpansionSystem.constructionZoneId = snapshot.constructionZoneId ?? null;
    ExpansionSystem.constructionStartedAt = snapshot.constructionStartedAt ?? null;
    ExpansionSystem.constructionCompletesAt = snapshot.constructionCompletesAt ?? null;

    if (typeof ExpansionSystem.migrateLegacyConstructionState === "function") {
      ExpansionSystem.migrateLegacyConstructionState(snapshot);
    }

    if (typeof ExpansionSystem.syncExpansionStateToGameState === "function") {
      ExpansionSystem.syncExpansionStateToGameState();
    }
  },

  applyExternalProgressSnapshots(gameStateSnapshot = {}) {
    if (!gameStateSnapshot || typeof gameStateSnapshot !== "object") {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(gameStateSnapshot, "dailyReward")) {
      this.applyDailyRewardSnapshot(gameStateSnapshot.dailyReward);
    }

    if (Object.prototype.hasOwnProperty.call(gameStateSnapshot, "rewardClaims")) {
      RewardCodeSystem.writeClaims(this.normalizeRewardClaimsSnapshot(gameStateSnapshot.rewardClaims));
    }
  },

  applyDailyRewardSnapshot(snapshot = {}) {
    const dailyReward = this.normalizeDailyRewardSnapshot(snapshot);

    DailyRewardSystem.writeAttendanceState(dailyReward.attendance);
    const syncedWallet = DailyRewardSystem.syncGameStateWallet(dailyReward.wallet);
    DailyRewardSystem.writeWallet(syncedWallet);
  },

  normalizeLoadedPhase(phase) {
    if (SAVEABLE_PHASES.has(phase)) {
      return phase;
    }

    return GAME_PHASE.READY;
  },

  normalizeInfiniteModeSnapshot(snapshot = {}) {
    return {
      consecutiveFailures: Math.max(
        0,
        Math.floor(Number(snapshot.consecutiveFailures) || 0)
      ),
      isGameOver: snapshot.isGameOver === true,
      lastGameOverReason: snapshot.lastGameOverReason ?? null,
      lastGameOverDay: snapshot.lastGameOverDay ?? null,
      lastCheckedDay: Math.max(
        1,
        Math.floor(Number(snapshot.lastCheckedDay) || GameState.day || 1)
      )
    };
  },

  createPaidBMCarryoverSnapshot(source = {}) {
    const paidWallet = source?.paidWallet && typeof source.paidWallet === "object"
      ? source.paidWallet
      : {};

    return {
      diamond: this.toNonNegativeInteger(paidWallet.diamond),
      adSkipTickets: this.toNonNegativeInteger(paidWallet.adSkipTickets),
      peakTimeCoupons: this.toNonNegativeInteger(paidWallet.peakTimeCoupons),
      coffeeTickets: this.toNonNegativeInteger(paidWallet.coffeeTickets),
      purchasedDiamondProductIds: this.createUniqueStringArray(source?.purchasedDiamondProductIds)
    };
  },

  createAccountBMWalletCarryoverSnapshot(source = {}) {
    return {
      diamond: this.toNonNegativeInteger(source?.diamond),
      adSkipTickets: this.toNonNegativeInteger(source?.adSkipTickets),
      peakTimeCoupons: this.toNonNegativeInteger(source?.peakTimeCoupons),
      coffeeTickets: this.toNonNegativeInteger(source?.coffeeTickets)
    };
  },

  applyAccountBMWalletCarryover(carryover = {}) {
    if (!GameState.bm || typeof GameState.bm !== "object") {
      GameState.bm = this.createDefaultBMSnapshot();
    }

    GameState.bm.diamond = Math.max(
      this.toNonNegativeInteger(GameState.bm.diamond),
      this.toNonNegativeInteger(carryover.diamond)
    );
    GameState.bm.adSkipTickets = Math.max(
      this.toNonNegativeInteger(GameState.bm.adSkipTickets),
      this.toNonNegativeInteger(carryover.adSkipTickets)
    );
    GameState.bm.peakTimeCoupons = Math.max(
      this.toNonNegativeInteger(GameState.bm.peakTimeCoupons),
      this.toNonNegativeInteger(carryover.peakTimeCoupons)
    );
    GameState.bm.coffeeTickets = Math.max(
      this.toNonNegativeInteger(GameState.bm.coffeeTickets),
      this.toNonNegativeInteger(carryover.coffeeTickets)
    );

    this.syncBMWalletFromBMSnapshot(GameState.bm);
  },

  applyPaidBMCarryover(carryover = {}) {
    if (!GameState.bm || typeof GameState.bm !== "object") {
      GameState.bm = this.createDefaultBMSnapshot();
    }

    GameState.bm.diamond = this.toNonNegativeInteger(GameState.bm.diamond) + this.toNonNegativeInteger(carryover.diamond);
    GameState.bm.adSkipTickets = this.toNonNegativeInteger(GameState.bm.adSkipTickets) + this.toNonNegativeInteger(carryover.adSkipTickets);
    GameState.bm.peakTimeCoupons = this.toNonNegativeInteger(GameState.bm.peakTimeCoupons) + this.toNonNegativeInteger(carryover.peakTimeCoupons);
    GameState.bm.coffeeTickets = this.toNonNegativeInteger(GameState.bm.coffeeTickets) + this.toNonNegativeInteger(carryover.coffeeTickets);
    GameState.bm.purchasedDiamondProductIds = this.createUniqueStringArray(carryover.purchasedDiamondProductIds);
    GameState.bm.paidWallet = {
      diamond: this.toNonNegativeInteger(carryover.diamond),
      adSkipTickets: this.toNonNegativeInteger(carryover.adSkipTickets),
      peakTimeCoupons: this.toNonNegativeInteger(carryover.peakTimeCoupons),
      coffeeTickets: this.toNonNegativeInteger(carryover.coffeeTickets)
    };
    this.syncBMWalletFromBMSnapshot(GameState.bm);
  },

  createDailyRewardSnapshot() {
    return this.normalizeDailyRewardSnapshot({
      attendance: DailyRewardSystem.readAttendanceState(),
      wallet: DailyRewardSystem.readWallet()
    });
  },

  createDefaultDailyRewardSnapshot() {
    return this.normalizeDailyRewardSnapshot({});
  },

  normalizeDailyRewardSnapshot(snapshot = {}) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const attendanceSource = source.attendance && typeof source.attendance === "object"
      ? source.attendance
      : source;

    return {
      attendance: {
        lastClaimedDateKey: typeof attendanceSource.lastClaimedDateKey === "string" && attendanceSource.lastClaimedDateKey.trim()
          ? attendanceSource.lastClaimedDateKey.trim()
          : null,
        cycleClaimCount: Math.min(7, this.toNonNegativeInteger(attendanceSource.cycleClaimCount)),
        totalClaimCount: this.toNonNegativeInteger(attendanceSource.totalClaimCount),
        cycleNumber: this.toPositiveInteger(attendanceSource.cycleNumber, 1)
      },
      wallet: this.normalizeDailyRewardWalletSnapshot(source.wallet ?? source.bmWallet ?? {})
    };
  },

  normalizeDailyRewardWalletSnapshot(wallet = {}) {
    const source = wallet && typeof wallet === "object" ? wallet : {};

    return {
      diamonds: this.toNonNegativeInteger(source.diamonds),
      coffeeTickets: this.toNonNegativeInteger(source.coffeeTickets),
      adSkipTickets: this.toNonNegativeInteger(source.adSkipTickets),
      peakTimeCoupons: this.toNonNegativeInteger(source.peakTimeCoupons)
    };
  },

  createDefaultRewardClaimsSnapshot() {
    return {
      usedCodes: [],
      claimedCampaigns: {}
    };
  },

  normalizeRewardClaimsSnapshot(snapshot = {}) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    const claimedCampaigns = source.claimedCampaigns && typeof source.claimedCampaigns === "object"
      ? source.claimedCampaigns
      : {};

    return {
      usedCodes: this.createUniqueStringArray(source.usedCodes).map((code) => code.toUpperCase()),
      claimedCampaigns: Object.fromEntries(
        Object.entries(claimedCampaigns)
          .map(([campaignId, count]) => [
            String(campaignId ?? "").trim(),
            this.toNonNegativeInteger(count)
          ])
          .filter(([campaignId, count]) => campaignId && count > 0)
      )
    };
  },

  createDefaultRewardInboxSnapshot() {
    return RewardInboxSystem.createDefaultState();
  },

  normalizeRewardInboxSnapshot(snapshot = {}) {
    return RewardInboxSystem.normalizeState(snapshot);
  },

  createDefaultBMSnapshot() {
    return {
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
    };
  },

  normalizeBMSnapshot(snapshot = {}) {
    const defaults = this.createDefaultBMSnapshot();
    const source = snapshot && typeof snapshot === "object"
      ? snapshot
      : {};
    const staffAbilitySource = source.staffAbilityUpgrade && typeof source.staffAbilityUpgrade === "object"
      ? source.staffAbilityUpgrade
      : defaults.staffAbilityUpgrade;
    const abilities = staffAbilitySource.abilities && typeof staffAbilitySource.abilities === "object"
      ? staffAbilitySource.abilities
      : defaults.staffAbilityUpgrade.abilities;

    return {
      ...defaults,
      diamond: this.toNonNegativeInteger(source.diamond),
      adSkipTickets: this.toNonNegativeInteger(source.adSkipTickets),
      peakTimeCoupons: this.toNonNegativeInteger(source.peakTimeCoupons),
      coffeeTickets: this.toNonNegativeInteger(source.coffeeTickets),
      ownedContractProductIds: this.createUniqueStringArray(source.ownedContractProductIds).length > 0
        ? this.createUniqueStringArray(source.ownedContractProductIds)
        : [...defaults.ownedContractProductIds],
      shopUnlockedContractProductIds: this.createUniqueStringArray(source.shopUnlockedContractProductIds),
      purchasedPremiumProductIds: this.createUniqueStringArray(source.purchasedPremiumProductIds),
      lastContractUnlockDay: this.toNullablePositiveInteger(source.lastContractUnlockDay),
      contractSkipUsedDay: this.toNullablePositiveInteger(source.contractSkipUsedDay),
      peakCouponUsedDay: this.toNullablePositiveInteger(source.peakCouponUsedDay),
      peakCouponActive: source.peakCouponActive === true,
      peakCouponMultiplier: Number(source.peakCouponMultiplier) > 0 ? Number(source.peakCouponMultiplier) : 1,
      freeRechargeClaims: source.freeRechargeClaims && typeof source.freeRechargeClaims === "object" ? this.deepClone(source.freeRechargeClaims) : {},
      peakCouponDiscountDay: this.toNullablePositiveInteger(source.peakCouponDiscountDay),
      peakCouponDiscountUsedDay: this.toNullablePositiveInteger(source.peakCouponDiscountUsedDay),
      purchasedDiamondProductIds: this.createUniqueStringArray(source.purchasedDiamondProductIds),
      paidWallet: {
        diamond: this.toNonNegativeInteger(source.paidWallet?.diamond),
        adSkipTickets: this.toNonNegativeInteger(source.paidWallet?.adSkipTickets),
        peakTimeCoupons: this.toNonNegativeInteger(source.paidWallet?.peakTimeCoupons),
        coffeeTickets: this.toNonNegativeInteger(source.paidWallet?.coffeeTickets)
      },
      warehouseLevel: Math.min(5, this.toNonNegativeInteger(source.warehouseLevel)),
      pendingWarehouseUpgrade: source.pendingWarehouseUpgrade && typeof source.pendingWarehouseUpgrade === "object" ? this.deepClone(source.pendingWarehouseUpgrade) : null,
      shelfUpgradeLevels: this.normalizeLevelMap(source.shelfUpgradeLevels, 5),
      productUpgradeLevels: this.normalizeLevelMap(source.productUpgradeLevels, 5),
      staffAbilityUpgrade: {
        totalCount: this.toNonNegativeInteger(staffAbilitySource.totalCount),
        lastUpgradeDay: this.toNullablePositiveInteger(staffAbilitySource.lastUpgradeDay),
        abilities: {
          warehouse: this.toNonNegativeInteger(abilities.warehouse),
          shelf: this.toNonNegativeInteger(abilities.shelf),
          cleaning: this.toNonNegativeInteger(abilities.cleaning)
        }
      }
    };
  },

  normalizeLevelMap(source = {}, maxLevel = 5) {
    if (!source || typeof source !== "object") {
      return {};
    }

    return Object.entries(source).reduce((normalized, [rawKey, rawValue]) => {
      const key = String(rawKey ?? "").trim();
      const level = Math.min(maxLevel, this.toNonNegativeInteger(rawValue));

      if (key && level > 0) {
        normalized[key] = level;
      }

      return normalized;
    }, {});
  },

  syncBMWalletFromBMSnapshot(bm = {}) {
    GameState.bmWallet = {
      diamonds: this.toNonNegativeInteger(bm.diamond),
      adSkipTickets: this.toNonNegativeInteger(bm.adSkipTickets),
      peakTimeCoupons: this.toNonNegativeInteger(bm.peakTimeCoupons),
      coffeeTickets: this.toNonNegativeInteger(bm.coffeeTickets)
    };

    return GameState.bmWallet;
  },

  createDefaultSanitationSnapshot() {
    return {
      value: 100,
      status: "clean",
      isCleaningNeeded: false,
      isCleaning: false,
      warningArmed: false,
      cleaningDurationMs: 5000,
      warningThreshold: 50,
      dirtyZoneId: null,
      dirtySpotId: null,
      activeCleaningPoint: null,
      settlementPenalty: -5,
      processedDisruptionKeys: []
    };
  },

  normalizeSanitationSnapshot(snapshot = {}) {
    const defaults = this.createDefaultSanitationSnapshot();
    const source = snapshot && typeof snapshot === "object"
      ? snapshot
      : {};
    const value = this.clampStat(source.value, defaults.value);
    const warningThreshold = this.clampStat(source.warningThreshold, defaults.warningThreshold);
    const status = source.status ?? (
      value === 0
        ? "critical"
        : value <= warningThreshold
          ? "warning"
          : value <= 79
            ? "normal"
            : "clean"
    );

    return {
      ...defaults,
      value,
      status,
      isCleaningNeeded: source.isCleaningNeeded === true || value < 100,
      isCleaning: false,
      warningArmed: source.warningArmed === true,
      cleaningDurationMs: this.toPositiveInteger(source.cleaningDurationMs, defaults.cleaningDurationMs),
      warningThreshold,
      dirtyZoneId: source.dirtyZoneId ?? source.activeCleaningPoint?.zoneId ?? defaults.dirtyZoneId ?? null,
      dirtySpotId: source.dirtySpotId ?? source.activeCleaningPoint?.id ?? defaults.dirtySpotId ?? null,
      activeCleaningPoint: source.activeCleaningPoint ? this.deepClone(source.activeCleaningPoint) : null,
      settlementPenalty: Number.isFinite(Number(source.settlementPenalty))
        ? Math.floor(Number(source.settlementPenalty))
        : defaults.settlementPenalty,
      processedDisruptionKeys: this.createUniqueStringArray(source.processedDisruptionKeys).slice(-30)
    };
  },

  isMeaningfulSaveData(saveData = {}) {
    const gameState = saveData.gameState ?? {};
    const inventory = saveData.inventory ?? {};
    const expansion = saveData.expansion ?? {};
    const bm = gameState.bm ?? {};
    const sanitation = this.normalizeSanitationSnapshot(gameState.sanitation);
    const todayStats = gameState.todayStats ?? {};
    const orderSnapshot = this.normalizeOrderSnapshot(saveData.order ?? gameState.orderSnapshot ?? {});
    const shelfStocks = this.normalizeShelfStocksSnapshot(saveData.shelfStocks ?? gameState.shelfStocks ?? {});
    const unlockedZoneIds = Array.isArray(expansion.unlockedZoneIds)
      ? expansion.unlockedZoneIds
      : Array.isArray(gameState.expansion?.unlockedZoneIds)
        ? gameState.expansion.unlockedZoneIds
        : [];

    const phase = gameState.phase ?? GAME_PHASE.READY;
    const day = this.toPositiveInteger(gameState.day, 1);
    const money = this.toNonNegativeInteger(gameState.money);
    const hasInventoryLots = Array.isArray(inventory.lots) && inventory.lots.some((lot) => {
      return lot && this.toNonNegativeInteger(lot.quantity) > 0;
    });
    const hasUpgrades = Array.isArray(gameState.upgrades) && gameState.upgrades.length > 0;
    const hasExpandedStore = unlockedZoneIds.some((zoneId) => zoneId && zoneId !== "zone_basic");
    const hasBMProgress = this.hasBMProgress(bm);
    const hasDailyRewardProgress = this.hasDailyRewardProgress(gameState.dailyReward);
    const hasRewardClaimsProgress = this.hasRewardClaimsProgress(gameState.rewardClaims);
    const hasRewardInboxProgress = this.hasRewardInboxProgress(gameState.rewardInbox);
    const hasTodayProgress = Object.values(todayStats).some((value) => {
      return Number.isFinite(Number(value)) && Number(value) !== 0;
    });
    const hasPendingOrder = orderSnapshot.pendingDelivery !== null;
    const hasShelfStockProgress = Object.values(shelfStocks).some((stock) => {
      return Object.values(stock.products ?? {}).some((productStock) => {
        return this.toNonNegativeInteger(productStock.currentStock) > 0;
      });
    });
    const hasSanitationProgress =
      sanitation.value !== 100 ||
      sanitation.isCleaningNeeded === true ||
      sanitation.processedDisruptionKeys.length > 0;

    return (
      day > 1 ||
      phase !== GAME_PHASE.READY ||
      money !== GAME_CONFIG.START_MONEY ||
      hasInventoryLots ||
      hasUpgrades ||
      hasExpandedStore ||
      hasBMProgress ||
      hasDailyRewardProgress ||
      hasRewardClaimsProgress ||
      hasRewardInboxProgress ||
      hasPendingOrder ||
      hasShelfStockProgress ||
      hasSanitationProgress ||
      hasTodayProgress
    );
  },

  hasBMProgress(snapshot = {}) {
    const bm = this.normalizeBMSnapshot(snapshot);
    const ownedProductIds = bm.ownedContractProductIds.filter((productId) => {
      return !BASIC_BM_PRODUCT_IDS.includes(productId);
    });

    return (
      bm.diamond > 0 ||
      bm.adSkipTickets > 0 ||
      bm.peakTimeCoupons > 0 ||
      bm.coffeeTickets > 0 ||
      ownedProductIds.length > 0 ||
      bm.purchasedPremiumProductIds.length > 0 ||
      bm.purchasedDiamondProductIds.length > 0 ||
      bm.contractSkipUsedDay !== null ||
      bm.peakCouponUsedDay !== null ||
      bm.peakCouponActive === true ||
      bm.peakCouponDiscountDay !== null ||
      bm.warehouseLevel > 0 ||
      bm.pendingWarehouseUpgrade !== null ||
      Object.keys(bm.shelfUpgradeLevels).length > 0 ||
      Object.keys(bm.productUpgradeLevels).length > 0 ||
      bm.staffAbilityUpgrade.totalCount > 0 ||
      Object.values(bm.paidWallet).some((value) => this.toNonNegativeInteger(value) > 0)
    );
  },

  hasDailyRewardProgress(snapshot = {}) {
    const dailyReward = this.normalizeDailyRewardSnapshot(snapshot);
    const attendance = dailyReward.attendance;
    const wallet = dailyReward.wallet;

    return (
      attendance.lastClaimedDateKey !== null ||
      attendance.cycleClaimCount > 0 ||
      attendance.totalClaimCount > 0 ||
      attendance.cycleNumber > 1 ||
      Object.values(wallet).some((value) => this.toNonNegativeInteger(value) > 0)
    );
  },

  hasRewardClaimsProgress(snapshot = {}) {
    const claims = this.normalizeRewardClaimsSnapshot(snapshot);

    return (
      claims.usedCodes.length > 0 ||
      Object.keys(claims.claimedCampaigns).length > 0
    );
  },

  hasRewardInboxProgress(snapshot = {}) {
    const inbox = this.normalizeRewardInboxSnapshot(snapshot);

    return (
      inbox.rewards.length > 0 ||
      Object.keys(inbox.items).length > 0
    );
  },

  validateSaveData(saveData) {
    if (!saveData.gameState || typeof saveData.gameState !== "object") {
      return {
        isValid: false,
        reason: "missing_game_state",
        message: "저장 데이터에 게임 상태가 없습니다."
      };
    }

    return {
      isValid: true,
      reason: null,
      message: "저장 데이터가 정상입니다."
    };
  },

  readSettings() {
    if (!this.canUseLocalStorage()) {
      return {};
    }

    try {
      const rawData = window.localStorage.getItem(SETTINGS_KEY);

      if (!rawData) {
        return {};
      }

      return JSON.parse(rawData) ?? {};
    } catch (error) {
      console.warn("[SaveSystem] 설정 데이터 파싱 실패. 기본값을 사용합니다.", error);
      return {};
    }
  },

  deepClone(value) {
    if (value === undefined || value === null) {
      return value;
    }

    return JSON.parse(JSON.stringify(value));
  },

  toPositiveInteger(value, fallback = 1) {
    const numberValue = Math.floor(Number(value));

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return fallback;
    }

    return numberValue;
  },

  toNonNegativeInteger(value) {
    const numberValue = Math.floor(Number(value));

    if (!Number.isFinite(numberValue) || numberValue < 0) {
      return 0;
    }

    return numberValue;
  },

  toNullablePositiveInteger(value) {
    const numberValue = Math.floor(Number(value));

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }

    return numberValue;
  },

  createUniqueStringArray(values = []) {
    if (!Array.isArray(values)) {
      return [];
    }

    return [...new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )];
  },

  clampStat(value, fallback = 100) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return fallback;
    }

    return Math.max(0, Math.min(100, Math.floor(numberValue)));
  }
};
