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
import { SanitationSystem } from "./SanitationSystem.js";
import { SHELF_INSTANCES } from "../data/ShelfPlacementData.js";
import { getProductById } from "../data/ProductData.js";

export const STAFF_ASSIST_EVENTS = Object.freeze({
  STATE_CHANGED: "STAFF_ASSIST_STATE_CHANGED",
  MESSAGE_REQUESTED: "STAFF_ASSIST_MESSAGE_REQUESTED",
  TASK_COMPLETED: "STAFF_ASSIST_TASK_COMPLETED"
});

const STAFF_STATE_CHANGED = "STAFF_STATE_CHANGED";
const BM_STATE_CHANGED = "BM_STATE_CHANGED";

const POSITIONS = Object.freeze({
  idle: Object.freeze({ x: 270, y: 610 }),
  warehouseAssist: Object.freeze({ x: 285, y: 575 }),
  cleaningAssist: Object.freeze({ x: 825, y: 640 })
});

const STATUS_LABELS = Object.freeze({
  idle: "대기 중",
  checking: "매장 상태 확인 중",
  warehouse: "창고 재고 확인 중",
  shelf: "진열 보조 중",
  cleaning: "청소 보조 중",
  returning: "복귀 중"
});

const ACTIVE_PHASES = new Set([
  GAME_PHASE.DAY_START,
  GAME_PHASE.STORE_RUNNING
]);

const BASE_WAREHOUSE_PREP_MS = 4200;
const BASE_SHELF_REFILL_MS = 5600;
const BASE_CLEANING_MS = 7000;
const CHECKING_DELAY_MS = 700;
const RETURNING_SETTLE_DELAY_MS = 420;
const STAFF_MOVE_SPEED = 3.2;
const STAFF_MOVE_FRAME_MS = 16;
const CLEANING_RECOVERY = 25;
const PRODUCT_NO_STOCK_MESSAGE_COOLDOWN_MS = 15000;
const GLOBAL_GUIDE_MESSAGE_COOLDOWN_MS = 5000;

