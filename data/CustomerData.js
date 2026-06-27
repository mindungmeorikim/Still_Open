/*
  CustomerData.js

  담당:
  - 3번 담당자 작업물 병합용 변환

  역할:
  - 손님 타입 데이터
  - 손님 상태값
  - 손님 이동 구역
  - 손님별 선호 상품
  - 랜덤 이벤트 후보 데이터

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
    id: "triangle_kimbap",
    name: "삼각김밥"
  },
  {
    id: "banana_milk",
    name: "바나나우유"
  },
  {
    id: "coffee",
    name: "커피"
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
    id: "water",
    name: "생수"
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
    preferredProductIds: ["coffee", "lunch_box"],
    eventChance: 0.12
  },
  {
    id: "hurried",
    name: "급한 손님",
    weight: 14,
    patience: 14,
    spendBias: 1,
    preferredProductIds: ["coffee", "triangle_kimbap"],
    eventChance: 0.16
  },
  {
    id: "difficult",
    name: "진상 손님",
    weight: 8,
    patience: 25,
    spendBias: 0.7,
    preferredProductIds: [],
    eventChance: 0.3
  }
];

export const CUSTOMER_EVENTS = [
  {
    id: "one_plus_one_confusion",
    title: "1+1 착각 손님",
    description: "행사 상품 조건을 착각한 손님 이벤트입니다.",
    allowedTypeIds: ["normal", "student", "difficult"]
  },
  {
    id: "bag_request",
    title: "봉투 요청 손님",
    description: "결제 중 봉투가 필요한 손님 이벤트입니다.",
    allowedTypeIds: ["normal", "student", "office_worker", "hurried", "difficult"]
  },
  {
    id: "impatient_worker",
    title: "급한 직장인",
    description: "빠른 처리를 원하는 회사원 또는 급한 손님 이벤트입니다.",
    allowedTypeIds: ["office_worker", "hurried"]
  },
  {
    id: "transit_card_charge",
    title: "교통카드 충전",
    description: "교통카드 충전을 요청하는 손님 이벤트입니다.",
    allowedTypeIds: ["student", "normal"]
  },
  {
    id: "rude_complaint",
    title: "진상 손님 불만",
    description: "불만을 제기하는 진상 손님 이벤트입니다.",
    allowedTypeIds: ["difficult"]
  }
];