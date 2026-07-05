/*
  DayScenarioData.js

  역할:
  - Day 1~5 프롤로그/스토리 모드 안내 및 진행 차이 데이터
  - Day 6 이후 무한모드 안내 및 손님/상품/이벤트 풀 기준

  규칙:
  - 실제 Date 사용 금지
  - 모든 기준은 GameState.day에서 사용할 Day 단위로 정의
*/

const createScenario = (scenario) => {
  return Object.freeze({
    ...scenario,
    features: Object.freeze([...(scenario.features ?? [])]),
    responseUnlocks: Object.freeze([...(scenario.responseUnlocks ?? [])]),
    wantedProductIds: Object.freeze([...(scenario.wantedProductIds ?? [])]),
    recommendedProductIds: Object.freeze([...(scenario.recommendedProductIds ?? [])]),
    recommendedProductReasons: Object.freeze({
      ...(scenario.recommendedProductReasons ?? {})
    }),
    marketInfo: Object.freeze({
      ...(scenario.marketInfo ?? {})
    }),
    customerTypeWeights: Object.freeze({
      ...(scenario.customerTypeWeights ?? {})
    })
  });
};

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const createMarketScenario = (market) => Object.freeze({
  ...market,
  targetProductIds: Object.freeze([...(market.targetProductIds ?? [])]),
  wantedProductIds: Object.freeze([...(market.wantedProductIds ?? market.targetProductIds ?? [])]),
  recommendedProductIds: Object.freeze([...(market.recommendedProductIds ?? market.targetProductIds ?? [])]),
  recommendedProductReasons: Object.freeze({ ...(market.recommendedProductReasons ?? {}) }),
  customerTypeWeights: Object.freeze({ ...(market.customerTypeWeights ?? {}) })
});

