/*
  EventData.js

  Role:
  - Final customer event data for customer response random events.
  - Data only. Event triggering and effect application are handled by systems.
  - revenue/cost and product inventoryChanges are applied through
    EconomySystem/InventorySystem event flows. itemKey-only inventoryChanges
    remain display-only until a matching inventory store exists.
*/

export const CUSTOMER_EVENT_TYPES = Object.freeze({
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "negative"
});

export const CUSTOMER_EVENT_TYPE_LABELS = Object.freeze({
  [CUSTOMER_EVENT_TYPES.POSITIVE]: "긍정",
  [CUSTOMER_EVENT_TYPES.NEUTRAL]: "중립",
  [CUSTOMER_EVENT_TYPES.NEGATIVE]: "부정"
});

const freezeInventoryChanges = (inventoryChanges = []) => {
  return Object.freeze(
    inventoryChanges.map((change) => {
      const quantity = Number(change.quantity) || 0;
      const hasProductId = Boolean(change.productId);

      return Object.freeze({
        label: change.label ?? "재고",
        productId: change.productId ?? null,
        itemKey: change.itemKey ?? null,
        quantity,
        apply: change.apply ?? (hasProductId && quantity !== 0)
      });
    })
  );
};

const createChoice = (choice) => {
  const inventoryChanges = freezeInventoryChanges(choice.inventoryChanges ?? []);
  const revenue = Number(choice.effects?.revenue) || 0;
  const cost = Number(choice.effects?.cost) || 0;
  const hasAppliedInventoryChanges = inventoryChanges.some((change) => {
    return change.apply === true;
  });
  const effects = Object.freeze({
    revenue,
    cost,
    satisfaction: Number(choice.effects?.satisfaction) || 0,
    mental: Number(choice.effects?.mental) || 0,
    inventoryChanges,
    applyRevenue: choice.effects?.applyRevenue ?? revenue !== 0,
    applyCost: choice.effects?.applyCost ?? cost > 0,
    applyInventory: choice.effects?.applyInventory ?? hasAppliedInventoryChanges,
    requireInventoryForRevenue:
      choice.effects?.requireInventoryForRevenue ??
      (revenue > 0 && hasAppliedInventoryChanges),
    economicMode:
      choice.effects?.economicMode ??
      (revenue > 0
        ? "event_revenue"
        : revenue < 0
          ? "event_revenue_loss"
          : cost > 0
            ? "event_cost"
            : hasAppliedInventoryChanges
              ? "event_inventory"
              : "stat_only")
  });

  return Object.freeze({
    ...choice,
    effects,
    inventoryChanges
  });
};

const createEvent = (eventDetail) => {
  return Object.freeze({
    ...eventDetail,
    typeLabel: CUSTOMER_EVENT_TYPE_LABELS[eventDetail.type] ?? "이벤트",
    allowedTypeIds: Object.freeze([...(eventDetail.allowedTypeIds ?? [])]),
    choices: Object.freeze((eventDetail.choices ?? []).map(createChoice)),
    ui: Object.freeze({
      tone: eventDetail.type ?? "customer",
      icon: eventDetail.ui?.icon ?? "event",
      choiceLayout: eventDetail.ui?.choiceLayout ?? "vertical"
    })
  });
};

