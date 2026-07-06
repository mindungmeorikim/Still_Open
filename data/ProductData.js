/*
  ProductData.js

  담당:
  - 4번 담당자

  역할:
  - 기본 상품 데이터 관리
  - 상품 가격, 해금 Day, 게임용 유통기한 관리
  - BMSystem에서 사용할 판매권/프리미엄 상품 기준 데이터 제공

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

export const PRODUCT_DISPLAY_CATEGORIES = Object.freeze({
  BASIC_SHELF: "basic_shelf",
  FRESH_SHELF: "fresh_shelf",
  FRIDGE: "fridge",
  WARMER: "warmer"
});

export const PRODUCT_SHELF_IDS = Object.freeze({
  BASIC: "shelf_basic",
  FRESH: "shelf_fresh",
  FRIDGE: "shelf_fridge",
  WARMER: "shelf_warmer"
});

export const PRODUCT_SHELF_ID_TO_DISPLAY_CATEGORY = Object.freeze({
  [PRODUCT_SHELF_IDS.BASIC]: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
  [PRODUCT_SHELF_IDS.FRESH]: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
  [PRODUCT_SHELF_IDS.FRIDGE]: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
  [PRODUCT_SHELF_IDS.WARMER]: PRODUCT_DISPLAY_CATEGORIES.WARMER
});

export const PRODUCT_DISPLAY_CATEGORY_TO_SHELF_ID = Object.freeze({
  [PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF]: PRODUCT_SHELF_IDS.BASIC,
  [PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF]: PRODUCT_SHELF_IDS.FRESH,
  [PRODUCT_DISPLAY_CATEGORIES.FRIDGE]: PRODUCT_SHELF_IDS.FRIDGE,
  [PRODUCT_DISPLAY_CATEGORIES.WARMER]: PRODUCT_SHELF_IDS.WARMER
});

export const PRODUCT_ZONE_IDS = Object.freeze({
  ZONE_1: "zone_basic",
  ZONE_2: "zone_extra_shelf",
  ZONE_3: "zone_cold_food",
  ZONE_4: "zone_premium_store"
});

const PREMIUM_BM_LOCK_DAY = 999;

export const PRODUCT_UPGRADE_TYPES = Object.freeze({
  NORMAL: "normal",
  LATE_FREE_HIGH: "late_free_high",
  PREMIUM_BM: "premium_bm"
});

const LATE_FREE_HIGH_EFFICIENCY_PRODUCT_IDS = new Set([
  "pudding",
  "tuna_mayo_sandwich"
]);

const inferProductUpgradeType = (product) => {
  if (product.isPremiumBM === true) return PRODUCT_UPGRADE_TYPES.PREMIUM_BM;
  if (LATE_FREE_HIGH_EFFICIENCY_PRODUCT_IDS.has(product.id)) return PRODUCT_UPGRADE_TYPES.LATE_FREE_HIGH;
  return PRODUCT_UPGRADE_TYPES.NORMAL;
};

const inferProductShelfId = (product) => {
  const displayCategory = product.displayCategory;

  if (displayCategory === PRODUCT_DISPLAY_CATEGORIES.FRIDGE) return PRODUCT_SHELF_IDS.FRIDGE;
  if (displayCategory === PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF) return PRODUCT_SHELF_IDS.FRESH;
  if (displayCategory === PRODUCT_DISPLAY_CATEGORIES.WARMER) return PRODUCT_SHELF_IDS.WARMER;
  return PRODUCT_SHELF_IDS.BASIC;
};

const createProduct = (product) => {
  return Object.freeze({
    ...product,
    finalName: product.finalName ?? product.name,
    finalSalePrice: product.finalSalePrice ?? product.salePrice,
    contractCost: product.contractCost ?? 0,
    isPremiumBM: product.isPremiumBM === true,
    diamondPrice: product.diamondPrice ?? 0,
    shelfId: product.shelfId ?? inferProductShelfId(product),
    targetShelfInstanceId: product.targetShelfInstanceId ?? null,
    upgradeType: product.upgradeType ?? inferProductUpgradeType(product),
    customerRequestIds: Object.freeze(product.customerRequestIds ?? [])
  });
};

export const PRODUCTS = Object.freeze([
  createProduct({
    id: "potato_chips",
    name: "바삭 감자칩",
    finalName: "화산에서 튀겨낸 감자칩",
    imagePath: "./assets/images/products/potato_chips.webp",
    category: PRODUCT_CATEGORIES.SNACK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_1,
    targetShelfInstanceId: "zone1_basic_shelf_1",
    purchasePrice: 1400,
    salePrice: 2300,
    finalSalePrice: 3500,
    shelfLifeDays: 6,
    unlockDay: 1,
    initialStock: 3
  }),
  createProduct({
    id: "ramen",
    name: "뜨끈 매운컵면",
    finalName: "불지 않는 전설의 매운컵면",
    imagePath: "./assets/images/products/ramen.webp",
    category: PRODUCT_CATEGORIES.INSTANT_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_1,
    targetShelfInstanceId: "zone1_basic_shelf_1",
    purchasePrice: 1400,
    salePrice: 2400,
    finalSalePrice: 3600,
    contractCost: 4800,
    shelfLifeDays: 6,
    unlockDay: 4,
    initialStock: 3
  }),
  createProduct({
    id: "water",
    name: "맑은 생수",
    finalName: "백두산 새벽이슬 생수",
    imagePath: "./assets/images/products/water.webp",
    category: PRODUCT_CATEGORIES.DRINK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_1,
    targetShelfInstanceId: "zone1_fridge_1",
    purchasePrice: 900,
    salePrice: 1500,
    finalSalePrice: 2300,
    shelfLifeDays: 8,
    unlockDay: 1,
    initialStock: 3
  }),
  createProduct({
    id: "cola",
    name: "톡톡 콜라",
    finalName: "탄산 폭발 레전드 콜라",
    imagePath: "./assets/images/products/cola.webp",
    category: PRODUCT_CATEGORIES.DRINK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_1,
    targetShelfInstanceId: "zone1_fridge_1",
    purchasePrice: 1600,
    salePrice: 2600,
    finalSalePrice: 3900,
    contractCost: 5200,
    shelfLifeDays: 7,
    unlockDay: 4,
    initialStock: 3
  }),
  createProduct({
    id: "chocolate_bar",
    name: "달콤 초코바",
    finalName: "악마도 숨겨 먹는 다크초코바",
    imagePath: "./assets/images/products/chocolate_bar.webp",
    category: PRODUCT_CATEGORIES.SNACK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_2,
    targetShelfInstanceId: "zone2_basic_shelf_1",
    purchasePrice: 1100,
    salePrice: 1800,
    finalSalePrice: 2700,
    contractCost: 5400,
    shelfLifeDays: 6,
    unlockDay: 7,
    initialStock: 3
  }),
  createProduct({
    id: "spicy_shrimp_snack",
    name: "매콤 새우스낵",
    finalName: "용암맛 매콤 새우스낵",
    imagePath: "./assets/images/products/spicy_shrimp_snack.webp",
    category: PRODUCT_CATEGORIES.SNACK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_2,
    targetShelfInstanceId: "zone2_basic_shelf_1",
    purchasePrice: 1300,
    salePrice: 2100,
    finalSalePrice: 3200,
    contractCost: 6300,
    shelfLifeDays: 6,
    unlockDay: 7,
    initialStock: 3
  }),
  createProduct({
    id: "udon",
    name: "담백 우동컵",
    finalName: "만 번 우려낸 사장님 우동컵",
    imagePath: "./assets/images/products/udon.webp",
    category: PRODUCT_CATEGORIES.INSTANT_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_2,
    targetShelfInstanceId: "zone2_basic_shelf_1",
    purchasePrice: 1700,
    salePrice: 2900,
    finalSalePrice: 4400,
    contractCost: 8700,
    shelfLifeDays: 6,
    unlockDay: 10,
    initialStock: 3
  }),
  createProduct({
    id: "cream_bread",
    name: "크림빵",
    finalName: "구름을 채운 폭신 크림빵",
    imagePath: "./assets/images/products/cream_bread.webp",
    category: PRODUCT_CATEGORIES.SNACK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_2,
    targetShelfInstanceId: "zone2_basic_shelf_1",
    purchasePrice: 2000,
    salePrice: 3300,
    finalSalePrice: 5000,
    contractCost: 9900,
    shelfLifeDays: 3,
    unlockDay: 10,
    initialStock: 3
  }),
  createProduct({
    id: "banana_milk",
    name: "달콤 바나나우유",
    finalName: "단골손님이 99번 찾은 바나나우유",
    imagePath: "./assets/images/products/banana_milk.webp",
    category: PRODUCT_CATEGORIES.DRINK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_2,
    targetShelfInstanceId: "zone2_fridge_1",
    purchasePrice: 1600,
    salePrice: 2700,
    finalSalePrice: 4100,
    contractCost: 8100,
    shelfLifeDays: 3,
    unlockDay: 13,
    initialStock: 3
  }),
  createProduct({
    id: "iced_americano",
    name: "얼음 아메리카노",
    finalName: "출근길을 깨우는 얼음 아메리카노",
    imagePath: "./assets/images/products/iced_americano.webp",
    category: PRODUCT_CATEGORIES.DRINK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_2,
    targetShelfInstanceId: "zone2_fridge_1",
    purchasePrice: 1800,
    salePrice: 3000,
    finalSalePrice: 4500,
    contractCost: 9000,
    shelfLifeDays: 3,
    unlockDay: 13,
    initialStock: 3
  }),
  createProduct({
    id: "triangle_kimbap",
    name: "든든 참치삼각밥",
    finalName: "편의점장이 몰래 숨겨둔 참치삼각밥",
    imagePath: "./assets/images/products/triangle_kimbap.webp",
    category: PRODUCT_CATEGORIES.READY_MEAL,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_2,
    targetShelfInstanceId: "zone2_fresh_shelf_1",
    purchasePrice: 1300,
    salePrice: 2100,
    finalSalePrice: 3200,
    contractCost: 6300,
    shelfLifeDays: 2,
    unlockDay: 16,
    initialStock: 3
  }),
  createProduct({
    id: "egg_sandwich",
    name: "촉촉 달걀샌드",
    finalName: "새벽 배송보다 빠른 촉촉 달걀샌드",
    imagePath: "./assets/images/products/egg_sandwich.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_2,
    targetShelfInstanceId: "zone2_fresh_shelf_1",
    purchasePrice: 2500,
    salePrice: 4200,
    finalSalePrice: 6300,
    contractCost: 12600,
    shelfLifeDays: 2,
    unlockDay: 16,
    initialStock: 3
  }),
  createProduct({
    id: "roasted_egg",
    name: "구운계란",
    finalName: "찜질방 단골의 구운계란",
    imagePath: "./assets/images/products/roasted_egg.webp",
    category: PRODUCT_CATEGORIES.SNACK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_basic_shelf_1",
    purchasePrice: 1200,
    salePrice: 2000,
    finalSalePrice: 3000,
    contractCost: 8000,
    shelfLifeDays: 5,
    unlockDay: 19,
    initialStock: 3
  }),
  createProduct({
    id: "golden_cookie",
    name: "계산대 앞에서 빛나는 황금쿠키",
    finalName: "계산대 앞에서 눈부신 황금쿠키",
    imagePath: "./assets/images/products/golden_cookie.webp",
    category: PRODUCT_CATEGORIES.SNACK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.BASIC_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_basic_shelf_2",
    purchasePrice: 4300,
    salePrice: 7200,
    finalSalePrice: 14400,
    isPremiumBM: true,
    diamondPrice: 140,
    shelfLifeDays: 6,
    unlockDay: PREMIUM_BM_LOCK_DAY,
    initialStock: 3
  }),
  createProduct({
    id: "orange_juice",
    name: "상쾌 오렌지주스",
    finalName: "태양을 갈아 넣은 오렌지주스",
    imagePath: "./assets/images/products/orange_juice.webp",
    category: PRODUCT_CATEGORIES.DRINK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_fridge_1",
    purchasePrice: 1800,
    salePrice: 3000,
    finalSalePrice: 4500,
    contractCost: 12000,
    shelfLifeDays: 3,
    unlockDay: 19,
    initialStock: 3
  }),
  createProduct({
    id: "hangover_drink",
    name: "숙취탈출 음료",
    finalName: "어제의 기억을 지우는 숙취탈출 음료",
    imagePath: "./assets/images/products/hangover_drink.webp",
    category: PRODUCT_CATEGORIES.DRINK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_fridge_1",
    purchasePrice: 2300,
    salePrice: 3800,
    finalSalePrice: 5700,
    contractCost: 15200,
    shelfLifeDays: 5,
    unlockDay: 22,
    initialStock: 3
  }),
  createProduct({
    id: "ice_bar",
    name: "바 아이스크림",
    finalName: "한입에 여름이 사라지는 바 아이스크림",
    imagePath: "./assets/images/products/ice_bar.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_fridge_2",
    purchasePrice: 1400,
    salePrice: 2300,
    finalSalePrice: 3500,
    contractCost: 9200,
    shelfLifeDays: 10,
    unlockDay: 22,
    initialStock: 3
  }),
  createProduct({
    id: "cone_ice_cream",
    name: "콘 아이스크림",
    finalName: "손끝까지 행복한 콘 아이스크림",
    imagePath: "./assets/images/products/cone_ice_cream.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_fridge_2",
    purchasePrice: 2000,
    salePrice: 3300,
    finalSalePrice: 5000,
    contractCost: 13200,
    shelfLifeDays: 10,
    unlockDay: 25,
    initialStock: 3
  }),
  createProduct({
    id: "pudding",
    name: "푸딩",
    finalName: "숟가락이 먼저 뛰어드는 푸딩",
    imagePath: "./assets/images/products/pudding.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_fridge_2",
    purchasePrice: 2300,
    salePrice: 3800,
    finalSalePrice: 6500,
    contractCost: 19000,
    shelfLifeDays: 3,
    unlockDay: 25,
    initialStock: 3
  }),
  createProduct({
    id: "macaron",
    name: "마카롱",
    finalName: "알바 월급을 흔드는 마카롱",
    imagePath: "./assets/images/products/macaron.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_fridge_2",
    purchasePrice: 2900,
    salePrice: 4800,
    finalSalePrice: 7200,
    contractCost: 19200,
    shelfLifeDays: 4,
    unlockDay: 28,
    initialStock: 3
  }),
  createProduct({
    id: "tuna_mayo_sandwich",
    name: "참치마요 샌드",
    finalName: "점심시간을 평정한 참치마요 샌드",
    imagePath: "./assets/images/products/tuna_mayo_sandwich.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_fresh_shelf_1",
    purchasePrice: 2700,
    salePrice: 4500,
    finalSalePrice: 7700,
    contractCost: 22500,
    shelfLifeDays: 2,
    unlockDay: 28,
    initialStock: 3
  }),
  createProduct({
    id: "healthy_salad",
    name: "건강샐러드",
    finalName: "양심을 살리는 건강샐러드",
    imagePath: "./assets/images/products/healthy_salad.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_3,
    targetShelfInstanceId: "zone3_fresh_shelf_1",
    purchasePrice: 3200,
    salePrice: 5300,
    finalSalePrice: 8000,
    contractCost: 21200,
    shelfLifeDays: 2,
    unlockDay: 31,
    initialStock: 3
  }),
  createProduct({
    id: "frozen_pizza",
    name: "냉동피자",
    finalName: "오븐 없이도 살아난 냉동피자",
    imagePath: "./assets/images/products/frozen_pizza.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_fridge_1",
    purchasePrice: 4100,
    salePrice: 6800,
    finalSalePrice: 10200,
    contractCost: 40800,
    shelfLifeDays: 12,
    unlockDay: 31,
    initialStock: 3
  }),
  createProduct({
    id: "miracle_tiramisu",
    name: "폐기 직전 기사회생 티라미수",
    finalName: "폐기 직전 부활한 전설의 티라미수",
    imagePath: "./assets/images/products/miracle_tiramisu.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRIDGE,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_fridge_2",
    purchasePrice: 4500,
    salePrice: 7500,
    finalSalePrice: 15000,
    isPremiumBM: true,
    diamondPrice: 150,
    shelfLifeDays: 2,
    unlockDay: PREMIUM_BM_LOCK_DAY,
    initialStock: 3
  }),
  createProduct({
    id: "spicy_pork_lunchbox",
    name: "매콤 제육도시락",
    finalName: "사장님도 줄 서는 매콤 제육도시락",
    imagePath: "./assets/images/products/spicy_pork_lunchbox.webp",
    category: PRODUCT_CATEGORIES.READY_MEAL,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_fresh_shelf_1",
    purchasePrice: 4100,
    salePrice: 6800,
    finalSalePrice: 10200,
    contractCost: 40800,
    shelfLifeDays: 2,
    unlockDay: 34,
    initialStock: 3,
    customerRequestIds: ["lunch_box"]
  }),
  createProduct({
    id: "cheese_kimchi_rice",
    name: "치즈 김치볶음밥",
    finalName: "치즈가 폭주한 김치볶음밥",
    imagePath: "./assets/images/products/cheese_kimchi_rice.webp",
    category: PRODUCT_CATEGORIES.READY_MEAL,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_fresh_shelf_1",
    purchasePrice: 3600,
    salePrice: 6000,
    finalSalePrice: 9000,
    contractCost: 36000,
    shelfLifeDays: 2,
    unlockDay: 34,
    initialStock: 3,
    customerRequestIds: ["lunch_box"]
  }),
  createProduct({
    id: "pork_cutlet_lunchbox",
    name: "왕돈가스 도시락",
    finalName: "뚜껑이 안 닫히는 왕돈가스 도시락",
    imagePath: "./assets/images/products/pork_cutlet_lunchbox.webp",
    category: PRODUCT_CATEGORIES.READY_MEAL,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_fresh_shelf_2",
    purchasePrice: 5000,
    salePrice: 8300,
    finalSalePrice: 12500,
    contractCost: 49800,
    shelfLifeDays: 2,
    unlockDay: 37,
    initialStock: 3,
    customerRequestIds: ["lunch_box"]
  }),
  createProduct({
    id: "premium_sandwich",
    name: "사장님도 못 먹어본 프리미엄 샌드위치",
    finalName: "사장님 월급날에만 먹는 프리미엄 샌드위치",
    imagePath: "./assets/images/products/premium_sandwich.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_fresh_shelf_2",
    purchasePrice: 5000,
    salePrice: 8300,
    finalSalePrice: 16600,
    isPremiumBM: true,
    diamondPrice: 180,
    shelfLifeDays: 2,
    unlockDay: PREMIUM_BM_LOCK_DAY,
    initialStock: 3
  }),
  createProduct({
    id: "coffee",
    name: "잠깨는 캔커피",
    finalName: "야간알바의 눈물 캔커피",
    imagePath: "./assets/images/products/coffee.webp",
    category: PRODUCT_CATEGORIES.DRINK,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.WARMER,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_warmer_1",
    purchasePrice: 1600,
    salePrice: 2700,
    finalSalePrice: 4100,
    contractCost: 16200,
    shelfLifeDays: 7,
    unlockDay: 37,
    initialStock: 3
  }),
  createProduct({
    id: "sausage_hotbar",
    name: "소시지 핫바",
    finalName: "육즙이 뛰쳐나온 소시지 핫바",
    imagePath: "./assets/images/products/sausage_hotbar.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.WARMER,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_warmer_1",
    purchasePrice: 2000,
    salePrice: 3300,
    finalSalePrice: 5000,
    contractCost: 19800,
    shelfLifeDays: 3,
    unlockDay: 40,
    initialStock: 3
  }),
  createProduct({
    id: "microwave_hotbar",
    name: "전자레인지가 두려워한 핫바",
    finalName: "전자레인지도 무릎 꿇은 핫바",
    imagePath: "./assets/images/products/microwave_hotbar.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.WARMER,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_warmer_1",
    purchasePrice: 3800,
    salePrice: 6300,
    finalSalePrice: 12600,
    isPremiumBM: true,
    diamondPrice: 120,
    shelfLifeDays: 3,
    unlockDay: PREMIUM_BM_LOCK_DAY,
    initialStock: 3
  }),
  createProduct({
    id: "tteokbokki",
    name: "즉석떡볶이",
    finalName: "분식집이 긴장한 즉석떡볶이",
    imagePath: "./assets/images/products/tteokbokki.webp",
    category: PRODUCT_CATEGORIES.INSTANT_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.WARMER,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_warmer_1",
    purchasePrice: 3200,
    salePrice: 5300,
    finalSalePrice: 8000,
    contractCost: 31800,
    shelfLifeDays: 3,
    unlockDay: 40,
    initialStock: 3
  }),
  createProduct({
    id: "roasted_sweet_potato",
    name: "군고구마",
    finalName: "겨울 퇴근길을 붙잡는 군고구마",
    imagePath: "./assets/images/products/roasted_sweet_potato.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.WARMER,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_warmer_1",
    purchasePrice: 1600,
    salePrice: 2700,
    finalSalePrice: 4100,
    contractCost: 16200,
    shelfLifeDays: 3,
    unlockDay: 43,
    initialStock: 3
  }),
  createProduct({
    id: "hoppang",
    name: "호빵",
    finalName: "손난로보다 따뜻한 호빵",
    imagePath: "./assets/images/products/hoppang.webp",
    category: PRODUCT_CATEGORIES.FRESH_FOOD,
    displayCategory: PRODUCT_DISPLAY_CATEGORIES.WARMER,
    requiredZoneId: PRODUCT_ZONE_IDS.ZONE_4,
    targetShelfInstanceId: "zone4_warmer_1",
    purchasePrice: 1400,
    salePrice: 2400,
    finalSalePrice: 3600,
    contractCost: 14400,
    shelfLifeDays: 3,
    unlockDay: 43,
    initialStock: 3
  })
]);

export function getProductById(productId) {
  return PRODUCTS.find((product) => product.id === productId) ?? null;
}

export function getProductShelfId(productId) {
  return getProductById(productId)?.shelfId ?? PRODUCT_SHELF_IDS.BASIC;
}

export function getDisplayCategoryForShelfId(shelfId) {
  return PRODUCT_SHELF_ID_TO_DISPLAY_CATEGORY[shelfId] ?? null;
}

export function getShelfIdForDisplayCategory(displayCategory) {
  return PRODUCT_DISPLAY_CATEGORY_TO_SHELF_ID[displayCategory] ?? null;
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
