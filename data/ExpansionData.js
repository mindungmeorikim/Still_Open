/*
  ExpansionData.js

  역할:
  - 매장 확장 구역 데이터 관리
  - 확장 비용, 필요 Day, 이전 구역 조건 정의
  - v6.0 월드맵 카메라 배치 좌표/에셋 경로 정의

  규칙:
  - 실제 Date 사용 금지
  - 모든 확장 조건은 GameState.day 기준 Day 단위로 정의
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
      worldX: 403,
      worldY: 418,
      worldWidth: 401,
      worldHeight: 210,
      focusZoom: 1.55,
      focusWorldX: 705,
      focusWorldY: 525,
      focusWorldWidth: 560,
      focusWorldHeight: 270,
      focusOffsetX: 24,
      focusOffsetY: 8,
      labelX: 50,
      labelY: 14,
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
        x: 489,
        y: 487,
        width: 282,
        height: 115
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
    constructionDays: 1,
    instantDiamondPrice: 60,
    requiredDay: 2,
    previousZoneId: "zone_basic",
    defaultUnlocked: false,
    description: "낡은 박스를 치우고 추가 진열대를 둘 수 있는 공간입니다.",
    scene: {
      worldX: 403,
      worldY: 222,
      worldWidth: 401,
      worldHeight: 170,
      focusZoom: 1.62,
      focusWorldX: 680,
      focusWorldY: 320,
      focusWorldWidth: 450,
      focusWorldHeight: 230,
      focusOffsetX: 36,
      focusOffsetY: 8,
      labelX: 72,
      labelY: 25,
      popoverAnchorX: 72,
      popoverAnchorY: 27,
      popoverOffsetX: 56,
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
        x: 485,
        y: 290,
        width: 286,
        height: 115
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
    constructionDays: 1,
    instantDiamondPrice: 90,
    requiredDay: 3,
    previousZoneId: "zone_extra_shelf",
    defaultUnlocked: false,
    description: "냉장 상품과 도시락을 더 많이 운영할 수 있는 공간입니다.",
    scene: {
      worldX: 817,
      worldY: 418,
      worldWidth: 401,
      worldHeight: 210,
      focusZoom: 1.55,
      focusWorldX: 1045,
      focusWorldY: 525,
      focusWorldWidth: 500,
      focusWorldHeight: 270,
      focusOffsetX: -8,
      focusOffsetY: 8,
      labelX: 52,
      labelY: 25,
      popoverAnchorX: 52,
      popoverAnchorY: 28,
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
        x: 847,
        y: 487,
        width: 282,
        height: 115
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
    constructionDays: 1,
    instantDiamondPrice: 150,
    requiredDay: 5,
    previousZoneId: "zone_cold_food",
    defaultUnlocked: false,
    description: "세계 1등 편의점으로 가기 위한 프리미엄 공간입니다.",
    isFinalGoal: true,
    endingTitle: "세계 1등 편의점 달성!",
    endingDescription: "먼지 나는 작은 편의점이 세계 최고의 K-편의점으로 성장했습니다.",
    scene: {
      worldX: 817,
      worldY: 222,
      worldWidth: 401,
      worldHeight: 170,
      focusZoom: 1.55,
      focusWorldX: 1060,
      focusWorldY: 320,
      focusWorldWidth: 500,
      focusWorldHeight: 245,
      focusOffsetX: -10,
      focusOffsetY: 8,
      labelX: 54,
      labelY: 24,
      popoverAnchorX: 54,
      popoverAnchorY: 27,
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
        x: 847,
        y: 290,
        width: 282,
        height: 115
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
