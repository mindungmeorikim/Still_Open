import { getProductById } from "./ProductData.js";
import { SHELF_INSTANCES } from "./ShelfPlacementData.js";

export const PRODUCT_SHELF_INSTANCE_MAP = Object.freeze({
  potato_chips: "zone1_basic_shelf_1",
  ramen: "zone1_basic_shelf_1",

  water: "zone1_fridge_1",
  cola: "zone1_fridge_1"
});

function normalizeProductId(productId) {
  return String(productId ?? "").trim().replace(/-/g, "_");
}

function getFirstShelfInstanceIdByShelfId(shelfId) {
  if (!shelfId) return null;

  return (
    SHELF_INSTANCES.find((shelf) => shelf.shelfId === shelfId)?.instanceId ??
    null
  );
}

export function getShelfInstanceIdByProductId(productId) {
  const resolvedProductId = normalizeProductId(productId);

  if (!resolvedProductId) return null;

  const explicitShelfInstanceId = PRODUCT_SHELF_INSTANCE_MAP[resolvedProductId];

  if (explicitShelfInstanceId) {
    return explicitShelfInstanceId;
  }

  const product = getProductById(resolvedProductId);

  if (!product?.shelfId) {
    return null;
  }

  return getFirstShelfInstanceIdByShelfId(product.shelfId);
}