export const MARKET_SCENARIOS = Object.freeze({
  normal: createMarketScenario({
    id: "normal",
    name: "기본 상권",
    weatherLabel: "기본 상권",
    headline: "오늘은 특별한 상권 변화가 없습니다.",
    message: "안정적인 기본 상품 위주로 발주해도 무난한 하루입니다.",
    targetProductIds: [],
    minAvailableProductCount: 0,
    recommendedProductIds: ["potato_chips", "water"],
    recommendedProductReasons: {
      potato_chips: "초반부터 안정적인 간식 수요",
      water: "모든 상권에서 꾸준히 팔리는 기본 음료"
    }
  }),
  starter_basics: createMarketScenario({
    id: "starter_basics",
    name: "동네 기본 수요",
    weatherLabel: "기본 수요",
    headline: "동네 기본 장보기 수요가 늘었습니다.",
    message: "아직 상권이 크게 갈리지 않은 시기입니다. 감자칩, 생수, 컵면, 콜라처럼 초반 상품을 중심으로 준비하세요.",
    targetProductIds: ["potato_chips", "water", "ramen", "cola"],
    minAvailableProductCount: 1,
    recommendedProductIds: ["potato_chips", "water", "ramen", "cola"],
    recommendedProductReasons: {
      potato_chips: "가볍게 집어가는 기본 간식",
      water: "초반 안정 수요 음료",
      ramen: "해금 후 기본 식사 수요",
      cola: "해금 후 간식 동반 구매 수요"
    },
    customerTypeWeights: {
      normal: 62,
      student: 22,
      office_worker: 12,
      hurried: 4,
      difficult: 0
    }
  }),
  school_peak: createMarketScenario({
    id: "school_peak",
    name: "등교길 피크",
    weatherLabel: "등교길",
    headline: "등교길 학생 손님이 늘어나는 날입니다.",
    message: "간편식과 달콤한 음료 수요가 강합니다. 학생 손님이 빠르게 집어갈 상품을 준비하세요.",
    targetProductIds: ["triangle_kimbap", "banana_milk", "egg_sandwich", "tuna_mayo_sandwich", "premium_sandwich"],
    minAvailableProductCount: 2,
    recommendedProductIds: ["triangle_kimbap", "banana_milk", "egg_sandwich", "tuna_mayo_sandwich", "premium_sandwich"],
    recommendedProductReasons: {
      triangle_kimbap: "등교길 대표 간편식",
      banana_milk: "학생 손님 선호 음료",
      egg_sandwich: "아침 대용 신선식품",
      tuna_mayo_sandwich: "점심 전후 간편식 수요",
      premium_sandwich: "프리미엄 간편식 수요"
    },
    customerTypeWeights: {
      normal: 30,
      student: 44,
      office_worker: 12,
      hurried: 12,
      difficult: 2
    }
  }),
  rainy_day: createMarketScenario({
    id: "rainy_day",
    name: "비 오는 날",
    weatherLabel: "비",
    headline: "비 오는 날에는 따뜻한 상품 수요가 올라갑니다.",
    message: "컵면, 우동, 온장고 상품처럼 몸을 데워주는 상품을 우선 확인하세요.",
    targetProductIds: ["ramen", "udon", "sausage_hotbar", "tteokbokki", "roasted_sweet_potato", "hoppang", "microwave_hotbar"],
    minAvailableProductCount: 2,
    recommendedProductIds: ["ramen", "udon", "sausage_hotbar", "tteokbokki", "roasted_sweet_potato", "hoppang", "microwave_hotbar"],
    recommendedProductReasons: {
      ramen: "비 오는 날 따뜻한 컵면 수요",
      udon: "쌀쌀한 날씨에 맞는 간편식",
      sausage_hotbar: "따뜻한 간식 수요",
      tteokbokki: "매콤한 즉석식 수요",
      roasted_sweet_potato: "비 오는 날 온장고 간식",
      hoppang: "쌀쌀한 날씨 대표 상품",
      microwave_hotbar: "프리미엄 온장고 상품 수요"
    },
    customerTypeWeights: {
      normal: 44,
      student: 18,
      office_worker: 24,
      hurried: 10,
      difficult: 4
    }
  }),
  exam_period: createMarketScenario({
    id: "exam_period",
    name: "시험 기간",
    weatherLabel: "시험 기간",
    headline: "시험 기간 각성 음료와 간식 수요가 늘었습니다.",
    message: "커피류와 달콤한 간식을 넉넉히 준비하면 추천 상품 판매 미션에도 유리합니다.",
    targetProductIds: ["coffee", "iced_americano", "chocolate_bar", "macaron", "golden_cookie", "cola"],
    minAvailableProductCount: 2,
    recommendedProductIds: ["coffee", "iced_americano", "chocolate_bar", "macaron", "golden_cookie", "cola"],
    recommendedProductReasons: {
      coffee: "집중을 위한 캔커피 수요",
      iced_americano: "각성 음료 수요",
      chocolate_bar: "시험 기간 당 충전 간식",
      macaron: "고가 디저트 간식 수요",
      golden_cookie: "프리미엄 간식 수요",
      cola: "간식 동반 음료 수요"
    },
    customerTypeWeights: {
      normal: 30,
      student: 34,
      office_worker: 18,
      hurried: 14,
      difficult: 4
    }
  }),
  friday_night: createMarketScenario({
    id: "friday_night",
    name: "불금 밤",
    weatherLabel: "불금",
    headline: "불금 밤 식사류와 고가 상품 수요가 강해졌습니다.",
    message: "도시락, 숙취 음료, 프리미엄 상품처럼 객단가가 높은 상품을 확인하세요.",
    targetProductIds: ["hangover_drink", "frozen_pizza", "spicy_pork_lunchbox", "cheese_kimchi_rice", "pork_cutlet_lunchbox", "miracle_tiramisu", "premium_sandwich"],
    wantedProductIds: ["hangover_drink", "frozen_pizza", "lunch_box", "miracle_tiramisu", "premium_sandwich"],
    minAvailableProductCount: 2,
    recommendedProductIds: ["hangover_drink", "frozen_pizza", "spicy_pork_lunchbox", "cheese_kimchi_rice", "pork_cutlet_lunchbox", "miracle_tiramisu", "premium_sandwich"],
    recommendedProductReasons: {
      hangover_drink: "불금 밤 숙취 대비 수요",
      frozen_pizza: "야식 대체 고가 상품",
      spicy_pork_lunchbox: "늦은 식사류 수요",
      cheese_kimchi_rice: "야식형 식사 수요",
      pork_cutlet_lunchbox: "높은 객단가 식사류",
      miracle_tiramisu: "프리미엄 디저트 수요",
      premium_sandwich: "프리미엄 간편식 수요"
    },
    customerTypeWeights: {
      normal: 24,
      student: 12,
      office_worker: 32,
      hurried: 20,
      difficult: 12
    }
  })
});

