# CHANGELOG

프로젝트 버전 기록

---

## v1.0

- 프로젝트 폴더 구조 생성
- GitHub 저장소 생성
- README 작성

---

## v1.1

- Constants.js 작성
- EventBus.js 작성
- GameState.js 작성

---

## v1.2

- UI 기본 화면 구축
- UIManager 작성
- index.html 구성
- style.css 작성

---

## v1.3

- GameFlowSystem 구축
- Day 시작
- 영업 시작
- 하루 종료 흐름 구현

---

## v1.4

- ResultSystem 구축
- 하루 정산
- 만족도
- 멘탈 계산

---

## v1.5

- UpgradeSystem 구축
- 업그레이드 단계
- 자동 업그레이드 적용

---

## v1.6

- Next Day 반복 시스템 구축
- 업그레이드 완료 후 다음 Day로 자동 이동
- Day 증가 처리 추가
- todayStats 초기화 처리 추가
- 목표 매출 증가 로직 추가
- 난이도 증가 로직 추가
- Day 6부터 무한모드 진입 구조 추가

---

## v1.7

- Day별 목표 매출 및 만족도 목표 구조 추가
- Day 1~5 스토리 모드용 임시 밸런스 테이블 추가
- Day 6 이후 무한모드용 자동 난이도 계산 구조 추가
- `GameState.difficulty` 값이 Day에 따라 갱신되도록 개선
- `DAY_STARTED`, `ORDER_PHASE_STARTED`, `STORE_OPENED` 이벤트 payload에 목표/난이도 데이터 전달 구조 유지
- 실제 날짜(Date)가 아닌 `GameState.day` 기준으로 밸런스 계산

---

## v1.8

- Day 5 이후 스토리 모드 클리어 및 무한모드 진입 흐름 추가
- Day 6부터 무한모드 상태가 명확하게 표시되도록 개선
- 잘못된 버튼 순서 입력 방지 로직 추가
- Day 시작 전 영업 시작 방지
- 영업 시작 전 하루 종료 방지
- 영업 중 Day 시작 중복 실행 방지
- 기존 `GameState.day` 기준 Day 진행 규칙 유지

---

## v1.9

- 팀원 시스템 연결을 위한 EventBus 수신 구조 추가
- PlayerActionSystem 이벤트를 ResultSystem에서 정산 데이터로 반영
- CustomerSystem 이벤트를 ResultSystem에서 손님 통계로 반영
- Economy / Inventory / RandomEvent 이벤트를 ResultSystem에서 비용 및 손익 데이터로 반영
- `CHECKOUT_COMPLETED`, `CUSTOMER_ENTERED`, `CUSTOMER_SATISFIED`, `CUSTOMER_ANGRY`, `CUSTOMER_LEFT` 이벤트 수신 처리 추가
- `REVENUE_CHANGED`, `COST_CHANGED`, `EXPIRED_LOSS_RECORDED`, `EVENT_PENALTY_RECORDED`, `BM_BONUS_APPLIED` 이벤트 수신 처리 추가
- 각 담당 시스템이 `GameState.todayStats`를 직접 수정하지 않고 EventBus로 정산 데이터에 반영될 수 있도록 구조 개선
- 기존 EventBus 기반 연결 규칙 유지

---

## v2.0

- MVP 기본 게임 루프 완성
- Day 시작 → 영업 시작 → 하루 종료 → 정산 → 업그레이드 → 다음 Day 흐름 연결
- 목표 매출 및 목표 만족도 기준 성공/실패 판정 구조 추가
- 멘탈 0 이하 여부를 결과 판정에 반영
- 정산 결과 메시지 개선
- 업그레이드 단계 메시지 개선
- 성공/실패 결과에 따라 자동 업그레이드 선택 기준 추가
- 정산 메시지가 업그레이드 메시지로 즉시 덮이지 않도록 지연 처리 추가
- 업그레이드 적용 후 다음 Day로 넘어가는 흐름 개선
- NPC / Inventory / Economy 시스템 연결 전 테스트 가능한 임시 MVP 데이터 구조 추가
- 추후 팀원 시스템 연결 시 임시 MVP 데이터 제거 가능하도록 주석 처리
- 기존 EventBus 기반 연결 규칙 유지
- 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 유지

---

## v2.1

- 정산 결과 확인 모달 구조 추가
- 정산 결과가 자동으로 사라지지 않고 확인 버튼 클릭 후 다음 단계로 진행되도록 개선
- `RESULT_CALCULATED` 이후 업그레이드 단계 자동 진입 흐름을 확인 버튼 기반으로 변경
- 모바일 터치 환경에서도 확인 버튼을 누르기 쉽도록 모달 UI 추가
- `UIManager.showResultModal()` 및 `UIManager.hideResultModal()` 추가
- `UpgradeSystem`의 정산 이후 진행 흐름을 모달 확인 방식으로 변경
- 기존 EventBus 기반 흐름 유지

