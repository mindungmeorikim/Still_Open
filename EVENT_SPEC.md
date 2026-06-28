# EventBus 개발 인터페이스 명세서

---

# 목적

각 시스템은 서로 직접 호출하지 않고 EventBus를 통해 연결합니다.

각 담당자는 자신의 파일만 수정합니다.

---

# ⚠️ 공통 개발 규칙

## 날짜(Date) 사용 금지

GameState의 날짜는 실제 Date가 아니라 Day 번호를 사용합니다.

예시

```js
GameState.day = 1
```

유통기한

```js
expireDay = 3
```

사용 금지

```js
new Date()

Date.now()

2026-06-28
```

GPT에게 코드를 요청할 때 반드시 아래 문장을 포함합니다.

> GameState의 날짜는 실제 Date가 아니라 Day 번호를 사용합니다. 모든 날짜 계산은 GameState.day 기준으로 작성해주세요.

---

# EventBus 사용

등록

```js
EventBus.on(EVENTS.DAY_STARTED, callback);
```

발생

```js
EventBus.emit(EVENTS.DAY_STARTED, data);
```

---

# Event 목록

## Game

| Event | 설명 |
|--------|------|
| GAME_INIT | 게임 시작 |
| DAY_START_REQUESTED | Day 시작 버튼 |
| DAY_STARTED | Day 시작 |
| ORDER_PHASE_STARTED | 발주 시작 |
| ORDER_BUTTON_CLICKED | 상품 카드 발주 버튼 클릭 |
| ORDER_REQUESTED | 상품 발주 요청 |
| STORE_OPEN_REQUESTED | 영업 시작 버튼 |
| STORE_OPENED | 영업 시작 |
| STORE_CLOSE_REQUESTED | 영업 종료 버튼 |
| STORE_CLOSED | 영업 종료 |
| DAY_ENDED | 하루 종료 |
| RESULT_CALCULATED | 정산 완료 |
| UPGRADE_PHASE_STARTED | 업그레이드 시작 |
| UPGRADE_SELECTED | 업그레이드 선택 |
| NEXT_DAY_READY | 다음 Day 준비 |
| GAME_STATE_CHANGED | 상태 변경 |
| EXPANSION_REQUESTED | 매장 확장 요청 |
| EXPANSION_COMPLETED | 매장 확장 완료 |
| EXPANSION_FAILED | 매장 확장 실패 |
| ENDING_ACHIEVED | 최종 확장 목표 달성 |
| ENDING_MODAL_CLOSED | 엔딩 모달 닫기 |

---

## 발주 요청 이벤트

### ORDER_BUTTON_CLICKED

상품 카드의 발주 버튼을 눌렀을 때 발생하는 UI 입력 이벤트입니다.

payload 예시

```js
{
  day: GameState.day,
  productId: "banana_milk",
  productName: "달콤 바나나우유"
}
```

### ORDER_REQUESTED

특정 상품에 대한 발주 요청 이벤트입니다.

추후 `OrderSystem`에서 이 이벤트를 받아 실제 발주 처리, 비용 차감, 재고 입고를 처리합니다.

payload 예시

```js
{
  day: GameState.day,
  productId: "banana_milk",
  productName: "달콤 바나나우유",
  quantity: 1
}
```

주의사항

- 실제 날짜 객체 사용 금지
- 모든 발주 일자는 GameState.day 기준
- GameState.todayStats 직접 수정 금지
- ORDER_REQUESTED는 요청 이벤트일 뿐 즉시 재고를 증가시키지 않음

---

## 매장 확장 이벤트

`requiredDay`는 자동 해금 조건이 아니라 확장 가능 조건입니다.

구역은 플레이어가 확장 버튼을 눌러 `EXPANSION_REQUESTED` 처리에 성공했을 때만 `unlocked` 상태가 됩니다.

확장 성공 조건은 아래 3가지를 모두 만족해야 합니다.

1. `GameState.day >= requiredDay`
2. `GameState.money >= unlockCost`
3. 이전 구역이 `unlocked` 상태

### EXPANSION_REQUESTED

매장 확장 버튼을 눌렀을 때 발생하는 확장 요청 이벤트입니다.

payload 예시

```js
{
  day: GameState.day,
  zoneId: "zone_extra_shelf"
}
```

### EXPANSION_COMPLETED

확장 조건을 만족해 확장 비용이 차감되고 구역이 unlocked 상태가 되었을 때 발생합니다.

payload 예시

```js
{
  day: GameState.day,
  zoneId: "zone_extra_shelf",
  zoneName: "Lv.2 추가 진열 구역",
  unlockCost: 30000,
  remainingMoney: GameState.money,
  unlockedZoneIds: ["zone_basic", "zone_extra_shelf"],
  effects: {
    customerSpawnRateBonus: 0.1,
    targetRevenueBonus: 5000,
    storeSizeBonus: 2
  },
  expansionState: {}
}
```

`effects`는 해금된 확장 구역의 누적 효과입니다. `GameFlowSystem`은 이 payload를 저장해 Day별 기본 밸런스 위에 목표 매출 보너스와 손님 방문율 보너스를 더합니다.

