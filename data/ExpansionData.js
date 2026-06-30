/*
  ExpansionData.js

  역할:
  - 매장 확장 구역 데이터 관리
  - 확장 비용, 필요 Day, 이전 구역 조건 정의

  규칙:
  - 실제 Date 사용 금지
  - 모든 확장 조건은 GameState.day 기준 Day 단위로 정의
*/

const createExpansionZone = (zone) => {
  return Object.freeze({
    ...zone
  });
};

export const EXPANSION_ZONES = Object.freeze([
  createExpansionZone({
    id: "zone_basic",
    level: 1,
    name: "Lv.1 먼지 나는 단칸 편의점",
    unlockCost: 0,
    requiredDay: 1,
    previousZoneId: null,
    defaultUnlocked: true,
    description: "처음 인수한 작은 편의점입니다.",
    scene: {
      mapX: 6,
      mapY: 44,
      mapWidth: 42,
      mapHeight: 30,
      depth: 1,
      icon: "🏪",
      mapLabel: "기본 매장",
      objectLabel: "운영 중인 매장"
    },
    movementBounds: [
      {
        id: "basic_floor",
        x: 0.02,
        y: 0.08,
        width: 0.84,
        height: 0.84
      }
    ],
    customerZones: ["door", "shelf", "counter", "exit"],
    effects: {
      customerSpawnRateBonus: 0,
      targetRevenueBonus: 0,
      storeSizeBonus: 1
    }
  }),
  createExpansionZone({
    id: "zone_extra_shelf",
    level: 2,
    name: "Lv.2 추가 진열 구역",
    unlockCost: 30000,
    requiredDay: 2,
    previousZoneId: "zone_basic",
    defaultUnlocked: false,
    description: "낡은 박스를 치우고 추가 진열대를 둘 수 있는 공간입니다.",
    scene: {
      mapX: 14,
      mapY: 18,
      mapWidth: 28,
      mapHeight: 24,
      depth: 2,
      icon: "🧃",
      mapLabel: "추가 진열",
      objectLabel: "추가 진열대"
    },
    movementBounds: [
      {
        id: "extra_shelf_floor",
        x: 0.04,
        y: 0.14,
        width: 0.36,
        height: 0.36
      }
    ],
    customerZones: ["shelf"],
    effects: {
      customerSpawnRateBonus: 0.1,
      targetRevenueBonus: 5000,
      storeSizeBonus: 1
    }
  }),
  createExpansionZone({
    id: "zone_cold_food",
    level: 3,
    name: "Lv.3 냉장·도시락 구역",
    unlockCost: 80000,
    requiredDay: 4,
    previousZoneId: "zone_extra_shelf",
    defaultUnlocked: false,
    description: "냉장 상품과 도시락을 더 많이 운영할 수 있는 공간입니다.",
    scene: {
      mapX: 42,
      mapY: 14,
      mapWidth: 30,
      mapHeight: 26,
      depth: 3,
      icon: "❄️",
      mapLabel: "냉장·도시락",
      objectLabel: "냉장 매대"
    },
    movementBounds: [
      {
        id: "cold_food_floor",
        x: 0.36,
        y: 0.12,
        width: 0.34,
        height: 0.34
      }
    ],
    customerZones: ["shelf"],
    effects: {
      customerSpawnRateBonus: 0.15,
      targetRevenueBonus: 10000,
      storeSizeBonus: 1
    }
  }),
  createExpansionZone({
    id: "zone_premium_store",
    level: 4,
    name: "Lv.4 프리미엄 매장 구역",
    unlockCost: 150000,
    requiredDay: 6,
    previousZoneId: "zone_cold_food",
    defaultUnlocked: false,
    description: "세계 1등 편의점으로 가기 위한 프리미엄 공간입니다.",
    isFinalGoal: true,
    endingTitle: "세계 1등 편의점 달성!",
    endingDescription: "먼지 나는 작은 편의점이 세계 최고의 K-편의점으로 성장했습니다.",
    scene: {
      mapX: 68,
      mapY: 38,
      mapWidth: 26,
      mapHeight: 34,
      depth: 4,
      icon: "⭐",
      mapLabel: "프리미엄",
      objectLabel: "프리미엄 구역"
    },
    movementBounds: [
      {
        id: "premium_floor",
        x: 0.78,
        y: 0.20,
        width: 0.20,
        height: 0.62
      }
    ],
    customerZones: ["counter", "exit"],
    effects: {
      customerSpawnRateBonus: 0.25,
      targetRevenueBonus: 20000,
      storeSizeBonus: 1
    }
  })
]);

export function getExpansionZoneById(zoneId) {
  return EXPANSION_ZONES.find((zone) => zone.id === zoneId) ?? null;
}

export function getPreviousExpansionZone(zone) {
  if (!zone?.previousZoneId) {
    return null;
  }

  return getExpansionZoneById(zone.previousZoneId);
}
