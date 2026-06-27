# 🏪 오늘도 정상영업 (Still Open)

> **대한민국에서 가장 정신없는 편의점을 운영하라!**

모바일 웹 기반 K-편의점 운영 시뮬레이션 게임

---

# 🎮 프로젝트 소개

**오늘도 정상영업**은 대한민국 편의점을 배경으로 한 모바일 웹 시뮬레이션 게임입니다.

플레이어는 작은 편의점을 운영하는 점장이 되어

- 계산
- 재고 관리
- 발주
- 진상 손님 대응
- 랜덤 이벤트
- 업그레이드

등을 수행하며 대한민국 최고의 편의점을 만드는 것이 목표입니다.

---

# 📱 게임 정보

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 오늘도 정상영업 (Still Open) |
| 장르 | K-편의점 운영 시뮬레이션 |
| 플랫폼 | Mobile Web |
| 개발 기간 | 2주 |
| 플레이 시간 | 약 3분 / Day |
| 개발 인원 | 4명 |

---

# 🎯 핵심 게임 루프

```
Day 시작
    ↓
오늘 목표 확인
    ↓
발주
    ↓
재고 정리
    ↓
영업 시작
    ↓
손님 입장
    ↓
상품 구매
    ↓
플레이어 계산
    ↓
진열대 재고 감소
    ↓
랜덤 이벤트
    ↓
플레이어 선택
    ↓
재고 보충
청소
대기열 관리
    ↓
하루 종료
    ↓
매출 / 만족도 / 멘탈 정산
    ↓
업그레이드
    ↓
다음 Day
```

---

# ✨ 주요 기능

- ✅ Day 기반 진행 시스템
- ✅ 계산 시스템
- ✅ 재고 관리
- ✅ 발주 시스템
- ✅ 손님 NPC
- ✅ 랜덤 이벤트
- ✅ 만족도 시스템
- ✅ 멘탈 시스템
- ✅ 업그레이드 시스템
- ✅ 무한모드

---

# 🛠 기술 스택

### Front-End

- HTML5
- CSS3
- JavaScript (ES6)

### Architecture

- EventBus Pattern
- Data Driven
- Lightweight ECS Style
- UI Manager

### Version Control

- Git
- GitHub

---

# 📂 프로젝트 구조

```
Still_Open

├── assets/
│   ├── images/
│   ├── audio/
│   └── fonts/
│
├── core/
│   ├── GameState.js
│   ├── EventBus.js
│   └── Constants.js
│
├── systems/
│   ├── GameFlowSystem.js
│   ├── ResultSystem.js
│   ├── UpgradeSystem.js
│   ├── PlayerMovementSystem.js
│   ├── PlayerActionSystem.js
│   ├── CustomerSystem.js
│   ├── InventorySystem.js
│   ├── OrderSystem.js
│   ├── EconomySystem.js
│   └── BMSystem.js
│
├── data/
│
├── ui/
│
├── index.html
├── style.css
├── main.js
├── README.md
└── EVENT_SPEC.md
```

---

# 👥 팀 역할

## 1️⃣ 시스템 PM (본인)

담당

- 전체 게임 플로우
- Day 진행
- 결과 정산
- 업그레이드 시스템
- 무한모드

파일

- GameFlowSystem.js
- ResultSystem.js
- UpgradeSystem.js

---

## 2️⃣ 플레이어 시스템

담당

- 플레이어 이동
- 터치 조작
- 계산
- 진열대 상호작용

---

## 3️⃣ NPC 시스템

담당

- 손님 AI
- 손님 행동
- 대기열
- 진상 손님

---

## 4️⃣ 경제 시스템

담당

- 상품
- 재고
- 발주
- 경제
- 랜덤 이벤트
- BM

---

# 📋 협업 규칙

### 공통 파일 수정 금지

```
index.html
main.js

GameState.js
Constants.js
EventBus.js
```

공통 파일 수정이 필요한 경우
반드시 팀원들과 협의 후 진행합니다.

---

### 담당 파일만 수정

각 팀원은 자신의 담당 파일만 수정합니다.

시스템 간 데이터 전달은 **EventBus**를 사용합니다.

---

# 🌿 Git Commit 규칙

```
v1.0 프로젝트 초기 구조 생성

v1.1 Day 시스템 구현

v1.2 Player 시스템 구현

v1.3 Customer 시스템 구현

v1.4 Inventory 시스템 구현

v1.5 Event 시스템 구현
```

---

# 🚀 실행 방법

```bash
git clone https://github.com/mindungmeorikim/Still_Open.git
```

VS Code에서 프로젝트 실행

```
Live Server 실행
```

---

# 🎯 개발 목표

- 모바일 환경 최적화
- K-편의점 감성 구현
- 반복 플레이 유도
- 2주 MVP 완성
- Git 협업 경험
- PM 중심 프로젝트 진행

---

# 📌 향후 업데이트 예정

- NPC 행동 다양화
- 상권 시스템
- 편의점 확장
- 업적 시스템
- 랭킹 시스템
- BM 고도화

---

# 👨‍💻 개발팀

**Still Open Team**

2026