export const CUSTOMER_EVENT_DETAILS = Object.freeze([
  createEvent({
    id: "EVENT_NEG_001",
    type: CUSTOMER_EVENT_TYPES.NEGATIVE,
    title: "명령하지마라 아저씨",
    summary: "라면 물 위치를 안내했을 뿐인데 손님은 명령을 들었다고 주장합니다.",
    unlockDay: 1,
    recommendedDay: 1,
    allowedTypeIds: ["normal", "difficult"],
    dialogue: "나한테 명령하지 마라. 내가 알아서 할 수 있어.",
    priority: 30,
    choices: [
      {
        id: "polite_re_guide",
        label: "안내처럼 들리셨다면 죄송합니다. 저쪽에 있습니다.",
        description: "정석적으로 사과하고 다시 안내합니다.",
        resultTitle: "정중한 재안내",
        customerReaction: "흠… 그렇게 말하면 또 내가 이해는 하지.",
        playerThought: "오늘도 존댓말로 지뢰를 해체했다.",
        resultText: "차분한 대응으로 상황을 넘겼습니다.",
        effects: { revenue: 1200, satisfaction: 3, mental: -3 },
        inventoryChanges: [{ label: "라면", productId: "ramen", quantity: -1 }],
        specialEffect: "없음"
      },
      {
        id: "ramen_water_joke",
        label: "그럼 라면 물님이 손님을 기다리고 있습니다.",
        description: "병맛 농담으로 분위기를 돌립니다.",
        resultTitle: "병맛 대응 성공",
        customerReaction: "라면 물이 기다린다면 어쩔 수 없지.",
        playerThought: "말 한마디로 세계 평화를 지켰다.",
        resultText: "손님이 어이없어 웃으며 라면을 구매했습니다.",
        effects: { revenue: 1200, satisfaction: 6, mental: 1 },
        inventoryChanges: [{ label: "라면", productId: "ramen", quantity: -1 }],
        specialEffect: "멘탈 소폭 회복"
      },
      {
        id: "find_it_yourself",
        label: "그럼 직접 찾으시면 됩니다.",
        description: "강하게 선을 긋습니다.",
        resultTitle: "말투 대전 패배",
        customerReaction: "이 가게는 손님을 방치하는군!",
        playerThought: "방금 내 멘탈도 셀프서비스가 됐다.",
        resultText: "상황이 악화되어 손님 만족도가 크게 떨어졌습니다.",
        effects: { revenue: 0, satisfaction: -8, mental: -5 },
        inventoryChanges: [],
        specialEffect: "만족도 크게 감소"
      }
    ],
    ui: { icon: "ramen" }
  }),

  createEvent({
    id: "EVENT_NEG_002",
    type: CUSTOMER_EVENT_TYPES.NEGATIVE,
    title: "1+1은 마음속에 있는 거야",
    summary: "행사 상품이 아닌 음료를 가져온 손님이 1+1을 주장합니다.",
    unlockDay: 2,
    recommendedDay: 2,
    allowedTypeIds: ["normal", "student", "difficult"],
    dialogue: "이거 1+1 아니에요? 제 마음속 행사표에는 적혀 있는데요?",
    priority: 28,
    choices: [
      {
        id: "explain_promotion_item",
        label: "행사 상품을 정확히 안내한다",
        description: "행사 위치와 조건을 차분히 설명합니다.",
        resultTitle: "행사 안내 완료",
        customerReaction: "아… 옆에 있는 거였어요?",
        playerThought: "행사표는 가까이 있지만 진실은 멀다.",
        resultText: "손님이 조건을 이해하고 음료를 구매했습니다.",
        effects: { revenue: 1500, satisfaction: 2, mental: -2 },
        inventoryChanges: [{ label: "음료", productId: "cola", quantity: -1 }],
        specialEffect: "없음"
      },
      {
        id: "recommend_promotion_drink",
        label: "비슷한 1+1 상품으로 교체 추천한다",
        description: "비슷한 행사 음료를 추천해 매출과 만족도를 챙깁니다.",
        resultTitle: "추천 판매 성공",
        customerReaction: "오히려 이게 더 이득 같네요?",
        playerThought: "혼돈 속에서 매출을 건졌다.",
        resultText: "행사 음료 추천이 성공했습니다.",
        effects: { revenue: 2000, satisfaction: 6, mental: -1 },
        inventoryChanges: [{ label: "행사음료", productId: "cola", quantity: -2 }],
        specialEffect: "매출 보너스"
      },
      {
        id: "treat_as_promotion",
        label: "그냥 1+1로 처리해준다",
        description: "평화를 위해 재고를 희생합니다.",
        resultTitle: "재고가 대신 울었다",
        customerReaction: "역시 말하면 되는군요!",
        playerThought: "내가 이긴 걸까, 재고가 진 걸까.",
        resultText: "손님은 만족했지만 재고 부담이 커졌습니다.",
        effects: { revenue: 1500, satisfaction: 8, mental: -1 },
        inventoryChanges: [{ label: "음료", productId: "cola", quantity: -2 }],
        specialEffect: "재고 추가 감소"
      }
    ],
    ui: { icon: "promotion" }
  }),

  createEvent({
    id: "EVENT_NEG_003",
    type: CUSTOMER_EVENT_TYPES.NEGATIVE,
    title: "봉투 하나만 더의 무한굴레",
    summary: "결제 후 봉투를 계속 요청하는 손님이 등장했습니다.",
    unlockDay: 1,
    recommendedDay: 1,
    allowedTypeIds: ["normal", "student", "office_worker", "hurried", "difficult"],
    dialogue: "봉투 하나만 더 주세요. 아, 하나만 더요. 진짜 마지막으로 하나만 더요.",
    priority: 22,
    choices: [
      {
        id: "ask_bag_quantity",
        label: "필요한 봉투 수량을 묻고 유료 안내한다",
        description: "봉투도 자원이라는 사실을 안내합니다.",
        resultTitle: "유료 안내 성공",
        customerReaction: "아, 봉투도 돈이었죠.",
        playerThought: "봉투 경제를 지켜냈다.",
        resultText: "필요한 수량만 유료로 제공했습니다.",
        effects: { revenue: 200, satisfaction: 2, mental: -2 },
        inventoryChanges: [{ label: "봉투", itemKey: "shopping_bag", quantity: -2 }],
        specialEffect: "없음"
      },
      {
        id: "bag_is_commuting",
        label: "봉투도 지금 출근 중입니다라고 농담하며 1장만 준다",
        description: "봉투 농담으로 무한 요청을 끊습니다.",
        resultTitle: "봉투 농담 적중",
        customerReaction: "아 뭐예요, 웃겨서 하나만 받을게요.",
        playerThought: "봉투 한 장과 멘탈 한 조각을 지켰다.",
        resultText: "손님이 웃으며 봉투 한 장만 받았습니다.",
        effects: { revenue: 100, satisfaction: 5, mental: 1 },
        inventoryChanges: [{ label: "봉투", itemKey: "shopping_bag", quantity: -1 }],
        specialEffect: "멘탈 소폭 회복"
      },
      {
        id: "free_bags_forever",
        label: "계속 무료로 준다",
        description: "분쟁은 피하지만 봉투 창고가 위험해집니다.",
        resultTitle: "봉투 창고 비상",
        customerReaction: "혹시 하나만 더 가능할까요?",
        playerThought: "끝난 줄 알았는데 시즌2였다.",
        resultText: "봉투를 많이 내주며 손님을 달랬습니다.",
        effects: { revenue: 0, satisfaction: 4, mental: -4 },
        inventoryChanges: [{ label: "봉투", itemKey: "shopping_bag", quantity: -4 }],
        specialEffect: "봉투 재고 크게 감소"
      }
    ],
    ui: { icon: "bag" }
  }),

  createEvent({
    id: "EVENT_NEG_004",
    type: CUSTOMER_EVENT_TYPES.NEGATIVE,
    title: "지각은 나의 것, 계산은 너의 것",
    summary: "급한 직장인이 커피, 삼각김밥, 에너지드링크를 들고 계산대로 달려왔습니다.",
    unlockDay: 3,
    recommendedDay: 3,
    allowedTypeIds: ["office_worker", "hurried"],
    dialogue: "저 진짜 급해요! 회사가 저보다 먼저 출근했어요!",
    priority: 35,
    choices: [
      {
        id: "fast_checkout_mode",
        label: "빠른 계산 모드로 처리한다",
        description: "인간 바코드 스캐너가 됩니다.",
        resultTitle: "초고속 계산 성공",
        customerReaction: "살았습니다. 회사는 절 못 잡아요.",
        playerThought: "나는 계산원이 아니라 인간 바코드 스캐너다.",
        resultText: "빠른 처리로 손님의 출근 루트를 구했습니다.",
        effects: { revenue: 5000, satisfaction: 4, mental: -3 },
        inventoryChanges: [
          { label: "커피", productId: "coffee", quantity: -1 },
          { label: "삼각김밥", productId: "triangle_kimbap", quantity: -1 },
          { label: "에너지드링크", productId: "energy_drink", quantity: -1 }
        ],
        specialEffect: "없음"
      },
      {
        id: "ask_queue_permission",
        label: "뒤 손님에게 양해를 구하고 먼저 처리한다",
        description: "질서와 긴급함 사이에서 중재합니다.",
        resultTitle: "새치기 아닌 새치기",
        customerReaction: "감사합니다! 제 영혼이 출근했습니다!",
        playerThought: "뒤 손님의 눈빛이 살짝 매웠다.",
        resultText: "급한 손님은 살았지만 전체 분위기는 살짝 흔들렸습니다.",
        effects: { revenue: 5000, satisfaction: 1, mental: -2 },
        inventoryChanges: [
          { label: "커피", productId: "coffee", quantity: -1 },
          { label: "삼각김밥", productId: "triangle_kimbap", quantity: -1 },
          { label: "에너지드링크", productId: "energy_drink", quantity: -1 }
        ],
        specialEffect: "만족도 상승폭 감소"
      },
      {
        id: "keep_order",
        label: "순서대로 기다리라고 한다",
        description: "원칙은 지키지만 공기는 무거워집니다.",
        resultTitle: "원칙은 지켰지만 공기는 무거워졌다",
        customerReaction: "제 지각 사유서에 이 편의점 적겠습니다.",
        playerThought: "원칙은 단단하고 분위기는 차갑다.",
        resultText: "원칙 대응으로 계산은 진행됐지만 만족도는 떨어졌습니다.",
        effects: { revenue: 5000, satisfaction: -3, mental: -1 },
        inventoryChanges: [
          { label: "커피", productId: "coffee", quantity: -1 },
          { label: "삼각김밥", productId: "triangle_kimbap", quantity: -1 },
          { label: "에너지드링크", productId: "energy_drink", quantity: -1 }
        ],
        specialEffect: "만족도 감소"
      }
    ],
    ui: { icon: "clock" }
  }),

  createEvent({
    id: "EVENT_NEG_005",
    type: CUSTOMER_EVENT_TYPES.NEGATIVE,
    title: "카드에는 충전, 마음에는 분노",
    summary: "교통카드를 5천 원 충전한 손님이 1만 원을 냈다고 주장합니다.",
    unlockDay: 2,
    recommendedDay: 2,
    allowedTypeIds: ["normal", "student", "difficult"],
    dialogue: "왜 10,000원이 안 들어갔죠? 저는 분명히 그렇게 낸 기분인데요.",
    priority: 26,
    choices: [
      {
        id: "check_receipt",
        label: "영수증과 결제 내역을 차분히 확인한다",
        description: "증거와 침착함으로 대응합니다.",
        resultTitle: "증거로 평화 유지",
        customerReaction: "아… 제가 착각했네요.",
        playerThought: "영수증은 거짓말을 하지 않는다. 사람은 가끔 한다.",
        resultText: "확인 절차로 갈등을 줄였습니다.",
        effects: { revenue: 0, satisfaction: 3, mental: -4 },
        inventoryChanges: [],
        specialEffect: "없음"
      },
      {
        id: "card_was_confused",
        label: "카드도 당황해서 5천 원만 먹었습니다라고 농담한다",
        description: "기계에게 잠시 책임을 넘깁니다.",
        resultTitle: "충전 분노 진압",
        customerReaction: "카드가 당황했다면 인정합니다.",
        playerThought: "오늘은 기계 탓으로 모두가 행복해졌다.",
        resultText: "병맛 농담으로 손님의 분노를 낮췄습니다.",
        effects: { revenue: 0, satisfaction: 5, mental: 1 },
        inventoryChanges: [],
        specialEffect: "멘탈 소폭 회복"
      },
      {
        id: "extra_charge_without_check",
        label: "확인 없이 5,000원을 추가 충전한다",
        description: "돈으로 평화를 삽니다.",
        resultTitle: "돈으로 평화를 샀다",
        customerReaction: "거봐요. 제가 맞다니까요.",
        playerThought: "평화의 가격은 5천 원이었다.",
        resultText: "손님은 만족했지만 매출 손실이 발생했습니다.",
        effects: { revenue: -5000, satisfaction: 6, mental: -2 },
        inventoryChanges: [],
        specialEffect: "매출 손실 발생"
      }
    ],
    ui: { icon: "card" }
  }),

  createEvent({
    id: "EVENT_NEG_006",
    type: CUSTOMER_EVENT_TYPES.NEGATIVE,
    title: "쿠폰의 영혼은 아직 살아있다",
    summary: "유효기간이 지난 컵라면 쿠폰을 들고 온 손님이 쿠폰의 생존권을 주장합니다.",
    unlockDay: 3,
    recommendedDay: 3,
    allowedTypeIds: ["normal", "office_worker", "difficult"],
    dialogue: "어제까지만 해도 오늘 같았어요. 이 쿠폰 아직 마음은 살아있습니다.",
    priority: 27,
    choices: [
      {
        id: "normal_ramen_payment",
        label: "유효기간을 안내하고 컵라면을 정상 결제한다",
        description: "규정을 지키고 컵라면을 정상 판매합니다.",
        resultTitle: "규정은 지켰다",
        customerReaction: "쿠폰에게도 마지막 기회가 있어야죠.",
        playerThought: "쿠폰의 장례식을 컵라면 앞에서 치른 기분이다.",
        resultText: "정상 결제로 규정은 지켰지만 만족도는 조금 떨어졌습니다.",
        effects: { revenue: 1600, satisfaction: -2, mental: -2 },
        inventoryChanges: [{ label: "컵라면", productId: "ramen", quantity: -1 }],
        specialEffect: "만족도 소폭 감소"
      },
      {
        id: "recommend_udon",
        label: "사용 가능한 신제품 우동을 추천한다",
        description: "죽은 쿠폰 대신 살아있는 신제품을 권합니다.",
        resultTitle: "대체 할인 성공",
        customerReaction: "이것도 할인 느낌이면 제 마음이 회복됩니다.",
        playerThought: "죽은 쿠폰 대신 살아있는 우동을 찾았다.",
        resultText: "만번 조린 셰프의 우동 추천으로 분위기를 회복했습니다.",
        effects: { revenue: 1900, satisfaction: 5, mental: -1 },
        inventoryChanges: [{ label: "만번 조린 셰프의 우동", productId: "udon", quantity: -1 }],
        specialEffect: "만족도 회복"
      },
      {
        id: "discount_ramen_exception",
        label: "쿠폰을 예외 처리하고 컵라면을 할인해준다",
        description: "규정을 잠시 접고 손님을 달랩니다.",
        resultTitle: "쿠폰 부활 의식 성공",
        customerReaction: "역시 쿠폰은 마음으로 쓰는 거죠.",
        playerThought: "규정은 잠시 눈을 감았고, 컵라면은 조용히 팔려나갔다.",
        resultText: "손님은 만족했지만 할인으로 매출이 줄었습니다.",
        effects: { revenue: 1200, satisfaction: 7, mental: -1 },
        inventoryChanges: [{ label: "컵라면", productId: "ramen", quantity: -1 }],
        specialEffect: "매출 소폭 감소"
      }
    ],
    ui: { icon: "coupon" }
  }),

  createEvent({
    id: "EVENT_NEG_007",
    type: CUSTOMER_EVENT_TYPES.NEGATIVE,
    title: "30초면 되는 걸 7분으로",
    summary: "손님이 삼각김밥을 전자레인지에 7분 돌리려 합니다.",
    unlockDay: 2,
    recommendedDay: 2,
    allowedTypeIds: ["normal", "student", "difficult"],
    dialogue: "삼각김밥은 7분 정도 돌리면 더 깊은 맛이 나지 않나요?",
    priority: 29,
    choices: [
      {
        id: "guide_30_seconds",
        label: "적정 시간 30초를 안내한다",
        description: "삼각김밥의 생명을 구합니다.",
        resultTitle: "전자레인지 참사 방지",
        customerReaction: "아, 7분은 요리가 아니라 의식이었군요.",
        playerThought: "삼각김밥의 생명을 구했다.",
        resultText: "적정 시간을 안내해 사고를 막았습니다.",
        effects: { revenue: 1200, satisfaction: 4, mental: -1 },
        inventoryChanges: [{ label: "삼각김밥", productId: "triangle_kimbap", quantity: -1 }],
        specialEffect: "없음"
      },
      {
        id: "set_microwave_time",
        label: "직접 전자레인지 시간을 맞춰준다",
        description: "편의점식 조리 지원에 나섭니다.",
        resultTitle: "직접 조리 지원",
        customerReaction: "오, 전문가의 손길이네요.",
        playerThought: "나는 편의점 직원이자 삼각김밥 소방관이다.",
        resultText: "손님이 안전하게 삼각김밥을 데웠습니다.",
        effects: { revenue: 1200, satisfaction: 6, mental: -2 },
        inventoryChanges: [{ label: "삼각김밥", productId: "triangle_kimbap", quantity: -1 }],
        specialEffect: "만족도 상승"
      },
      {
        id: "ignore_microwave",
        label: "방치한다",
        description: "불길한 예감을 외면합니다.",
        resultTitle: "전자레인지 비상사태",
        customerReaction: "어… 이거 원래 연기가 나나요?",
        playerThought: "30초를 아끼려다 하루를 태웠다.",
        resultText: "전자레인지 사고로 점검비가 발생했습니다.",
        effects: { revenue: 1200, cost: 2000, satisfaction: -8, mental: -7 },
        inventoryChanges: [{ label: "삼각김밥", productId: "triangle_kimbap", quantity: -1 }],
        specialEffect: "점검비 2,000원 발생"
      }
    ],
    ui: { icon: "microwave" }
  }),

  createEvent({
    id: "EVENT_NEU_001",
    type: CUSTOMER_EVENT_TYPES.NEUTRAL,
    title: "짤랑짤랑 최종보스",
    summary: "손님이 4,700원어치 물건을 사고 동전을 한 움큼 쏟아냅니다.",
    unlockDay: 1,
    recommendedDay: 1,
    allowedTypeIds: ["normal", "student", "office_worker", "difficult"],
    dialogue: "동전으로 계산해도 되죠? 오늘 제 지갑이 보스전을 열었어요.",
    priority: 18,
    choices: [
      {
        id: "sort_coins_fast",
        label: "빠르게 분류해서 계산한다",
        description: "손가락과 집중력으로 동전 산을 넘습니다.",
        resultTitle: "동전과의 정면승부",
        customerReaction: "정확하시네요. 동전들이 기뻐합니다.",
        playerThought: "내 손가락이 계산기를 이겼다.",
        resultText: "빠르게 처리했지만 멘탈 소모가 컸습니다.",
        effects: { revenue: 4700, satisfaction: 2, mental: -5 },
        inventoryChanges: [
          { label: "과자", productId: "potato_chips", quantity: -1 },
          { label: "음료", productId: "cola", quantity: -1 }
        ],
        specialEffect: "멘탈 감소"
      },
      {
        id: "use_coin_tray",
        label: "동전 계산 트레이를 사용한다",
        description: "도구의 힘으로 동전을 정리합니다.",
        resultTitle: "도구의 승리",
        customerReaction: "오, 동전 전용 경기장이 있네요.",
        playerThought: "장비빨도 실력이다.",
        resultText: "도구를 활용해 부담을 줄였습니다.",
        effects: { revenue: 4700, satisfaction: 5, mental: -2 },
        inventoryChanges: [
          { label: "과자", productId: "potato_chips", quantity: -1 },
          { label: "음료", productId: "cola", quantity: -1 }
        ],
        specialEffect: "멘탈 감소 완화"
      },
      {
        id: "treasure_chest_joke",
        label: "혹시 보물상자 여셨나요?라고 말한다",
        description: "동전 더미를 병맛 농담으로 받아칩니다.",
        resultTitle: "동전 개그 성공",
        customerReaction: "들켰네요. 오늘 던전 돌았습니다.",
        playerThought: "동전은 무거웠지만 분위기는 가벼워졌다.",
        resultText: "농담으로 분위기를 풀고 계산도 마쳤습니다.",
        effects: { revenue: 4700, satisfaction: 4, mental: 2 },
        inventoryChanges: [
          { label: "과자", productId: "potato_chips", quantity: -1 },
          { label: "음료", productId: "cola", quantity: -1 }
        ],
        specialEffect: "멘탈 회복"
      }
    ],
    ui: { icon: "coin" }
  }),

  createEvent({
    id: "EVENT_NEU_002",
    type: CUSTOMER_EVENT_TYPES.NEUTRAL,
    title: "라면은 끓고, 인생은 식는다",
    summary: "새벽 라면 손님이 계산대 앞에서 갑자기 인생 상담을 시작합니다.",
    unlockDay: 2,
    recommendedDay: 2,
    allowedTypeIds: ["normal", "student", "difficult"],
    dialogue: "왜 우리는 국물을 남기는 걸까요? 인생도 그런 걸까요?",
    priority: 16,
    choices: [
      {
        id: "short_empathy",
        label: "짧게 공감하고 업무로 돌아간다",
        description: "라면 철학은 짧고 업무는 길게 갑니다.",
        resultTitle: "적당한 공감 성공",
        customerReaction: "짧지만 깊은 대답이네요.",
        playerThought: "라면은 깊었고 대화는 얕게 끝냈다.",
        resultText: "적절한 공감으로 손님을 응대했습니다.",
        effects: { revenue: 1600, satisfaction: 3, mental: -1 },
        inventoryChanges: [{ label: "컵라면", productId: "ramen", quantity: -1 }],
        specialEffect: "없음"
      },
      {
        id: "one_minute_philosophy",
        label: "1분 동안 철학 대화를 받아준다",
        description: "편의점 계산대가 상담센터가 됩니다.",
        resultTitle: "새벽 감성 과다복용",
        customerReaction: "당신은 편의점의 소크라테스입니다.",
        playerThought: "나는 알바인가, 상담센터인가.",
        resultText: "손님 만족도는 올랐지만 멘탈은 소모됐습니다.",
        effects: { revenue: 1600, satisfaction: 7, mental: -5 },
        inventoryChanges: [{ label: "컵라면", productId: "ramen", quantity: -1 }],
        specialEffect: "만족도 크게 상승, 멘탈 감소"
      },
      {
        id: "receipt_does_not_remain",
        label: "국물은 남지만 영수증은 남지 않습니다라고 답한다",
        description: "아무 말 같지만 묘하게 위로가 되는 답을 합니다.",
        resultTitle: "철학 개그 성공",
        customerReaction: "와… 깊은데 쓸모없네요. 마음에 들어요.",
        playerThought: "아무 말도 때로는 위로가 된다.",
        resultText: "병맛 철학으로 손님의 마음을 달랬습니다.",
        effects: { revenue: 1600, satisfaction: 6, mental: 3 },
        inventoryChanges: [{ label: "컵라면", productId: "ramen", quantity: -1 }],
        specialEffect: "멘탈 회복"
      }
    ],
    ui: { icon: "ramen" }
  }),

  createEvent({
    id: "EVENT_NEU_003",
    type: CUSTOMER_EVENT_TYPES.NEUTRAL,
    title: "차가운 공기의 자유 선언",
    summary: "손님이 냉장고 문을 열어둔 채 음료와 대치 중입니다.",
    unlockDay: 1,
    recommendedDay: 1,
    allowedTypeIds: ["normal", "student", "office_worker"],
    dialogue: "음료가 저를 선택할 때까지 기다리는 중입니다.",
    priority: 17,
    choices: [
      {
        id: "recommend_popular_drink",
        label: "인기 음료를 추천한다",
        description: "고민을 줄이고 냉장고 문도 닫게 만듭니다.",
        resultTitle: "추천으로 고민 종료",
        customerReaction: "역시 인기 있는 건 이유가 있겠죠.",
        playerThought: "냉장고 문과 손님의 마음을 동시에 닫았다.",
        resultText: "음료 추천으로 상황을 정리했습니다.",
        effects: { revenue: 2000, satisfaction: 4, mental: -1 },
        inventoryChanges: [{ label: "음료", productId: "orange_juice", quantity: -1 }],
        specialEffect: "없음"
      },
      {
        id: "fridge_catches_cold",
        label: "냉장고가 감기 걸립니다라고 안내한다",
        description: "귀여운 농담으로 냉장고를 구합니다.",
        resultTitle: "냉장고 구조 성공",
        customerReaction: "아, 냉장고도 생명체였군요.",
        playerThought: "전기세와 내 멘탈을 동시에 지켰다.",
        resultText: "손님이 웃으며 음료를 골랐습니다.",
        effects: { revenue: 1500, satisfaction: 5, mental: 1 },
        inventoryChanges: [{ label: "음료", productId: "cola", quantity: -1 }],
        specialEffect: "멘탈 소폭 회복"
      },
      {
        id: "leave_fridge_open",
        label: "그냥 둔다",
        description: "손님의 선택을 기다리며 냉기가 탈출합니다.",
        resultTitle: "냉기 탈출 사건",
        customerReaction: "아직 음료가 저를 선택하지 않았어요.",
        playerThought: "냉장고 문보다 내 마음이 더 열려버렸다.",
        resultText: "결국 음료는 팔렸지만 만족도는 조금 떨어졌습니다.",
        effects: { revenue: 1500, satisfaction: -2, mental: -3 },
        inventoryChanges: [{ label: "음료", productId: "cola", quantity: -1 }],
        specialEffect: "만족도 소폭 감소"
      }
    ],
    ui: { icon: "drink" }
  }),

  createEvent({
    id: "EVENT_POS_001",
    type: CUSTOMER_EVENT_TYPES.POSITIVE,
    title: "단골 할머니의 따뜻한 캔커피",
    summary: "단골 할머니가 고생이 많다며 캔커피를 하나 건넵니다.",
    unlockDay: 1,
    recommendedDay: 1,
    allowedTypeIds: ["normal", "office_worker", "student"],
    dialogue: "젊은 사람이 고생이 많다. 이거 마시고 힘내요.",
    priority: 12,
    choices: [
      {
        id: "accept_coffee_politely",
        label: "감사 인사를 하고 정중히 받는다",
        description: "따뜻한 마음을 고맙게 받습니다.",
        resultTitle: "따뜻한 응원 도착",
        customerReaction: "이거 마시고 힘내요.",
        playerThought: "오늘 하루가 조금 덜 차가워졌다.",
        resultText: "단골의 응원으로 멘탈이 회복됐습니다.",
        effects: { revenue: 1800, satisfaction: 6, mental: 10 },
        inventoryChanges: [{ label: "캔커피", productId: "coffee", quantity: -1 }],
        specialEffect: "멘탈 회복"
      },
      {
        id: "points_joke",
        label: "이 은혜는 포인트 적립으로 갚겠습니다라고 농담한다",
        description: "감사를 병맛 농담으로 돌려줍니다.",
        resultTitle: "단골 호감도 상승",
        customerReaction: "허허, 말도 참 재밌게 하네.",
        playerThought: "캔커피보다 따뜻한 건 단골의 한마디였다.",
        resultText: "농담이 통하며 손님과 종업원 모두 기분이 좋아졌습니다.",
        effects: { revenue: 1800, satisfaction: 8, mental: 12 },
        inventoryChanges: [{ label: "캔커피", productId: "coffee", quantity: -1 }],
        specialEffect: "멘탈 크게 회복"
      },
      {
        id: "decline_coffee",
        label: "괜찮다며 거절한다",
        description: "마음만 받겠다고 말합니다.",
        resultTitle: "마음만 받았다",
        customerReaction: "그래도 고생하는 건 알아요.",
        playerThought: "받진 않았지만 마음은 충전됐다.",
        resultText: "정중히 거절했지만 따뜻함은 남았습니다.",
        effects: { revenue: 1800, satisfaction: 2, mental: 3 },
        inventoryChanges: [{ label: "캔커피", productId: "coffee", quantity: -1 }],
        specialEffect: "멘탈 소폭 회복"
      }
    ],
    ui: { icon: "coffee" }
  }),

  createEvent({
    id: "EVENT_POS_002",
    type: CUSTOMER_EVENT_TYPES.POSITIVE,
    title: "오늘 시험 망했으니 과자로 복구한다",
    summary: "시험을 끝낸 학생들이 과자와 음료를 잔뜩 사러 왔습니다.",
    unlockDay: 2,
    recommendedDay: 2,
    allowedTypeIds: ["student"],
    dialogue: "시험은 망했지만 간식은 성공하고 싶어요.",
    priority: 14,
    choices: [
      {
        id: "fast_group_snack_checkout",
        label: "빠르게 계산해준다",
        description: "학생들의 당 충전 루트를 열어줍니다.",
        resultTitle: "단체 간식 계산 완료",
        customerReaction: "시험은 졌지만 간식은 이겼다!",
        playerThought: "학생들의 슬픔이 매출로 환산됐다.",
        resultText: "단체 간식 계산을 빠르게 마쳤습니다.",
        effects: { revenue: 8000, satisfaction: 4, mental: 4 },
        inventoryChanges: [
          { label: "과자", productId: "potato_chips", quantity: -3 },
          { label: "음료", productId: "cola", quantity: -2 }
        ],
        specialEffect: "매출 증가"
      },
      {
        id: "recommend_popular_snack_set",
        label: "인기 과자 세트를 추천한다",
        description: "시험 후 회복 세트를 제안합니다.",
        resultTitle: "추천 판매 대성공",
        customerReaction: "이 조합이면 수학 점수도 잊을 수 있어요.",
        playerThought: "과자는 틀리지 않는다.",
        resultText: "추천 판매로 큰 반응을 얻었습니다.",
        effects: { revenue: 11000, satisfaction: 7, mental: 6 },
        inventoryChanges: [
          { label: "과자", productId: "potato_chips", quantity: -5 },
          { label: "음료", productId: "cola", quantity: -2 }
        ],
        specialEffect: "매출 크게 증가"
      },
      {
        id: "sweet_score_cheer",
        label: "점수는 낮아도 당도는 높게 가자라고 응원한다",
        description: "간식과 위로를 함께 건넵니다.",
        resultTitle: "위로와 당 충전",
        customerReaction: "와, 이 편의점 위로 맛집이네.",
        playerThought: "나도 모르게 청춘 드라마에 출연했다.",
        resultText: "응원 멘트로 학생들의 마음을 회복시켰습니다.",
        effects: { revenue: 8000, satisfaction: 9, mental: 9 },
        inventoryChanges: [
          { label: "과자", productId: "potato_chips", quantity: -3 },
          { label: "음료", productId: "cola", quantity: -2 }
        ],
        specialEffect: "만족도와 멘탈 회복"
      }
    ],
    ui: { icon: "snack" }
  }),

  createEvent({
    id: "EVENT_POS_003",
    type: CUSTOMER_EVENT_TYPES.POSITIVE,
    title: "별점 5점의 강림",
    summary: "친절한 응대를 받은 손님이 좋은 리뷰를 남기겠다고 합니다.",
    unlockDay: 1,
    recommendedDay: 1,
    allowedTypeIds: ["normal", "student", "office_worker"],
    dialogue: "여기 알바님 친절하시네요. 리뷰 남겨도 돼요?",
    priority: 15,
    choices: [
      {
        id: "thank_for_review",
        label: "감사 인사를 한다",
        description: "정석적으로 고마움을 전합니다.",
        resultTitle: "좋은 리뷰 예고",
        customerReaction: "리뷰 꼭 남길게요.",
        playerThought: "별점은 화면에 뜨지만 온기는 마음에 남는다.",
        resultText: "좋은 리뷰 예고로 만족도와 멘탈이 회복됐습니다.",
        effects: { revenue: 3000, satisfaction: 10, mental: 8 },
        inventoryChanges: [{ label: "음료", productId: "cola", quantity: -1 }],
        specialEffect: "만족도 크게 상승"
      },
      {
        id: "five_star_mental",
        label: "별 다섯 개면 제 멘탈도 다섯 개 충전됩니다라고 답한다",
        description: "리뷰를 병맛 리액션으로 받아칩니다.",
        resultTitle: "리뷰 천사의 축복",
        customerReaction: "진짜 웃기네요. 별 다섯 개 확정입니다.",
        playerThought: "내 멘탈에도 별점이 있다면 지금 5점이다.",
        resultText: "손님이 웃으며 좋은 리뷰를 약속했습니다.",
        effects: { revenue: 3000, satisfaction: 12, mental: 12 },
        inventoryChanges: [{ label: "음료", productId: "cola", quantity: -1 }],
        specialEffect: "다음 부정 이벤트 만족도 감소 1회 완화"
      },
      {
        id: "quiet_checkout",
        label: "무덤덤하게 계산만 한다",
        description: "말수는 적지만 계산은 정확합니다.",
        resultTitle: "조용한 친절",
        customerReaction: "말은 적어도 친절하시네요.",
        playerThought: "가끔은 침묵도 서비스다.",
        resultText: "조용한 응대로 소소한 긍정 효과를 얻었습니다.",
        effects: { revenue: 3000, satisfaction: 4, mental: 2 },
        inventoryChanges: [{ label: "음료", productId: "cola", quantity: -1 }],
        specialEffect: "없음"
      }
    ],
    ui: { icon: "review" }
  }),

  createEvent({
    id: "EVENT_POS_004",
    type: CUSTOMER_EVENT_TYPES.POSITIVE,
    title: "아직 세상은 살 만하다",
    summary: "양심 손님이 다른 손님이 두고 간 지갑을 계산대로 가져다줍니다.",
    unlockDay: 1,
    recommendedDay: 1,
    allowedTypeIds: ["normal", "office_worker", "student"],
    dialogue: "여기 지갑이 떨어져 있었어요. 주인이 꼭 찾았으면 좋겠네요.",
    priority: 13,
    choices: [
      {
        id: "store_lost_wallet",
        label: "감사 인사를 하고 분실물로 보관한다",
        description: "정석적으로 분실물을 보관합니다.",
        resultTitle: "양심 보관 완료",
        customerReaction: "주인이 꼭 찾았으면 좋겠네요.",
        playerThought: "오늘은 진상보다 사람이 먼저 보였다.",
        resultText: "훈훈한 상황으로 멘탈이 회복됐습니다.",
        effects: { revenue: 0, satisfaction: 8, mental: 10 },
        inventoryChanges: [],
        specialEffect: "멘탈 회복"
      },
      {
        id: "give_thanks_coupon",
        label: "감사 쿠폰을 제공한다",
        description: "착한 일에 작은 보상을 건넵니다.",
        resultTitle: "착한 일 보상",
        customerReaction: "이런 걸 바란 건 아닌데 감사합니다.",
        playerThought: "500원으로 가게 분위기를 샀다.",
        resultText: "작은 보상으로 만족도가 크게 올랐습니다.",
        effects: { revenue: -500, satisfaction: 12, mental: 12 },
        inventoryChanges: [],
        specialEffect: "만족도 크게 상승"
      },
      {
        id: "humanity_mvp",
        label: "오늘의 인간성 MVP입니다라고 칭찬한다",
        description: "손님의 양심에 병맛 트로피를 수여합니다.",
        resultTitle: "인간성 MVP 선정",
        customerReaction: "MVP라니 좀 부끄럽네요.",
        playerThought: "아직 편의점 세계관은 망하지 않았다.",
        resultText: "칭찬으로 따뜻한 분위기를 만들었습니다.",
        effects: { revenue: 0, satisfaction: 10, mental: 14 },
        inventoryChanges: [],
        specialEffect: "멘탈 크게 회복"
      }
    ],
    ui: { icon: "heart" }
  }),

  createEvent({
    id: "EVENT_POS_005",
    type: CUSTOMER_EVENT_TYPES.POSITIVE,
    title: "신제품 먹방 서포터",
    summary: "손님이 신제품 만번 조린 셰프의 우동을 보고 맛을 묻습니다.",
    unlockDay: 2,
    recommendedDay: 2,
    allowedTypeIds: ["normal", "student", "office_worker"],
    dialogue: "이 신제품 우동 맛있어요? 이름이 너무 진지해서 좀 궁금한데요.",
    priority: 14,
    choices: [
      {
        id: "recommend_new_udon",
        label: "무난하게 신제품을 추천한다",
        description: "신제품 우동을 안정적으로 추천합니다.",
        resultTitle: "신제품 판매 성공",
        customerReaction: "한 번 먹어볼게요.",
        playerThought: "신제품도 팔리고 내 마음도 조금 팔렸다.",
        resultText: "신제품 추천이 무난하게 성공했습니다.",
        effects: { revenue: 1900, satisfaction: 4, mental: 3 },
        inventoryChanges: [{ label: "만번 조린 셰프의 우동", productId: "udon", quantity: -1 }],
        specialEffect: "없음"
      },
      {
        id: "recommend_udon_cola_set",
        label: "같이 먹기 좋은 콜라까지 추천한다",
        description: "우동과 콜라 세트 조합을 제안합니다.",
        resultTitle: "세트 추천 성공",
        customerReaction: "오, 조합까지요? 믿고 갑니다.",
        playerThought: "이것이 편의점식 코스요리다.",
        resultText: "신제품과 콜라 세트 추천이 성공했습니다.",
        effects: { revenue: 3600, satisfaction: 7, mental: 5 },
        inventoryChanges: [
          { label: "만번 조린 셰프의 우동", productId: "udon", quantity: -1 },
          { label: "콜라", productId: "cola", quantity: -1 }
        ],
        specialEffect: "추가 판매 성공"
      },
      {
        id: "convenience_party_pitch",
        label: "이건 입 안에서 편의점 회식합니다라고 과장 추천한다",
        description: "설명은 이상하지만 이상하게 설득됩니다.",
        resultTitle: "병맛 영업 성공",
        customerReaction: "뭔 소린지 모르겠는데 사고 싶어졌어요.",
        playerThought: "설명은 실패했지만 판매는 성공했다.",
        resultText: "과장된 병맛 추천으로 손님을 웃겼습니다.",
        effects: { revenue: 1900, satisfaction: 9, mental: 8 },
        inventoryChanges: [{ label: "만번 조린 셰프의 우동", productId: "udon", quantity: -1 }],
        specialEffect: "멘탈 회복"
      }
    ],
    ui: { icon: "new" }
  })
]);

export function getCustomerEventDetail(eventId) {
  if (!eventId) {
    return null;
  }

  return CUSTOMER_EVENT_DETAILS.find((eventDetail) => {
    return eventDetail.id === eventId;
  }) ?? null;
}

export function getAvailableEventDetails(day, customerTypeId, eventType = null) {
  const safeDay = Math.max(1, Math.floor(Number(day) || 1));

  return CUSTOMER_EVENT_DETAILS.filter((eventDetail) => {
    const isUnlocked = eventDetail.unlockDay <= safeDay;
    const isAllowedType =
      !customerTypeId ||
      eventDetail.allowedTypeIds.includes(customerTypeId);
    const isMatchingType = !eventType || eventDetail.type === eventType;

    return isUnlocked && isAllowedType && isMatchingType;
  });
}