---

## v2.2 / v2.2.1

* 3번 담당 손님 NPC 작업물을 현재 프로젝트 구조에 맞게 병합용으로 변환
* `data/CustomerData.js` 추가
* `systems/CustomerSystem.js` 추가 및 EventBus 기반 구조로 변환
* `main.js`에 `CustomerSystem.init()` 연결
* 손님 타입 5종 추가

  * 일반 손님
  * 학생
  * 회사원
  * 급한 손님
  * 진상 손님
* 손님별 구매 희망 상품 데이터 추가

  * `wantedProductId`
  * `wantedProductName`
* 손님 상태 관리값 추가

  * `status`
  * `currentZone`
  * `targetZone`
  * `waitTime`
  * `mood`
* 영업 시작 시 손님 자동 생성 기능 추가
* 손님 생성 시 `CUSTOMER_ENTERED` 이벤트가 발생하도록 연결
* 계산 완료 시 대기 손님을 만족 처리하고 `CUSTOMER_SATISFIED` 이벤트가 발생하도록 연결
* 대기시간 초과 시 `CUSTOMER_ANGRY`, `CUSTOMER_LEFT` 이벤트가 발생할 수 있도록 구조 추가
* 계산 대상 손님 조회 로직 보완

  * `waiting` 상태 손님 우선 조회
  * 대기 손님이 없을 경우 계산대 근처 손님, 쇼핑 중 손님, 입장 중 손님 순서로 조회
* 테스트 타이밍에 따라 `CHECKOUT_COMPLETED` 이벤트가 먼저 발생해도 손님 만족 처리가 가능하도록 개선
* 랜덤 이벤트 후보 손님 조회 함수 추가
* 손님 타입별 이벤트 후보 판정 구조 추가
* `Date.now()` 사용 제거
* 손님 ID를 `GameState.day`와 내부 counter 기준으로 생성하도록 변경
* `GameState.todayStats`를 직접 수정하지 않고 ResultSystem과 EventBus로 연결되도록 개선
* 3번 담당 작업물의 기존 손님 NPC 로직은 유지하고, 현재 프로젝트 구조에 맞게 병합 안정화
* 기존 EventBus 기반 연결 규칙 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.3

* 4번 담당 상품 / 재고 / 유통기한 작업물을 현재 프로젝트 구조에 맞게 병합
* `data/ProductData.js` 추가
* `systems/InventorySystem.js` 추가
* `systems/ExpirationSystem.js` 추가
* `main.js`에 `ExpirationSystem.init()`, `InventorySystem.init()` 연결
* 상품 데이터 16종 추가
* 바나나우유 상품 데이터 추가

  * 매입가 1,000원
  * 판매가 1,800원
  * Day 2 해금
* 상품별 매입가, 판매가, 유통기한, 해금 Day, 초기 재고 데이터 추가
* 손님 요청 상품 ID와 실제 상품 ID 연결 구조 추가

  * 예: `lunch_box` 요청을 도시락 상품군과 연결
* 재고 입고 기능 추가
* 상품 판매 시 재고 차감 구조 추가
* 유통기한이 빠른 재고부터 차감하는 선입선출 구조 추가
* Day 기준 유통기한 검사 구조 추가
* 유통기한 만료 상품 폐기 및 폐기 손실 계산 구조 추가
* 폐기 손실 발생 시 `EXPIRED_LOSS_RECORDED` 이벤트가 발생하도록 연결
* 재고 변경 시 `INVENTORY_CHANGED` 이벤트가 발생하도록 연결
* `CUSTOMER_SATISFIED` 이벤트를 받아 손님이 원하는 상품 기준으로 재고 차감이 가능하도록 연결
* 실제 날짜(Date)가 아닌 `GameState.day` 기준으로 유통기한을 처리하도록 유지
* 현재 구조상 계산 전 품절 여부 차단은 아직 미구현이며, 추후 `PlayerActionSystem`에서 계산 전 재고 검증 규칙 연결 필요

---

## v2.4

