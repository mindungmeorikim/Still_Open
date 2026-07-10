/*
  CustomerData.js

  담당:
  - 3번 담당자 작업물 병합용 변환

  역할:
  - 손님 타입 데이터
  - 손님 상태값
  - 손님 이동 구역
  - 손님별 선호 상품
  - 고객 이벤트 후보는 EventData.js 기준으로 관리

  규칙:
  - 실제 Date 사용 금지
  - GameState.todayStats 직접 수정 금지
  - 시스템 연결은 CustomerSystem에서 EventBus로 처리
*/

export const CUSTOMER_STATUS = {
  ENTERING: "entering",
  SHOPPING: "shopping",
  WAITING: "waiting",
  CHECKOUT: "checkout",
  LEAVING: "leaving",
  ANGRY: "angry"
};

export const CUSTOMER_ZONES = {
  DOOR: "door",
  SHELF: "shelf",
  COUNTER: "counter",
  EXIT: "exit"
};

export const CUSTOMER_WANTED_PRODUCTS = [
  {
    id: "potato_chips",
    name: "감자칩"
  },
  {
    id: "chocolate_bar",
    name: "초코바"
  },
  {
    id: "triangle_kimbap",
    name: "삼각김밥"
  },
  {
    id: "banana_milk",
    name: "바나나우유"
  },
  {
    id: "orange_juice",
    name: "오렌지주스"
  },
  {
    id: "coffee",
    name: "커피"
  },
  {
    id: "iced_americano",
    name: "얼음 아메리카노"
  },
  {
    id: "lunch_box",
    name: "도시락"
  },
  {
    id: "ramen",
    name: "컵라면"
  },
  {
    id: "udon",
    name: "우동"
  },
  {
    id: "egg_sandwich",
    name: "달걀샌드"
  },
  {
    id: "sausage_hotbar",
    name: "소시지 핫바"
  },
  {
    id: "microwave_hotbar",
    name: "전자레인지 핫바"
  },
  {
    id: "spicy_shrimp_snack",
    name: "새우스낵"
  },
  {
    id: "pork_cutlet_lunchbox",
    name: "돈가스 도시락"
  },
  {
    id: "water",
    name: "생수"
  },
  {
    id: "cola",
    name: "콜라"
  },
  {
    id: "cream_bread",
    name: "크림빵"
  },
  {
    id: "roasted_egg",
    name: "구운계란"
  },
  {
    id: "golden_cookie",
    name: "황금쿠키"
  },
  {
    id: "hangover_drink",
    name: "숙취 음료"
  },
  {
    id: "ice_bar",
    name: "바 아이스크림"
  },
  {
    id: "cone_ice_cream",
    name: "콘 아이스크림"
  },
  {
    id: "pudding",
    name: "푸딩"
  },
  {
    id: "macaron",
    name: "마카롱"
  },
  {
    id: "tuna_mayo_sandwich",
    name: "참치마요 샌드"
  },
  {
    id: "healthy_salad",
    name: "건강샐러드"
  },
  {
    id: "frozen_pizza",
    name: "냉동피자"
  },
  {
    id: "miracle_tiramisu",
    name: "티라미수"
  },
  {
    id: "spicy_pork_lunchbox",
    name: "제육도시락"
  },
  {
    id: "cheese_kimchi_rice",
    name: "김치볶음밥"
  },
  {
    id: "premium_sandwich",
    name: "프리미엄 샌드위치"
  },
  {
    id: "tteokbokki",
    name: "즉석떡볶이"
  },
  {
    id: "roasted_sweet_potato",
    name: "군고구마"
  },
  {
    id: "hoppang",
    name: "호빵"
  }
];

export const CUSTOMER_TYPES = [
  {
    id: "normal",
    name: "일반 손님",
    weight: 40,
    patience: 30,
    spendBias: 1,
    preferredProductIds: [],
    eventChance: 0.08
  },
  {
    id: "student",
    name: "학생",
    weight: 20,
    patience: 30,
    spendBias: 0.8,
    preferredProductIds: ["triangle_kimbap", "banana_milk"],
    eventChance: 0.1
  },
  {
    id: "office_worker",
    name: "회사원",
    weight: 18,
    patience: 22,
    spendBias: 1.2,
    preferredProductIds: ["coffee", "iced_americano", "lunch_box"],
    eventChance: 0.12
  },
  {
    id: "hurried",
    name: "급한 손님",
    weight: 14,
    patience: 14,
    spendBias: 1,
    preferredProductIds: ["coffee", "iced_americano", "triangle_kimbap"],
    eventChance: 0.16
  },
  {
    id: "difficult",
    name: "진상 손님",
    weight: 8,
    patience: 25,
    spendBias: 0.7,
    preferredProductIds: [],
    eventChance: 0.3,
    entryDialogues: [
      "여기 알바 누구야?",
      "나 오늘 기분 별로니까 빨리 처리해요.",
      "이 매장 책임자 불러도 되죠?",
      "내가 단골인데 이런 대접 처음이네."
    ]
  }
];

export const CUSTOMER_EVENTS = Object.freeze([]);
