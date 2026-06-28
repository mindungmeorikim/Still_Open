/*
  ExpansionSystem.js

  역할:
  - 매장 확장 구역 상태 관리
  - 확장 요청 이벤트를 받아 조건 확인
  - 조건 충족 시 확장 비용 차감 및 구역 해금

  규칙:
  - 다른 시스템 직접 호출 금지
  - GameState.todayStats 직접 수정 금지
  - 재고 증가, 비용 정산, 상품 슬롯 확장 효과 구현 금지
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import {
  EXPANSION_ZONES,
  getExpansionZoneById,
  getPreviousExpansionZone
} from "../data/ExpansionData.js";

export const ExpansionSystem = {
  unlockedZoneIds: new Set(),
  isInitialized: false,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.initializeDefaultZones();

    EventBus.on(EVENTS.EXPANSION_REQUESTED, (data) => {
      this.handleExpansionRequested(data);
    });
  },

  initializeDefaultZones() {
    EXPANSION_ZONES.forEach((zone) => {
      if (zone.defaultUnlocked) {
        this.unlockedZoneIds.add(zone.id);
      }
    });
  },

  handleExpansionRequested(data = {}) {
    const zoneId = data.zoneId;
    const zone = getExpansionZoneById(zoneId);

    if (!zone) {
      this.emitExpansionFailed(null, "존재하지 않는 확장 구역입니다.", "invalid_zone");
      return;
    }

    if (this.unlockedZoneIds.has(zone.id)) {
      this.emitExpansionFailed(zone, "이미 확장 완료된 구역입니다.", "already_unlocked");
      return;
    }

    const check = this.checkExpansionAvailability(zone);

    if (!check.canExpand) {
      this.emitExpansionFailed(zone, check.message, check.reason);
      return;
    }

    GameState.money -= zone.unlockCost;
    this.unlockedZoneIds.add(zone.id);

    const payload = {
      day: GameState.day,
      zoneId: zone.id,
      zoneName: zone.name,
      unlockCost: zone.unlockCost,
      remainingMoney: GameState.money,
      expansionState: this.getExpansionState(),
      message: `${zone.name} 확장 완료! 남은 돈은 ₩${GameState.money.toLocaleString()}입니다.`
    };

    EventBus.emit(EVENTS.EXPANSION_COMPLETED, payload);
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  checkExpansionAvailability(zone) {
    const missingRequirements = [];
    const previousZone = getPreviousExpansionZone(zone);
    const previousUnlocked =
      !previousZone || this.unlockedZoneIds.has(previousZone.id);
    const hasEnoughMoney = GameState.money >= zone.unlockCost;
    const hasRequiredDay = GameState.day >= zone.requiredDay;

    if (!previousUnlocked) {
      missingRequirements.push(`${previousZone.name} 확장 필요`);
    }

    if (!hasRequiredDay) {
      missingRequirements.push(`Day ${zone.requiredDay} 필요`);
    }

    if (!hasEnoughMoney) {
      missingRequirements.push(`₩${zone.unlockCost.toLocaleString()} 필요`);
    }

    if (missingRequirements.length === 0) {
      return {
        canExpand: true,
        reason: "available",
        message: `${zone.name} 확장이 가능합니다.`
      };
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
    const unlockedZoneIds = [...this.unlockedZoneIds];

    return {
      day: GameState.day,
      money: GameState.money,
      unlockedZoneIds,
      zones: EXPANSION_ZONES.map((zone) => {
        return this.createZoneState(zone);
      })
    };
  },

  createZoneState(zone) {
    const previousZone = getPreviousExpansionZone(zone);
    const previousUnlocked =
      !previousZone || this.unlockedZoneIds.has(previousZone.id);
    const hasEnoughMoney = GameState.money >= zone.unlockCost;
    const hasRequiredDay = GameState.day >= zone.requiredDay;
    const isUnlocked = this.unlockedZoneIds.has(zone.id);
    const isAvailable =
      !isUnlocked && previousUnlocked && hasEnoughMoney && hasRequiredDay;

    return {
      ...zone,
      status: isUnlocked ? "unlocked" : isAvailable ? "available" : "locked",
      isUnlocked,
      isAvailable,
      conditions: {
        previousUnlocked,
        hasEnoughMoney,
        hasRequiredDay
      }
    };
  }
};
