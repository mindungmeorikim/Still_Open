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
import { PRODUCTS } from "../data/ProductData.js";

const STAFF_EVENTS = {
  HIRE_OFFERED: "STAFF_HIRE_OFFERED",
  HIRED: "STAFF_HIRED",
  HIRE_SKIPPED: "STAFF_HIRE_SKIPPED",
  STATE_CHANGED: "STAFF_STATE_CHANGED",
  AUTO_CHECKOUT_REQUESTED: "STAFF_AUTO_CHECKOUT_REQUESTED",
  AUTO_CHECKOUT_COMPLETED: "STAFF_AUTO_CHECKOUT_COMPLETED"
};

const TUTORIAL_PRACTICE_RESET_REQUESTED = "TUTORIAL_PRACTICE_RESET_REQUESTED";
const STAFF_UNLOCK_DAY = 3;
const STAFF_SHIFT_HOURS = 3;
const STAFF_SHIFT_ENTRY_REQUESTED = "STAFF_SHIFT_ENTRY_REQUESTED";
const STAFF_CANDIDATES = Object.freeze([
  Object.freeze({
    id: "kim_minji",
    assetVariant: "staff_female_glasses",
    name: "김민지",
    type: "꼼꼼한 정리형 알바",
    hourlyWage: 1200,
    attendance: 95,
    stats: Object.freeze({ warehouse: 1, shelf: 3, cleaning: 1 }),
    ability: "창고/진열/청소 보조를 모두 수행하지만, 진열 정리 능력이 조금 높은 알바입니다. 체크리스트를 보며 매장 정리를 꼼꼼하게 챙깁니다."
  }),
  Object.freeze({
    id: "park_junho",
    assetVariant: "staff_male_cashier",
    name: "박준호",
    type: "성실한 창고형 알바",
    hourlyWage: 1350,
    attendance: 88,
    stats: Object.freeze({ warehouse: 3, shelf: 1, cleaning: 1 }),
    ability: "창고/진열/청소 보조를 모두 수행하지만, 창고에서 재고를 가져오는 능력이 조금 높은 알바입니다. 시키면 착실히 해내는 신입 타입입니다."
  }),
  Object.freeze({
    id: "lee_bora",
    assetVariant: "staff_female_friendly",
    name: "이보라",
    type: "밝고 침착한 위생형 알바",
    hourlyWage: 1300,
    attendance: 90,
    stats: Object.freeze({ warehouse: 1, shelf: 1, cleaning: 3 }),
    ability: "창고/진열/청소 보조를 모두 수행하지만, 청소와 위생 유지 능력이 조금 높은 알바입니다. 밝고 침착한 미소로 매장을 정돈합니다."
  })
]);

