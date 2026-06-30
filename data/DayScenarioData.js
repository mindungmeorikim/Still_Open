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
    customerTypeWeights: Object.freeze({
      ...(scenario.customerTypeWeights ?? {})
    })
  });
};

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
    ctaText: "첫 영업 준비하기",
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
      difficult: 1
    },
    eventRateMultiplier: 0.7
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
    ctaText: "Day 2 발주 준비",
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
      hurried: 7,
      difficult: 3
    },
    eventRateMultiplier: 0.85
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
    ctaText: "Day 3 발주 준비",
    responseUnlocks: ["재촉 손님 대응"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "coffee",
      "energy_drink",
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
    ctaText: "Day 4 발주 준비",
    responseUnlocks: ["진상 손님 응대 선택지"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "coffee",
      "energy_drink",
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
    ctaText: "마지막 프롤로그 준비",
    responseUnlocks: ["종합 대응"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "coffee",
      "energy_drink",
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
    ctaText: "무한 영업 준비",
    responseUnlocks: ["랜덤 대응 상황"],
    wantedProductIds: [
      "triangle_kimbap",
      "banana_milk",
      "coffee",
      "energy_drink",
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

export function getDayScenario(day) {
  const safeDay = Math.max(1, Math.floor(Number(day) || 1));

  if (DAY_SCENARIOS[safeDay]) {
    return DAY_SCENARIOS[safeDay];
  }

  const endlessScenario = DAY_SCENARIOS[6];
  const extraDay = safeDay - 6;

  return {
    ...endlessScenario,
    day: safeDay,
    title: `Day ${safeDay}. 무한 영업`,
    subtitle: "프롤로그에서 배운 모든 상황이 섞여 등장합니다.",
    story: "손님 유형, 상품 요청, 이벤트가 매일 다른 조합으로 등장하고 난이도는 계속 상승합니다.",
    eventRateMultiplier:
      endlessScenario.eventRateMultiplier + Math.min(1, extraDay * 0.04),
    isEndlessScenario: true
  };
}
