/*
  ProductData.js

  담당:
  - 4번 담당자

  역할:
  - 기본 상품 데이터 관리
  - 상품 가격, 해금 Day, 게임용 유통기한 관리

  규칙:
  - 실제 Date 사용 금지
  - 모든 기간은 GameState.day에서 사용할 Day 단위로 정의
*/

export const PRODUCT_CATEGORIES = Object.freeze({
  SNACK: "snack",
  DRINK: "drink",
  READY_MEAL: "ready_meal",
  INSTANT_FOOD: "instant_food",
  FRESH_FOOD: "fresh_food"
});

const createProduct = (product) => {
  return Object.freeze({
    ...product,
    customerRequestIds: Object.freeze(product.customerRequestIds ?? [])
  });
};

export const PRODUCTS = Object.freeze([
  createProduct({
    id: "potato_chips",
    name: "바삭 감자칩",
    category: PRODUCT_CATEGORIES.SNACK,
    purchasePrice: 900,
    salePrice: 1500,
    shelfLifeDays: 6,
    unlockDay: 1,
    initialStock: 3
  }),
  createProduct({
    id: "chocolate_bar",
    name: "달콤 초코바",
    category: PRODUCT_CATEGORIES.SNACK,
    purchasePrice: 700,
    salePrice: 1200,
    shelfLifeDays: 6,
    unlockDay: 1,
    initialStock: 3
  }),
  createProduct({
    id: "banana_milk",
    name: "달콤 바나나우유",
    category: PRODUCT_CATEGORIES.DRINK,
    purchasePrice: 1000,
    salePrice: 1800,
    shelfLifeDays: 3,
    unlockDay: 2,
    initialStock: 3
  }),
  createProduct({
    id: "spicy_shrimp_snack",
    name: "매콤 새우스낵",
    category: PRODUCT_CATEGORIES.SNACK,
    purchasePrice: 800,
    salePrice: 1400,
    shelfLifeDays: 6,
    unlockDay: 3,
    initialStock: 3
  }),
  createProduct({
    id: "water",
    name: "맑은 생수",
    category: PRODUCT_CATEGORIES.DRINK,
    purchasePrice: 500,
    salePrice: 1000,
    shelfLifeDays: 8,
    unlockDay: 1,
    initialStock: 3
  }),
  createProduct({
    id: "cola",
    name: "톡톡 콜라",
    category: PRODUCT_CATEGORIES.DRINK,
    purchasePrice: 900,
    salePrice: 1700,
    shelfLifeDays: 7,
    unlockDay: 1,
    initialStock: 3
  }),
  createProduct({
    id: "orange_juice",
    name: "상쾌 오렌지주스",
    category: PRODUCT_CATEGORIES.DRINK,
    purchasePrice: 1100,
    salePrice: 2000,
    shelfLifeDays: 3,
    unlockDay: 2,
    initialStock: 3
  }),
  createProduct({
    id: "coffee",
    name: "잠깨는 캔커피",
    category: PRODUCT_CATEGORIES.DRINK,
    purchasePrice: 1000,
    salePrice: 1800,
    shelfLifeDays: 7,
    unlockDay: 3,
    initialStock: 3
  }),
  createProduct({
    id: "triangle_kimbap",
    name: "든든 참치삼각밥",
    category: PRODUCT_CATEGORIES.READY_MEAL,
    purchasePrice: 800,
    salePrice: 1400,
    shelfLifeDays: 2,
    unlockDay: 1,
    initialStock: 3
  }),
  createProduct({
    id: "spicy_pork_lunchbox",
    name: "매콤 제육도시락",
    category: PRODUCT_CATEGORIES.READY_MEAL,
    purchasePrice: 2700,
    salePrice: 4500,
    shelfLifeDays: 2,
    unlockDay: 2,
    initialStock: 3,
    customerRequestIds: ["lunch_box"]
  }),
  createProduct({
    id: "cheese_kimchi_rice",
    name: "치즈 김치볶음밥",
    category: PRODUCT_CATEGORIES.READY_MEAL,
    purchasePrice: 2400,
    salePrice: 4000,
    shelfLifeDays: 2,
    unlockDay: 3,
    initialStock: 3,
    customerRequestIds: ["lunch_box"]
  }),
  createProduct({
    id: "pork_cutlet_lunchbox",
    name: "왕돈가스 도시락",
    category: PRODUCT_CATEGORIES.READY_MEAL,
    purchasePrice: 3200,
    salePrice: 5500,
    shelfLifeDays: 2,
    unlockDay: 4,
    initialStock: 3,
    customerRequestIds: ["lunch_box"]
  }),
  createProduct({
    id: "ramen",
    name: "뜨끈 매운컵면",
    category: PRODUCT_CATEGORIES.INSTANT_FOOD,
    purchasePrice: 900,
    salePrice: 1600,
    shelfLifeDays: 6,
    unlockDay: 1,
    initialStock: 3
  }),
  createProduct({
    id: "udon",
    name: "담백 우동컵",
    category: PRODUCT_CATEGORIES.INSTANT_FOOD,
    purchasePrice: 1100,
    salePrice: 1900,
    shelfLifeDays: 6,
    unlockDay: 2,
    initialStock: 3
  }),
  createProduct({
    id: "egg_sandwich",
    name: "촉촉 달걀샌드",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    purchasePrice: 1500,
    salePrice: 2800,
    shelfLifeDays: 2,
    unlockDay: 3,
    initialStock: 3
  }),
  createProduct({
    id: "sausage_hotbar",
    name: "소시지 핫바",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    purchasePrice: 1200,
    salePrice: 2200,
    shelfLifeDays: 3,
    unlockDay: 4,
    initialStock: 3
  })
]);

export function getProductById(productId) {
  return PRODUCTS.find((product) => product.id === productId) ?? null;
}

export function getProductsByCustomerRequestId(requestId) {
  return PRODUCTS.filter((product) => {
    return (
      product.id === requestId ||
      product.customerRequestIds.includes(requestId)
    );
  });
}

export function getUnlockedProducts(day) {
  const safeDay = Math.max(1, Math.floor(Number(day) || 1));

  return PRODUCTS.filter((product) => product.unlockDay <= safeDay);
}