### EXPANSION_FAILED

확장 조건이 부족하거나 잘못된 구역을 요청했을 때 발생합니다.

payload 예시

```js
{
  day: GameState.day,
  zoneId: "zone_extra_shelf",
  zoneName: "Lv.2 추가 진열 구역",
  reason: "requirements_not_met",
  expansionState: {},
  message: "Lv.2 추가 진열 구역 확장 조건 부족: Day 2 필요 / ₩30,000 필요"
}
```

주의사항

- 실제 날짜 객체 사용 금지
- 모든 확장 조건은 GameState.day 기준
- GameState.day가 requiredDay에 도달해도 구역은 자동 unlocked 처리되지 않음
- ExpansionSystem은 GameState.money만 차감하고 GameState.todayStats를 직접 수정하지 않음
- 재고 증가, 비용 정산, 입고 처리, 상품 슬롯 확장 효과는 확장 효과 반영 범위에 포함하지 않음

---

## 엔딩 이벤트

### ENDING_ACHIEVED

최종 확장 구역을 Day 6 이후에 해금했을 때 발생합니다.

현재는 `zone_premium_store` 확장 완료 후 목표 달성 연출을 표시하기 위한 이벤트입니다.

payload 예시

```js
{
  day: GameState.day,
  zoneId: "zone_premium_store",
  zoneName: "Lv.4 프리미엄 매장 구역",
  endingTitle: "세계 1등 편의점 달성!",
  endingDescription: "먼지 나는 작은 편의점이 세계 최고의 K-편의점으로 성장했습니다.",
  unlockedZoneIds: [
    "zone_basic",
    "zone_extra_shelf",
    "zone_cold_food",
    "zone_premium_store"
  ],
  effects: {
    customerSpawnRateBonus: 0.5,
    targetRevenueBonus: 35000,
    storeSizeBonus: 4
  }
}
```

### ENDING_MODAL_CLOSED

엔딩 모달에서 “무한모드 계속하기” 버튼을 눌렀을 때 발생합니다.

엔딩은 게임 종료가 아니라 목표 달성 연출이므로, 모달을 닫은 뒤에도 게임은 계속 진행할 수 있습니다.

payload 예시

```js
{
  day: GameState.day,
  zoneId: "zone_premium_store",
  zoneName: "Lv.4 프리미엄 매장 구역"
}
```

주의사항

- 실제 날짜 객체 사용 금지
- 엔딩 달성 일자는 GameState.day 기준
- Day 1~5 프롤로그/스토리 모드에서는 최종 구역이 실수로 확장되어도 ENDING_ACHIEVED가 발생하지 않음
- GameState.todayStats 직접 수정 금지
- ENDING_MODAL_CLOSED는 게임 phase를 변경하지 않음

---

# 1번 담당

담당 파일

```
GameFlowSystem.js
ResultSystem.js
UpgradeSystem.js
```

받는 이벤트

```
DAY_START_REQUESTED

STORE_OPEN_REQUESTED

STORE_CLOSE_REQUESTED

DAY_ENDED

RESULT_CALCULATED
```

보내는 이벤트

```
DAY_STARTED

ORDER_PHASE_STARTED

STORE_OPENED

STORE_CLOSED

RESULT_CALCULATED

UPGRADE_PHASE_STARTED

UPGRADE_SELECTED

NEXT_DAY_READY
```

---

# 2번 담당

담당 파일

```
PlayerMovementSystem.js

PlayerActionSystem.js
```

보내는 이벤트

```
CHECKOUT_COMPLETED

RESTOCK_COMPLETED

CLEANING_COMPLETED
```

---

# 3번 담당

담당 파일

```
CustomerSystem.js

CustomerData.js
```

보내는 이벤트

```
CUSTOMER_ENTERED

CUSTOMER_SATISFIED

CUSTOMER_ANGRY

CUSTOMER_LEFT
```

---

# 4번 담당

담당 파일

```
InventorySystem.js

OrderSystem.js

ExpirationSystem.js

RandomEventSystem.js

EconomySystem.js

BMSystem.js

ProductData.js
```

보내는 이벤트

```
REVENUE_CHANGED

COST_CHANGED

INVENTORY_CHANGED

EXPIRED_LOSS_RECORDED

EVENT_PENALTY_RECORDED

BM_BONUS_APPLIED
```

---

# GameState.todayStats

```js
todayStats = {

revenue:0,

cost:0,

profit:0,

totalCustomers:0,

satisfiedCustomers:0,

angryCustomers:0,

lostCustomers:0,

checkoutSuccessCount:0,

restockCount:0,

cleaningCount:0,

expiredLoss:0,

eventPenalty:0,

bmBonus:0

}
```

---

# 개발 원칙

- 시스템끼리 직접 import해서 호출하지 않는다.
- EventBus를 통해 연결한다.
- GameState의 기존 변수명은 변경하지 않는다.
- 날짜는 반드시 GameState.day를 사용한다.
- 새로운 Event는 팀 공유 후 추가한다.
- 작업 전 git pull.
- 작업 후 commit / push.