const SPECIAL_MARKET_IDS = Object.freeze([
  "school_peak",
  "rainy_day",
  "exam_period",
  "friday_night"
]);

const MARKET_STAGE_WEIGHTS = Object.freeze({
  0: Object.freeze({ normal: 80, starter: 20, special: 0 }),
  1: Object.freeze({ normal: 70, starter: 15, special: 15 }),
  2: Object.freeze({ normal: 60, starter: 15, special: 12.5 }),
  3: Object.freeze({ normal: 55, starter: 7.5, special: 12.5 }),
  4: Object.freeze({ normal: 50, starter: 0, special: 12.5 })
});

const seededRatio = (day, salt = 0) => {
  let seed = Math.max(1, Math.floor(Number(day) || 1)) * 9301 + 49297 + salt;
  seed = (seed * 233280 + 12345) % 2147483647;
  return (seed % 100000) / 100000;
};

const getAvailableIds = (ids = [], availableSet = new Set()) => {
  return ids.filter((id) => availableSet.has(id));
};

const canUseMarket = (market, availableProductIds = new Set()) => {
  if (!market || market.id === "normal") return true;
  const availableTargets = getAvailableIds(market.targetProductIds, availableProductIds);
  return availableTargets.length >= (market.minAvailableProductCount ?? 1);
};

export function selectMarketScenario(day, options = {}) {
  const availableProductIds = new Set(options.sellableProductIds ?? []);
  const starter = MARKET_SCENARIOS.starter_basics;
  const starterAvailable = canUseMarket(starter, availableProductIds);
  const availableSpecialIds = SPECIAL_MARKET_IDS.filter((marketId) => {
    return canUseMarket(MARKET_SCENARIOS[marketId], availableProductIds);
  });
  const specialCount = Math.min(4, availableSpecialIds.length);
  const stageWeights = MARKET_STAGE_WEIGHTS[specialCount] ?? MARKET_STAGE_WEIGHTS[0];
  const entries = [];

  entries.push({ id: "normal", weight: stageWeights.normal });

  if (stageWeights.starter > 0) {
    entries.push({
      id: starterAvailable ? "starter_basics" : "normal",
      weight: stageWeights.starter
    });
  }

  availableSpecialIds.forEach((marketId) => {
    entries.push({ id: marketId, weight: stageWeights.special });
  });

  const mergedEntries = Object.values(entries.reduce((map, entry) => {
    if (!entry.id || entry.weight <= 0) return map;
    map[entry.id] = map[entry.id] ?? { id: entry.id, weight: 0 };
    map[entry.id].weight += entry.weight;
    return map;
  }, {}));
  const totalWeight = mergedEntries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = seededRatio(day, [...availableProductIds].join("").length) * totalWeight;
  const selectedEntry = mergedEntries.find((entry) => {
    roll -= entry.weight;
    return roll <= 0;
  }) ?? mergedEntries[0] ?? { id: "normal", weight: 100 };
  const market = MARKET_SCENARIOS[selectedEntry.id] ?? MARKET_SCENARIOS.normal;

  return {
    ...market,
    weight: selectedEntry.weight,
    totalWeight,
    probability: totalWeight > 0 ? selectedEntry.weight / totalWeight : 1,
    availableSpecialMarketIds: availableSpecialIds,
    availableTargetProductIds: getAvailableIds(market.targetProductIds, availableProductIds)
  };
}

