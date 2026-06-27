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