* 업그레이드 자동 적용 구조를 플레이어 선택 구조로 변경
* 정산 결과 확인 후 업그레이드 선택 모달이 표시되도록 개선
* 업그레이드 카드 UI 추가
* 플레이어가 업그레이드 1개를 직접 선택하면 효과가 적용되도록 변경
* 업그레이드 선택 후 다음 Day로 이동하는 흐름 유지
* `UIManager.showUpgradeModal()` 및 `UIManager.hideUpgradeModal()` 추가
* `UpgradeSystem`에서 자동 업그레이드 선택 타이머 제거
* 정산 → 확인 → 업그레이드 선택 → 다음 Day로 이어지는 성장 루프 개선
* 기존 EventBus 기반 Day 진행 / 정산 / 업그레이드 흐름 유지

---

## v2.5

* 4번 담당 상품 카드 UI 및 이미지 연결 작업물을 현재 프로젝트 구조에 맞게 부분 병합
* 상품 이미지 16종 추가

  * 바나나우유
  * 치즈 김치볶음밥
  * 초코바
  * 커피
  * 콜라
  * 달걀샌드
  * 오렌지주스
  * 왕돈가스 도시락
  * 감자칩
  * 컵라면
  * 소시지 핫바
  * 제육도시락
  * 새우스낵
  * 삼각김밥
  * 우동
  * 생수
* `data/ProductData.js`에 상품별 `imagePath` 추가
* `ui/UIManager.js`에 상품 카드 패널 생성 및 렌더링 코드 추가
* `INVENTORY_CHANGED` 이벤트 수신 시 상품 카드 UI가 갱신되도록 연결
* 모바일 화면 기준 2열 상품 카드 UI 추가
* 상품 카드에 상품 이미지, 가격, 재고, 다음 폐기 Day 표시 추가
* 잠금 상품에 해금 Day 표시 추가
* 바나나우유 이미지 연결 반영
* 상품 이미지 매칭 및 이벤트 기반 렌더링 테스트 완료
* 계산 테스트 후 상품 카드 재고 갱신 확인
* 기존 v2.4 업그레이드 선택 UI 유지
* 기존 손님 NPC 표시 UI 유지
* `main.js`, `index.html`, `core` 파일은 수정하지 않음
* 기존 `ExpirationSystem.init()` → `InventorySystem.init()` 초기화 순서 유지
* 기존 EventBus 기반 연결 규칙 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.6

* 발주 버튼 입력 이벤트 구조 추가
* `ORDER_BUTTON_CLICKED` 이벤트 추가
* `ORDER_REQUESTED` 이벤트 추가
* 상품 카드에 발주 버튼 추가
* 발주 버튼 클릭 시 `ORDER_REQUESTED` 이벤트가 발생하도록 연결
* 발주 요청 payload에 `day`, `productId`, `productName`, `quantity` 포함
* 잠금 상품은 발주 버튼이 비활성화되도록 처리
* 실제 발주 처리, 비용 차감, 재고 입고는 추후 `OrderSystem`에서 처리하도록 이벤트 입구만 구성
* 기존 상품 카드 UI, 손님 NPC 표시 UI, 업그레이드 선택 UI 유지
* 기존 EventBus 기반 연결 규칙 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.7

* 매장 구역 확장 시스템 1차 구현
* `data/ExpansionData.js` 추가
* `systems/ExpansionSystem.js` 추가
* 확장 구역 데이터 추가

  * Lv.1 먼지 나는 단칸 편의점
  * Lv.2 추가 진열 구역
  * Lv.3 냉장·도시락 구역
  * Lv.4 프리미엄 매장 구역
* `EXPANSION_REQUESTED`, `EXPANSION_COMPLETED`, `EXPANSION_FAILED` 이벤트 추가
* 미확장 구역을 어두운 오버레이와 구름/먼지 느낌으로 표시
* 확장 가능 조건을 만족하면 확장 버튼이 활성화되도록 처리
* 확장 완료 시 돈을 차감하고 구역 상태를 unlocked로 변경
* 확장 완료 구역은 밝게 표시되도록 개선
* 기존 Day 진행, 정산, 업그레이드 선택, 손님 NPC, 상품 카드, 발주 버튼 흐름 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.8

* 확장 구역 효과를 실제 게임 진행에 반영
* 확장 구역별 `effects` 데이터 추가
* 해금된 확장 구역의 누적 효과 계산 구조 추가
* 확장 완료 시 `EXPANSION_COMPLETED` 이벤트 payload에 누적 효과 포함
* `GameFlowSystem`에서 확장 효과를 Day 목표 및 난이도 계산에 반영
* 확장 효과에 따라 목표 매출 보너스 적용
* 확장 효과에 따라 손님 방문율 보너스 적용
* 확장 패널에 현재 매장 효과 표시 추가
* 기존 Day 진행, 정산, 업그레이드 선택, 손님 NPC, 상품 카드, 발주 버튼 흐름 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---
