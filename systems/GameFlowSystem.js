/*
  GameFlowSystem.js

  담당:
  - 1번 담당자

  역할:
  - 전체 플로우
  - Day 시작
  - 영업 시작
  - 하루 종료
  - 다음 Day 준비
  - Day 반복
  - Day별 목표/난이도 밸런스 관리
  - 스토리 모드 클리어
  - 무한모드 진입

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE, GAME_CONFIG } from "../core/Constants.js";
import { UIManager } from "../ui/UIManager.js";
import { getDayScenario } from "../data/DayScenarioData.js";

const STAFF_EVENTS = {
  HIRE_OFFERED: "STAFF_HIRE_OFFERED",
  HIRED: "STAFF_HIRED",
  HIRE_SKIPPED: "STAFF_HIRE_SKIPPED",
  STATE_CHANGED: "STAFF_STATE_CHANGED"
};

const STAFF_UNLOCK_DAY = 3;
const STAFF_SHIFT_HOURS = 3;
const STAFF_CANDIDATES = Object.freeze([
  Object.freeze({
    id: "kim_minji",
    name: "김민지",
    type: "성실형",
    hourlyWage: 1200,
    attendance: 95,
    ability: "재고 정리 +10%, 멘탈 소모 완화"
  }),
  Object.freeze({
    id: "park_junho",
    name: "박준호",
    type: "스피드형",
    hourlyWage: 1500,
    attendance: 78,
    ability: "계산 속도 +15%, 지각 가능성 있음"
  }),
  Object.freeze({
    id: "lee_bora",
    name: "이보라",
    type: "친절형",
    hourlyWage: 1350,
    attendance: 88,
    ability: "만족도 +8, 진상 응대 피해 완화"
  })
]);

export const GameFlowSystem = {
  orderReadyDay: null,
  dayTimerId: null,
  remainingDaySeconds: GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS,
  isStoreOpen: false,
  isClosing: false,
  isDayTimerPaused: false,

  expansionEffects: {
    customerSpawnRateBonus: 0,
    targetRevenueBonus: 0,
    storeSizeBonus: 0
  },

  /*
    임시 밸런스 데이터
    추후 플레이 테스트 후 수정 가능

    Day 1~5는 스토리 모드 기준 고정값
    Day 6부터는 무한모드 공식 계산 사용
  */
  dayBalanceTable: {
    1: {
      targetRevenue: 30000,
      targetSatisfaction: 70,
      difficulty: {
        customerSpawnRate: 1.0,
        angryCustomerRate: 1.0,
        stockDecreaseRate: 1.0,
        eventRate: 1.0
      }
    },
    2: {
      targetRevenue: 45000,
      targetSatisfaction: 70,
      difficulty: {
        customerSpawnRate: 1.15,
        angryCustomerRate: 1.05,
        stockDecreaseRate: 1.05,
        eventRate: 1.05
      }
    },
    3: {
      targetRevenue: 60000,
      targetSatisfaction: 72,
      difficulty: {
        customerSpawnRate: 1.3,
        angryCustomerRate: 1.12,
        stockDecreaseRate: 1.1,
        eventRate: 1.1
      }
    },
    4: {
      targetRevenue: 80000,
      targetSatisfaction: 75,
      difficulty: {
        customerSpawnRate: 1.5,
        angryCustomerRate: 1.2,
        stockDecreaseRate: 1.18,
        eventRate: 1.18
      }
    },
    5: {
      targetRevenue: 100000,
      targetSatisfaction: 78,
      difficulty: {
        customerSpawnRate: 1.75,
        angryCustomerRate: 1.3,
        stockDecreaseRate: 1.28,
        eventRate: 1.3
      }
    }
  },

  init() {
    this.ensureStaffState();
    this.applyDayBalance();

    EventBus.on(EVENTS.DAY_START_REQUESTED, () => this.startDay());
    EventBus.on(EVENTS.STORE_OPEN_REQUESTED, () => this.openStore());
    EventBus.on(EVENTS.STORE_CLOSE_REQUESTED, (data) => this.closeStore(data));
    EventBus.on(EVENTS.NEXT_DAY_READY, (data) => this.goToNextDay(data));
    EventBus.on(EVENTS.STOCK_ORGANIZED, (data) => {
      this.handleStockOrganized(data);
    });
    EventBus.on(EVENTS.INVENTORY_CHANGED, (data) => {
      this.handleInventoryChanged(data);
    });
    EventBus.on(EVENTS.EXPANSION_COMPLETED, (data) => {
      this.applyExpansionEffects(data);
    });
    EventBus.on(STAFF_EVENTS.HIRED, (data) => {
      this.handleStaffHired(data);
    });
    EventBus.on(STAFF_EVENTS.HIRE_SKIPPED, (data) => {
      this.handleStaffHireSkipped(data);
    });
  },

  ensureStaffState() {
    if (!GameState.staff) {
      GameState.staff = {
        unlocked: false,
        hired: null,
        hirePopupShownDay: null
      };
    }

    GameState.staff.unlocked =
      GameState.staff.unlocked === true || GameState.day >= STAFF_UNLOCK_DAY;

    if (typeof GameState.staff.hirePopupShownDay === "undefined") {
      GameState.staff.hirePopupShownDay = null;
    }

    if (typeof GameState.staff.hired === "undefined") {
      GameState.staff.hired = null;
    }

    return GameState.staff;
  },

  getStaffCandidates() {
    return STAFF_CANDIDATES.map((candidate) => {
      return {
        ...candidate,
        shiftHours: STAFF_SHIFT_HOURS,
        expectedDailyWage: candidate.hourlyWage * STAFF_SHIFT_HOURS
      };
    });
  },

  shouldOfferStaffHiring() {
    const staffState = this.ensureStaffState();

    return (
      GameState.day >= STAFF_UNLOCK_DAY &&
      !staffState.hired &&
      staffState.hirePopupShownDay !== GameState.day
    );
  },

  offerStaffHiringIfNeeded() {
    if (!this.shouldOfferStaffHiring()) {
      return;
    }

    GameState.staff.unlocked = true;
    GameState.staff.hirePopupShownDay = GameState.day;

    EventBus.emit(STAFF_EVENTS.HIRE_OFFERED, {
      day: GameState.day,
      shiftHours: STAFF_SHIFT_HOURS,
      candidates: this.getStaffCandidates(),
      staff: GameState.staff
    });
  },

  handleStaffHired(data = {}) {
    const staffState = this.ensureStaffState();

    if (data.day && data.day !== GameState.day) {
      return;
    }

    const candidate = STAFF_CANDIDATES.find((staffCandidate) => {
      return staffCandidate.id === data.candidateId;
    });

    if (!candidate) {
      UIManager.showMessage("고용할 알바 후보를 다시 선택해주세요.");
      return;
    }

    staffState.unlocked = true;
    staffState.hirePopupShownDay = GameState.day;
    staffState.hired = {
      ...candidate,
      shiftHours: STAFF_SHIFT_HOURS,
      expectedDailyWage: candidate.hourlyWage * STAFF_SHIFT_HOURS,
      hiredDay: GameState.day
    };

    UIManager.showMessage(
      `${candidate.name} 알바를 고용했습니다. 급여 차감과 능력치 효과는 다음 버전에서 적용됩니다.`
    );

    EventBus.emit(STAFF_EVENTS.STATE_CHANGED, {
      day: GameState.day,
      staff: staffState
    });
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handleStaffHireSkipped(data = {}) {
    const staffState = this.ensureStaffState();

    if (data.day && data.day !== GameState.day) {
      return;
    }

    staffState.unlocked = GameState.day >= STAFF_UNLOCK_DAY;
    staffState.hirePopupShownDay = GameState.day;

    UIManager.showMessage("오늘은 알바 고용을 넘겼습니다. 다음 Day 시작 때 다시 확인할 수 있습니다.");

    EventBus.emit(STAFF_EVENTS.STATE_CHANGED, {
      day: GameState.day,
      staff: staffState
    });
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  applyExpansionEffects(data = {}) {
    this.expansionEffects = this.normalizeExpansionEffects(data.effects);
    this.applyDayBalance();

    UIManager.showMessage(
      `확장 효과 적용: 목표 매출 +₩${this.expansionEffects.targetRevenueBonus.toLocaleString()} / 손님 방문 +${Math.round(this.expansionEffects.customerSpawnRateBonus * 100)}%`
    );

    UIManager.render();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  normalizeExpansionEffects(effects = {}) {
    return {
      customerSpawnRateBonus: this.toNumber(effects.customerSpawnRateBonus),
      targetRevenueBonus: this.toNumber(effects.targetRevenueBonus),
      storeSizeBonus: this.toNumber(effects.storeSizeBonus)
    };
  },

  startDay() {
    this.ensureStaffState();

    if (
      GameState.phase === GAME_PHASE.STORE_RUNNING ||
      GameState.phase === GAME_PHASE.DAY_END ||
      GameState.phase === GAME_PHASE.RESULT ||
      GameState.phase === GAME_PHASE.UPGRADE
    ) {
      UIManager.showMessage("이미 Day가 진행 중입니다. 현재 단계를 먼저 완료해주세요.");
      return;
    }

    this.orderReadyDay = null;
    this.isStoreOpen = false;
    this.isClosing = false;
    this.isDayTimerPaused = false;
    this.remainingDaySeconds = GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS;
    this.clearDayTimer();

    GameState.phase = GAME_PHASE.ORDER;

    const modeText = GameState.isEndlessMode ? "무한모드" : "스토리 모드";
    const dayScenario = this.getCurrentDayScenario();

    UIManager.showMessage(
      `Day ${GameState.day} 시작! ${modeText}입니다. 발주 → 택배 수령 → 재고 정리까지 마치면 영업을 시작할 수 있습니다.`
    );

    UIManager.render();

    EventBus.emit(EVENTS.DAY_STARTED, {
      day: GameState.day,
      dailyGoal: GameState.dailyGoal,
      difficulty: GameState.difficulty,
      isEndlessMode: GameState.isEndlessMode,
      dayScenario
    });

    EventBus.emit(EVENTS.ORDER_PHASE_STARTED, {
      day: GameState.day,
      dailyGoal: GameState.dailyGoal,
      difficulty: GameState.difficulty,
      isEndlessMode: GameState.isEndlessMode,
      dayScenario
    });

    this.offerStaffHiringIfNeeded();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  openStore() {
    if (GameState.phase === GAME_PHASE.ORDER) {
      UIManager.showMessage("아직 오픈 준비 중입니다. 발주를 확정하고 도착한 택배를 열어 재고 정리까지 완료해주세요.");
      return;
    }

    if (this.isStoreOpen || GameState.phase === GAME_PHASE.STORE_RUNNING) {
      UIManager.showMessage("이미 편의점 영업이 진행 중입니다.");
      return;
    }

    if (GameState.phase !== GAME_PHASE.DAY_START) {
      UIManager.showMessage("Day 시작 후에 영업을 시작할 수 있습니다.");
      return;
    }

    if (!this.isOrderReadyForCurrentDay()) {
      UIManager.showMessage("아직 오픈 준비 중입니다. 발주를 확정하고 도착한 택배를 열어 재고 정리까지 완료해주세요.");
      return;
    }

    GameState.phase = GAME_PHASE.STORE_RUNNING;
    this.isStoreOpen = true;
    this.isClosing = false;
    this.isDayTimerPaused = false;
    this.startDayTimer();

    UIManager.showMessage(
      `영업 시작! ${GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS}초 동안 손님 응대와 계산을 진행하고, 종료 후 오늘의 정산을 확인합니다.`
    );

    UIManager.render();

    EventBus.emit(EVENTS.STORE_OPENED, {
      day: GameState.day,
      phase: GameState.phase,
      dayTimeSeconds: GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS,
      remainingDaySeconds: this.remainingDaySeconds,
      dailyGoal: GameState.dailyGoal,
      difficulty: GameState.difficulty,
      isEndlessMode: GameState.isEndlessMode
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  closeStore(data = {}) {
    if (this.isClosing) {
      return;
    }

    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) {
      UIManager.showMessage("영업 중일 때만 하루를 종료할 수 있습니다.");
      return;
    }

    this.isClosing = true;
    this.isStoreOpen = false;
    this.isDayTimerPaused = false;
    this.clearDayTimer();

    GameState.phase = GAME_PHASE.DAY_END;

    const closeSource = data.source ?? "store_close_requested";
    const closeMessage = closeSource === "stock_out"
      ? "판매 가능한 재고가 모두 소진되어 영업을 조기 종료합니다."
      : "영업 종료! 매출, 만족도, 멘탈을 기준으로 오늘의 정산을 준비합니다.";

    UIManager.showMessage(closeMessage);

    UIManager.render();

    EventBus.emit(EVENTS.STORE_CLOSED, {
      day: GameState.day,
      phase: GameState.phase,
      source: closeSource
    });

    EventBus.emit(EVENTS.DAY_ENDED, {
      day: GameState.day,
      todayStats: GameState.todayStats,
      source: closeSource
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  goToNextDay(data = {}) {
    if (data.currentDay && data.currentDay !== GameState.day) {
      return;
    }

    if (
      GameState.phase !== GAME_PHASE.RESULT &&
      GameState.phase !== GAME_PHASE.UPGRADE
    ) {
      return;
    }

    const clearedStoryMode =
      GameState.day === GAME_CONFIG.MAX_STORY_DAY && !GameState.isEndlessMode;

    this.clearDayTimer();

    GameState.day += 1;
    this.orderReadyDay = null;
    this.isStoreOpen = false;
    this.isClosing = false;
    this.isDayTimerPaused = false;
    this.remainingDaySeconds = GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS;

    if (GameState.day > GAME_CONFIG.MAX_STORY_DAY) {
      GameState.isEndlessMode = true;
      GameState.phase = GAME_PHASE.ENDLESS;
    } else {
      GameState.phase = GAME_PHASE.NEXT_DAY;
    }

    this.resetTodayStats();
    this.applyDayBalance();

    const modeText = GameState.isEndlessMode ? "무한모드" : "스토리 모드";

    if (clearedStoryMode) {
      UIManager.showMessage(
        `스토리 모드 클리어! Day ${GameState.day}부터 무한모드가 시작됩니다. 목표 매출 ₩${GameState.dailyGoal.targetRevenue.toLocaleString()}에 도전하세요.`
      );
    } else {
      UIManager.showMessage(
        `Day ${GameState.day} 준비 완료! 현재 모드: ${modeText} / 목표 매출 ₩${GameState.dailyGoal.targetRevenue.toLocaleString()}`
      );
    }

    UIManager.render();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handleStockOrganized(data = {}) {
    if (data.day !== GameState.day) {
      return;
    }

    this.orderReadyDay = GameState.day;

    if (GameState.phase === GAME_PHASE.ORDER) {
      GameState.phase = GAME_PHASE.DAY_START;
    }

    UIManager.showMessage("재고 정리 완료! 오픈 준비가 끝났습니다. 영업 시작 버튼을 눌러 180초 영업을 시작하세요.");
    UIManager.render();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handleInventoryChanged(data = {}) {
    if (
      GameState.phase !== GAME_PHASE.STORE_RUNNING ||
      this.isClosing ||
      !this.isStoreOpen
    ) {
      return;
    }

    if (data.day !== GameState.day) {
      return;
    }

    const sellableQuantity = Number(
      data.sellableStockQuantityForCurrentDayRequests
    );

    if (!Number.isFinite(sellableQuantity) || sellableQuantity > 0) {
      return;
    }

    this.closeStore({ source: "stock_out" });
  },

  isOrderReadyForCurrentDay() {
    return this.orderReadyDay === GameState.day;
  },

  pauseDayTimer() {
    if (
      GameState.phase !== GAME_PHASE.STORE_RUNNING ||
      this.isClosing ||
      !this.dayTimerId
    ) {
      return;
    }

    this.isDayTimerPaused = true;
  },

  resumeDayTimer() {
    if (this.isClosing) {
      return;
    }

    this.isDayTimerPaused = false;
  },

  startDayTimer() {
    if (this.dayTimerId) {
      return;
    }

    this.remainingDaySeconds = GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS;
    this.isDayTimerPaused = false;
    console.log("[DAY TIMER START]", this.remainingDaySeconds);

    this.dayTimerId = setInterval(() => {
      if (GameState.phase !== GAME_PHASE.STORE_RUNNING || this.isClosing) {
        this.clearDayTimer();
        return;
      }

      if (this.isDayTimerPaused) {
        return;
      }

      this.remainingDaySeconds = Math.max(0, this.remainingDaySeconds - 1);
      console.log("[DAY TIMER]", this.remainingDaySeconds);

      if (this.remainingDaySeconds <= 0) {
        console.log("[DAY TIMER END]");
        this.closeStore({ source: "day_timer_finished" });
      }
    }, 1000);
  },

  clearDayTimer() {
    if (!this.dayTimerId) return;

    clearInterval(this.dayTimerId);
    this.dayTimerId = null;
    console.log("[DAY TIMER CLEAR]");
  },

  resetTodayStats() {
    GameState.todayStats = {
      revenue: 0,
      cost: 0,
      profit: 0,

      totalCustomers: 0,
      satisfiedCustomers: 0,
      angryCustomers: 0,
      lostCustomers: 0,

      checkoutSuccessCount: 0,
      restockCount: 0,
      cleaningCount: 0,

      expiredLoss: 0,
      eventPenalty: 0,
      bmBonus: 0
    };
  },

  applyDayBalance() {
    const balance = this.getDayBalance(GameState.day);
    const expansionEffects = this.expansionEffects;

    GameState.dailyGoal = {
      targetRevenue:
        balance.targetRevenue + expansionEffects.targetRevenueBonus,
      targetSatisfaction: balance.targetSatisfaction
    };

    GameState.difficulty = {
      customerSpawnRate:
        balance.difficulty.customerSpawnRate +
        expansionEffects.customerSpawnRateBonus,
      angryCustomerRate: balance.difficulty.angryCustomerRate,
      stockDecreaseRate: balance.difficulty.stockDecreaseRate,
      eventRate: balance.difficulty.eventRate
    };
  },

  getDayBalance(day) {
    if (this.dayBalanceTable[day]) {
      return this.dayBalanceTable[day];
    }

    return this.getEndlessModeBalance(day);
  },

  getEndlessModeBalance(day) {
    const extraDay = day - GAME_CONFIG.MAX_STORY_DAY;

    return {
      targetRevenue: 100000 + extraDay * 25000,
      targetSatisfaction: Math.min(90, 78 + extraDay),
      difficulty: {
        customerSpawnRate: Number((1.75 + extraDay * 0.12).toFixed(2)),
        angryCustomerRate: Number((1.3 + extraDay * 0.07).toFixed(2)),
        stockDecreaseRate: Number((1.28 + extraDay * 0.06).toFixed(2)),
        eventRate: Number((1.3 + extraDay * 0.07).toFixed(2))
      }
    };
  },

  getCurrentDayScenario() {
    return getDayScenario(GameState.day);
  },

  toNumber(value) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return 0;
    }

    return numberValue;
  }
};
