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
예정

- NPC 연결

v1.8

- Inventory 연결

v1.9

- Random Event 연결

v2.0

- MVP 완성