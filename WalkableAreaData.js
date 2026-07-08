/*
  WalkableAreaData.js

  역할:
  - 오브젝트 충돌 박스와 분리된 캐릭터 이동 가능 영역 정의
  - 플레이어/아르바이트생이 매장 벽면과 미해금 구역을 뚫지 않도록 제한
  - 기존 CollisionData.js의 오브젝트 차단 범위는 수정하지 않는다.

  기준:
  - 매장 1~4구역은 bright_empty_space 에셋의 실제 밝은 바닥 범위를 기준으로 한다.
  - 창고박스 앞 → 입구 앞 보라색 통로는 기본 구역 동선으로 항상 허용한다.
*/

export const WALKABLE_WORLD_SIZE = Object.freeze({
  width: 1672,
  height: 941
});

const DEFAULT_UNLOCKED_ZONE_IDS = Object.freeze(["zone_basic"]);
const EXTERIOR_WALL_INSET = 30;

function rect(id, x, y, width, height, extra = {}) {
  const {
    insetLeft = 0,
    insetRight = 0,
    insetTop = 0,
    insetBottom = 0,
    ...areaExtra
  } = extra;
  const safeInsetLeft = Math.max(0, Math.min(Number(insetLeft) || 0, width / 2 - 1));
  const safeInsetRight = Math.max(0, Math.min(Number(insetRight) || 0, width / 2 - 1));
  const safeInsetTop = Math.max(0, Math.min(Number(insetTop) || 0, height / 2 - 1));
  const safeInsetBottom = Math.max(0, Math.min(Number(insetBottom) || 0, height / 2 - 1));

  return Object.freeze({
    id,
    kind: "rect",
    x: x + safeInsetLeft,
    y: y + safeInsetTop,
    width: Math.max(0, width - safeInsetLeft - safeInsetRight),
    height: Math.max(0, height - safeInsetTop - safeInsetBottom),
    ...areaExtra
  });
}

function polygon(id, points, extra = {}) {
  return Object.freeze({
    id,
    kind: "polygon",
    points: Object.freeze(points.map((point) => Object.freeze({ ...point }))),
    ...extra
  });
}

const ALWAYS_WALKABLE_AREAS = Object.freeze([
  polygon("entry_sidewalk_corridor", [
    // 창고박스 왼쪽/뒤쪽 도로로 빠지지 않도록 창고박스 이미지 "앞" 동선부터만 허용한다.
    // 벽/도로 테두리를 타는 느낌을 줄이기 위해 외곽 꼭짓점은 기존보다 소폭 안쪽으로 조정한다.
    // 기준은 캐릭터 발 위치이며, 창고박스 접근 지점(standX/standY)의 발 위치는 포함한다.
    { x: 258, y: 630 },
    { x: 430, y: 625 },
    { x: 585, y: 643 },
    { x: 675, y: 670 },
    { x: 640, y: 735 },
    { x: 315, y: 713 },
    { x: 250, y: 676 }
  ], { requiredZoneId: "zone_basic" })
]);

