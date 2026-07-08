import { STOCK_VISUAL_OBJECT_TYPES } from "./AssetData.js";
import { SHELF_INSTANCES } from "./ShelfPlacementData.js";

const OBJECT_TYPE_COLLISION_PRESETS = Object.freeze({
  [STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND]: {
    widthRatio: 0.6,
    heightRatio: 0.6,
    offsetX: -50,
    offsetY: -20
  },

  [STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE]: {
    widthRatio: 0.4,
    heightRatio: 0.7,
    offsetX: -75,
    offsetY: -40
  },

  [STOCK_VISUAL_OBJECT_TYPES.FRESH_SHELF]: {
    widthRatio: 0.6,
    heightRatio: 0.6,
    offsetX: -55,
    offsetY: -30
  },

  [STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER]: {
    widthRatio: 0.6,
    heightRatio: 0.7,
    offsetX: -65,
    offsetY: -40
  }
});

const COUNTER_COLLISION_RECT = Object.freeze({
  id: "counter-zone",
  kind: "counter",
  // 계산대는 화면에 보이는 PNG 이미지 크기 기준으로 막는다.
  // 기존 값은 하단 일부만 막아서 손님/알바가 계산대 위에 선 것처럼 보일 수 있었다.
  x: 608,
  y: 512,
  width: 96,
  height: 88
});

function isShelfZoneUnlocked(shelf, unlockedZoneIds = []) {
  if (!shelf?.zoneId) return true;
  if (shelf.zoneId === "zone_basic") return true;

  return unlockedZoneIds.includes(shelf.zoneId);
}

function createCollisionRectFromShelf(shelf) {
  const preset = OBJECT_TYPE_COLLISION_PRESETS[shelf.objectType];

  if (!preset) {
    return null;
  }

  const width = Math.round(shelf.width * preset.widthRatio);
  const height = Math.round(shelf.height * preset.heightRatio);

  return {
    id: `${shelf.instanceId}-collision`,
    kind: "shelf",
    sourceId: shelf.instanceId,
    objectType: shelf.objectType,
    zoneId: shelf.zoneId,
    x: Math.round(shelf.x + (shelf.width - width) / 2 + preset.offsetX),
    y: Math.round(shelf.y + preset.offsetY),
    width,
    height
  };
}

export function getStoreObjectCollisionRects(unlockedZoneIds = []) {
  const shelfCollisionRects = SHELF_INSTANCES
    .filter((shelf) => isShelfZoneUnlocked(shelf, unlockedZoneIds))
    .map((shelf) => createCollisionRectFromShelf(shelf))
    .filter(Boolean);

  return [
    COUNTER_COLLISION_RECT,
    ...shelfCollisionRects
  ];
}