const COUNTER_COLLISION_RECT = Object.freeze({
  id: "counter-zone",
  kind: "counter",
  x: 620,
  y: 555,
  width: 72,
  height: 42
});

export function getStoreObjectCollisionRects(unlockedZoneIds = []) {
  void unlockedZoneIds;

  return [
    COUNTER_COLLISION_RECT
  ];
}
