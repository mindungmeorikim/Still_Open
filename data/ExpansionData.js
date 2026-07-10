/*
  ExpansionData.js

  역할:
  - 매장 확장 구역 데이터 관리
  - 확장 비용, 필요 Day, 이전 구역 조건 정의
  - v6.0 월드맵 카메라 배치 좌표/에셋 경로 정의

  규칙:
  - 확장 해금 조건(requiredDay)은 GameState.day 기준
  - 공사 대기시간(constructionDurationHours)은 실제 경과 시간 기준
*/

const createExpansionZone = (zone) => {
  return Object.freeze({
    ...zone
  });
};

const WORLD_SIZE = Object.freeze({
  width: 1672,
  height: 941
});

const createMovementBound = ({ id, x, y, width, height }) => {
  return Object.freeze({
    id,
    x: x / WORLD_SIZE.width,
    y: y / WORLD_SIZE.height,
    width: width / WORLD_SIZE.width,
    height: height / WORLD_SIZE.height
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
      worldX: 302,
      worldY: 395,
      worldWidth: 584,
      worldHeight: 273,
      focusZoom: 1.55,
      focusWorldX: 674,
      focusWorldY: 514,
      focusWorldWidth: 610,
      focusWorldHeight: 305,
      focusOffsetX: 0,
      focusOffsetY: 8,
      labelX: 50,
      labelY: 13,
      depth: 1,
      icon: "🏪",
      mapLabel: "기본 매장",
      objectLabel: "운영 중인 매장",
      brightAsset: "./assets/images/world/bright_empty_space/first_empty_space.png",
      darkAsset: null,
      cloudAsset: null,
      lockAsset: null,
      displayConditions: [
        "게임 시작 시 오픈",
        "기본 플레이 구역"
      ]
    },
    movementBounds: [
      createMovementBound({
        id: "basic_floor",
        x: 382,
        y: 462,
        width: 410,
        height: 145
      })
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
    unlockCost: 67500,
    constructionDurationHours: 24,
    instantDiamondPrice: 60,
    requiredDay: 2,
    previousZoneId: "zone_basic",
    defaultUnlocked: false,
    description: "낡은 박스를 치우고 추가 진열대를 둘 수 있는 공간입니다.",
    scene: {
      worldX: 556,
      worldY: 252,
      worldWidth: 480,
      worldHeight: 182,
      focusZoom: 1.62,
      focusWorldX: 796,
      focusWorldY: 309,
      focusWorldWidth: 520,
      focusWorldHeight: 230,
      focusOffsetX: 0,
      focusOffsetY: 6,
      labelX: 50,
      labelY: 14,
      popoverAnchorX: 50,
      popoverAnchorY: 22,
      popoverOffsetX: 0,
      depth: 2,
      icon: "🧃",
      mapLabel: "Lv.2 추가 진열 구역",
      objectLabel: "추가 진열대",
      brightAsset: "./assets/images/world/bright_empty_space/second_empty_space.png",
      darkAsset: null,
      cloudAsset: "./assets/images/world/icon/cloud_icon2.png",
      lockAsset: "./assets/images/world/icon/lock_icon.png",
      displayConditions: [
        "Day 2 달성",
        "67,500골드 필요"
      ]
    },
    movementBounds: [
      createMovementBound({
        id: "extra_shelf_floor",
        x: 630,
        y: 302,
        width: 330,
        height: 92
      })
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
    unlockCost: 135000,
    constructionDurationHours: 24,
    instantDiamondPrice: 90,
    requiredDay: 3,
    previousZoneId: "zone_extra_shelf",
    defaultUnlocked: false,
    description: "냉장 상품과 도시락을 더 많이 운영할 수 있는 공간입니다.",
    scene: {
      worldX: 658,
      worldY: 434,
      worldWidth: 596,
      worldHeight: 284,
      focusZoom: 1.55,
      focusWorldX: 956,
      focusWorldY: 532,
      focusWorldWidth: 630,
      focusWorldHeight: 320,
      focusOffsetX: 0,
      focusOffsetY: 8,
      labelX: 52,
      labelY: 15,
      popoverAnchorX: 52,
      popoverAnchorY: 24,
      depth: 3,
      icon: "❄️",
      mapLabel: "Lv.3 냉장·도시락 구역",
      objectLabel: "냉장·도시락 매대",
      brightAsset: "./assets/images/world/bright_empty_space/third_empty_space.png",
      darkAsset: null,
      cloudAsset: "./assets/images/world/icon/cloud_icon2.png",
      lockAsset: "./assets/images/world/icon/lock_icon.png",
      displayConditions: [
        "Day 3 달성",
        "135,000골드 필요"
      ]
    },
    movementBounds: [
      createMovementBound({
        id: "cold_food_floor",
        x: 742,
        y: 508,
        width: 410,
        height: 150
      })
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
    unlockCost: 270000,
    constructionDurationHours: 24,
    instantDiamondPrice: 150,
    requiredDay: 5,
    previousZoneId: "zone_cold_food",
    defaultUnlocked: false,
    description: "세계 1등 편의점으로 가기 위한 프리미엄 공간입니다.",
    isFinalGoal: true,
    endingTitle: "세계 1등 편의점 달성!",
    endingDescription: "먼지 나는 작은 편의점이 세계 최고의 K-편의점으로 성장했습니다.",
    scene: {
      worldX: 886,
      worldY: 279,
      worldWidth: 506,
      worldHeight: 197,
      focusZoom: 1.55,
      focusWorldX: 1072,
      focusWorldY: 334,
      focusWorldWidth: 545,
      focusWorldHeight: 250,
      focusOffsetX: 0,
      focusOffsetY: 6,
      labelX: 50,
      labelY: 15,
      popoverAnchorX: 50,
      popoverAnchorY: 23,
      depth: 4,
      icon: "⭐",
      mapLabel: "Lv.4 프리미엄 매장 구역",
      objectLabel: "프리미엄 구역",
      brightAsset: "./assets/images/world/bright_empty_space/fourth_empty_space.png",
      darkAsset: null,
      cloudAsset: "./assets/images/world/icon/cloud_icon2.png",
      lockAsset: "./assets/images/world/icon/lock_icon.png",
      displayConditions: [
        "Day 5 달성",
        "270,000골드 필요"
      ]
    },
    movementBounds: [
      createMovementBound({
        id: "premium_floor",
        x: 975,
        y: 326,
        width: 330,
        height: 100
      })
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
