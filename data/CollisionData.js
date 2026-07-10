import { STOCK_VISUAL_OBJECT_TYPES } from "./AssetData.js";
import { getResponsiveShelfInstances } from "./ShelfPlacementData.js";

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

const COUNTER_COLLISION_RECTS = Object.freeze([
  Object.freeze({
    id: "counter-zone-top-deck",
    kind: "counter",
    sourceId: "counter-zone",
    // 계산대 상판 위로 올라가지 못하게 막되, 왼쪽 빈 바닥은 열어둔다.
    x: 612,
    y: 526,
    width: 78,
    height: 30
  }),
  Object.freeze({
    id: "counter-zone-monitor-side",
    kind: "counter",
    sourceId: "counter-zone",
    // 모니터와 우측 상판 주변을 추가로 막는다.
    x: 654,
    y: 514,
    width: 36,
    height: 42
  }),
  Object.freeze({
    id: "counter-zone-body",
    kind: "counter",
    sourceId: "counter-zone",
    // 계산대 본체는 막고, 좌측 바닥과 우측 통로는 통과할 수 있게 한다.
    x: 610,
    y: 556,
    width: 72,
    height: 38
  }),
  Object.freeze({
    id: "counter-zone-right-side-face",
    kind: "counter",
    sourceId: "counter-zone",
    // 계산대 이미지 우측의 세로 옆면 전체를 차단한다.
    // 기존 3분할 충돌, 좌측 허용 영역, 청소 충돌은 그대로 유지한다.
    x: 682,
    y: 548,
    width: 22,
    height: 23
  })
]);

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

const COMPACT_STORE_MEDIA_QUERY = "(max-height: 560px), (max-width: 980px) and (orientation: landscape)";
const COMPACT_COUNTER_COLLISION_SCALE = 0.86;
const COMPACT_CLEANING_COLLISION_SCALE = 0.86;

function isCompactStoreLayout() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  try {
    return window.matchMedia(COMPACT_STORE_MEDIA_QUERY).matches;
  } catch (_error) {
    return false;
  }
}

function scaleRectFromCenter(rect, scale = 1) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  if (safeScale === 1) {
    return { ...rect };
  }

  const width = Math.max(1, Math.round(rect.width * safeScale));
  const height = Math.max(1, Math.round(rect.height * safeScale));

  return {
    ...rect,
    x: Math.round(rect.x + (rect.width - width) / 2),
    y: Math.round(rect.y + (rect.height - height) / 2),
    width,
    height
  };
}

const CLEANING_TOOLS_COLLISION_RECT = Object.freeze({
  id: "cleaning-tools-collision",
  kind: "cleaning_tools",
  sourceId: "cleaning-zone",
  // 청소도구 실제 받침/몸체만 차단해 계산대 뒤 통로를 확보한다.
  x: 728,
  y: 492,
  width: 24,
  height: 28
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
  const useCompactCollisionScale = isCompactStoreLayout();
  const counterCollisionRects = COUNTER_COLLISION_RECTS.map((rect) => {
    return useCompactCollisionScale
      ? scaleRectFromCenter(rect, COMPACT_COUNTER_COLLISION_SCALE)
      : rect;
  });
  const cleaningToolsCollisionRect = useCompactCollisionScale
    ? scaleRectFromCenter(
        CLEANING_TOOLS_COLLISION_RECT,
        COMPACT_CLEANING_COLLISION_SCALE
      )
    : CLEANING_TOOLS_COLLISION_RECT;

  const shelfCollisionRects = getResponsiveShelfInstances()
    .filter((shelf) => isShelfZoneUnlocked(shelf, unlockedZoneIds))
    .map((shelf) => createCollisionRectFromShelf(shelf))
    .filter(Boolean);

  return [
    ...counterCollisionRects,
    WAREHOUSE_BOX_COLLISION_RECT,
    cleaningToolsCollisionRect,
    ...shelfCollisionRects
  ];
}