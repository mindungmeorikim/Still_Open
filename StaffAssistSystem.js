/*
  StaffAssistSystem.js

  Staff assistance is limited to shelf refill and cleaning.
  It never handles order boxes, delivery boxes, checkout, BM purchases, upgrades,
  expansion, or settlement.
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { InventorySystem } from "./InventorySystem.js";
import { PlayerActionSystem } from "./PlayerActionSystem.js";
import { CustomerSystem } from "./CustomerSystem.js";
import { SanitationSystem } from "./SanitationSystem.js";
import { SHELF_INSTANCES } from "../data/ShelfPlacementData.js";
import { getCleaningPointByZoneId } from "../data/CleaningPointData.js";
import { getProductById } from "../data/ProductData.js";
import { getStoreObjectCollisionRects } from "../data/CollisionData.js";
import {
  arePointsInWalkableAreas,
  getStoreWalkableAreas,
  isPointInCenterProbeWalkableArea
} from "../data/WalkableAreaData.js";

export const STAFF_ASSIST_EVENTS = Object.freeze({
  STATE_CHANGED: "STAFF_ASSIST_STATE_CHANGED",
  MESSAGE_REQUESTED: "STAFF_ASSIST_MESSAGE_REQUESTED",
  TASK_COMPLETED: "STAFF_ASSIST_TASK_COMPLETED"
});

const STAFF_STATE_CHANGED = "STAFF_STATE_CHANGED";
const BM_STATE_CHANGED = "BM_STATE_CHANGED";
const STAFF_SHIFT_ENTRY_REQUESTED = "STAFF_SHIFT_ENTRY_REQUESTED";

const POSITIONS = Object.freeze({
  entry: Object.freeze({ x: 537, y: 680 }),
  // fallback 좌표입니다. 실제 알바 대기 위치는 getIdlePosition()에서 청소 도구함 좌표를 기준으로 계산합니다.
  idle: Object.freeze({ x: 895, y: 548 }),
  // fallback 좌표입니다. 실제 창고 도착 위치는 PlayerActionSystem.warehouseZone의 standX/standY를 기준으로 계산합니다.
  warehouseAssist: Object.freeze({ x: 250, y: 580 }),
  cleaningAssist: Object.freeze({ x: 895, y: 548 })
});

// 청소 도구함 기준 알바 대기 오프셋입니다.
// 청소 도구함/청소 포인트 좌표가 바뀌면 알바도 같은 기준점 옆으로 따라붙습니다.
const STAFF_IDLE_CLEANING_TOOL_OFFSET = Object.freeze({ x: -35, y: 12, direction: "down_right" });

// F8 좌표 모드에서 쓰는 월드 좌표 기준 알바 이동 경유지입니다.
// 화면 비율/카메라 줌이 바뀌어도 월드 좌표만 따라가도록 StaffAssistSystem 내부에서만 사용합니다.
const STAFF_ROUTE_POINTS = Object.freeze({
  entryAisle: Object.freeze({ x: 500, y: 645 }),
  mainAisle: Object.freeze({ x: 520, y: 640 }),
  // 계산대 앞 손님 대기열이 있을 때 알바가 줄을 관통하지 않도록 아래쪽 통로로 우회하는 지점입니다.
  counterQueueBypassAisle: Object.freeze({ x: 735, y: 620 }),
  // 플레이어가 발주 박스 정리 시 서는 위치를 기준으로 한 입구 바깥 물류 경유지입니다.
  deliveryBoxAisle: Object.freeze({ x: 510, y: 630 }),
  warehouseAisle: Object.freeze({ x: 340, y: 610 }),
  cleaningAisle: Object.freeze({ x: 760, y: 640 }),
  lowerRightAisle: Object.freeze({ x: 760, y: 640 }),
  zone1Aisle: Object.freeze({ x: 515, y: 610 }),
  zone2Aisle: Object.freeze({ x: 700, y: 430 }),
  zone3Aisle: Object.freeze({ x: 925, y: 565 }),
  zone3LowerAisle: Object.freeze({ x: 900, y: 675 }),
  zone3RightAisle: Object.freeze({ x: 1040, y: 690 }),
  zone4LowerAisle: Object.freeze({ x: 1180, y: 680 }),
  zone4ApproachAisle: Object.freeze({ x: 1230, y: 600 }),
  zone4Aisle: Object.freeze({ x: 1085, y: 430 })
});

const STAFF_ROUTE_POINTS_BY_ZONE_ID = Object.freeze({
  zone_basic: Object.freeze([STAFF_ROUTE_POINTS.mainAisle, STAFF_ROUTE_POINTS.zone1Aisle]),
  zone_extra_shelf: Object.freeze([STAFF_ROUTE_POINTS.mainAisle, STAFF_ROUTE_POINTS.zone2Aisle]),
  zone_cold_food: Object.freeze([STAFF_ROUTE_POINTS.mainAisle, STAFF_ROUTE_POINTS.zone3Aisle]),
  zone_premium_store: Object.freeze([STAFF_ROUTE_POINTS.mainAisle, STAFF_ROUTE_POINTS.zone4Aisle])
});

const STAFF_CHARACTER_ANCHOR = Object.freeze({ x: 56, y: 58 });
const STAFF_FOOT_COLLISION_BOX = Object.freeze({
  width: 28,
  height: 16,
  offsetX: -14,
  offsetY: -8
});
const STAFF_WALKABLE_PROBE = Object.freeze({
  // 플레이어와 같은 방식으로 발 주변 가로 라인을 검사해 외곽 벽을 타지 않게 한다.
  // 경로 연결부가 끊기지 않도록 몸통 전체가 아니라 발판 중심선만 검사한다.
  halfWidth: 21,
  upperOffsetY: 5
});
const STAFF_COUNTER_CUSTOMER_COLLISION_BOX = Object.freeze({
  width: 74,
  height: 34,
  offsetX: -12,
  offsetY: 48
});
const STAFF_CUSTOMER_COLLISION_BOX = Object.freeze({
  // 손님 PNG 49x87 기준 발밑/몸통 하단만 막는다.
  // 전체 이미지를 막으면 말풍선/머리 쪽까지 과하게 충돌해서 알바가 멈출 수 있다.
  width: 54,
  height: 30,
  offsetX: -3,
  offsetY: 52
});
const STAFF_COUNTER_QUEUE_BASE_POSITION = Object.freeze({ x: 610, y: 445 });
const STAFF_COUNTER_QUEUE_OFFSET = Object.freeze({ x: -18, y: 18 });
const STAFF_DEFAULT_STAND_FOOT_OFFSET = Object.freeze({ x: 0, y: 54, direction: "up" });

// 각 진열대의 interaction 좌표는 플레이어/알바가 실제로 접근해야 하는 기준점입니다.
// 알바 캐릭터는 DOM left/top 좌표로 배치되므로, 보이는 발 위치가 interaction 주변 통로에 오도록 보정합니다.
const STAFF_STAND_FOOT_OFFSETS_BY_SHELF_INSTANCE_ID = Object.freeze({
  zone1_basic_shelf_1: Object.freeze({ x: -30, y: 60, direction: "up_right" }),
  zone1_fridge_1: Object.freeze({ x: 10, y: 28, direction: "up" }),

  zone2_basic_shelf_1: Object.freeze({ x: 0, y: 96, direction: "up" }),
  zone2_fridge_1: Object.freeze({ x: 0, y: 112, direction: "up" }),
  zone2_fresh_shelf_1: Object.freeze({ x: -5, y: 104, direction: "up_left" }),

  zone3_basic_shelf_1: Object.freeze({ x: 5, y: 66, direction: "up_left" }),
  zone3_basic_shelf_2: Object.freeze({ x: 30, y: 86, direction: "up_left" }),
  zone3_fridge_1: Object.freeze({ x: -5, y: 30, direction: "up" }),
  zone3_fridge_2: Object.freeze({ x: 0, y: 42, direction: "up_left" }),
  zone3_fresh_shelf_1: Object.freeze({ x: 0, y: 56, direction: "up" }),

  zone4_fridge_1: Object.freeze({ x: -5, y: 190, direction: "up_left" }),
  zone4_fridge_2: Object.freeze({ x: 60, y: 140, direction: "up_left" }),
  zone4_fresh_shelf_1: Object.freeze({ x: -10, y: 145, direction: "up_left" }),
  zone4_fresh_shelf_2: Object.freeze({ x: -10, y: 106, direction: "up_left" }),
  zone4_warmer_1: Object.freeze({ x: 15, y: 62, direction: "up_left" })
});

const STATUS_LABELS = Object.freeze({
  off_duty: "출근 대기 중",
  entering: "출근 중",
  idle: "대기 중",
  checking: "매장 상태 확인 중",
  warehouse: "창고 재고 확인 중",
  shelf: "진열 보조 중",
  cleaning: "청소 보조 중",
  returning: "복귀 중"
});

const ACTIVE_PHASES = new Set([
  GAME_PHASE.STORE_RUNNING
]);

const BASE_WAREHOUSE_PREP_MS = 4200;
const BASE_SHELF_REFILL_MS = 5600;
const BASE_CLEANING_MS = 7000;
const CHECKING_DELAY_MS = 700;
const RETURNING_SETTLE_DELAY_MS = 420;
const STAFF_MOVE_SPEED = 2.0;
const STAFF_MOVE_FRAME_MS = 16;
const STAFF_MOVE_MAX_FRAME_SCALE = 1.75;
const STAFF_ROUTE_SKIP_DISTANCE = 28;
const CLEANING_RECOVERY = 25;
const PRODUCT_NO_STOCK_MESSAGE_COOLDOWN_MS = 15000;
const GLOBAL_GUIDE_MESSAGE_COOLDOWN_MS = 5000;
const STAFF_ATTENDANCE_NORMAL = "normal";
const STAFF_ATTENDANCE_LATE = "late";
const STAFF_ATTENDANCE_RULES = Object.freeze({
  1: Object.freeze({ lateRate: 0.15, minDelayMs: 20000, maxDelayMs: 30000 }),
  2: Object.freeze({ lateRate: 0.1, minDelayMs: 15000, maxDelayMs: 22000 }),
  3: Object.freeze({ lateRate: 0.05, minDelayMs: 10000, maxDelayMs: 16000 })
});
const STAFF_LATE_COMMUTE_MESSAGE = "알바생이 아직 출근길인 것 같아요.";
const STAFF_LATE_ARRIVAL_MESSAGE = "알바생이 뒤늦게 출근했습니다!";

export const StaffAssistSystem = {
  isInitialized: false,
  checkTimerId: null,
  lateEntryTimerId: null,
  taskTimerIds: [],
  moveRafId: null,
  moveSequence: 0,
  isWorking: false,
  cooldownUntilMs: 0,
  shiftEntryRequestedForDay: null,
  attendanceDecision: null,
  lastGuideMessageAtMs: 0,
  noStockMessageAtByProductId: {},
  state: {
    status: "off_duty",
    label: STATUS_LABELS.off_duty,
    x: POSITIONS.entry.x,
    y: POSITIONS.entry.y,
    direction: "down",
    isMoving: false,
    isWorking: false,
    taskType: null,
    targetShelfInstanceId: null,
    checkIntervalMs: 19000,
    cooldownMs: 12000,
    cooldownRemainingMs: 0
  },

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.bindEvents();
    if (this.canAssistInCurrentPhase()) {
      this.updateState("idle", { reason: "init_active", position: this.getIdlePosition() });
      this.scheduleNextCheck(1000);
      return;
    }

    this.setOffDuty("init");
  },

  bindEvents() {
    EventBus.on(EVENTS.GAME_INIT, () => {
      if (this.canAssistInCurrentPhase()) {
        this.updateState("idle", { reason: "game_init_active", position: this.getIdlePosition() });
        this.scheduleNextCheck(1000);
        return;
      }

      this.setOffDuty("game_init");
    });

    EventBus.on(EVENTS.DAY_STARTED, () => {
      this.setOffDuty("day_started");
    });

    EventBus.on(STAFF_SHIFT_ENTRY_REQUESTED, () => {
      this.handleShiftEntryRequested("store_open_requested");
    });

    EventBus.on(EVENTS.STORE_OPENED, () => {
      if (this.isLateAttendancePending()) {
        this.emitLateCommuteMessageOnce();
        return;
      }

      // 영업 시작 검증 통과 후 입구에서 들어오는 중이면,
      // 조기 상태 체크를 예약하지 않고 입장 완료 콜백에서만 자동 보조를 시작한다.
      if (this.state.status === "entering") {
        return;
      }

      if (this.shiftEntryRequestedForDay === GameState.day) {
        if (this.hasHiredStaff() && this.state.status === "idle") {
          this.scheduleNextCheck(900);
        }
        return;
      }

      this.handleShiftEntryRequested("store_opened");
    });

    EventBus.on(EVENTS.STORE_CLOSED, () => {
      this.setOffDuty("store_closed");
    });

    EventBus.on(EVENTS.DAY_ENDED, () => {
      this.setOffDuty("day_ended");
    });

    EventBus.on(STAFF_STATE_CHANGED, () => {
      if (this.canAssistInCurrentPhase()) {
        // 이미 출근 중/근무 중인 상태에서 알바 정보 갱신 이벤트가 다시 들어오면
        // 입구부터 재입장시키지 않는다. 이 재입장이 매장 안에서 입구로 튀는 것처럼 보였다.
        if (this.state.status !== "off_duty") {
          this.scheduleNextCheck(this.isWorking ? this.getCheckIntervalMs() : 900);
          return;
        }

        this.enterStoreFromEntrance("staff_state_changed");
        return;
      }

      this.setOffDuty("staff_state_changed");
    });

    EventBus.on(BM_STATE_CHANGED, () => {
      if (!this.hasHiredStaff()) return;

      this.scheduleNextCheck(this.isWorking ? this.getCheckIntervalMs() : 900);
    });
  },

  runCheckCycle() {
    this.checkTimerId = null;

    if (!this.hasHiredStaff()) {
      this.updateState("idle", { reason: "no_staff" });
      return;
    }

    if (this.isLateAttendancePending()) {
      return;
    }

    if (this.isWorking) {
      return;
    }

    if (!this.canAssistInCurrentPhase()) {
      this.updateState("idle", { reason: "inactive_phase" });
      this.scheduleNextCheck(this.getCheckIntervalMs());
      return;
    }

    const nowMs = this.getNowMs();

    if (nowMs < this.cooldownUntilMs) {
      this.updateState("idle", {
        reason: "cooldown",
        cooldownRemainingMs: Math.ceil(this.cooldownUntilMs - nowMs)
      });
      this.scheduleNextCheck(this.cooldownUntilMs - nowMs);
      return;
    }

    this.updateState("checking", { reason: "scheduled_check" });

    this.setTaskTimer(() => {
      if (this.isWorking || !this.hasHiredStaff() || !this.canAssistInCurrentPhase()) {
        this.scheduleNextCheck(this.getCheckIntervalMs());
        return;
      }

      const task = this.selectNextTask();

      if (!task) {
        this.updateState("idle", { reason: "no_task" });
        this.scheduleNextCheck(this.getCheckIntervalMs());
        return;
      }

      this.startTask(task);
    }, CHECKING_DELAY_MS);
  },

  selectNextTask() {
    const cleaningTask = this.createCleaningTask();

    if (cleaningTask) {
      return cleaningTask;
    }

    return (
      this.findShelfRefillTask("empty") ??
      this.findShelfRefillTask("low")
    );
  },

  createCleaningTask() {
    const sanitationState = SanitationSystem.getState?.() ?? GameState.sanitation ?? {};

    if (sanitationState.isCleaning === true || GameState.sanitation?.isCleaning === true) {
      return null;
    }

    const sanitationValue = this.getSanitationValue();
    const cleaningPower = this.getAssistPower("cleaning");
    const cleaningTriggerValue = 35 + cleaningPower * 5;

    if (sanitationValue > cleaningTriggerValue) {
      return null;
    }

    const activeCleaningPoint = this.getActiveCleaningAssistPoint();

    return {
      type: "cleaning",
      sanitationValue,
      cleaningTriggerValue,
      targetCleaningZoneId: activeCleaningPoint.zoneId,
      targetCleaningSpotId: activeCleaningPoint.id,
      activeCleaningPoint,
      durationMs: this.getTaskDurationMs("cleaning", BASE_CLEANING_MS)
    };
  },

  findShelfRefillTask(kind = "empty") {
    const shelves = this.getShelfSlots();

    for (const shelf of shelves) {
      const normalizedShelf = this.normalizeShelfSlot(shelf);

      if (!this.isShelfZoneUnlocked(normalizedShelf)) {
        continue;
      }

      if (!normalizedShelf.productId) {
        continue;
      }

      const lowStockThreshold = Math.max(
        1,
        Math.floor(normalizedShelf.maxStock * 0.3)
      );
      const isEmpty = normalizedShelf.currentStock <= 0;
      const isLow = normalizedShelf.currentStock <= lowStockThreshold;
      const matchesKind = kind === "empty" ? isEmpty : !isEmpty && isLow;

      if (!matchesKind) {
        continue;
      }

      const warehouseStock = this.getWarehouseStock(normalizedShelf.productId);

      if (warehouseStock <= 0) {
        this.requestNoStockGuide(normalizedShelf.productId);
        continue;
      }

      const restockAmount = this.getRefillableShelfQuantity(
        normalizedShelf,
        warehouseStock
      );

      if (restockAmount <= 0) {
        continue;
      }

      return {
        type: "shelf",
        shelf: normalizedShelf,
        productId: normalizedShelf.productId,
        urgency: kind,
        warehouseStock,
        restockAmount,
        prepDurationMs: this.getTaskDurationMs("warehouse", BASE_WAREHOUSE_PREP_MS),
        refillDurationMs: this.getTaskDurationMs("shelf", BASE_SHELF_REFILL_MS)
      };
    }

    return null;
  },

  startTask(task) {
    if (this.isWorking || !task) {
      return;
    }

    this.clearCheckTimer();
    this.isWorking = true;

    if (task.type === "cleaning") {
      this.startCleaningTask(task);
      return;
    }

    if (task.type === "shelf") {
      this.startShelfTask(task);
    }
  },

  startCleaningTask(task) {
    const cleaningAssistPosition = this.getCleaningAssistPosition(task.activeCleaningPoint);

    this.moveStaffToState("cleaning", {
      reason: "cleaning_started",
      taskType: "cleaning",
      position: cleaningAssistPosition,
      direction: cleaningAssistPosition.direction,
      targetCleaningZoneId: task.targetCleaningZoneId,
      targetCleaningSpotId: task.targetCleaningSpotId,
      cleaningTriggerValue: task.cleaningTriggerValue,
      taskDurationMs: task.durationMs
    }, () => {
      this.setTaskTimer(() => {
        const previousValue = this.getSanitationValue();
        const result = SanitationSystem.increaseSanitation(
          CLEANING_RECOVERY,
          "staff_cleaning_assist"
        );
        const nextValue = this.toSanitationValue(
          result?.state?.value ?? GameState.sanitation?.value,
          previousValue
        );

        this.incrementStaffDailyCount("todayCleaningHelpCount");

        const cleanedPoint = task.activeCleaningPoint ?? this.getActiveCleaningAssistPoint();

        EventBus.emit(EVENTS.CLEANING_COMPLETED, {
          day: GameState.day,
          source: "staff_assist",
          actorType: "staff",
          previousValue,
          value: nextValue,
          recoveredAmount: Math.max(0, nextValue - previousValue),
          cleanedZoneId: cleanedPoint.zoneId,
          cleanedSpotId: cleanedPoint.id,
          cleanedPoint,
          state: SanitationSystem.getState?.() ?? GameState.sanitation
        });

        this.emitMessage(`${cleanedPoint.label} 청소 보조가 끝났어요.`, 2200);
        this.completeTask({
          type: "cleaning",
          success: true,
          previousValue,
          value: nextValue
        });
      }, task.durationMs);
    });
  },

  startShelfTask(task) {
    const warehouseAssistPosition = this.getWarehouseAssistPosition();

    this.moveStaffToState("warehouse", {
      reason: "shelf_prepare_started",
      taskType: "shelf",
      label: "창고로 재고 가지러 가는 중",
      position: warehouseAssistPosition,
      routePoints: this.getStaffIdleToWarehouseRoutePoints(),
      direction: "up_left",
      carryingBoxType: null,
      targetShelfInstanceId: task.shelf.instanceId,
      productId: task.productId,
      taskDurationMs: task.prepDurationMs
    }, () => {
      this.setWarehouseBoxVisualState("open");
      this.updateState("warehouse", {
        reason: "shelf_prepare_picking_stock",
        taskType: "shelf",
        label: "창고에서 재고 꺼내는 중",
        position: warehouseAssistPosition,
        direction: "up_left",
        carryingBoxType: null,
        targetShelfInstanceId: task.shelf.instanceId,
        productId: task.productId,
        taskDurationMs: task.prepDurationMs
      });

      this.setTaskTimer(() => {
        const refreshedTask = this.refreshShelfTask(task);

        if (!refreshedTask || refreshedTask.restockAmount <= 0) {
          this.setWarehouseBoxVisualState("closed");
          this.requestNoStockGuide(task.productId);
          this.completeTask({
            type: "shelf",
            success: false,
            reason: "no_warehouse_stock",
            productId: task.productId
          });
          return;
        }

        const shelfAssistPosition = this.getShelfAssistPosition(refreshedTask.shelf);
        const carryingBoxType = this.getCarryingBoxTypeForProduct(refreshedTask.productId);

        this.setWarehouseBoxVisualState("closed");
        this.moveStaffToState("shelf", {
          reason: "shelf_refill_started",
          taskType: "shelf",
          label: "재고 들고 진열대로 이동 중",
          position: shelfAssistPosition,
          routePoints: this.getStaffWarehouseToShelfRoutePoints(refreshedTask.shelf),
          direction: shelfAssistPosition.direction,
          carryingBoxType,
          targetShelfInstanceId: refreshedTask.shelf.instanceId,
          targetShelfZoneId: refreshedTask.shelf.zoneId,
          productId: refreshedTask.productId,
          taskDurationMs: refreshedTask.refillDurationMs
        }, () => {
          this.updateState("shelf", {
            reason: "shelf_refill_working",
            taskType: "shelf",
            label: "진열대 보충 중",
            position: shelfAssistPosition,
            direction: shelfAssistPosition.direction,
            carryingBoxType,
            targetShelfInstanceId: refreshedTask.shelf.instanceId,
            targetShelfZoneId: refreshedTask.shelf.zoneId,
            productId: refreshedTask.productId,
            taskDurationMs: refreshedTask.refillDurationMs
          });

          this.setTaskTimer(() => {
            const result = this.completeShelfRefill(refreshedTask);

            if (result.success) {
              this.emitMessage("진열 보조가 끝났어요.", 2200);
            }

            this.completeTask(result);
          }, refreshedTask.refillDurationMs);
        });
      }, task.prepDurationMs);
    });
  },

  refreshShelfTask(task) {
    const shelf = this.getShelfSlotByInstanceId(task.shelf.instanceId);

    if (!shelf) {
      return null;
    }

    const normalizedShelf = this.normalizeShelfSlot(shelf);
    const warehouseStock = this.getWarehouseStock(normalizedShelf.productId);
    const restockAmount = this.getRefillableShelfQuantity(
      normalizedShelf,
      warehouseStock
    );

    return {
      ...task,
      shelf: normalizedShelf,
      productId: normalizedShelf.productId,
      warehouseStock,
      restockAmount: Math.max(0, restockAmount)
    };
  },

  completeShelfRefill(task) {
    const shelf = this.getShelfSlotByInstanceId(task.shelf.instanceId);

    if (!shelf) {
      return {
        type: "shelf",
        success: false,
        reason: "missing_shelf",
        productId: task.productId
      };
    }

    const normalizedShelf = this.normalizeShelfSlot(shelf);
    const warehouseStock = this.getWarehouseStock(normalizedShelf.productId);
    const restockAmount = this.getRefillableShelfQuantity(
      normalizedShelf,
      warehouseStock
    );

    if (restockAmount <= 0) {
      return {
        type: "shelf",
        success: false,
        reason: "no_warehouse_stock",
        productId: normalizedShelf.productId,
        shelfInstanceId: normalizedShelf.instanceId
      };
    }

    const nextStock = Math.min(
      normalizedShelf.maxStock,
      normalizedShelf.currentStock + restockAmount
    );

    if (!PlayerActionSystem.shelfStocks[normalizedShelf.instanceId]) {
      PlayerActionSystem.shelfStocks[normalizedShelf.instanceId] = { products: {} };
    }

    if (!PlayerActionSystem.shelfStocks[normalizedShelf.instanceId].products) {
      PlayerActionSystem.shelfStocks[normalizedShelf.instanceId].products = {};
    }

    PlayerActionSystem.shelfStocks[normalizedShelf.instanceId].products[normalizedShelf.productId] = {
      productId: normalizedShelf.productId,
      currentStock: nextStock,
      maxStock: normalizedShelf.maxStock
    };
    PlayerActionSystem.syncShelfStocksToGameState?.("staff_shelf_refill");
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    this.incrementStaffDailyCount("todayShelfHelpCount");

    return {
      type: "shelf",
      success: true,
      productId: normalizedShelf.productId,
      shelfId: normalizedShelf.shelfId,
      shelfInstanceId: normalizedShelf.instanceId,
      previousStock: normalizedShelf.currentStock,
      currentStock: nextStock,
      maxStock: normalizedShelf.maxStock,
      quantity: nextStock - normalizedShelf.currentStock
    };
  },

  completeTask(result = {}) {
    EventBus.emit(STAFF_ASSIST_EVENTS.TASK_COMPLETED, {
      day: GameState.day,
      staffId: GameState.staff?.hired?.id ?? null,
      staffName: GameState.staff?.hired?.name ?? null,
      ...result,
      assistState: this.getStateSnapshot()
    });

    this.moveStaffToState("returning", {
      reason: "task_finished",
      taskType: result.type ?? null,
      position: this.getIdlePosition(),
      carryingBoxType: null
    }, () => {
      this.setTaskTimer(() => {
        this.isWorking = false;
        this.cooldownUntilMs = this.getNowMs() + this.getCooldownMs();
        this.updateState("idle", {
          reason: "task_cooldown",
          lastTaskType: result.type ?? null,
          position: this.getIdlePosition(),
          carryingBoxType: null
        });
        this.scheduleNextCheck(this.getCooldownMs());
      }, RETURNING_SETTLE_DELAY_MS);
    });
  },

  setOffDuty(reason = "off_duty") {
    this.clearCheckTimer();
    this.clearLateEntryTimer();
    this.clearTaskTimers();
    this.cancelStaffMovement();
    this.isWorking = false;
    this.cooldownUntilMs = 0;
    this.shiftEntryRequestedForDay = null;
    this.attendanceDecision = null;
    this.updateState("off_duty", {
      reason,
      position: POSITIONS.entry,
      direction: "down_left",
      isMoving: false,
      attendanceStatus: null,
      attendanceLevel: null,
      attendanceDelayMs: 0,
      attendanceReadyAtMs: null,
      attendanceDecidedDay: null,
      attendanceArrived: false
    });
  },

  handleShiftEntryRequested(reason = "store_open_requested") {
    if (!this.hasHiredStaff()) {
      this.setOffDuty(`${reason}_no_staff`);
      return;
    }

    if (this.shiftEntryRequestedForDay === GameState.day && this.state.status !== "off_duty") {
      return;
    }

    const attendance = this.getAttendanceDecisionForDay();

    if (attendance.status === STAFF_ATTENDANCE_LATE) {
      this.scheduleLateEntry(attendance, reason);
      return;
    }

    this.enterStoreFromEntrance(reason);
  },

  getAttendanceDecisionForDay() {
    const hired = GameState.staff?.hired ?? null;
    const staffId = hired?.id ?? "staff";

    if (
      this.attendanceDecision?.day === GameState.day &&
      this.attendanceDecision.staffId === staffId
    ) {
      return this.attendanceDecision;
    }

    const level = this.getStaffAttendanceLevel();
    const rule = this.getAttendanceRuleForLevel(level);
    const isLate = rule.lateRate > 0 && Math.random() < rule.lateRate;
    const delayMs = isLate ? this.getRandomDelayMs(rule.minDelayMs, rule.maxDelayMs) : 0;

    this.attendanceDecision = {
      day: GameState.day,
      staffId,
      level,
      status: isLate ? STAFF_ATTENDANCE_LATE : STAFF_ATTENDANCE_NORMAL,
      delayMs,
      readyAtMs: null,
      arrived: false
    };

    return this.attendanceDecision;
  },

  getStaffAttendanceLevel() {
    const upgradeCount = Math.max(
      0,
      Math.floor(Number(GameState.bm?.staffAbilityUpgrade?.totalCount) || 0)
    );

    return Math.max(1, upgradeCount + 1);
  },

  getAttendanceRuleForLevel(level = 1) {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));

    if (safeLevel >= 4) {
      return { lateRate: 0, minDelayMs: 0, maxDelayMs: 0 };
    }

    return STAFF_ATTENDANCE_RULES[safeLevel] ?? STAFF_ATTENDANCE_RULES[1];
  },

  getRandomDelayMs(minDelayMs, maxDelayMs) {
    const min = Math.max(0, Math.floor(Number(minDelayMs) || 0));
    const max = Math.max(min, Math.floor(Number(maxDelayMs) || min));

    return min + Math.floor(Math.random() * (max - min + 1));
  },

  scheduleLateEntry(attendance, reason = "late_entry") {
    if (this.lateEntryTimerId && this.isLateAttendancePending()) {
      return;
    }

    this.clearCheckTimer();
    this.clearTaskTimers();
    this.cancelStaffMovement();
    this.isWorking = false;
    this.cooldownUntilMs = 0;
    this.shiftEntryRequestedForDay = GameState.day;

    const delayMs = Math.max(0, Math.floor(Number(attendance.delayMs) || 0));
    const readyAtMs = this.getNowMs() + delayMs;

    this.attendanceDecision = {
      ...attendance,
      readyAtMs,
      arrived: false
    };

    this.updateState("off_duty", {
      reason: `${reason}_late`,
      position: POSITIONS.entry,
      direction: "down_left",
      isMoving: false,
      attendanceStatus: STAFF_ATTENDANCE_LATE,
      attendanceLevel: attendance.level,
      attendanceDelayMs: delayMs,
      attendanceReadyAtMs: readyAtMs,
      attendanceDecidedDay: GameState.day,
      attendanceArrived: false
    });

    if (this.canAssistInCurrentPhase()) {
      this.emitLateCommuteMessageOnce();
    }

    this.lateEntryTimerId = window.setTimeout(() => {
      this.lateEntryTimerId = null;

      if (
        this.attendanceDecision?.day !== GameState.day ||
        this.attendanceDecision?.staffId !== attendance.staffId ||
        !this.hasHiredStaff()
      ) {
        return;
      }

      if (!this.canAssistInCurrentPhase()) {
        this.attendanceDecision = null;
        this.setOffDuty("late_entry_cancelled");
        return;
      }

      this.attendanceDecision = {
        ...this.attendanceDecision,
        arrived: true
      };
      this.emitMessage(STAFF_LATE_ARRIVAL_MESSAGE, 2600);
      this.enterStoreFromEntrance("late_arrival");
    }, delayMs);
  },

  isLateAttendancePending() {
    return (
      this.attendanceDecision?.day === GameState.day &&
      this.attendanceDecision.status === STAFF_ATTENDANCE_LATE &&
      this.attendanceDecision.arrived !== true
    );
  },

  emitLateCommuteMessageOnce() {
    if (!this.isLateAttendancePending() || this.attendanceDecision.commuteMessageShown === true) {
      return;
    }

    this.attendanceDecision = {
      ...this.attendanceDecision,
      commuteMessageShown: true
    };
    this.emitMessage(STAFF_LATE_COMMUTE_MESSAGE, 2600);
  },

  getAttendanceStateFields(status = null) {
    const decision = this.attendanceDecision?.day === GameState.day
      ? this.attendanceDecision
      : null;
    const attendanceStatus = status ?? decision?.status ?? STAFF_ATTENDANCE_NORMAL;

    return {
      attendanceStatus,
      attendanceLevel: decision?.level ?? this.getStaffAttendanceLevel(),
      attendanceDelayMs: Math.max(0, Math.floor(Number(decision?.delayMs) || 0)),
      attendanceReadyAtMs: decision?.readyAtMs ?? null,
      attendanceDecidedDay: decision?.day ?? GameState.day,
      attendanceArrived: attendanceStatus !== STAFF_ATTENDANCE_LATE || decision?.arrived === true
    };
  },

  enterStoreFromEntrance(reason = "enter_store") {
    this.clearCheckTimer();
    this.clearTaskTimers();
    this.cancelStaffMovement();

    if (!this.hasHiredStaff()) {
      this.setOffDuty(`${reason}_no_staff`);
      return;
    }

    this.shiftEntryRequestedForDay = GameState.day;
    this.isWorking = false;
    this.cooldownUntilMs = 0;
    const attendanceFields = this.getAttendanceStateFields();
    this.updateState("entering", {
      reason,
      position: POSITIONS.entry,
      direction: "down_left",
      isMoving: false,
      ...attendanceFields
    });

    this.moveStaffToState("idle", {
      reason: `${reason}_arrive_idle`,
      position: this.getIdlePosition(),
      label: STATUS_LABELS.idle,
      ...attendanceFields
    }, () => {
      this.cooldownUntilMs = this.getNowMs() + 900;
      this.scheduleNextCheck(900);
    });
  },

  returnToIdle(reason = "return_to_idle") {
    this.clearCheckTimer();
    this.clearTaskTimers();
    this.cancelStaffMovement();
    this.isWorking = false;
    this.cooldownUntilMs = 0;
    this.updateState("idle", { reason });

    if (this.hasHiredStaff()) {
      this.scheduleNextCheck(this.getCheckIntervalMs());
    }
  },

  moveStaffToState(status, options = {}, onArrive = null) {
    const targetPosition = this.normalizePoint(
      options.position ?? this.getDefaultPositionForStatus(status),
      this.getDefaultPositionForStatus("idle")
    );
    const idlePosition = this.getDefaultPositionForStatus("idle");
    const currentPosition = this.normalizePoint(
      { x: this.state.x, y: this.state.y },
      idlePosition
    );
    const directDistance = this.getPointDistance(
      currentPosition.x,
      currentPosition.y,
      targetPosition.x,
      targetPosition.y
    );

    // 이미 목표 위치 근처에 있는데 기본 경유 루트를 타면 청소/복귀 시
    // 알바가 멀리 휙 나갔다가 다시 돌아오는 것처럼 보인다.
    // 가까운 목적지는 경유지 없이 바로 정착시켜 대기 흔들림도 줄인다.
    if (directDistance <= STAFF_ROUTE_SKIP_DISTANCE) {
      this.moveStaffDirectToState(status, {
        ...options,
        position: targetPosition
      }, onArrive);
      return;
    }

    const movementPath = this.createMovementPath(status, options, targetPosition);

    if (movementPath.length <= 1) {
      this.moveStaffDirectToState(status, {
        ...options,
        position: targetPosition
      }, onArrive);
      return;
    }

    this.moveStaffAlongPath(status, options, movementPath, onArrive);
  },

  moveStaffAlongPath(status, options = {}, path = [], onArrive = null) {
    const [nextPoint, ...remainingPath] = path;

    if (!nextPoint) {
      onArrive?.();
      return;
    }

    const isFinalPoint = remainingPath.length === 0;
    const segmentOptions = {
      ...options,
      position: nextPoint,
      direction: isFinalPoint ? options.direction : undefined,
      routeRemainingCount: remainingPath.length
    };

    this.moveStaffDirectToState(status, segmentOptions, () => {
      if (remainingPath.length > 0) {
        this.moveStaffAlongPath(status, options, remainingPath, onArrive);
        return;
      }

      onArrive?.();
    });
  },

  moveStaffDirectToState(status, options = {}, onArrive = null) {
    const targetPosition = this.normalizePoint(
      options.position ?? this.getDefaultPositionForStatus(status),
      this.getDefaultPositionForStatus("idle")
    );
    const targetX = targetPosition.x;
    const targetY = targetPosition.y;
    const idlePosition = this.getDefaultPositionForStatus("idle");
    const startX = Math.round(Number(this.state.x) || idlePosition.x);
    const startY = Math.round(Number(this.state.y) || idlePosition.y);
    const distance = this.getPointDistance(startX, startY, targetX, targetY);

    this.cancelStaffMovement();

    if (distance <= STAFF_MOVE_SPEED) {
      this.updateState(status, {
        ...options,
        position: { x: targetX, y: targetY },
        direction: options.direction ?? this.state.direction ?? "down",
        isMoving: false
      });
      onArrive?.();
      return;
    }

    const sequence = this.moveSequence + 1;
    this.moveSequence = sequence;
    const movementDirection = this.getDirectionFromMovement(
      targetX - startX,
      targetY - startY,
      this.state.direction
    );

    this.updateState(status, {
      ...options,
      position: { x: startX, y: startY },
      direction: movementDirection,
      isMoving: true
    });

    let lastFrameAtMs = this.getNowMs();

    const step = () => {
      if (sequence !== this.moveSequence) {
        return;
      }

      const nowMs = this.getNowMs();
      const elapsedFrameMs = Math.max(STAFF_MOVE_FRAME_MS, nowMs - lastFrameAtMs);
      const frameScale = Math.min(
        STAFF_MOVE_MAX_FRAME_SCALE,
        elapsedFrameMs / STAFF_MOVE_FRAME_MS
      );
      const currentX = Number(this.state.x) || startX;
      const currentY = Number(this.state.y) || startY;
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      const remainingDistance = Math.sqrt(dx * dx + dy * dy);
      const frameSpeed = STAFF_MOVE_SPEED * frameScale;

      lastFrameAtMs = nowMs;

      if (remainingDistance <= frameSpeed) {
        this.updateState(status, {
          ...options,
          position: { x: targetX, y: targetY },
          direction: options.direction ?? this.getDirectionFromMovement(dx, dy, movementDirection),
          isMoving: false
        });
        this.moveRafId = null;
        onArrive?.();
        return;
      }

      const rawNextX = currentX + (dx / remainingDistance) * frameSpeed;
      const rawNextY = currentY + (dy / remainingDistance) * frameSpeed;
      const safeNextPosition = this.getCollisionSafeStaffPosition(
        currentX,
        currentY,
        rawNextX,
        rawNextY
      );

      this.updateState(status, {
        ...options,
        position: safeNextPosition,
        direction: this.getDirectionFromMovement(dx, dy, movementDirection),
        isMoving: true
      });

      this.moveRafId = window.requestAnimationFrame(step);
    };

    this.moveRafId = window.requestAnimationFrame(step);
  },

  getCollisionSafeStaffPosition(currentX, currentY, nextX, nextY) {
    const nextPosition = { x: nextX, y: nextY };

    if (!this.isStaffPositionBlocked(nextPosition)) {
      return nextPosition;
    }

    const horizontalSlide = { x: nextX, y: currentY };
    const verticalSlide = { x: currentX, y: nextY };

    if (!this.isStaffPositionBlocked(horizontalSlide)) {
      return horizontalSlide;
    }

    if (!this.isStaffPositionBlocked(verticalSlide)) {
      return verticalSlide;
    }

    return { x: currentX, y: currentY };
  },

  isStaffPositionBlocked(position = {}) {
    if (!this.isStaffPositionInsideWalkableArea(position)) {
      return true;
    }

    const footRect = this.getStaffFootCollisionRect(position);
    const collisionRects = [
      ...getStoreObjectCollisionRects(GameState.expansion?.unlockedZoneIds)
    ];

    return collisionRects.some((rect) => {
      return this.doRectsOverlap(footRect, rect);
    });
  },

  isStaffPositionInsideWalkableArea(position = {}) {
    const walkableAreas = getStoreWalkableAreas(GameState.expansion?.unlockedZoneIds);

    if (walkableAreas.length === 0) {
      return true;
    }

    const movementPoint = this.getStaffMovementPoint(position);

    if (isPointInCenterProbeWalkableArea(movementPoint, walkableAreas)) {
      return true;
    }

    return arePointsInWalkableAreas(this.getStaffWalkableProbePoints(position), walkableAreas);
  },

  getStaffMovementPoint(position = {}) {
    return {
      x: (Number(position.x) || 0) + STAFF_CHARACTER_ANCHOR.x,
      y: (Number(position.y) || 0) + STAFF_CHARACTER_ANCHOR.y
    };
  },

  getStaffWalkableProbePoints(position = {}) {
    const movementPoint = this.getStaffMovementPoint(position);
    const halfWidth = Math.max(
      STAFF_FOOT_COLLISION_BOX.width / 2,
      Number(STAFF_WALKABLE_PROBE.halfWidth) || STAFF_FOOT_COLLISION_BOX.width / 2
    );
    const upperOffsetY = Math.max(0, Number(STAFF_WALKABLE_PROBE.upperOffsetY) || 0);

    return [
      movementPoint,
      { x: movementPoint.x - halfWidth, y: movementPoint.y },
      { x: movementPoint.x + halfWidth, y: movementPoint.y },
      { x: movementPoint.x, y: movementPoint.y - upperOffsetY }
    ];
  },

  getStaffFootCollisionRect(position = {}) {
    const x = Number(position.x) || 0;
    const y = Number(position.y) || 0;
    const footCenterX = x + STAFF_CHARACTER_ANCHOR.x;
    const footCenterY = y + STAFF_CHARACTER_ANCHOR.y;

    return {
      x: footCenterX + STAFF_FOOT_COLLISION_BOX.offsetX,
      y: footCenterY + STAFF_FOOT_COLLISION_BOX.offsetY,
      width: STAFF_FOOT_COLLISION_BOX.width,
      height: STAFF_FOOT_COLLISION_BOX.height
    };
  },

  doRectsOverlap(first, second) {
    return (
      first.x < second.x + second.width &&
      first.x + first.width > second.x &&
      first.y < second.y + second.height &&
      first.y + first.height > second.y
    );
  },

  getActiveCounterQueueCustomers() {
    if (typeof CustomerSystem.getRenderableCustomers !== "function") {
      return [];
    }

    return CustomerSystem.getRenderableCustomers().filter((customer) => {
      return (
        customer &&
        customer.currentZone === "counter" &&
        customer.status !== "leaving" &&
        customer.isSatisfied !== true
      );
    });
  },

  hasActiveCounterQueueCustomers() {
    return this.getActiveCounterQueueCustomers().length > 0;
  },

  getCounterQueueAvoidanceRoutePoints() {
    if (!this.hasActiveCounterQueueCustomers()) {
      return [];
    }

    return [STAFF_ROUTE_POINTS.counterQueueBypassAisle];
  },

  getCustomerCollisionRects() {
    const domRects = this.getCustomerDomCollisionRects();

    if (domRects.length > 0) {
      return domRects;
    }

    return this.getCustomerFallbackCollisionRects();
  },

  getCustomerDomCollisionRects() {
    if (typeof document === "undefined") {
      return [];
    }

    const nodes = [
      ...document.querySelectorAll(
        "#store-interaction-layer .customer-npc, #customer-layer .customer-npc"
      )
    ];
    const uniqueNodes = [...new Set(nodes)];

    return uniqueNodes
      .filter((node) => {
        return node instanceof HTMLElement && node.offsetParent !== null;
      })
      .map((node) => {
        const x = Number(node.offsetLeft);
        const y = Number(node.offsetTop);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }

        const isCounterCustomer = node.classList.contains("customer-zone-counter");
        const box = isCounterCustomer
          ? STAFF_COUNTER_CUSTOMER_COLLISION_BOX
          : STAFF_CUSTOMER_COLLISION_BOX;

        return {
          x: x + box.offsetX,
          y: y + box.offsetY,
          width: box.width,
          height: box.height
        };
      })
      .filter(Boolean);
  },

  getCustomerFallbackCollisionRects() {
    return [
      ...this.getCounterCustomerFallbackCollisionRects(),
      ...this.getShelfCustomerFallbackCollisionRects()
    ];
  },

  getCounterCustomerFallbackCollisionRects() {
    const counterCustomers = this.getActiveCounterQueueCustomers();

    return counterCustomers.map((customer, index) => {
      const rawQueueIndex = Number(customer.queueOrder);
      const queueIndex = Number.isFinite(rawQueueIndex)
        ? Math.max(0, Math.min(index, 3))
        : Math.max(0, Math.min(index, 3));
      const x = STAFF_COUNTER_QUEUE_BASE_POSITION.x + STAFF_COUNTER_QUEUE_OFFSET.x * queueIndex;
      const y = STAFF_COUNTER_QUEUE_BASE_POSITION.y + STAFF_COUNTER_QUEUE_OFFSET.y * queueIndex;

      return {
        x: x + STAFF_COUNTER_CUSTOMER_COLLISION_BOX.offsetX,
        y: y + STAFF_COUNTER_CUSTOMER_COLLISION_BOX.offsetY,
        width: STAFF_COUNTER_CUSTOMER_COLLISION_BOX.width,
        height: STAFF_COUNTER_CUSTOMER_COLLISION_BOX.height
      };
    });
  },

  getShelfCustomerFallbackCollisionRects() {
    const renderableCustomers = this.getRenderableObstacleCustomers();

    return renderableCustomers
      .filter((customer) => {
        return customer.currentZone !== "counter";
      })
      .map((customer) => {
        const position = this.getFallbackCustomerWorldPosition(customer);

        if (!position) {
          return null;
        }

        return {
          x: position.x + STAFF_CUSTOMER_COLLISION_BOX.offsetX,
          y: position.y + STAFF_CUSTOMER_COLLISION_BOX.offsetY,
          width: STAFF_CUSTOMER_COLLISION_BOX.width,
          height: STAFF_CUSTOMER_COLLISION_BOX.height
        };
      })
      .filter(Boolean);
  },

  getRenderableObstacleCustomers() {
    if (typeof CustomerSystem.getRenderableCustomers !== "function") {
      return [];
    }

    return CustomerSystem.getRenderableCustomers().filter((customer) => {
      return (
        customer &&
        customer.status !== "leaving" &&
        customer.isSatisfied !== true &&
        customer.hasReportedLeft !== true
      );
    });
  },

  getFallbackCustomerWorldPosition(customer = {}) {
    const targetX = Number(customer.targetX);
    const targetY = Number(customer.targetY);

    if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
      return { x: targetX, y: targetY };
    }

    if (customer.currentZone === "door") {
      return { x: POSITIONS.entry.x, y: POSITIONS.entry.y };
    }

    return null;
  },

  createMovementPath(status, options = {}, targetPosition = POSITIONS.idle) {
    const explicitRoute = Array.isArray(options.routePoints) ? options.routePoints : null;
    const routePoints = explicitRoute ?? this.getDefaultRoutePoints(status, options);
    const rawPath = [
      ...routePoints,
      targetPosition
    ];

    return this.compactMovementPath(rawPath);
  },

  getActiveCleaningAssistPoint() {
    const sanitationState = SanitationSystem.getState?.() ?? GameState.sanitation ?? {};
    const point = sanitationState.activeCleaningPoint;

    if (
      point &&
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y))
    ) {
      return point;
    }

    return getCleaningPointByZoneId(sanitationState.dirtyZoneId);
  },

  getCleaningAssistPosition(point = this.getActiveCleaningAssistPoint()) {
    const cleaningPoint = point ?? getCleaningPointByZoneId();

    return {
      x: Number(cleaningPoint.staffX ?? cleaningPoint.x ?? POSITIONS.cleaningAssist.x),
      y: Number(cleaningPoint.staffY ?? cleaningPoint.y ?? POSITIONS.cleaningAssist.y),
      direction: cleaningPoint.direction ?? "up_left"
    };
  },

  getIdlePosition() {
    const cleaningPoint = this.getActiveCleaningAssistPoint() ?? getCleaningPointByZoneId();
    const baseX = Number(cleaningPoint.x ?? POSITIONS.idle.x);
    const baseY = Number(cleaningPoint.y ?? POSITIONS.idle.y);

    return {
      x: baseX + STAFF_IDLE_CLEANING_TOOL_OFFSET.x,
      y: baseY + STAFF_IDLE_CLEANING_TOOL_OFFSET.y,
      direction: STAFF_IDLE_CLEANING_TOOL_OFFSET.direction
    };
  },

  getDefaultPositionForStatus(status = "idle") {
    if (status === "idle" || status === "returning") {
      return this.getIdlePosition();
    }

    if (status === "warehouse") {
      return this.getWarehouseAssistPosition();
    }

    return POSITIONS[status] ?? this.getIdlePosition();
  },

  getWarehouseAssistPosition() {
    const warehouseZone = PlayerActionSystem.warehouseZone ?? {};
    const fallback = POSITIONS.warehouseAssist;

    // 창고 박스 이미지 자체의 left/top 좌표가 아니라,
    // 플레이어가 창고 박스를 정리할 때 쓰는 같은 상호작용 도착 좌표(standX/standY)를 사용합니다.
    // 이렇게 해야 알바가 박스 이미지와 어긋난 임의 좌표가 아니라 창고 박스 기준 위치에 도착합니다.
    if (
      Number.isFinite(Number(warehouseZone.standX)) &&
      Number.isFinite(Number(warehouseZone.standY))
    ) {
      return this.normalizePoint({
        x: Number(warehouseZone.standX),
        y: Number(warehouseZone.standY),
        direction: "up_left"
      }, fallback);
    }

    if (typeof PlayerActionSystem.getPlayerStandPositionForZone === "function") {
      return this.normalizePoint(
        PlayerActionSystem.getPlayerStandPositionForZone("warehouse-box-zone", warehouseZone),
        fallback
      );
    }

    return this.normalizePoint(fallback, fallback);
  },

  getStaffIdleToWarehouseRoutePoints() {
    // 알바 진열 보충 전용: 청소 대기 위치에서 바로 창고로 꺾지 않고,
    // 입구 방향 통로를 경유해 창고 상호작용 위치로 이동한다.
    // 손님 NPC는 알바 충돌 대상으로 보지 않고, 계산대/진열대 등 매장 오브젝트만 회피한다.
    return [
      STAFF_ROUTE_POINTS.mainAisle,
      STAFF_ROUTE_POINTS.entryAisle,
      this.getDeliveryBoxRoutePoint()
    ];
  },

  getStaffWarehouseToStoreRoutePoints() {
    // 창고에서 매장으로 돌아오는 구간은 입구 방향 통로를 거쳐 진열대로 이동한다.
    // 손님 NPC 충돌은 무시하고 매장 오브젝트 충돌만 유지한다.
    return [
      this.getDeliveryBoxRoutePoint(),
      STAFF_ROUTE_POINTS.entryAisle,
      STAFF_ROUTE_POINTS.mainAisle
    ];
  },

  getStaffWarehouseToShelfRoutePoints(shelf = {}) {
    return [
      ...this.getStaffWarehouseToStoreRoutePoints(),
      ...this.getShelfApproachRoutePoints(shelf)
    ];
  },

  getShelfApproachRoutePoints(shelf = {}) {
    const targetZoneId = shelf.zoneId ?? this.getShelfZoneIdByInstanceId(shelf.instanceId);

    if (targetZoneId === "zone_basic") {
      return [STAFF_ROUTE_POINTS.zone1Aisle];
    }

    if (targetZoneId === "zone_extra_shelf") {
      return [
        STAFF_ROUTE_POINTS.lowerRightAisle,
        STAFF_ROUTE_POINTS.zone2Aisle
      ];
    }

    if (targetZoneId === "zone_cold_food") {
      return [
        STAFF_ROUTE_POINTS.lowerRightAisle,
        STAFF_ROUTE_POINTS.zone3Aisle
      ];
    }

    if (targetZoneId === "zone_premium_store") {
      return [
        STAFF_ROUTE_POINTS.lowerRightAisle,
        STAFF_ROUTE_POINTS.zone3LowerAisle,
        STAFF_ROUTE_POINTS.zone3RightAisle,
        STAFF_ROUTE_POINTS.zone4LowerAisle,
        STAFF_ROUTE_POINTS.zone4ApproachAisle
      ];
    }

    return [STAFF_ROUTE_POINTS.lowerRightAisle];
  },

  getStaffCleaningRoutePoints(targetZoneId = "zone_basic") {
    // 알바가 청소 스팟으로 이동할 때도 계산대/진열대/손님을 가로지르지 않게
    // 보충 동선과 같은 하단 통로를 먼저 탄 뒤 구역별 접근점으로 들어간다.
    const commonSafeRoute = [
      STAFF_ROUTE_POINTS.mainAisle,
      ...this.getCounterQueueAvoidanceRoutePoints(),
      STAFF_ROUTE_POINTS.lowerRightAisle
    ];

    if (targetZoneId === "zone_basic") {
      return [
        ...commonSafeRoute,
        STAFF_ROUTE_POINTS.zone1Aisle
      ];
    }

    if (targetZoneId === "zone_extra_shelf") {
      return [
        ...commonSafeRoute,
        STAFF_ROUTE_POINTS.zone2Aisle
      ];
    }

    if (targetZoneId === "zone_cold_food") {
      return [
        ...commonSafeRoute,
        STAFF_ROUTE_POINTS.zone3Aisle
      ];
    }

    if (targetZoneId === "zone_premium_store") {
      return [
        ...commonSafeRoute,
        STAFF_ROUTE_POINTS.zone3LowerAisle,
        STAFF_ROUTE_POINTS.zone3RightAisle,
        STAFF_ROUTE_POINTS.zone4LowerAisle,
        STAFF_ROUTE_POINTS.zone4ApproachAisle
      ];
    }

    return commonSafeRoute;
  },

  getDeliveryBoxRoutePoint() {
    const deliveryBoxZone = PlayerActionSystem.deliveryBoxZone ?? {};
    const fallback = STAFF_ROUTE_POINTS.deliveryBoxAisle;

    return this.normalizePoint({
      x: Number.isFinite(Number(deliveryBoxZone.standX))
        ? Number(deliveryBoxZone.standX)
        : fallback.x,
      y: Number.isFinite(Number(deliveryBoxZone.standY))
        ? Number(deliveryBoxZone.standY)
        : fallback.y
    }, fallback);
  },

  getCarryingBoxTypeForProduct(productId) {
    if (typeof PlayerActionSystem.getCarryingBoxTypeForProduct === "function") {
      return PlayerActionSystem.getCarryingBoxTypeForProduct(productId);
    }

    return "basic";
  },

  setWarehouseBoxVisualState(state = "closed") {
    if (typeof PlayerActionSystem.setWarehouseBoxState === "function") {
      PlayerActionSystem.setWarehouseBoxState(state === "open" ? "open" : "closed");
    }
  },

  getDefaultRoutePoints(status, options = {}) {
    if (status === "idle" && String(options.reason ?? "").includes("arrive_idle")) {
      return [STAFF_ROUTE_POINTS.entryAisle, STAFF_ROUTE_POINTS.mainAisle];
    }

    if (status === "warehouse") {
      return [STAFF_ROUTE_POINTS.warehouseAisle];
    }

    if (status === "shelf") {
      const targetZoneId = options.targetShelfZoneId ?? this.getShelfZoneIdByInstanceId(options.targetShelfInstanceId);

      return STAFF_ROUTE_POINTS_BY_ZONE_ID[targetZoneId] ?? [STAFF_ROUTE_POINTS.mainAisle];
    }

    if (status === "cleaning") {
      const targetZoneId = options.targetCleaningZoneId ?? this.getActiveCleaningAssistPoint().zoneId;

      return this.getStaffCleaningRoutePoints(targetZoneId);
    }

    if (status === "returning") {
      return [
        STAFF_ROUTE_POINTS.mainAisle,
        ...this.getCounterQueueAvoidanceRoutePoints(),
        STAFF_ROUTE_POINTS.lowerRightAisle
      ];
    }

    return [];
  },

  compactMovementPath(points = []) {
    const compacted = [];
    let previousPoint = this.normalizePoint({ x: this.state.x, y: this.state.y }, this.getDefaultPositionForStatus("idle"));

    points.forEach((point) => {
      const normalizedPoint = this.normalizePoint(point, previousPoint);

      if (this.getPointDistance(previousPoint.x, previousPoint.y, normalizedPoint.x, normalizedPoint.y) < 18) {
        return;
      }

      compacted.push(normalizedPoint);
      previousPoint = normalizedPoint;
    });

    return compacted;
  },

  normalizePoint(point = {}, fallback = POSITIONS.idle) {
    const fallbackX = Math.round(Number(fallback.x) || POSITIONS.idle.x);
    const fallbackY = Math.round(Number(fallback.y) || POSITIONS.idle.y);

    return {
      ...point,
      x: Math.round(Number.isFinite(Number(point.x)) ? Number(point.x) : fallbackX),
      y: Math.round(Number.isFinite(Number(point.y)) ? Number(point.y) : fallbackY)
    };
  },

  getShelfZoneIdByInstanceId(instanceId) {
    if (!instanceId) {
      return null;
    }

    return SHELF_INSTANCES.find((shelf) => shelf.instanceId === instanceId)?.zoneId ?? null;
  },

  cancelStaffMovement() {
    this.moveSequence += 1;

    if (this.moveRafId) {
      window.cancelAnimationFrame(this.moveRafId);
      this.moveRafId = null;
    }
  },

  getPointDistance(firstX, firstY, secondX, secondY) {
    const dx = secondX - firstX;
    const dy = secondY - firstY;

    return Math.sqrt(dx * dx + dy * dy);
  },

  getDirectionFromMovement(dx, dy, fallbackDirection = "down") {
    const threshold = 0.35;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const hasHorizontal = absX > threshold;
    const hasVertical = absY > threshold;
    const isDiagonal = hasHorizontal && hasVertical &&
      Math.min(absX, absY) / Math.max(absX, absY) >= 0.45;

    if (isDiagonal) {
      if (dx < 0 && dy < 0) return "up_left";
      if (dx > 0 && dy < 0) return "up_right";
      if (dx < 0 && dy > 0) return "down_left";
      if (dx > 0 && dy > 0) return "down_right";
    }

    if (hasHorizontal) return dx < 0 ? "left" : "right";
    if (hasVertical) return dy < 0 ? "up" : "down";

    return fallbackDirection || "down";
  },

  getShelfSlots() {
    if (typeof PlayerActionSystem.getShelfSlots === "function") {
      return PlayerActionSystem.getShelfSlots();
    }

    return SHELF_INSTANCES.map((shelf) => ({
      ...shelf,
      productId: this.getDefaultProductIdForShelf(shelf.shelfId),
      currentStock: 0,
      maxStock: 3
    }));
  },

  getUnlockedZoneIds() {
    const savedUnlockedZoneIds = Array.isArray(GameState.expansion?.unlockedZoneIds)
      ? GameState.expansion.unlockedZoneIds
      : [];
    const unlockedZoneIds = new Set(savedUnlockedZoneIds.filter(Boolean));

    // 기본 1구역은 세이브/초기화 순서와 관계없이 항상 알바 이동 가능 구역으로 유지합니다.
    unlockedZoneIds.add("zone_basic");

    return unlockedZoneIds;
  },

  isShelfZoneUnlocked(shelf = {}) {
    const zoneId = shelf.zoneId ?? this.getShelfZoneId(shelf.instanceId);

    if (!zoneId) {
      return true;
    }

    return this.getUnlockedZoneIds().has(zoneId);
  },

  getShelfSlotByInstanceId(instanceId) {
    return this.getShelfSlots().find((shelf) => {
      return shelf.instanceId === instanceId;
    }) ?? null;
  },

  normalizeShelfSlot(shelf = {}) {
    const productId = this.getResolvedProductId(
      shelf.productId ?? this.getDefaultProductIdForShelf(shelf.shelfId)
    );
    const capacity = typeof PlayerActionSystem.getShelfCapacityForSlot === "function"
      ? PlayerActionSystem.getShelfCapacityForSlot({
        ...shelf,
        productId
      })
      : shelf.maxStock;

    return {
      ...shelf,
      productId,
      currentStock: Math.max(0, Math.floor(Number(shelf.currentStock) || 0)),
      maxStock: Math.max(1, Math.floor(Number(capacity || shelf.maxStock) || 1))
    };
  },

  getDefaultProductIdForShelf(shelfId) {
    if (typeof PlayerActionSystem.getDefaultProductIdForShelf === "function") {
      return PlayerActionSystem.getDefaultProductIdForShelf(shelfId);
    }

    return "potato_chips";
  },

  getResolvedProductId(productId) {
    if (typeof PlayerActionSystem.getResolvedProductId === "function") {
      return PlayerActionSystem.getResolvedProductId(productId);
    }

    const id = String(productId ?? "").trim().replace(/-/g, "_");

    return getProductById(id)?.id ?? id;
  },

  getWarehouseStock(productId) {
    const resolvedProductId = this.getResolvedProductId(productId);

    if (!resolvedProductId) {
      return 0;
    }

    if (typeof PlayerActionSystem.getAvailableWarehouseStock === "function") {
      return Math.max(
        0,
        Math.floor(Number(PlayerActionSystem.getAvailableWarehouseStock(resolvedProductId)) || 0)
      );
    }

    return Math.max(
      0,
      Math.floor(Number(InventorySystem.getStockQuantity?.(resolvedProductId)) || 0)
    );
  },

  getRefillableShelfQuantity(shelf = {}, warehouseStock = 0) {
    const currentStock = Math.max(0, Math.floor(Number(shelf.currentStock) || 0));
    const maxStock = Math.max(1, Math.floor(Number(shelf.maxStock) || 1));
    const organizedStock = Math.max(0, Math.floor(Number(warehouseStock) || 0));
    const shelfSpace = Math.max(0, maxStock - currentStock);
    const unplacedStock = Math.max(0, organizedStock - currentStock);

    return Math.min(shelfSpace, unplacedStock);
  },

  getSanitationValue() {
    return this.toSanitationValue(GameState.sanitation?.value, 100);
  },

  toSanitationValue(value, fallback = 100) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return fallback;
    }

    return Math.max(0, Math.min(100, Math.floor(numberValue)));
  },

  getShelfAssistPosition(shelf = {}) {
    const interactionX = Number.isFinite(Number(shelf.interactionX))
      ? Number(shelf.interactionX)
      : Number(shelf.x) || POSITIONS.idle.x;
    const interactionY = Number.isFinite(Number(shelf.interactionY))
      ? Number(shelf.interactionY)
      : Number(shelf.y) || POSITIONS.idle.y;
    const offset = STAFF_STAND_FOOT_OFFSETS_BY_SHELF_INSTANCE_ID[shelf.instanceId] ??
      STAFF_DEFAULT_STAND_FOOT_OFFSET;
    const footX = interactionX + (Number(offset.x) || 0);
    const footY = interactionY + (Number(offset.y) || 0);

    return {
      x: Math.round(footX - STAFF_CHARACTER_ANCHOR.x),
      y: Math.round(footY - STAFF_CHARACTER_ANCHOR.y),
      direction: offset.direction ?? "up"
    };
  },

  requestNoStockGuide(productId) {
    const key = this.getResolvedProductId(productId);
    const nowMs = this.getNowMs();
    const lastProductMessageAt = Number(this.noStockMessageAtByProductId[key]) || 0;

    if (nowMs - lastProductMessageAt < PRODUCT_NO_STOCK_MESSAGE_COOLDOWN_MS) {
      return;
    }

    if (nowMs - this.lastGuideMessageAtMs < GLOBAL_GUIDE_MESSAGE_COOLDOWN_MS) {
      return;
    }

    this.noStockMessageAtByProductId[key] = nowMs;
    this.lastGuideMessageAtMs = nowMs;
    this.emitMessage("창고에 정리된 재고가 없어 보충할 수 없어요.", 2600);
  },

  incrementStaffDailyCount(key) {
    if (!GameState.staff || typeof GameState.staff !== "object") {
      return;
    }

    GameState.staff[key] = Math.max(0, Math.floor(Number(GameState.staff[key]) || 0)) + 1;
  },

  emitMessage(message, duration = 2400) {
    EventBus.emit(STAFF_ASSIST_EVENTS.MESSAGE_REQUESTED, {
      day: GameState.day,
      message,
      duration
    });
  },

  updateState(status, options = {}) {
    const position = options.position ?? this.getDefaultPositionForStatus(status);
    const label = options.label ?? STATUS_LABELS[status] ?? STATUS_LABELS.idle;
    const nowMs = this.getNowMs();
    const hasOption = (key) => Object.prototype.hasOwnProperty.call(options, key);
    const cooldownRemainingMs = Math.max(
      0,
      Math.ceil(this.cooldownUntilMs - nowMs)
    );
    const nextState = {
      status,
      label,
      x: Math.round(Number(position.x) || this.getDefaultPositionForStatus("idle").x),
      y: Math.round(Number(position.y) || this.getDefaultPositionForStatus("idle").y),
      direction: options.direction ?? position.direction ?? this.state.direction ?? "down",
      isMoving: options.isMoving === true,
      isWorking: this.isWorking,
      taskType: options.taskType ?? null,
      targetShelfInstanceId: options.targetShelfInstanceId ?? null,
      productId: options.productId ?? null,
      reason: options.reason ?? "unknown",
      lastTaskType: options.lastTaskType ?? this.state.lastTaskType ?? null,
      checkIntervalMs: this.getCheckIntervalMs(),
      cooldownMs: this.getCooldownMs(),
      cooldownRemainingMs,
      taskDurationMs: Math.max(0, Math.floor(Number(options.taskDurationMs) || 0)),
      carryingBoxType: options.carryingBoxType ?? null,
      cleaningTriggerValue: options.cleaningTriggerValue ?? null,
      attendanceStatus: hasOption("attendanceStatus") ? options.attendanceStatus : this.state.attendanceStatus ?? null,
      attendanceLevel: hasOption("attendanceLevel") ? options.attendanceLevel : this.state.attendanceLevel ?? null,
      attendanceDelayMs: hasOption("attendanceDelayMs")
        ? Math.max(0, Math.floor(Number(options.attendanceDelayMs) || 0))
        : Math.max(0, Math.floor(Number(this.state.attendanceDelayMs) || 0)),
      attendanceReadyAtMs: hasOption("attendanceReadyAtMs") ? options.attendanceReadyAtMs : this.state.attendanceReadyAtMs ?? null,
      attendanceDecidedDay: hasOption("attendanceDecidedDay") ? options.attendanceDecidedDay : this.state.attendanceDecidedDay ?? null,
      attendanceArrived: hasOption("attendanceArrived") ? options.attendanceArrived === true : this.state.attendanceArrived === true,
      updatedAtMs: Math.round(nowMs)
    };

    this.state = nextState;
    GameState.staffAssist = nextState;

    EventBus.emit(STAFF_ASSIST_EVENTS.STATE_CHANGED, {
      day: GameState.day,
      staff: GameState.staff ?? null,
      assistState: this.getStateSnapshot()
    });
  },

  getStateSnapshot() {
    return {
      ...this.state
    };
  },

  scheduleNextCheck(delayMs = this.getCheckIntervalMs()) {
    this.clearCheckTimer();

    if (!this.hasHiredStaff()) {
      return;
    }

    if (this.isLateAttendancePending()) {
      return;
    }

    const safeDelayMs = Math.max(500, Math.floor(Number(delayMs) || 0));

    this.checkTimerId = window.setTimeout(() => {
      this.runCheckCycle();
    }, safeDelayMs);
  },

  clearCheckTimer() {
    if (!this.checkTimerId) {
      return;
    }

    window.clearTimeout(this.checkTimerId);
    this.checkTimerId = null;
  },

  clearLateEntryTimer() {
    if (!this.lateEntryTimerId) {
      return;
    }

    window.clearTimeout(this.lateEntryTimerId);
    this.lateEntryTimerId = null;
  },

  setTaskTimer(callback, delayMs) {
    const timerId = window.setTimeout(() => {
      this.taskTimerIds = this.taskTimerIds.filter((id) => id !== timerId);
      callback();
    }, Math.max(0, Math.floor(Number(delayMs) || 0)));

    this.taskTimerIds.push(timerId);

    return timerId;
  },

  clearTaskTimers() {
    this.taskTimerIds.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    this.taskTimerIds = [];
    this.cancelStaffMovement();
  },

  hasHiredStaff() {
    return Boolean(GameState.staff?.hired);
  },

  canAssistInCurrentPhase() {
    return ACTIVE_PHASES.has(GameState.phase);
  },

  getAssistPower(type) {
    const staff = GameState.staff?.hired;

    if (!staff) {
      return 0;
    }

    const base = Math.max(0, Math.floor(Number(staff.stats?.[type]) || 0));
    const bonus = Math.max(
      0,
      Math.floor(Number(GameState.bm?.staffAbilityUpgrade?.abilities?.[type]) || 0)
    );

    return Math.min(5, base + bonus);
  },

  getAveragePower() {
    return (
      this.getAssistPower("warehouse") +
      this.getAssistPower("shelf") +
      this.getAssistPower("cleaning")
    ) / 3;
  },

  getCheckIntervalMs() {
    return Math.max(6000, Math.round(19000 - this.getAveragePower() * 3000));
  },

  getCooldownMs() {
    return Math.max(3000, Math.round(12000 - this.getAveragePower() * 2000));
  },

  getTaskDurationMs(type, baseDurationMs) {
    const safeBaseDurationMs = Math.max(1000, Math.floor(Number(baseDurationMs) || 1000));
    const reductionRate = Math.min(0.4, this.getAssistPower(type) * 0.08);

    return Math.max(1800, Math.round(safeBaseDurationMs * (1 - reductionRate)));
  },

  getNowMs() {
    return Math.floor(window.performance?.now?.() ?? Date.now());
  }
};
