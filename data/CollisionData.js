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

// v7.13.80 추가 오브젝트 차단 범위
// 기존 계산대/진열대/냉장고 충돌값은 절대 변경하지 않고,
// 창고 박스와 청소 도구함만 별도 고정 충돌 박스로 추가한다.
const WAREHOUSE_BOX_COLLISION_RECT = Object.freeze({
  id: "warehouse-box-collision",
  kind: "warehouse_box",
  sourceId: "warehouse-box-zone",
  x: 226,
  y: 592,
  width: 64,
  height: 54
});

const CLEANING_TOOLS_COLLISION_RECT = Object.freeze({
  id: "cleaning-tools-collision",
  kind: "cleaning_tools",
  sourceId: "cleaning-zone",
  x: 716,
  y: 483,
  width: 42,
  height: 46
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
    WAREHOUSE_BOX_COLLISION_RECT,
    CLEANING_TOOLS_COLLISION_RECT,
    ...shelfCollisionRects
  ];
}