/*
  ExpansionSystem.js
  BM 최종본 기준 구역 확장:
  - 골드 확장 비용은 즉시 지불
  - 공사 시간은 게임 Day와 무관한 실제 시간 24시간
  - 게임 종료/재접속 중에도 타임스탬프 기준으로 시간이 경과
  - 다이아 즉시 완료권은 남은 대기 시간만 제거
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import {
  EXPANSION_ZONES,
  getExpansionZoneById,
  getPreviousExpansionZone
} from "../data/ExpansionData.js";

const EXPANSION_CONSTRUCTION_STARTED = "EXPANSION_CONSTRUCTION_STARTED";
const EXPANSION_TIMER_UPDATED = "EXPANSION_TIMER_UPDATED";
const SAVE_GAME_LOADED = "SAVE_GAME_LOADED";
const DEFAULT_CONSTRUCTION_DURATION_HOURS = 24;
const CONSTRUCTION_TIMER_INTERVAL_MS = 1000;

export const ExpansionSystem = {
  unlockedZoneIds: new Set(),
  isInitialized: false,
  finalEndingMinDay: 6,
  constructionZoneId: null,
  constructionStartedAt: null,
  constructionCompletesAt: null,
  constructionTimerId: null,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.initializeFromGameState();
    this.syncExpansionStateToGameState();

    EventBus.on(EVENTS.EXPANSION_REQUESTED, (data) => this.handleExpansionRequested(data));
    EventBus.on(EVENTS.DAY_STARTED, () => this.checkConstructionClock());
    EventBus.on(SAVE_GAME_LOADED, () => this.handleSaveGameLoaded());

    this.bindConstructionClockResumeEvents();
    this.startConstructionClock();
    this.checkConstructionClock();
  },

  initializeFromGameState() {
    const savedUnlocked = Array.isArray(GameState.expansion?.unlockedZoneIds)
      ? GameState.expansion.unlockedZoneIds
      : EXPANSION_ZONES.filter((zone) => zone.defaultUnlocked).map((zone) => zone.id);

    this.unlockedZoneIds = new Set(savedUnlocked.length > 0 ? savedUnlocked : ["zone_basic"]);
    this.constructionZoneId = GameState.expansion?.constructionZoneId ?? null;
    this.constructionStartedAt = this.toTimestamp(GameState.expansion?.constructionStartedAt);
    this.constructionCompletesAt = this.toTimestamp(GameState.expansion?.constructionCompletesAt);

    this.migrateLegacyConstructionState(GameState.expansion ?? {});

    EXPANSION_ZONES.forEach((zone) => {
      if (zone.defaultUnlocked) this.unlockedZoneIds.add(zone.id);
    });
  },

  handleSaveGameLoaded() {
    this.initializeFromGameState();
    this.syncExpansionStateToGameState();
    this.startConstructionClock();
    this.checkConstructionClock();
  },

  bindConstructionClockResumeEvents() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.checkConstructionClock();
        }
      });
    }

    if (typeof window !== "undefined") {
      window.addEventListener("focus", () => this.checkConstructionClock());
    }
  },

  startConstructionClock() {
    if (this.constructionTimerId) {
      clearInterval(this.constructionTimerId);
    }

    this.constructionTimerId = setInterval(() => {
      this.checkConstructionClock();
    }, CONSTRUCTION_TIMER_INTERVAL_MS);
  },

  checkConstructionClock(now = Date.now()) {
    if (!this.constructionZoneId || !this.constructionCompletesAt) {
      return false;
    }

    if (this.completeConstructionIfDue(now)) {
      return true;
    }

    EventBus.emit(EXPANSION_TIMER_UPDATED, {
      now,
      zoneId: this.constructionZoneId,
      remainingMs: this.getConstructionRemainingMs(now),
      expansionState: this.getExpansionState(now)
    });

    return false;
  },

  handleExpansionRequested(data = {}) {
    const zone = getExpansionZoneById(data.zoneId);
    const instantComplete = data.instantComplete === true;

    if (!zone) {
      this.emitExpansionFailed(null, "존재하지 않는 확장 구역입니다.", "invalid_zone");
      return;
    }

    if (this.unlockedZoneIds.has(zone.id)) {
      this.emitExpansionFailed(zone, "이미 확장 완료된 구역입니다.", "already_unlocked");
      return;
    }

    if (instantComplete) {
      this.handleInstantCompletion(zone);
      return;
    }

    this.startConstruction(zone);
  },

  startConstruction(zone) {
    const check = this.checkExpansionAvailability(zone);
    if (!check.canExpand) {
      this.emitExpansionFailed(zone, check.message, check.reason);
      return;
    }

    const now = Date.now();
    const constructionDurationMs = this.getConstructionDurationMs(zone);

    GameState.money -= zone.unlockCost;
    this.constructionZoneId = zone.id;
    this.constructionStartedAt = now;
    this.constructionCompletesAt = now + constructionDurationMs;
    this.syncExpansionStateToGameState();

    EventBus.emit(EXPANSION_CONSTRUCTION_STARTED, {
      day: GameState.day,
      zoneId: zone.id,
      zoneName: zone.name,
      unlockCost: zone.unlockCost,
      constructionStartedAt: this.constructionStartedAt,
      constructionCompletesAt: this.constructionCompletesAt,
      constructionDurationMs,
      remainingMs: constructionDurationMs,
      instantDiamondPrice: this.getInstantDiamondPrice(zone),
      remainingMoney: GameState.money,
      expansionState: this.getExpansionState(now),
      message: `${zone.name} 공사를 시작합니다. 실제 시간 24시간 후 완료됩니다.`
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handleInstantCompletion(zone) {
    const diamondPrice = this.getInstantDiamondPrice(zone);
    if (!GameState.bm || typeof GameState.bm !== "object") GameState.bm = {};
    GameState.bm.diamond = Math.max(0, Math.floor(Number(GameState.bm.diamond) || 0));

    const isCurrentConstruction = this.constructionZoneId === zone.id;

    if (!isCurrentConstruction) {
      const check = this.checkExpansionAvailability(zone, { ignoreConstruction: true });
      if (!check.canExpand) {
        this.emitExpansionFailed(zone, check.message, check.reason);
        return;
      }
      if (GameState.money < zone.unlockCost) {
        this.emitExpansionFailed(zone, `골드가 부족합니다. 필요 골드: ${zone.unlockCost.toLocaleString("ko-KR")}`, "not_enough_gold");
        return;
      }
    }

    if (GameState.bm.diamond < diamondPrice) {
      this.emitExpansionFailed(zone, `다이아가 부족합니다. 필요 다이아: ${diamondPrice}`, "not_enough_diamond");
      return;
    }

    if (!isCurrentConstruction) {
      GameState.money -= zone.unlockCost;
    }

    GameState.bm.diamond -= diamondPrice;
    this.finishConstruction(zone, {
      instantComplete: true,
      spentDiamond: diamondPrice,
      spentGold: isCurrentConstruction ? 0 : zone.unlockCost
    });
  },

  completeConstructionIfDue(now = Date.now()) {
    if (!this.constructionZoneId || !this.constructionCompletesAt) return false;
    if (now < this.constructionCompletesAt) return false;
    const zone = getExpansionZoneById(this.constructionZoneId);
    if (!zone) return false;
    this.finishConstruction(zone, { autoComplete: true });
    return true;
  },

  finishConstruction(zone, options = {}) {
    if (!zone) return;
    this.constructionZoneId = null;
    this.constructionStartedAt = null;
    this.constructionCompletesAt = null;
    this.unlockedZoneIds.add(zone.id);
    this.syncExpansionStateToGameState();

    const payload = {
      day: GameState.day,
      zoneId: zone.id,
      zoneName: zone.name,
      unlockCost: zone.unlockCost,
      remainingMoney: GameState.money,
      unlockedZoneIds: [...this.unlockedZoneIds],
      movementBounds: this.getUnlockedMovementBounds(),
      customerAccessibleZones: this.getUnlockedCustomerZones(),
      effects: this.getCurrentExpansionEffects(),
      expansionState: this.getExpansionState(),
      instantComplete: options.instantComplete === true,
      spentDiamond: options.spentDiamond ?? 0,
      animation: {
        type: "expansion_unlock_puff",
        zoneId: zone.id
      },
      message: options.instantComplete
        ? `${zone.name} 즉시 확장 완료! 대기 시간이 제거되었습니다.`
        : `${zone.name} 확장 완료! ${this.getExpansionEffectMessage(zone)} 효과 적용.`
    };

    EventBus.emit(EVENTS.EXPANSION_COMPLETED, payload);

    if (zone.isFinalGoal === true && GameState.day >= this.finalEndingMinDay) {
      EventBus.emit(EVENTS.ENDING_ACHIEVED, {
        day: GameState.day,
        zoneId: zone.id,
        zoneName: zone.name,
        endingTitle: zone.endingTitle,
        endingDescription: zone.endingDescription,
        unlockedZoneIds: [...this.unlockedZoneIds],
        effects: this.getCurrentExpansionEffects()
      });
    }

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  checkExpansionAvailability(zone, options = {}) {
    const missingRequirements = [];
    const previousZone = getPreviousExpansionZone(zone);
    const previousUnlocked = !previousZone || this.unlockedZoneIds.has(previousZone.id);
    const hasEnoughMoney = GameState.money >= zone.unlockCost;
    const hasRequiredDay = GameState.day >= zone.requiredDay;

    if (!previousUnlocked) missingRequirements.push(`${previousZone.name} 확장 필요`);
    if (!hasRequiredDay) missingRequirements.push(`Day ${zone.requiredDay} 필요`);
    if (!hasEnoughMoney) missingRequirements.push(`₩${zone.unlockCost.toLocaleString()} 필요`);

    if (this.constructionZoneId && options.ignoreConstruction !== true) {
      return {
        canExpand: false,
        reason: "construction_in_progress",
        message: "다른 구역 공사가 진행 중입니다. 즉시 완료 후 다시 시도해주세요."
      };
    }

    if (missingRequirements.length === 0) {
      return { canExpand: true, reason: "available", message: `${zone.name} 확장이 가능합니다.` };
    }

    return {
      canExpand: false,
      reason: "requirements_not_met",
      message: `${zone.name} 확장 조건 부족: ${missingRequirements.join(" / ")}`
    };
  },

  emitExpansionFailed(zone, message, reason) {
    EventBus.emit(EVENTS.EXPANSION_FAILED, {
      day: GameState.day,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? "",
      reason,
      expansionState: this.getExpansionState(),
      message
    });
  },

  getExpansionState(now = Date.now()) {
    return {
      day: GameState.day,
      money: GameState.money,
      diamond: Math.max(0, Math.floor(Number(GameState.bm?.diamond) || 0)),
      unlockedZoneIds: [...this.unlockedZoneIds],
      movementBounds: this.getUnlockedMovementBounds(),
      customerAccessibleZones: this.getUnlockedCustomerZones(),
      effects: this.getCurrentExpansionEffects(),
      constructionZoneId: this.constructionZoneId,
      constructionStartedAt: this.constructionStartedAt,
      constructionCompletesAt: this.constructionCompletesAt,
      constructionRemainingMs: this.getConstructionRemainingMs(now),
      zones: EXPANSION_ZONES.map((zone) => this.createZoneState(zone, now))
    };
  },

  getUnlockedZones() {
    return EXPANSION_ZONES.filter((zone) => this.unlockedZoneIds.has(zone.id));
  },

  getCurrentExpansionEffects() {
    return this.getUnlockedZones().reduce((total, zone) => {
      const effects = zone.effects ?? {};
      return {
        customerSpawnRateBonus: total.customerSpawnRateBonus + this.toNumber(effects.customerSpawnRateBonus),
        targetRevenueBonus: total.targetRevenueBonus + this.toNumber(effects.targetRevenueBonus),
        storeSizeBonus: total.storeSizeBonus + this.toNumber(effects.storeSizeBonus)
      };
    }, this.createEmptyExpansionEffects());
  },

  createExpansionEffectPayload() {
    return {
      day: GameState.day,
      unlockedZoneIds: [...this.unlockedZoneIds],
      movementBounds: this.getUnlockedMovementBounds(),
      customerAccessibleZones: this.getUnlockedCustomerZones(),
      effects: this.getCurrentExpansionEffects()
    };
  },

  syncExpansionStateToGameState() {
    if (!GameState.expansion) GameState.expansion = {};
    GameState.expansion.unlockedZoneIds = [...this.unlockedZoneIds];
    GameState.expansion.movementBounds = this.getUnlockedMovementBounds();
    GameState.expansion.customerAccessibleZones = this.getUnlockedCustomerZones();
    GameState.expansion.constructionZoneId = this.constructionZoneId;
    GameState.expansion.constructionStartedAt = this.constructionStartedAt;
    GameState.expansion.constructionCompletesAt = this.constructionCompletesAt;
    delete GameState.expansion.constructionStartDay;
    delete GameState.expansion.constructionCompleteDay;
  },

  createZoneState(zone, now = Date.now()) {
    const previousZone = getPreviousExpansionZone(zone);
    const previousUnlocked = !previousZone || this.unlockedZoneIds.has(previousZone.id);
    const isUnlocked = this.unlockedZoneIds.has(zone.id);
    const isConstructing = this.constructionZoneId === zone.id;
    const hasEnoughMoney = GameState.money >= zone.unlockCost;
    const hasRequiredDay = GameState.day >= zone.requiredDay;

    return {
      ...zone,
      isUnlocked,
      isConstructing,
      isAvailable: !isUnlocked && !this.constructionZoneId && previousUnlocked && hasEnoughMoney && hasRequiredDay,
      previousZoneName: previousZone?.name ?? "없음",
      constructionStartedAt: isConstructing ? this.constructionStartedAt : null,
      constructionCompletesAt: isConstructing ? this.constructionCompletesAt : null,
      constructionRemainingMs: isConstructing ? this.getConstructionRemainingMs(now) : 0,
      instantDiamondPrice: this.getInstantDiamondPrice(zone),
      conditions: { previousUnlocked, hasEnoughMoney, hasRequiredDay }
    };
  },

  migrateLegacyConstructionState(expansionState = {}) {
    if (!this.constructionZoneId) {
      this.constructionStartedAt = null;
      this.constructionCompletesAt = null;
      return;
    }

    if (this.constructionStartedAt && this.constructionCompletesAt) {
      return;
    }

    const zone = getExpansionZoneById(this.constructionZoneId);
    const now = Date.now();

    this.constructionStartedAt = now;
    this.constructionCompletesAt = now + this.getConstructionDurationMs(zone);

    if (expansionState.constructionStartDay || expansionState.constructionCompleteDay) {
      console.info("[ExpansionSystem] 구버전 Day 기반 공사 데이터를 실제 24시간 타이머로 전환했습니다.");
    }
  },

  getConstructionDurationMs(zone) {
    const hours = Math.max(
      1,
      Number(zone?.constructionDurationHours) || DEFAULT_CONSTRUCTION_DURATION_HOURS
    );

    return Math.round(hours * 60 * 60 * 1000);
  },

  getConstructionRemainingMs(now = Date.now()) {
    if (!this.constructionZoneId || !this.constructionCompletesAt) {
      return 0;
    }

    return Math.max(0, this.constructionCompletesAt - now);
  },

  toTimestamp(value) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0 ? Math.floor(timestamp) : null;
  },

  getUnlockedMovementBounds() {
    return this.getUnlockedZones().flatMap((zone) => zone.movementBounds ?? []);
  },

  getUnlockedCustomerZones() {
    return [...new Set(this.getUnlockedZones().flatMap((zone) => zone.customerZones ?? []))];
  },

  getExpansionEffectMessage(zone) {
    const effects = zone.effects ?? {};
    const messages = [];
    if (effects.customerSpawnRateBonus) messages.push(`손님 방문 +${Math.round(effects.customerSpawnRateBonus * 100)}%`);
    if (effects.targetRevenueBonus) messages.push(`목표 매출 +₩${effects.targetRevenueBonus.toLocaleString()}`);
    if (effects.storeSizeBonus) messages.push(`매장 규모 +${effects.storeSizeBonus}`);
    return messages.length > 0 ? messages.join(" / ") : "기본 구역 확장";
  },

  getInstantDiamondPrice(zone) {
    return Math.max(0, Math.floor(Number(zone?.instantDiamondPrice) || 0));
  },

  createEmptyExpansionEffects() {
    return { customerSpawnRateBonus: 0, targetRevenueBonus: 0, storeSizeBonus: 0 };
  },

  toNumber(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  },

  toDay(value, fallback = GameState.day) {
    const day = Math.floor(Number(value));
    return Number.isFinite(day) && day >= 1 ? day : fallback;
  }
};