export const GameFlowSystem = {
  orderReadyDay: null,
  dayTimerId: null,
  remainingDaySeconds: GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS,
  isStoreOpen: false,
  isClosing: false,
  isDayTimerPaused: false,
  staffAutoCheckoutElapsedSeconds: 0,

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

    EventBus.on(EVENTS.DAY_START_REQUESTED, (data) => this.startDay(data));
    EventBus.on(EVENTS.STORE_OPEN_REQUESTED, () => this.openStore());
    EventBus.on(EVENTS.STORE_CLOSE_REQUESTED, (data) => this.closeStore(data));
    EventBus.on(EVENTS.NEXT_DAY_READY, (data) => this.goToNextDay(data));
    EventBus.on(TUTORIAL_PRACTICE_RESET_REQUESTED, (data) => {
      this.resetTutorialPracticeRun(data);
    });
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
    EventBus.on(STAFF_EVENTS.AUTO_CHECKOUT_COMPLETED, (data) => {
      this.handleStaffAutoCheckoutCompleted(data);
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

    this.normalizeHiredStaffBaseStats(GameState.staff.hired);

    if (GameState.staff.workCountDay !== GameState.day) {
      GameState.staff.todayWarehouseHelpCount = 0;
      GameState.staff.todayShelfHelpCount = 0;
      GameState.staff.todayCleaningHelpCount = 0;
      GameState.staff.workCountDay = GameState.day;
    }

    ["todayWarehouseHelpCount", "todayShelfHelpCount", "todayCleaningHelpCount"].forEach((key) => {
      if (!Number.isFinite(Number(GameState.staff[key]))) {
        GameState.staff[key] = 0;
      }
    });

    return GameState.staff;
  },

  normalizeHiredStaffBaseStats(hired = null) {
    if (!hired) return null;
    const candidate = STAFF_CANDIDATES.find((staffCandidate) => staffCandidate.id === hired.id);
    const sourceStats = candidate?.stats ?? hired.stats ?? {};
    hired.stats = {
      warehouse: this.toStaffStat(sourceStats.warehouse),
      shelf: this.toStaffStat(sourceStats.shelf),
      cleaning: this.toStaffStat(sourceStats.cleaning)
    };
    return hired;
  },

  toStaffStat(value) {
    return Math.min(5, Math.max(0, Math.floor(Number(value) || 0)));
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
      `${candidate.name} 알바를 고용했습니다. 창고/진열대/청소 보조가 활성화됩니다.`
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

  getStaffAutoCheckoutInterval() {
    return 0;
  },

  handleStaffAutoCheckoutTick() {
    // BM 최종본 기준 알바는 자동 계산 전담이 아니라 창고/진열대/청소 보조를 수행한다.
    this.staffAutoCheckoutElapsedSeconds = 0;
  },

  handleStaffAutoCheckoutCompleted() {
    // 구버전 자동 계산 이벤트 호환용 no-op.
    this.staffAutoCheckoutElapsedSeconds = 0;
  },

  getStaffAssistPower(type = "shelf") {
    const staff = this.ensureStaffState().hired;
    if (!staff) return 0;
    const base = Math.max(0, Math.floor(Number(staff.stats?.[type]) || 0));
    const bonus = Math.max(0, Math.floor(Number(GameState.bm?.staffAbilityUpgrade?.abilities?.[type]) || 0));
    return Math.min(5, base + bonus);
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

  resetTutorialPracticeRun(data = {}) {
    this.clearDayTimer();
    this.orderReadyDay = null;
    this.isStoreOpen = false;
    this.isClosing = false;
    this.isDayTimerPaused = false;
    this.staffAutoCheckoutElapsedSeconds = 0;
    this.remainingDaySeconds = GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS;

    if (GameState.day <= 1 && GameState.isEndlessMode !== true) {
      GameState.day = 1;
    }

    GameState.phase = GAME_PHASE.READY;
    GameState.dayScenario = null;
    GameState.deliveryBoxState = null;
    GameState.warehouseBoxState = "closed";

    if (GameState.player && typeof GameState.player === "object") {
      delete GameState.player.carryingBoxType;
    }

    this.resetTodayStats();
    this.applyDayBalance();

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  startDay(data = {}) {
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
    this.staffAutoCheckoutElapsedSeconds = 0;
    this.remainingDaySeconds = GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS;
    this.clearDayTimer();

    GameState.phase = GAME_PHASE.ORDER;

    const modeText = GameState.isEndlessMode ? "무한모드" : "스토리 모드";
    const dayScenario = this.getCurrentDayScenario({ refresh: true });
    GameState.dayScenario = dayScenario;

    const isTutorialRealStart = data?.source === "tutorial_real_start";

    UIManager.showMessage(
      isTutorialRealStart
        ? "본격 게임이 시작됩니다! 세계 1등 편의점이 되는 날까지 발주부터 시작해보세요~"
        : `Day ${GameState.day} 시작! ${modeText}입니다. 발주 → 도착한 발주 박스 정리 → 첫 진열까지 마치면 영업을 시작할 수 있습니다.`
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
      UIManager.showMessage("아직 오픈 준비 중입니다. 발주를 확정하고 도착한 발주 박스를 눌러 발주 상품 정리까지 완료해주세요.");
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
      UIManager.showMessage("아직 오픈 준비 중입니다. 발주를 확정하고 도착한 발주 박스를 눌러 발주 상품 정리까지 완료해주세요.");
      return;
    }

    GameState.phase = GAME_PHASE.STORE_RUNNING;
    this.isStoreOpen = true;
    this.isClosing = false;
    this.isDayTimerPaused = false;
    this.staffAutoCheckoutElapsedSeconds = 0;
    this.startDayTimer();

    EventBus.emit(STAFF_SHIFT_ENTRY_REQUESTED, {
      day: GameState.day,
      phase: GameState.phase,
      source: "store_open_validated"
    });

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
    this.staffAutoCheckoutElapsedSeconds = 0;
    this.remainingDaySeconds = GAME_CONFIG.DEFAULT_DAY_TIME_SECONDS;

    if (GameState.day > GAME_CONFIG.MAX_STORY_DAY) {
      GameState.isEndlessMode = true;
      GameState.phase = GAME_PHASE.ENDLESS;
    } else {
      GameState.phase = GAME_PHASE.NEXT_DAY;
    }

    this.resetTodayStats();
    this.resetStaffDailyStats();
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

    UIManager.showMessage("재고 정리 완료! 첫 진열대가 자동으로 채워졌습니다. 영업 시작 버튼을 눌러 180초 영업을 시작하세요.");
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

    // v6.2.9: 재고가 없거나 오늘 상권 수요와 맞는 재고가 없어도 영업을 즉시 종료하지 않는다.
    // 0개 발주/소량 발주도 플레이는 계속 가능해야 하며, 실패 여부는 하루 종료 정산에서 판정한다.
    if (data.reason === "store_open_stock_check") {
      UIManager.showMessage("판매 가능한 재고가 부족합니다. 그래도 영업은 진행됩니다.");
    }

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
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

    this.dayTimerId = setInterval(() => {
      if (GameState.phase !== GAME_PHASE.STORE_RUNNING || this.isClosing) {
        this.clearDayTimer();
        return;
      }

      if (this.isDayTimerPaused) {
        return;
      }

      this.remainingDaySeconds = Math.max(0, this.remainingDaySeconds - 1);
      this.handleStaffAutoCheckoutTick(1);

      if (this.remainingDaySeconds <= 0) {
        this.closeStore({ source: "day_timer_finished" });
      }
    }, 1000);
  },

  clearDayTimer() {
    if (!this.dayTimerId) return;

    clearInterval(this.dayTimerId);
    this.dayTimerId = null;
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

  resetStaffDailyStats() {
    const staffState = this.ensureStaffState();

    staffState.todayWarehouseHelpCount = 0;
    staffState.todayShelfHelpCount = 0;
    staffState.todayCleaningHelpCount = 0;
    staffState.workCountDay = GameState.day;
    this.staffAutoCheckoutElapsedSeconds = 0;
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

  getCurrentDayScenario(options = {}) {
    if (
      options.refresh !== true &&
      GameState.dayScenario?.day === GameState.day
    ) {
      return GameState.dayScenario;
    }

    const marketAvailability = this.createMarketAvailabilitySnapshot();
    const scenario = getDayScenario(GameState.day, marketAvailability);

    if (options.refresh === true) {
      GameState.dayScenario = scenario;
    }

    return scenario;
  },

  createMarketAvailabilitySnapshot() {
    const sellableProducts = PRODUCTS.filter((product) => {
      return this.isProductAvailableForMarket(product);
    });
    const sellableProductIds = sellableProducts.map((product) => product.id);
    const sellableRequestIds = new Set(sellableProductIds);

    sellableProducts.forEach((product) => {
      (product.customerRequestIds ?? []).forEach((requestId) => {
        sellableRequestIds.add(requestId);
      });
    });

    return {
      sellableProductIds,
      sellableRequestIds: [...sellableRequestIds]
    };
  },

  isProductAvailableForMarket(product) {
    if (!product) return false;
    if (!this.isProductZoneAvailableForMarket(product.requiredZoneId)) return false;

    const bm = GameState.bm ?? {};
    const ownedContractProductIds = new Set([
      "potato_chips",
      "water",
      ...(Array.isArray(bm.ownedContractProductIds) ? bm.ownedContractProductIds : [])
    ]);
    const purchasedPremiumProductIds = new Set(
      Array.isArray(bm.purchasedPremiumProductIds) ? bm.purchasedPremiumProductIds : []
    );

    return product.isPremiumBM
      ? purchasedPremiumProductIds.has(product.id)
      : ownedContractProductIds.has(product.id);
  },

  isProductZoneAvailableForMarket(requiredZoneId) {
    if (!requiredZoneId) return true;

    const expansion = GameState.expansion ?? {};
    const unlockedZoneIds = new Set(
      Array.isArray(expansion.unlockedZoneIds) ? expansion.unlockedZoneIds : ["zone_basic"]
    );

    if (unlockedZoneIds.has(requiredZoneId)) return true;

    const constructionZoneId = expansion.constructionZoneId ?? null;
    const completeDay = Math.floor(Number(expansion.constructionCompleteDay));

    return (
      constructionZoneId === requiredZoneId &&
      Number.isFinite(completeDay) &&
      completeDay <= GameState.day
    );
  },

  toNumber(value) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return 0;
    }

    return numberValue;
  }
};