export function applyMarketScenarioToDayScenario(scenario, marketScenario, options = {}) {
  const availableProductIds = new Set(options.sellableProductIds ?? []);
  const availableRequestIds = new Set(options.sellableRequestIds ?? options.sellableProductIds ?? []);
  const market = marketScenario ?? MARKET_SCENARIOS.normal;
  const baseRecommendedIds = (scenario.recommendedProductIds ?? []).filter((productId) => {
    return availableProductIds.has(productId);
  });
  const marketRecommendedIds = (market.recommendedProductIds ?? []).filter((productId) => {
    return availableProductIds.has(productId);
  });
  const fallbackRecommendedIds = [...availableProductIds].slice(0, 4);
  const recommendedProductIds = unique([
    ...marketRecommendedIds,
    ...baseRecommendedIds,
    ...fallbackRecommendedIds
  ]).slice(0, 5);
  const baseWantedIds = (scenario.wantedProductIds ?? []).filter((requestId) => {
    return availableRequestIds.has(requestId);
  });
  const marketWantedIds = (market.wantedProductIds ?? []).filter((requestId) => {
    return availableRequestIds.has(requestId);
  });
  const wantedProductIds = unique([
    ...marketWantedIds,
    ...baseWantedIds,
    ...availableRequestIds
  ]);

  return {
    ...scenario,
    marketScenario: market,
    marketInfo: {
      ...(scenario.marketInfo ?? {}),
      weatherLabel: market.weatherLabel ?? scenario.marketInfo?.weatherLabel,
      headline: market.headline ?? scenario.marketInfo?.headline,
      message: market.message ?? scenario.marketInfo?.message
    },
    recommendedProductIds,
    recommendedProductReasons: {
      ...(scenario.recommendedProductReasons ?? {}),
      ...(market.recommendedProductReasons ?? {})
    },
    wantedProductIds,
    customerTypeWeights: {
      ...(scenario.customerTypeWeights ?? {}),
      ...(market.customerTypeWeights ?? {})
    }
  };
}

