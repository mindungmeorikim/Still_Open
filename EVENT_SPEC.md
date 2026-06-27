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