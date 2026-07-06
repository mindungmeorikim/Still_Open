export const PRODUCT_SHELF_INSTANCE_MAP = Object.freeze({
  potato_chips: "zone1_basic_shelf_1",
  ramen: "zone1_basic_shelf_1",

  water: "zone1_fridge_1",
  cola: "zone1_fridge_1"
});

export function getShelfInstanceIdByProductId(productId) {
  return PRODUCT_SHELF_INSTANCE_MAP[productId] ?? null;
}