const ZONE_WALKABLE_AREAS = Object.freeze({
  zone_basic: Object.freeze([
    // first_empty_space.png 알파 영역 기준 이동 밴드
    // 외곽 벽 쪽만 살짝 안쪽으로 보정하고, 확장 구역 연결 경계는 줄이지 않는다.
    rect("zone_basic_bright_floor_01", 544, 394, 170, 20, { insetLeft: EXTERIOR_WALL_INSET, insetTop: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_02", 521, 414, 356, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_03", 498, 434, 379, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_04", 476, 454, 382, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_05", 453, 474, 386, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_06", 430, 494, 390, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_07", 407, 514, 393, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_08", 384, 534, 397, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_09", 362, 554, 400, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_10", 339, 574, 404, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_11", 315, 594, 407, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_12", 314, 614, 389, 20, { insetLeft: EXTERIOR_WALL_INSET }),
    rect("zone_basic_bright_floor_13", 436, 634, 248, 20),
    rect("zone_basic_bright_floor_14", 572, 654, 92, 14)
  ]),
  zone_extra_shelf: Object.freeze([
    // second_empty_space.png 알파 영역 기준 이동 밴드
    // zone_basic/zone_premium_store와 맞닿는 내부 연결 경계는 줄이지 않는다.
    rect("zone_extra_shelf_bright_floor_01", 708, 252, 229, 20, { insetTop: EXTERIOR_WALL_INSET }),
    rect("zone_extra_shelf_bright_floor_02", 685, 272, 342, 20),
    rect("zone_extra_shelf_bright_floor_03", 661, 292, 353, 20),
    rect("zone_extra_shelf_bright_floor_04", 639, 312, 356, 20),
    rect("zone_extra_shelf_bright_floor_05", 616, 332, 361, 20),
    rect("zone_extra_shelf_bright_floor_06", 592, 352, 364, 20),
    rect("zone_extra_shelf_bright_floor_07", 570, 372, 367, 20),
    rect("zone_extra_shelf_bright_floor_08", 566, 392, 352, 20),
    rect("zone_extra_shelf_bright_floor_09", 705, 412, 194, 20)
  ]),
  zone_cold_food: Object.freeze([
    // third_empty_space.png 알파 영역 기준 이동 밴드
    // zone_basic/zone_premium_store와 맞닿는 내부 연결 경계는 줄이지 않는다.
    rect("zone_cold_food_bright_floor_01", 874, 433, 181, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_02", 854, 453, 386, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_03", 835, 473, 407, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_04", 816, 493, 412, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_05", 797, 513, 414, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_06", 777, 533, 417, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_07", 758, 553, 420, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_08", 739, 573, 422, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_09", 719, 593, 426, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_10", 699, 613, 429, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_11", 681, 633, 431, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_12", 667, 653, 428, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_13", 709, 673, 369, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_cold_food_bright_floor_14", 846, 693, 215, 20, { insetRight: EXTERIOR_WALL_INSET, insetBottom: EXTERIOR_WALL_INSET })
  ]),
  zone_premium_store: Object.freeze([
    // fourth_empty_space.png 알파 영역 기준 이동 밴드
    // zone_extra_shelf/zone_cold_food와 맞닿는 내부 연결 경계는 줄이지 않는다.
    rect("zone_premium_store_bright_floor_01", 1023, 279, 220, 20, { insetTop: EXTERIOR_WALL_INSET, insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_02", 1004, 299, 375, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_03", 984, 319, 389, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_04", 966, 339, 390, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_05", 946, 359, 393, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_06", 927, 379, 396, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_07", 907, 399, 398, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_08", 893, 419, 396, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_09", 936, 439, 336, 20, { insetRight: EXTERIOR_WALL_INSET }),
    rect("zone_premium_store_bright_floor_10", 1112, 459, 143, 17, { insetRight: EXTERIOR_WALL_INSET })
  ])
});

function normalizeUnlockedZoneIds(unlockedZoneIds = []) {
  const source = Array.isArray(unlockedZoneIds) ? unlockedZoneIds : [];
  const normalized = source.map(String).filter(Boolean);
  const ids = normalized.length > 0 ? normalized : [...DEFAULT_UNLOCKED_ZONE_IDS];
  const withDefault = new Set(ids);

  DEFAULT_UNLOCKED_ZONE_IDS.forEach((zoneId) => withDefault.add(zoneId));

  return withDefault;
}

function isAreaUnlocked(area, unlockedZoneIds) {
  if (!area?.requiredZoneId) return true;
  return unlockedZoneIds.has(area.requiredZoneId);
}

function scaleRect(area, worldSize) {
  const scaleX = worldSize.width / WALKABLE_WORLD_SIZE.width;
  const scaleY = worldSize.height / WALKABLE_WORLD_SIZE.height;

  return {
    ...area,
    x: area.x * scaleX,
    y: area.y * scaleY,
    width: area.width * scaleX,
    height: area.height * scaleY
  };
}

function scalePolygon(area, worldSize) {
  const scaleX = worldSize.width / WALKABLE_WORLD_SIZE.width;
  const scaleY = worldSize.height / WALKABLE_WORLD_SIZE.height;

  return {
    ...area,
    points: area.points.map((point) => ({
      x: point.x * scaleX,
      y: point.y * scaleY
    }))
  };
}

function scaleArea(area, worldSize = WALKABLE_WORLD_SIZE) {
  if (area.kind === "polygon") {
    return scalePolygon(area, worldSize);
  }

  return scaleRect(area, worldSize);
}

export function getStoreWalkableAreas(unlockedZoneIds = [], worldSize = WALKABLE_WORLD_SIZE) {
  const unlockedIds = normalizeUnlockedZoneIds(unlockedZoneIds);
  const alwaysAreas = ALWAYS_WALKABLE_AREAS.filter((area) => isAreaUnlocked(area, unlockedIds));
  const zoneAreas = Object.entries(ZONE_WALKABLE_AREAS)
    .filter(([zoneId]) => unlockedIds.has(zoneId))
    .flatMap(([zoneId, areas]) => {
      return areas.map((area) => ({
        ...area,
        zoneId
      }));
    });

  return [
    ...alwaysAreas,
    ...zoneAreas
  ].map((area) => scaleArea(area, worldSize));
}

export function isPointInWalkableAreas(point = {}, areas = []) {
  return areas.some((area) => isPointInWalkableArea(point, area));
}

export function isPointInWalkableArea(point = {}, area = {}) {
  if (area.kind === "polygon") {
    return isPointInPolygon(point, area.points ?? []);
  }

  return isPointInRect(point, area);
}

export function getNearestPointInWalkableAreas(point = {}, areas = []) {
  return areas.reduce((nearest, area) => {
    const candidate = getNearestPointInWalkableArea(point, area);
    const distance = getPointDistance(point, candidate);

    if (!nearest || distance < nearest.distance) {
      return {
        ...candidate,
        distance
      };
    }

    return nearest;
  }, null) ?? { x: Number(point.x) || 0, y: Number(point.y) || 0 };
}

function getNearestPointInWalkableArea(point = {}, area = {}) {
  if (isPointInWalkableArea(point, area)) {
    return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  }

  if (area.kind === "polygon") {
    return getNearestPointOnPolygon(point, area.points ?? []);
  }

  return {
    x: clamp(Number(point.x) || 0, Number(area.x) || 0, (Number(area.x) || 0) + (Number(area.width) || 0)),
    y: clamp(Number(point.y) || 0, Number(area.y) || 0, (Number(area.y) || 0) + (Number(area.height) || 0))
  };
}

function isPointInRect(point = {}, rect = {}) {
  const x = Number(point.x) || 0;
  const y = Number(point.y) || 0;
  const rectX = Number(rect.x) || 0;
  const rectY = Number(rect.y) || 0;
  const rectWidth = Number(rect.width) || 0;
  const rectHeight = Number(rect.height) || 0;

  return (
    x >= rectX &&
    x <= rectX + rectWidth &&
    y >= rectY &&
    y <= rectY + rectHeight
  );
}

function isPointInPolygon(point = {}, points = []) {
  const x = Number(point.x) || 0;
  const y = Number(point.y) || 0;
  let isInside = false;

  if (points.length < 3) {
    return false;
  }

  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index++) {
    const current = points[index];
    const previous = points[previousIndex];
    const currentX = Number(current.x) || 0;
    const currentY = Number(current.y) || 0;
    const previousX = Number(previous.x) || 0;
    const previousY = Number(previous.y) || 0;
    const intersects =
      currentY > y !== previousY > y &&
      x < ((previousX - currentX) * (y - currentY)) / ((previousY - currentY) || 1) + currentX;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function getNearestPointOnPolygon(point = {}, points = []) {
  if (points.length === 0) {
    return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  }

  if (points.length === 1) {
    return { x: Number(points[0].x) || 0, y: Number(points[0].y) || 0 };
  }

  return points.reduce((nearest, start, index) => {
    const end = points[(index + 1) % points.length];
    const candidate = getNearestPointOnSegment(point, start, end);
    const distance = getPointDistance(point, candidate);

    if (!nearest || distance < nearest.distance) {
      return {
        ...candidate,
        distance
      };
    }

    return nearest;
  }, null) ?? { x: Number(point.x) || 0, y: Number(point.y) || 0 };
}

function getNearestPointOnSegment(point = {}, start = {}, end = {}) {
  const pointX = Number(point.x) || 0;
  const pointY = Number(point.y) || 0;
  const startX = Number(start.x) || 0;
  const startY = Number(start.y) || 0;
  const endX = Number(end.x) || 0;
  const endY = Number(end.y) || 0;
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= 0) {
    return { x: startX, y: startY };
  }

  const t = clamp(((pointX - startX) * dx + (pointY - startY) * dy) / lengthSquared, 0, 1);

  return {
    x: startX + t * dx,
    y: startY + t * dy
  };
}

function getPointDistance(first = {}, second = {}) {
  const dx = (Number(first.x) || 0) - (Number(second.x) || 0);
  const dy = (Number(first.y) || 0) - (Number(second.y) || 0);

  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value, min, max) {
  const safeMax = Math.max(min, max);

  return Math.min(safeMax, Math.max(min, value));
}
