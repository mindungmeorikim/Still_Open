/*
  ExpansionSystem.js
  BM 최종본 기준 구역 확장:
  - 골드 확장 비용은 즉시 지불
  - 24시간 대기 = 게임 내 1 Day 대기
  - 다이아 즉시 완료권은 대기 시간만 제거
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

export const ExpansionSystem = {
  unlockedZoneIds: new Set(),
  isInitialized: false,
  finalEndingMinDay: 6,
  constructionZoneId: null,
  constructionStartDay: null,
  constructionCompleteDay: null,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.initializeFromGameState();
    this.syncExpansionStateToGameState();

    EventBus.on(EVENTS.EXPANSION_REQUESTED, (data) => this.handleExpansionRequested(data));
    EventBus.on(EVENTS.DAY_STARTED, (data = {}) => this.handleDayStarted(data));
  },

  initializeFromGameState() {
    const savedUnlocked = Array.isArray(GameState.expansion?.unlockedZoneIds)
      ? GameState.expansion.unlockedZoneIds
      : EXPANSION_ZONES.filter((zone) => zone.defaultUnlocked).map((zone) => zone.id);

    this.unlockedZoneIds = new Set(savedUnlocked.length > 0 ? savedUnlocked : ["zone_basic"]);
    this.constructionZoneId = GameState.expansion?.constructionZoneId ?? null;
    this.constructionStartDay = GameState.expansion?.constructionStartDay ?? null;
    this.constructionCompleteDay = GameState.expansion?.constructionCompleteDay ?? null;

    EXPANSION_ZONES.forEach((zone) => {
      if (zone.defaultUnlocked) this.unlockedZoneIds.add(zone.id);
    });
  },

  handleDayStarted(data = {}) {
    const day = this.toDay(data.day, GameState.day);
    this.completeConstructionIfDue(day);
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

    GameState.money -= zone.unlockCost;
    this.constructionZoneId = zone.id;
    this.constructionStartDay = GameState.day;
    this.constructionCompleteDay = GameState.day + Math.max(1, Math.floor(Number(zone.constructionDays) || 1));
    this.syncExpansionStateToGameState();

    EventBus.emit(EXPANSION_CONSTRUCTION_STARTED, {
      day: GameState.day,
      zoneId: zone.id,
      zoneName: zone.name,
      unlockCost: zone.unlockCost,
      constructionCompleteDay: this.constructionCompleteDay,
      instantDiamondPrice: this.getInstantDiamondPrice(zone),
      remainingMoney: GameState.money,
      expansionState: this.getExpansionState(),
      message: `${zone.name} 공사를 시작합니다. Day ${this.constructionCompleteDay}에 완료됩니다.`
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

  completeConstructionIfDue(day = GameState.day) {
    if (!this.constructionZoneId || !this.constructionCompleteDay) return false;
    if (day < this.constructionCompleteDay) return false;
    const zone = getExpansionZoneById(this.constructionZoneId);
    if (!zone) return false;
    this.finishConstruction(zone, { autoComplete: true });
    return true;
  },

  finishConstruction(zone, options = {}) {
    if (!zone) return;
    this.constructionZoneId = null;
    this.constructionStartDay = null;
    this.constructionCompleteDay = null;
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

  getExpansionState() {
    return {
      day: GameState.day,
      money: GameState.money,
      diamond: Math.max(0, Math.floor(Number(GameState.bm?.diamond) || 0)),
      unlockedZoneIds: [...this.unlockedZoneIds],
      movementBounds: this.getUnlockedMovementBounds(),
      customerAccessibleZones: this.getUnlockedCustomerZones(),
      effects: this.getCurrentExpansionEffects(),
      constructionZoneId: this.constructionZoneId,
      constructionStartDay: this.constructionStartDay,
      constructionCompleteDay: this.constructionCompleteDay,
      zones: EXPANSION_ZONES.map((zone) => this.createZoneState(zone))
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
    GameState.expansion.constructionStartDay = this.constructionStartDay;
    GameState.expansion.constructionCompleteDay = this.constructionCompleteDay;
  },

  createZoneState(zone) {
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
      constructionCompleteDay: isConstructing ? this.constructionCompleteDay : null,
      instantDiamondPrice: this.getInstantDiamondPrice(zone),
      conditions: { previousUnlocked, hasEnoughMoney, hasRequiredDay }
    };
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