export const StaffAssistSystem = {
  isInitialized: false,
  checkTimerId: null,
  taskTimerIds: [],
  moveRafId: null,
  moveSequence: 0,
  isWorking: false,
  cooldownUntilMs: 0,
  lastGuideMessageAtMs: 0,
  noStockMessageAtByProductId: {},
  state: {
    status: "idle",
    label: STATUS_LABELS.idle,
    x: POSITIONS.idle.x,
    y: POSITIONS.idle.y,
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
    this.updateState("idle", { reason: "init" });
    this.scheduleNextCheck(1000);
  },

  bindEvents() {
    EventBus.on(EVENTS.GAME_INIT, () => {
      this.updateState("idle", { reason: "game_init" });
      this.scheduleNextCheck(1000);
    });

    EventBus.on(EVENTS.DAY_STARTED, () => {
      this.clearTaskTimers();
      this.isWorking = false;
      this.cooldownUntilMs = 0;
      this.updateState("idle", { reason: "day_started" });
      this.scheduleNextCheck(1200);
    });

    EventBus.on(EVENTS.STORE_OPENED, () => {
      this.scheduleNextCheck(900);
    });

    EventBus.on(EVENTS.STORE_CLOSED, () => {
      this.returnToIdle("store_closed");
    });

    EventBus.on(EVENTS.DAY_ENDED, () => {
      this.returnToIdle("day_ended");
    });

    EventBus.on(STAFF_STATE_CHANGED, () => {
      this.updateState("idle", { reason: "staff_state_changed" });
      this.scheduleNextCheck(900);
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
    const sanitationValue = this.getSanitationValue();
    const cleaningPower = this.getAssistPower("cleaning");
    const cleaningTriggerValue = 35 + cleaningPower * 5;

    if (sanitationValue > cleaningTriggerValue) {
      return null;
    }

    return {
      type: "cleaning",
      sanitationValue,
      cleaningTriggerValue,
      durationMs: this.getTaskDurationMs("cleaning", BASE_CLEANING_MS)
    };
  },

  findShelfRefillTask(kind = "empty") {
    const shelves = this.getShelfSlots();

    for (const shelf of shelves) {
      const normalizedShelf = this.normalizeShelfSlot(shelf);

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
    this.moveStaffToState("cleaning", {
      reason: "cleaning_started",
      taskType: "cleaning",
      position: POSITIONS.cleaningAssist,
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

        EventBus.emit(EVENTS.CLEANING_COMPLETED, {
          day: GameState.day,
          source: "staff_assist",
          actorType: "staff",
          previousValue,
          value: nextValue,
          recoveredAmount: Math.max(0, nextValue - previousValue),
          state: SanitationSystem.getState?.() ?? GameState.sanitation
        });

        this.emitMessage("청소 보조가 끝났어요.", 2200);
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
    this.moveStaffToState("warehouse", {
      reason: "shelf_prepare_started",
      taskType: "shelf",
      label: "진열 보충 준비 중",
      position: POSITIONS.warehouseAssist,
      targetShelfInstanceId: task.shelf.instanceId,
      productId: task.productId,
      taskDurationMs: task.prepDurationMs
    }, () => {
      this.setTaskTimer(() => {
        const refreshedTask = this.refreshShelfTask(task);

        if (!refreshedTask || refreshedTask.restockAmount <= 0) {
          this.requestNoStockGuide(task.productId);
          this.completeTask({
            type: "shelf",
            success: false,
            reason: "no_warehouse_stock",
            productId: task.productId
          });
          return;
        }

        this.moveStaffToState("shelf", {
          reason: "shelf_refill_started",
          taskType: "shelf",
          position: this.getShelfAssistPosition(refreshedTask.shelf),
          targetShelfInstanceId: refreshedTask.shelf.instanceId,
          productId: refreshedTask.productId,
          taskDurationMs: refreshedTask.refillDurationMs
        }, () => {
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

    PlayerActionSystem.shelfStocks[normalizedShelf.instanceId] = {
      productId: normalizedShelf.productId,
      currentStock: nextStock
    };

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
      position: POSITIONS.idle
    }, () => {
      this.setTaskTimer(() => {
        this.isWorking = false;
        this.cooldownUntilMs = this.getNowMs() + this.getCooldownMs();
        this.updateState("idle", {
          reason: "task_cooldown",
          lastTaskType: result.type ?? null,
          position: POSITIONS.idle
        });
        this.scheduleNextCheck(this.getCooldownMs());
      }, RETURNING_SETTLE_DELAY_MS);
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
    const targetPosition = options.position ?? POSITIONS[status] ?? POSITIONS.idle;
    const targetX = Math.round(Number(targetPosition.x) || POSITIONS.idle.x);
    const targetY = Math.round(Number(targetPosition.y) || POSITIONS.idle.y);
    const startX = Math.round(Number(this.state.x) || POSITIONS.idle.x);
    const startY = Math.round(Number(this.state.y) || POSITIONS.idle.y);
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
    const direction = this.getDirectionFromMovement(targetX - startX, targetY - startY, this.state.direction);

    this.updateState(status, {
      ...options,
      position: { x: startX, y: startY },
      direction,
      isMoving: true
    });

    let lastFrameAtMs = this.getNowMs();

    const step = () => {
      if (sequence !== this.moveSequence) {
        return;
      }

      const nowMs = this.getNowMs();
      const elapsedFrameMs = Math.max(STAFF_MOVE_FRAME_MS, nowMs - lastFrameAtMs);
      const frameScale = elapsedFrameMs / STAFF_MOVE_FRAME_MS;
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
          direction: this.getDirectionFromMovement(dx, dy, direction),
          isMoving: false
        });
        this.moveRafId = null;
        onArrive?.();
        return;
      }

      const nextX = currentX + (dx / remainingDistance) * frameSpeed;
      const nextY = currentY + (dy / remainingDistance) * frameSpeed;

      this.updateState(status, {
        ...options,
        position: { x: nextX, y: nextY },
        direction: this.getDirectionFromMovement(dx, dy, direction),
        isMoving: true
      });

      this.moveRafId = window.requestAnimationFrame(step);
    };

    this.moveRafId = window.requestAnimationFrame(step);
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
    return {
      x: Math.round(Number(shelf.standX) + 45),
      y: Math.round(Number(shelf.standY) + 20)
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
    this.emitMessage("진열하려고 했는데 창고 재고가 없어요.", 2600);
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
    const position = options.position ?? POSITIONS[status] ?? POSITIONS.idle;
    const label = options.label ?? STATUS_LABELS[status] ?? STATUS_LABELS.idle;
    const nowMs = this.getNowMs();
    const cooldownRemainingMs = Math.max(
      0,
      Math.ceil(this.cooldownUntilMs - nowMs)
    );
    const nextState = {
      status,
      label,
      x: Math.round(Number(position.x) || POSITIONS.idle.x),
      y: Math.round(Number(position.y) || POSITIONS.idle.y),
      direction: options.direction ?? this.state.direction ?? "down",
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
      cleaningTriggerValue: options.cleaningTriggerValue ?? null,
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
