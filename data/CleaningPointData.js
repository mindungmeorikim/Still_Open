export const CLEANING_ZONE_IDS = Object.freeze({
  ZONE_1: "zone_basic",
  ZONE_2: "zone_extra_shelf",
  ZONE_3: "zone_cold_food",
  ZONE_4: "zone_premium_store"
});

// F8 월드 좌표 기준 구역별 청소 포인트입니다.
// x/y는 플레이어 상호작용 및 UI 표시 기준점, staffX/staffY는 알바 캐릭터가 멈춰 설 위치입니다.
export const CLEANING_POINTS_BY_ZONE_ID = Object.freeze({
  [CLEANING_ZONE_IDS.ZONE_1]: Object.freeze({
    id: "zone1_cleaning_spot",
    zoneId: CLEANING_ZONE_IDS.ZONE_1,
    label: "주변",
    x: 735,
    y: 520,
    staffX: 700,
    staffY: 532,
    interactionDistance: 100
  }),
  [CLEANING_ZONE_IDS.ZONE_2]: Object.freeze({
    id: "zone2_cleaning_spot",
    zoneId: CLEANING_ZONE_IDS.ZONE_2,
    label: "주변",
    x: 720,
    y: 430,
    staffX: 690,
    staffY: 430,
    interactionDistance: 100
  }),
  [CLEANING_ZONE_IDS.ZONE_3]: Object.freeze({
    id: "zone3_cleaning_spot",
    zoneId: CLEANING_ZONE_IDS.ZONE_3,
    label: "주변",
    x: 980,
    y: 610,
    staffX: 940,
    staffY: 595,
    interactionDistance: 100
  }),
  [CLEANING_ZONE_IDS.ZONE_4]: Object.freeze({
    id: "zone4_cleaning_spot",
    zoneId: CLEANING_ZONE_IDS.ZONE_4,
    label: "주변",
    x: 1160,
    y: 420,
    staffX: 1125,
    staffY: 415,
    interactionDistance: 100
  })
});

export const DEFAULT_CLEANING_ZONE_ID = CLEANING_ZONE_IDS.ZONE_1;
export const CLEANING_ZONE_ORDER = Object.freeze([
  CLEANING_ZONE_IDS.ZONE_1,
  CLEANING_ZONE_IDS.ZONE_2,
  CLEANING_ZONE_IDS.ZONE_3,
  CLEANING_ZONE_IDS.ZONE_4
]);

export function getCleaningPointByZoneId(zoneId = DEFAULT_CLEANING_ZONE_ID) {
  return CLEANING_POINTS_BY_ZONE_ID[zoneId] ?? CLEANING_POINTS_BY_ZONE_ID[DEFAULT_CLEANING_ZONE_ID];
}

export function getCleaningPointForUnlockedZones(unlockedZoneIds = [], preferredZoneId = null) {
  const allowedZoneIds = getUnlockedCleaningZoneIds(unlockedZoneIds);

  if (preferredZoneId && allowedZoneIds.includes(preferredZoneId)) {
    return getCleaningPointByZoneId(preferredZoneId);
  }

  return getCleaningPointByZoneId(allowedZoneIds[0] ?? DEFAULT_CLEANING_ZONE_ID);
}

export function getUnlockedCleaningZoneIds(unlockedZoneIds = []) {
  const source = Array.isArray(unlockedZoneIds) ? unlockedZoneIds : [];
  const normalized = source.map(String).filter(Boolean);
  const withDefault = normalized.length > 0 ? normalized : [DEFAULT_CLEANING_ZONE_ID];

  return CLEANING_ZONE_ORDER.filter((zoneId) => withDefault.includes(zoneId));
}
