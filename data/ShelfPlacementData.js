import { PRODUCT_SHELF_IDS } from "./ProductData.js";
import {
  OBJECT_FACINGS,
  STOCK_VISUAL_OBJECT_TYPES
} from "./AssetData.js";

export const SHELF_INSTANCES = [
  {
    instanceId: "zone1_basic_shelf_1",
    zoneId: "zone_basic",
    shelfId: PRODUCT_SHELF_IDS.BASIC,
    nodeId: "zone1-basic-shelf-1",
    label: "1구역 기본 매대 1",
    x: 540,
    y: 410,
    width: 160,
    height: 160,
    standX: 515,
    standY: 410,
    interactionX: 545,
    interactionY: 545,
    interactionDistance: 160,
    objectType: STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND,
    facing: OBJECT_FACINGS.RIGHT
  },
  {
    instanceId: "zone1_fridge_1",
    zoneId: "zone_basic",
    shelfId: PRODUCT_SHELF_IDS.FRIDGE,
    nodeId: "zone1-fridge-1",
    label: "1구역 냉장고 1",
    x: 400,
    y: 500,
    width: 200,
    height: 200,
    standX: 400,
    standY: 490,
    interactionX: 430,
    interactionY: 630,
    interactionDistance: 170,
    objectType: STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE,
    facing: OBJECT_FACINGS.RIGHT
  }
];

export function getShelfInstanceById(instanceId) {
  return SHELF_INSTANCES.find((shelf) => shelf.instanceId === instanceId) ?? null;
}

export function getShelfInstancesByZoneId(zoneId) {
  return SHELF_INSTANCES.filter((shelf) => shelf.zoneId === zoneId);
}

export function getShelfInstancesByShelfId(shelfId) {
  return SHELF_INSTANCES.filter((shelf) => shelf.shelfId === shelfId);
}