export const DAY_SCENARIOS = Object.freeze({
  1: createScenario({
    day: 1,
    title: "Day 1. 첫 영업 시작",
    subtitle: "작은 편의점의 첫 하루입니다.",
    story: "발주부터 계산, 정산까지 편의점 운영의 기본 흐름을 경험합니다.",
    features: [
      "기본 상품 판매",
      "일반 손님 중심",
      "낮은 진상 손님 비율",
      "기본 발주/계산/정산 루프 진행"
    ],
    tip: "처음부터 모든 걸 잘할 필요는 없습니다. 손님을 계산하고 하루를 마치는 것부터 시작하세요.",
    ctaText: "발주하러 가기",
    marketInfo: {
      weatherLabel: "맑음",
      headline: "첫 영업은 기본 상품 수요가 안정적입니다.",
      message: "오늘은 특별한 상권 이슈가 없습니다. 삼각밥, 생수, 컵면처럼 손님이 자주 찾는 기본 상품을 먼저 준비해보세요."
    },
    recommendedProductIds: ["triangle_kimbap", "water", "ramen"],
    recommendedProductReasons: {
      triangle_kimbap: "출근길 기본 식사 수요",
      water: "모든 Day에 안정적인 기본 음료",
      ramen: "초반 매출을 만들기 쉬운 간편식"
    },
    responseUnlocks: ["기본 계산 대응"],
    wantedProductIds: [
      "triangle_kimbap",
      "water",
      "ramen",
      "potato_chips",
      "chocolate_bar",
      "cola"
    ],
    customerTypeWeights: {
      normal: 62,
      student: 24,
      office_worker: 10,
      hurried: 3,
      difficult: 0
    },
    eventRateMultiplier: 0
  }),
  2: createScenario({
    day: 2,
    title: "Day 2. 상품이 늘어나는 날",
    subtitle: "손님이 고르는 상품이 조금 더 다양해집니다.",
    story: "기본 상품에 음료와 도시락 상품이 더해지며 발주 선택의 폭이 넓어집니다.",
    features: [
      "판매 가능 상품 증가",
      "손님 수 소폭 증가",
      "까다로운 손님 낮은 확률 등장",
      "상품별 발주 수량 선택 중요"
    ],
    tip: "매입가와 판매가를 비교하면서 오늘 팔릴 상품을 조금씩 준비해보세요.",
    ctaText: "발주하러 가기",
    marketInfo: {
      weatherLabel: "비",
      headline: "비 오는 날에는 따뜻한 간편식 수요가 늘어납니다.",
      message: "오늘은 비가 올 예정입니다. 우산 상품은 아직 회의 후 확정 예정이므로, 지금은 따뜻한 컵면과 우동류를 넉넉히 준비해보세요."
    },
    recommendedProductIds: ["ramen", "udon", "banana_milk"],
    recommendedProductReasons: {
      ramen: "비 오는 날 따뜻한 상품 수요",
      udon: "쌀쌀한 날씨에 어울리는 간편식",
      banana_milk: "학생 손님 선호 음료"
    },
    responseUnlocks: ["빠른 계산"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "orange_juice",
      "lunch_box",
      "ramen",
      "udon",
      "water"
    ],
    customerTypeWeights: {
      normal: 48,
      student: 26,
      office_worker: 16,
      hurried: 10,
      difficult: 0
    },
    eventRateMultiplier: 0.55
  }),
  3: createScenario({
    day: 3,
    title: "Day 3. 재고 관리 압박",
    subtitle: "많이 팔수록 폐기와 재고 관리가 중요해집니다.",
    story: "신선 상품과 식사류가 늘어나며 유통기한과 재고 부족을 함께 신경 써야 합니다.",
    features: [
      "유통기한/폐기 손실 압박 증가",
      "급한 손님 등장 확률 증가",
      "재고 운영 난이도 상승",
      "짧은 유통기한 상품 관리 필요"
    ],
    tip: "유통기한이 짧은 상품은 조금씩 자주 발주하는 편이 안전합니다.",
    ctaText: "발주하러 가기",
    marketInfo: {
      weatherLabel: "한파",
      headline: "김이 서릴 정도로 추운 날씨입니다.",
      message: "오늘은 추운 날씨 탓에 따뜻한 식사류와 각성 음료 수요가 늘어날 수 있습니다. 컵면, 우동, 캔커피를 확인해보세요."
    },
    recommendedProductIds: ["ramen", "udon", "coffee"],
    recommendedProductReasons: {
      ramen: "한파 대응 따뜻한 식사",
      udon: "추운 날씨 추천 간편식",
      coffee: "출근길 직장인 수요"
    },
    responseUnlocks: ["재촉 손님 대응"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "coffee",
      "iced_americano",
      "lunch_box",
      "ramen",
      "udon",
      "egg_sandwich",
      "water"
    ],
    customerTypeWeights: {
      normal: 38,
      student: 22,
      office_worker: 20,
      hurried: 14,
      difficult: 6
    },
    eventRateMultiplier: 1
  }),
  4: createScenario({
    day: 4,
    title: "Day 4. 돌발 상황 시작",
    subtitle: "이제 진짜 편의점다운 돌발 상황이 시작됩니다.",
    story: "진상 손님과 급한 손님 비율이 늘고, 랜덤 이벤트도 더 자주 발생합니다.",
    features: [
      "진상 손님 비율 증가",
      "진상 대응 선택지 일부 해금",
      "랜덤 이벤트 발생 확률 증가",
      "손님 대기 관리 중요"
    ],
    tip: "계산대 앞 손님을 오래 기다리게 두면 멘탈과 만족도가 흔들릴 수 있습니다.",
    ctaText: "발주하러 가기",
    marketInfo: {
      weatherLabel: "야근 상권",
      headline: "근처 회사에 야근 인원이 늘었습니다.",
      message: "늦은 시간까지 버티는 손님이 많아질 것 같습니다. 얼음 아메리카노, 캔커피, 간단히 먹을 수 있는 샌드위치를 추천합니다."
    },
    recommendedProductIds: ["iced_americano", "coffee", "egg_sandwich"],
    recommendedProductReasons: {
      iced_americano: "야근 손님 각성 음료 수요",
      coffee: "직장인 반복 구매 수요",
      egg_sandwich: "간단한 식사 대체 상품"
    },
    responseUnlocks: ["진상 손님 응대 선택지"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "coffee",
      "iced_americano",
      "lunch_box",
      "ramen",
      "udon",
      "egg_sandwich",
      "sausage_hotbar",
      "spicy_shrimp_snack",
      "water"
    ],
    customerTypeWeights: {
      normal: 30,
      student: 20,
      office_worker: 22,
      hurried: 18,
      difficult: 10
    },
    eventRateMultiplier: 1.15
  }),
  5: createScenario({
    day: 5,
    title: "Day 5. 프롤로그 마지막 영업",
    subtitle: "오늘을 버티면 본격적인 무한 영업이 시작됩니다.",
    story: "Day 1~4의 요소가 섞여 다양한 손님, 상품, 이벤트가 함께 등장합니다.",
    features: [
      "프롤로그 종합 난이도",
      "진상 손님과 다양한 상품 동시 등장",
      "랜덤 이벤트 빈도 증가",
      "무한모드 진입 예고"
    ],
    tip: "오늘은 재고를 넉넉히 준비하되, 유통기한이 짧은 상품은 과하게 쌓지 마세요.",
    ctaText: "발주하러 가기",
    marketInfo: {
      weatherLabel: "혼잡",
      headline: "프롤로그 마지막 영업으로 다양한 손님이 몰릴 예정입니다.",
      message: "오늘은 식사류, 음료, 간식 수요가 한꺼번에 섞입니다. 객단가가 높은 도시락과 빠르게 팔릴 수 있는 음료를 함께 준비하세요."
    },
    recommendedProductIds: ["pork_cutlet_lunchbox", "iced_americano", "sausage_hotbar"],
    recommendedProductReasons: {
      pork_cutlet_lunchbox: "높은 객단가 식사류",
      iced_americano: "급한 손님과 직장인 수요",
      sausage_hotbar: "간식/식사 사이 수요"
    },
    responseUnlocks: ["종합 대응"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "coffee",
      "iced_americano",
      "lunch_box",
      "ramen",
      "udon",
      "egg_sandwich",
      "sausage_hotbar",
      "spicy_shrimp_snack",
      "pork_cutlet_lunchbox",
      "water"
    ],
    customerTypeWeights: {
      normal: 26,
      student: 18,
      office_worker: 23,
      hurried: 20,
      difficult: 13
    },
    eventRateMultiplier: 1.3
  }),
  6: createScenario({
    day: 6,
    title: "Day 6. 무한모드 시작",
    subtitle: "이제부터는 매일 어떤 손님이 올지 알 수 없습니다.",
    story: "프롤로그에서 등장했던 손님, 상품, 이벤트가 랜덤 조합으로 섞여 등장합니다.",
    features: [
      "무한모드 시작",
      "Day 1~5 손님/상품/이벤트 랜덤 조합",
      "Day 증가에 따른 난이도 지속 상승",
      "매일 발주 판단 중요"
    ],
    tip: "매일 같은 정답은 없습니다. 전날 재고와 보유금을 보고 오늘의 발주를 정하세요.",
    ctaText: "발주하러 가기",
    marketInfo: {
      weatherLabel: "변동 상권",
      headline: "무한모드에서는 매일 수요가 달라집니다.",
      message: "오늘은 전날 재고와 보유금을 보고 안정 상품과 고마진 상품을 섞어 발주하는 것이 좋습니다."
    },
    recommendedProductIds: ["triangle_kimbap", "coffee", "ramen"],
    recommendedProductReasons: {
      triangle_kimbap: "안정적인 기본 식사 수요",
      coffee: "반복 구매가 쉬운 음료",
      ramen: "재고 운영이 쉬운 간편식"
    },
    responseUnlocks: ["랜덤 대응 상황"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "coffee",
      "iced_americano",
      "lunch_box",
      "ramen",
      "udon",
      "egg_sandwich",
      "sausage_hotbar",
      "spicy_shrimp_snack",
      "pork_cutlet_lunchbox",
      "water"
    ],
    customerTypeWeights: {
      normal: 24,
      student: 18,
      office_worker: 23,
      hurried: 21,
      difficult: 14
    },
    eventRateMultiplier: 1.35,
    isEndlessScenario: true
  })
});

export function getDayScenario(day, options = {}) {
  const safeDay = Math.max(1, Math.floor(Number(day) || 1));
  const hasMarketOptions =
    Array.isArray(options.sellableProductIds) ||
    Array.isArray(options.sellableRequestIds);
  const applyMarket = (scenario) => {
    if (!hasMarketOptions) return scenario;
    const marketScenario = selectMarketScenario(safeDay, options);
    return applyMarketScenarioToDayScenario(scenario, marketScenario, options);
  };

  if (DAY_SCENARIOS[safeDay]) {
    return applyMarket(DAY_SCENARIOS[safeDay]);
  }

  const endlessScenario = DAY_SCENARIOS[6];
  const extraDay = safeDay - 6;

  return applyMarket({
    ...endlessScenario,
    day: safeDay,
    title: `Day ${safeDay}. 무한 영업`,
    subtitle: "프롤로그에서 배운 모든 상황이 섞여 등장합니다.",
    story: "손님 유형, 상품 요청, 이벤트가 매일 다른 조합으로 등장하고 난이도는 계속 상승합니다.",
    eventRateMultiplier:
      endlessScenario.eventRateMultiplier + Math.min(1, extraDay * 0.04),
    isEndlessScenario: true
  });
}
