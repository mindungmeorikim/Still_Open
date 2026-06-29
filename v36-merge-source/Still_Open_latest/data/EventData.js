/*
  EventData.js

  Role:
  - Detailed customer event data for MVP interactions.
  - Data only. Event triggering, UI, and effects are handled by systems later.
*/

export const CUSTOMER_EVENT_DETAILS = Object.freeze([
  {
    id: "bag_request",
    title: "봉투 요청 손님",
    summary: "손님이 봉투 하나를 두고 인생의 무게를 느끼기 시작합니다.",
    unlockDay: 1,
    recommendedDay: 1,
    baseChance: 0.1,
    allowedTypeIds: Object.freeze([
      "normal",
      "student",
      "office_worker",
      "hurried",
      "difficult"
    ]),
    dialogue: "봉투 하나 주세요. 근데… 유료인가요?",
    priority: 10,
    choices: Object.freeze([
      {
        id: "provide_bag",
        label: "봉투를 제공한다",
        description: "말없이 봉투를 건네며 편의점 평화를 지킵니다.",
        resultText: "손님이 봉투를 받아 들고 세상의 균형을 되찾습니다.",
        effects: Object.freeze({
          satisfaction: 0,
          mental: 0,
          inventory: Object.freeze({
            itemId: "shopping_bag",
            quantity: -1
          }),
          message: "봉투를 제공했습니다."
        })
      },
      {
        id: "explain_bag_fee",
        label: "유료 봉투라고 설명한다",
        description: "봉투가 무료가 아니라는 현실을 차분히 안내합니다.",
        resultText: "손님이 잠깐 멈칫하더니 봉투 구매 여부를 진지하게 고민합니다.",
        effects: Object.freeze({
          satisfaction: -1,
          mental: 0,
          money: 50,
          message: "유료 봉투를 안내했습니다."
        })
      },
      {
        id: "no_bag_available",
        label: "지금은 봉투가 없다고 안내한다",
        description: "봉투가 없다는 슬픈 소식을 조심스럽게 전합니다.",
        resultText: "손님이 두 손을 바라보며 오늘의 운반 계획을 다시 세웁니다.",
        effects: Object.freeze({
          satisfaction: -2,
          mental: -1,
          angryChance: 0.1,
          message: "봉투가 없다고 안내했습니다."
        })
      }
    ]),
    affectedStats: Object.freeze(["satisfaction", "mental", "inventory", "money"]),
    ui: Object.freeze({
      tone: "service",
      icon: "bag",
      choiceLayout: "vertical"
    })
  },
  {
    id: "one_plus_one_confusion",
    title: "1+1 착각 손님",
    summary: "손님이 상품 앞에서 보이지 않는 1+1 기운을 감지했습니다.",
    unlockDay: 2,
    recommendedDay: 2,
    baseChance: 0.08,
    allowedTypeIds: Object.freeze(["normal", "student", "difficult"]),
    dialogue: "이거 1+1 아니에요? 느낌이 딱 그런데요?",
    priority: 20,
    choices: Object.freeze([
      {
        id: "explain_not_promotion",
        label: "행사 상품이 아니라고 안내한다",
        description: "행사 상품이 아니라는 사실을 최대한 부드럽게 설명합니다.",
        resultText: "손님이 아쉬워하지만 행사표를 다시 확인하고 고개를 끄덕입니다.",
        effects: Object.freeze({
          satisfaction: -1,
          mental: 0,
          message: "행사 조건을 안내했습니다."
        })
      },
      {
        id: "give_extra_item",
        label: "그냥 하나 더 준다",
        description: "평화를 위해 하나 더 주는 극단적 친절을 선택합니다.",
        resultText: "손님은 행복해졌지만, 편의점 어딘가의 재고가 조용히 울었습니다.",
        effects: Object.freeze({
          satisfaction: 0,
          mental: -1,
          inventory: Object.freeze({
            quantity: -1
          }),
          message: "상품을 하나 더 제공했습니다."
        })
      },
      {
        id: "ask_manager_check",
        label: "점장 확인 중이라고 기다리게 한다",
        description: "확신이 없는 순간, 점장이라는 이름의 시간을 법니다.",
        resultText: "손님이 팔짱을 끼고 기다리며 자신의 촉을 끝까지 믿습니다.",
        effects: Object.freeze({
          satisfaction: -2,
          mental: -1,
          waitTime: -3,
          angryChance: 0.15,
          message: "확인 중이라고 안내했습니다."
        })
      }
    ]),
    affectedStats: Object.freeze(["satisfaction", "mental", "inventory", "waitTime"]),
    ui: Object.freeze({
      tone: "confusion",
      icon: "promotion",
      choiceLayout: "vertical"
    })
  },
  {
    id: "transit_card_charge",
    title: "교통카드 충전",
    summary: "교통카드 잔액이 손님의 하루 계획을 위협하고 있습니다.",
    unlockDay: 2,
    recommendedDay: 2,
    baseChance: 0.07,
    allowedTypeIds: Object.freeze(["student", "normal"]),
    dialogue: "교통카드 충전 되나요? 버스가 저를 기다리진 않아서요.",
    priority: 15,
    choices: Object.freeze([
      {
        id: "charge_transit_card",
        label: "충전해 준다",
        description: "빠르게 충전을 처리해 손님의 등교/이동 루트를 구합니다.",
        resultText: "손님이 안도의 한숨을 쉬며 교통카드에 다시 희망을 충전합니다.",
        effects: Object.freeze({
          satisfaction: 0,
          mental: 0,
          money: 1000,
          message: "교통카드 충전을 처리했습니다."
        })
      },
      {
        id: "explain_unavailable",
        label: "지금은 안 된다고 안내한다",
        description: "현재 충전이 어렵다고 최대한 미안하게 설명합니다.",
        resultText: "손님이 멀어지는 버스의 환영을 본 듯 조용히 굳어버립니다.",
        effects: Object.freeze({
          satisfaction: -2,
          mental: -1,
          message: "충전이 어렵다고 안내했습니다."
        })
      },
      {
        id: "ask_checkout_first",
        label: "결제 먼저 하자고 한다",
        description: "편의점 질서를 위해 계산 순서를 먼저 안내합니다.",
        resultText: "손님이 급하지만 일단 계산대의 룰을 받아들입니다.",
        effects: Object.freeze({
          satisfaction: -1,
          mental: 0,
          waitTime: -2,
          message: "결제를 먼저 안내했습니다."
        })
      }
    ]),
    affectedStats: Object.freeze(["satisfaction", "mental", "money", "waitTime"]),
    ui: Object.freeze({
      tone: "service",
      icon: "card",
      choiceLayout: "vertical"
    })
  },
  {
    id: "impatient_worker",
    title: "급한 직장인",
    summary: "회의 3분 전, 회사원의 영혼이 계산대 앞에서 흔들립니다.",
    unlockDay: 3,
    recommendedDay: 3,
    baseChance: 0.12,
    allowedTypeIds: Object.freeze(["office_worker", "hurried"]),
    dialogue: "빨리 계산해 주세요. 회의가 저보다 먼저 도착했어요.",
    priority: 30,
    choices: Object.freeze([
      {
        id: "checkout_immediately",
        label: "바로 계산한다",
        description: "손놀림을 빠르게 해서 회사원의 사회생활을 구합니다.",
        resultText: "손님이 영수증을 받자마자 회의실을 향해 순간이동할 기세입니다.",
        effects: Object.freeze({
          satisfaction: 0,
          mental: 0,
          waitTime: 3,
          message: "빠르게 계산을 도왔습니다."
        })
      },
      {
        id: "keep_queue_order",
        label: "순서대로 기다리라고 한다",
        description: "급해도 줄은 줄이라는 편의점의 질서를 지킵니다.",
        resultText: "손님이 초조하게 시계를 보지만, 일단 사회적 질서를 받아들입니다.",
        effects: Object.freeze({
          satisfaction: -2,
          mental: -1,
          angryChance: 0.2,
          message: "대기 순서를 안내했습니다."
        })
      },
      {
        id: "ask_wait_briefly",
        label: "잠시만 기다려 달라고 한다",
        description: "가장 무난하지만 가장 긴장되는 말을 건넵니다.",
        resultText: "손님이 “잠시”의 길이를 마음속으로 계산하기 시작합니다.",
        effects: Object.freeze({
          satisfaction: -1,
          mental: -1,
          waitTime: -2,
          message: "잠시 대기를 요청했습니다."
        })
      }
    ]),
    affectedStats: Object.freeze(["satisfaction", "mental", "waitTime"]),
    ui: Object.freeze({
      tone: "urgent",
      icon: "clock",
      choiceLayout: "vertical"
    })
  },
  {
    id: "rude_complaint",
    title: "진상 손님 불만",
    summary: "손님의 감정 온도가 계산대 조명보다 빠르게 올라가고 있습니다.",
    unlockDay: 4,
    recommendedDay: 4,
    baseChance: 0.18,
    allowedTypeIds: Object.freeze(["difficult"]),
    dialogue: "점장님 불러주세요. 제 마음속 고객센터가 열렸어요.",
    priority: 40,
    choices: Object.freeze([
      {
        id: "apologize_politely",
        label: "정중히 사과한다",
        description: "최대한 낮은 목소리로 편의점 평화 협정을 시도합니다.",
        resultText: "손님이 아직 못마땅해하지만 일단 폭발 버튼에서 손을 뗍니다.",
        effects: Object.freeze({
          satisfaction: -1,
          mental: -1,
          angryChance: 0.05,
          message: "정중히 사과했습니다."
        })
      },
      {
        id: "explain_policy",
        label: "규정대로 안내한다",
        description: "감정보다는 규정이라는 방패를 조심스럽게 꺼냅니다.",
        resultText: "손님이 규정을 들으며 표정은 굳지만, 상황은 간신히 유지됩니다.",
        effects: Object.freeze({
          satisfaction: -2,
          mental: -1,
          angryChance: 0.2,
          message: "규정을 안내했습니다."
        })
      },
      {
        id: "respond_strongly",
        label: "강하게 대응한다",
        description: "더 이상 밀리지 않겠다는 태도로 선을 분명히 긋습니다.",
        resultText: "손님이 잠깐 당황하지만, 계산대 주변 공기가 살짝 얼어붙습니다.",
        effects: Object.freeze({
          satisfaction: -2,
          mental: -2,
          customerMood: "angry",
          customerStatus: "angry",
          leaveImmediately: true,
          angryChance: 0.6,
          message: "강하게 대응했습니다."
        })
      }
    ]),
    affectedStats: Object.freeze([
      "satisfaction",
      "mental",
      "customerMood",
      "customerStatus"
    ]),
    ui: Object.freeze({
      tone: "complaint",
      icon: "angry",
      choiceLayout: "vertical"
    })
  }
]);

export function getCustomerEventDetail(eventId) {
  if (!eventId) {
    return null;
  }

  return CUSTOMER_EVENT_DETAILS.find((eventDetail) => {
    return eventDetail.id === eventId;
  }) ?? null;
}

export function getAvailableEventDetails(day, customerTypeId) {
  const safeDay = Math.max(1, Math.floor(Number(day) || 1));

  return CUSTOMER_EVENT_DETAILS.filter((eventDetail) => {
    const isUnlocked = eventDetail.unlockDay <= safeDay;
    const isAllowedType =
      !customerTypeId ||
      eventDetail.allowedTypeIds.includes(customerTypeId);

    return isUnlocked && isAllowedType;
  });
}
