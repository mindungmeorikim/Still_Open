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

const SAVE_KEY = "today_normal_open_save_v1";
const SETTINGS_KEY = "today_normal_open_settings_v1";
const SAVE_VERSION = "v7.0.1";
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

    EventBus.on(EVENTS.EXPANSION_COMPLETED, () => {
      this.requestAutosave("expansion_completed");
    });

    EventBus.on(EVENTS.UPGRADE_SELECTED, () => {
      this.requestAutosave("upgrade_selected");
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

  saveNow(reason = "manual") {
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

    if (!this.canAutosaveCurrentPhase()) {
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
    this.clearSaveData();
    this.isResettingNewGame = true;

    this.applyGameStateSnapshot(this.createDefaultGameStateSnapshot());
    this.applyInventorySnapshot({ lots: [], lotSequence: 0, initializedProductIds: [] });
    this.applyExpansionSnapshot({ unlockedZoneIds: ["zone_basic"], constructionZoneId: null });

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

    this.applyGameStateSnapshot(this.createInfiniteModeStartSnapshot());
    this.applyInventorySnapshot(this.createInfiniteModeStartInventorySnapshot());
    this.applyExpansionSnapshot({
      unlockedZoneIds: ["zone_basic"],
      constructionZoneId: null
    });

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
      bm: this.normalizeBMSnapshot(GameState.bm),
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
        targetRevenue: 30000,
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
      bm: this.createDefaultBMSnapshot(),
      staff: null,
      player: {
        x: 600,
        y: 705,
        speed: 4
      },
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
      targetRevenue: 100000 + extraDay * 25000,
      targetSatisfaction: Math.min(90, 78 + extraDay)
    };
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
      bmBonus: 0
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
      constructionZoneId: ExpansionSystem.constructionZoneId ?? null
    };
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
    GameState.dailyGoal = this.deepClone(nextState.dailyGoal ?? defaultSnapshot.dailyGoal);
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
    GameState.bm = this.normalizeBMSnapshot(nextState.bm ?? defaultSnapshot.bm);
    GameState.expansion = this.deepClone(nextState.expansion ?? defaultSnapshot.expansion);
    GameState.player = this.deepClone(nextState.player ?? defaultSnapshot.player);

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

    if (typeof ExpansionSystem.syncExpansionStateToGameState === "function") {
      ExpansionSystem.syncExpansionStateToGameState();
    }
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

  createDefaultBMSnapshot() {
    return {
      diamond: 0,
      ownedContractProductIds: [],
      shopUnlockedContractProductIds: [],
      purchasedPremiumProductIds: [],
      lastContractUnlockDay: null,
      contractSkipUsedDay: null,
      peakCouponUsedDay: null,
      mentalRecoveryAdUsedDay: null,
      peakCouponActive: false,
      peakCouponMultiplier: 1
    };
  },

  normalizeBMSnapshot(snapshot = {}) {
    const source = snapshot && typeof snapshot === "object"
      ? snapshot
      : {};

    return {
      diamond: this.toNonNegativeInteger(source.diamond),
      ownedContractProductIds: this.createUniqueStringArray(source.ownedContractProductIds),
      shopUnlockedContractProductIds: this.createUniqueStringArray(source.shopUnlockedContractProductIds),
      purchasedPremiumProductIds: this.createUniqueStringArray(source.purchasedPremiumProductIds),
      lastContractUnlockDay: this.toNullablePositiveInteger(source.lastContractUnlockDay),
      contractSkipUsedDay: this.toNullablePositiveInteger(source.contractSkipUsedDay),
      peakCouponUsedDay: this.toNullablePositiveInteger(source.peakCouponUsedDay),
      mentalRecoveryAdUsedDay: this.toNullablePositiveInteger(source.mentalRecoveryAdUsedDay),
      peakCouponActive: source.peakCouponActive === true,
      peakCouponMultiplier: Number(source.peakCouponMultiplier) > 0
        ? Number(source.peakCouponMultiplier)
        : 1
    };
  },


  isMeaningfulSaveData(saveData = {}) {
    const gameState = saveData.gameState ?? {};
    const inventory = saveData.inventory ?? {};
    const expansion = saveData.expansion ?? {};
    const bm = gameState.bm ?? {};
    const todayStats = gameState.todayStats ?? {};
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
    const hasTodayProgress = Object.values(todayStats).some((value) => {
      return Number.isFinite(Number(value)) && Number(value) !== 0;
    });

    return (
      day > 1 ||
      phase !== GAME_PHASE.READY ||
      money !== GAME_CONFIG.START_MONEY ||
      hasInventoryLots ||
      hasUpgrades ||
      hasExpandedStore ||
      hasBMProgress ||
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
      ownedProductIds.length > 0 ||
      bm.purchasedPremiumProductIds.length > 0 ||
      bm.contractSkipUsedDay !== null ||
      bm.peakCouponUsedDay !== null ||
      bm.mentalRecoveryAdUsedDay !== null ||
      bm.peakCouponActive === true
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
