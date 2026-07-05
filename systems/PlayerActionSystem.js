/*
  PlayerActionSystem.js

  담당:
  - 2번 담당자

  역할:
  - 화면 요소 클릭/터치 기반 플레이어 상호작용을 EventBus 이벤트로 변환
  - 계산대, 진열대, 택배 박스 등 직접 조작 기능의 공통 진입점

  규칙:
  - 다른 시스템 직접 호출 금지
  - GameState 날짜는 Day 번호만 사용
  - new Date(), Date.now() 사용 금지
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_DISPLAY_CATEGORIES,
  getProductById
} from "../data/ProductData.js";
import { CustomerSystem } from "./CustomerSystem.js";
import { InventorySystem } from "./InventorySystem.js";

const STAFF_EVENTS = {
  AUTO_CHECKOUT_REQUESTED: "STAFF_AUTO_CHECKOUT_REQUESTED",
  AUTO_CHECKOUT_COMPLETED: "STAFF_AUTO_CHECKOUT_COMPLETED"
};

const PLAYER_DIALOGUE_REQUESTED = "PLAYER_DIALOGUE_REQUESTED";
const ORDER_DELIVERY_PICKUP_REQUESTED = "ORDER_DELIVERY_PICKUP_REQUESTED";
const SANITATION_CLEANING_REQUESTED = "SANITATION_CLEANING_REQUESTED";
const SANITATION_CLEANING_STARTED = "SANITATION_CLEANING_STARTED";
const SANITATION_CLEANING_COMPLETED = "SANITATION_CLEANING_COMPLETED";
const SANITATION_CLEANING_FAILED = "SANITATION_CLEANING_FAILED";
const NUISANCE_CHECKOUT_DELAY_MS = 5000;
const VALID_CARRYING_BOX_TYPES = new Set([
  "arrive",
  "basic",
  "drink",
  "ramen",
  "lunch",
  "snack",
  "refrigerated"
]);

export const PlayerActionSystem = {
  isInitialized: false,
  checkoutSequence: 0,
  isCheckoutInputLocked: false,
  isPlayerBusy: false,
  pendingNuisanceCheckoutCustomerIds: new Set(),
  actionMessageTimerId: null,
  cleaningCountdownTimerId: null,

  shelf: {
    x: 540,
    y: 680,
    productId: "potato_chips",
    currentStock: 0,
    maxStock: 3
  },

  warehouse: {
    stock: 0
  },

  interactionDistance: 120,
  restockDuration: 5000,
  
  restockTimerId: null,
  restockRemainingSeconds: 0,
  restockPhase: null,

  autoMoveTimerId: null,
  autoMoveSpeed: 4,

  warehouseZone: {
    x: 300,
    y: 470,
  },

  deliveryBoxZone: {
    x: 560,
    y: 560,
  },

  cleaningZone: {
    x: 870,
    y: 650,
  },

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.initializeWarehouseBoxState();
    this.bindCounterCheckoutAction();
    this.bindPointerActions();
    this.bindKeyboardActions();
    this.bindStaffAutoCheckoutEvents();
    this.bindDeliveryBoxEvents();
    this.bindSanitationEvents();
  },

  initializeWarehouseBoxState() {
    GameState.warehouseBoxPosition = {
      ...this.warehouseZone
    };

    if (!GameState.warehouseBoxState) {
      GameState.warehouseBoxState = "closed";
    }
  },

  bindStaffAutoCheckoutEvents() {
    EventBus.on(STAFF_EVENTS.AUTO_CHECKOUT_REQUESTED, (data = {}) => {
      this.handleStaffAutoCheckoutRequest(data);
    });
  },

  bindDeliveryBoxEvents() {
    EventBus.on(ORDER_DELIVERY_PICKUP_REQUESTED, (data = {}) => {
      this.handleDeliveryBoxPickupRequested(data);
    });
  },

  bindSanitationEvents() {
    EventBus.on(SANITATION_CLEANING_STARTED, (data = {}) => {
      this.startCleaningBusyState(data);
    });

    EventBus.on(SANITATION_CLEANING_COMPLETED, () => {
      this.finishCleaningBusyState("청소 완료!");
    });

    EventBus.on(SANITATION_CLEANING_FAILED, (data = {}) => {
      this.finishCleaningBusyState(data.message ?? "지금은 청소할 수 없습니다.");
    });
  },

  bindCounterCheckoutAction() {
    const counterNode = document.getElementById("counter-zone");

    if (!counterNode) return;

    counterNode.dataset.playerAction = "checkout";

    if (!counterNode.hasAttribute("role")) {
      counterNode.setAttribute("role", "button");
    }

    if (!counterNode.hasAttribute("tabindex")) {
      counterNode.setAttribute("tabindex", "0");
    }
  },

  bindPointerActions() {
    document.addEventListener("click", (event) => {
      this.handlePointerAction(event);
    });

    document.addEventListener("touchend", (event) => {
      this.handlePointerAction(event);
    }, { passive: true });
  },

  bindKeyboardActions() {
    window.addEventListener("keydown", (event) => {
      this.handleKeyboardAction(event);
    }, true);
  },

  handleKeyboardAction(event) {
  if (this.isPlayerBusy) {
    const blockedKeys = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD"
    ];

    if (blockedKeys.includes(event.code)) {
      event.preventDefault();
      event.stopPropagation();
      this.showActionMessage(
        `작업 중입니다... ${this.restockRemainingSeconds}초`
      );
      return;
    }
  }

  if (!this.isInteractionKey(event)) return;

  event.preventDefault();
  event.stopPropagation();
  this.handlePrimaryInteractionAction();
},

  isInteractionKey(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return false;
    }

    const target = event.target;
    const targetTagName = target?.tagName?.toLowerCase?.() ?? "";
    const isTypingTarget =
      target?.isContentEditable ||
      targetTagName === "input" ||
      targetTagName === "textarea" ||
      targetTagName === "select";

    if (isTypingTarget) {
      return false;
    }

    return (
      event.code === "Space" ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.keyCode === 32
    );
  },

  handlePrimaryInteractionAction() {
    if (this.isPlayerBusy) {
      this.showActionMessage("지금은 다른 행동을 할 수 없습니다.");
      return;
    }

    const target = this.getPrimaryInteractionTarget();

    if (!target) {
      this.showActionMessage("상호작용 가능한 대상에 더 가까이 가야 합니다.");
      return;
    }

    if (target.type === "shelf") {
      this.handleShelfRestockAction();
      return;
    }

    if (target.type === "cleaning") {
      this.handleCleaningAction({
        source: "player_action_system_keyboard",
        requireNear: true
      });
      return;
    }

    if (target.type === "counter") {
      if (!this.tryLockCheckoutInput()) {
        return;
      }

      EventBus.emit(EVENTS.PLAYER_ACTION_RECORDED, {
        day: GameState.day,
        actionType: "checkout",
        orderId: null,
        productId: null,
        source: "player_action_system_keyboard"
      });

      this.handleCheckoutAction();
    }
  },

  handleShelfRestockAction() {
    if (this.isPlayerBusy) {
      this.showActionMessage("지금은 다른 행동을 할 수 없습니다.");
      return;
    } 

    if (!GameState.player) return;

    if (!this.isNearShelf()) {
      this.showActionMessage("진열대에 더 가까이 가야 합니다.");
      return;
    }

    if (this.shelf.currentStock > 0) {
      this.showActionMessage(
        `아직 상품이 남아 있습니다. (${this.shelf.currentStock}/${this.shelf.maxStock})`
      );
      return;
    }

    const availableWarehouseStock = this.getAvailableWarehouseStock(this.shelf.productId);

    if (availableWarehouseStock <= 0) {
      this.showActionMessage("창고에 입고된 재고가 없습니다. 먼저 발주 물류를 정리해주세요.");
      return;
    }

    this.startShelfRestock();
  },

  isNearShelf() {
    const distance = this.getDistanceToZone("shelf-zone", this.shelf);

    return distance !== null && distance <= this.interactionDistance;
  },

  isNearCounter() {
    const distance = this.getDistanceToZone("counter-zone", null);

    return distance !== null && distance <= this.interactionDistance;
  },

  isNearCleaningZone() {
    const distance = this.getDistanceToZone("cleaning-zone", this.cleaningZone);

    return distance !== null && distance <= this.interactionDistance;
  },

  getPrimaryInteractionTarget() {
    const targets = [
      {
        type: "shelf",
        distance: this.getDistanceToZone("shelf-zone", this.shelf)
      },
      {
        type: "cleaning",
        distance: this.getDistanceToZone("cleaning-zone", this.cleaningZone)
      },
      {
        type: "counter",
        distance: this.getDistanceToZone("counter-zone", null)
      }
    ]
      .filter((target) => {
        return (
          target.distance !== null &&
          target.distance <= this.interactionDistance
        );
      })
      .sort((first, second) => first.distance - second.distance);

    return targets[0] ?? null;
  },

  getDistanceToZone(zoneId, fallback = null) {
    if (!GameState.player) {
      return null;
    }

    const playerCenter = this.getPlayerCenter();
    const zoneCenter = this.getZoneCenter(zoneId, fallback);

    if (!zoneCenter) {
      return null;
    }

    const dx = playerCenter.x - zoneCenter.x;
    const dy = playerCenter.y - zoneCenter.y;

    return Math.sqrt(dx * dx + dy * dy);
  },

  getPlayerCenter() {
    const player = GameState.player ?? { x: 0, y: 0 };
    const playerNode = document.getElementById("player-zone");
    const playerWidth = Number(playerNode?.offsetWidth) || 42;
    const playerHeight = Number(playerNode?.offsetHeight) || 58;

    return {
      x: (Number(player.x) || 0) + playerWidth / 2,
      y: (Number(player.y) || 0) + playerHeight / 2
    };
  },

  getZoneCenter(zoneId, fallback = null) {
    const zoneNode = document.getElementById(zoneId);

    if (zoneNode) {
      /*
        월드맵 카메라가 translate/scale 되는 구조라 getBoundingClientRect()는
        화면 좌표를 반환한다. 플레이어 좌표는 월드맵 내부 좌표이므로
        같은 좌표계인 offsetLeft/offsetTop 기준으로 비교해야 한다.
      */
      return {
        x: (Number(zoneNode.offsetLeft) || 0) + (Number(zoneNode.offsetWidth) || 0) / 2,
        y: (Number(zoneNode.offsetTop) || 0) + (Number(zoneNode.offsetHeight) || 0) / 2
      };
    }

    return fallback;
  },

  getPlayerStandPositionForZone(zoneId, fallbackPosition) {
    const zoneNode = document.getElementById(zoneId);

    if (!zoneNode) {
      return fallbackPosition;
    }

    const zoneCenter = this.getZoneCenter(zoneId, null);

    if (!zoneCenter) {
      return fallbackPosition;
    }

    const playerNode = document.getElementById("player-zone");
    const playerWidth = Number(playerNode?.offsetWidth) || 74;
    const playerHeight = Number(playerNode?.offsetHeight) || 130;

    return {
      x: zoneCenter.x - playerWidth / 2,
      y: zoneCenter.y - playerHeight / 2
    };
  },

  setCarryingBoxType(boxType) {
    if (!GameState.player) {
      return;
    }

    const nextBoxType = VALID_CARRYING_BOX_TYPES.has(boxType) ? boxType : null;

    if (GameState.player.carryingBoxType === nextBoxType) {
      return;
    }

    GameState.player.carryingBoxType = nextBoxType;
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  setWarehouseBoxState(state) {
    const nextState = state === "open" ? "open" : "closed";

    if (GameState.warehouseBoxState === nextState) {
      return;
    }

    GameState.warehouseBoxState = nextState;
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  setDeliveryBoxState(state) {
    const nextState = state === "carrying" ? "carrying" : null;

    if (GameState.deliveryBoxState === nextState) {
      return;
    }

    GameState.deliveryBoxState = nextState;
    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  handleDeliveryBoxPickupRequested(data = {}) {
    if (this.isPlayerBusy) {
      this.showActionMessage("지금은 다른 행동을 할 수 없습니다.");
      return;
    }

    const deliveredItems = Array.isArray(data.items)
      ? data.items.filter((item) => Number(item.quantity) > 0 && !item.isSorted)
      : [];

    if (!GameState.player || !data.orderId || deliveredItems.length === 0 || data.isCompleted) {
      return;
    }

    this.isPlayerBusy = true;
    this.setCarryingBoxType(null);
    this.setDeliveryBoxState(null);
    this.showActionMessage("도착한 물류 박스로 이동 중입니다.");

    this.movePlayerToDeliveryBox(() => {
      this.setDeliveryBoxState("carrying");
      this.setCarryingBoxType("arrive");
      this.showActionMessage("물류 박스를 창고로 옮기는 중입니다.");

      this.movePlayerToWarehouse(() => {
        this.startTimedRestockPhase({
          phase: "delivery",
          message: "물류 정리 중",
          onComplete: () => {
            EventBus.emit(EVENTS.STOCK_ORGANIZED, {
              day: data.day ?? GameState.day,
              orderId: data.orderId,
              items: deliveredItems.map((item) => ({ ...item })),
              totalCost: Number(data.totalCost) || 0,
              source: "delivery_box_sorted",
              message: "물류 정리가 완료되었습니다. 입고 상품이 재고에 반영되었습니다."
            });

            this.setCarryingBoxType(null);
            this.setDeliveryBoxState(null);
            this.setWarehouseBoxState("closed");
            this.isPlayerBusy = false;
            this.restockPhase = null;
            this.showActionMessage("입고 정리가 완료되었습니다.");
          }
        });
      });
    });
  },

  getCarryingBoxTypeForProduct(productId) {
    const product = this.getProductForBoxClassification(productId);
    const productText = [
      product?.id,
      product?.name,
      product?.finalName,
      product?.category,
      product?.displayCategory,
      ...(product?.customerRequestIds ?? []),
      productId
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      product?.category === PRODUCT_CATEGORIES.DRINK ||
      /drink|water|cola|milk|coffee|juice|americano|banana/.test(productText)
    ) {
      return "drink";
    }

    if (
      /ice|cream|pudding|macaron|tiramisu|frozen|dessert|refrigerated|cold/.test(productText)
    ) {
      return "refrigerated";
    }

    if (
      product?.category === PRODUCT_CATEGORIES.READY_MEAL ||
      product?.displayCategory === PRODUCT_DISPLAY_CATEGORIES.FRESH_SHELF ||
      /lunch|sandwich|salad|kimbap|rice|cutlet|dosirak/.test(productText)
    ) {
      return "lunch";
    }

    if (
      product?.category === PRODUCT_CATEGORIES.INSTANT_FOOD ||
      /ramen|udon|noodle/.test(productText)
    ) {
      return "ramen";
    }

    if (
      product?.category === PRODUCT_CATEGORIES.SNACK ||
      /snack|chips|cookie|chocolate|bar/.test(productText)
    ) {
      return "snack";
    }

    return "basic";
  },

  getProductForBoxClassification(productId) {
    const id = String(productId ?? "").trim();
    const normalizedId = id.replace(/-/g, "_");

    return getProductById(id) ?? getProductById(normalizedId) ?? null;
  },

  getResolvedProductId(productId = this.shelf.productId) {
    const product = this.getProductForBoxClassification(productId);

    if (product?.id) {
      return product.id;
    }

    return String(productId ?? "").trim().replace(/-/g, "_");
  },

  getAvailableWarehouseStock(productId = this.shelf.productId) {
    const resolvedProductId = this.getResolvedProductId(productId);

    if (!resolvedProductId) {
      return 0;
    }

    return Math.max(0, Math.floor(Number(
      InventorySystem.getStockQuantity?.(resolvedProductId)
    ) || 0));
  },

  startShelfRestock() {
  this.isPlayerBusy = true;
  this.setCarryingBoxType(null);

  this.showActionMessage("창고로 이동 중입니다.");

  this.movePlayerToWarehouse(() => {
    this.startTimedRestockPhase({
      phase: "warehouse",
      message: "창고에서 상품을 꺼내는 중입니다",
      onComplete: () => {
        this.setCarryingBoxType(this.getCarryingBoxTypeForProduct(this.shelf.productId));
        this.showActionMessage("진열대로 이동 중입니다.");

        this.movePlayerToShelf(() => {
          this.startTimedRestockPhase({
            phase: "shelf",
            message: "진열대에 상품을 채우는 중입니다",
            onComplete: () => {
              this.completeShelfRestock();
            }
          });
        });
      }
    });
  });
},

movePlayerToPosition(targetPosition, onComplete) {
  if (!GameState.player) return;

  const targetX = Number(targetPosition?.x);
  const targetY = Number(targetPosition?.y);

  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    onComplete?.();
    return;
  }

  if (this.autoMoveTimerId) {
    clearInterval(this.autoMoveTimerId);
    this.autoMoveTimerId = null;
  }

  this.autoMoveTimerId = setInterval(() => {
    const dx = targetX - GameState.player.x;
    const dy = targetY - GameState.player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= this.autoMoveSpeed) {
      GameState.player.x = targetX;
      GameState.player.y = targetY;

      clearInterval(this.autoMoveTimerId);
      this.autoMoveTimerId = null;

      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
      onComplete?.();
      return;
    }

    GameState.player.direction = this.getDirectionFromMovement(dx, dy, GameState.player.direction);
    GameState.player.x += (dx / distance) * this.autoMoveSpeed;
    GameState.player.y += (dy / distance) * this.autoMoveSpeed;

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  }, 16);
},

getDirectionFromMovement(dx, dy, fallbackDirection = "down") {
  const threshold = 0.35;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const hasHorizontal = absX > threshold;
  const hasVertical = absY > threshold;
  const isDiagonal = hasHorizontal && hasVertical && Math.min(absX, absY) / Math.max(absX, absY) >= 0.45;

  if (isDiagonal) {
    if (dx < 0 && dy < 0) return "upLeft";
    if (dx > 0 && dy < 0) return "upRight";
    if (dx < 0 && dy > 0) return "downLeft";
    if (dx > 0 && dy > 0) return "downRight";
  }

  if (hasHorizontal) return dx < 0 ? "left" : "right";
  if (hasVertical) return dy < 0 ? "up" : "down";

  return fallbackDirection || "down";
},

movePlayerToWarehouse(onComplete) {
  this.movePlayerToPosition(
    this.getPlayerStandPositionForZone("warehouse-box-zone", this.warehouseZone),
    onComplete
  );
},

movePlayerToShelf(onComplete) {
  this.movePlayerToPosition(this.shelf, onComplete);
},

movePlayerToDeliveryBox(onComplete) {
  this.movePlayerToPosition(
    this.getPlayerStandPositionForZone("delivery-box-zone", this.deliveryBoxZone),
    onComplete
  );
},

movePlayerToCleaningZone(onComplete) {
  this.movePlayerToPosition(
    this.getPlayerStandPositionForZone("cleaning-zone", this.cleaningZone),
    onComplete
  );
},

startTimedRestockPhase({ phase, message, onComplete }) {
  this.restockPhase = phase;
  this.restockRemainingSeconds = Math.ceil(this.restockDuration / 1000);
  const usesWarehouseBox = phase === "warehouse" || phase === "delivery";

  if (usesWarehouseBox) {
    this.setWarehouseBoxState("open");
  }

  this.showActionMessage(`${message}... ${this.restockRemainingSeconds}초`);

  this.restockTimerId = setInterval(() => {
    this.restockRemainingSeconds -= 1;

    if (this.restockRemainingSeconds > 0) {
      this.showActionMessage(`${message}... ${this.restockRemainingSeconds}초`);
    }
  }, 1000);

  setTimeout(() => {
    if (this.restockTimerId) {
      clearInterval(this.restockTimerId);
      this.restockTimerId = null;
    }

    this.restockRemainingSeconds = 0;

    if (usesWarehouseBox) {
      this.setWarehouseBoxState("closed");
    }

    onComplete?.();
  }, this.restockDuration);
},

completeShelfRestock() {
  const needStock = this.shelf.maxStock - this.shelf.currentStock;
  const availableWarehouseStock = this.getAvailableWarehouseStock(this.shelf.productId);
  const restockAmount = Math.min(needStock, availableWarehouseStock);

  if (restockAmount <= 0) {
    this.isPlayerBusy = false;
    this.restockPhase = null;
    this.setCarryingBoxType(null);
    this.setWarehouseBoxState("closed");
    this.showActionMessage("창고에 입고된 재고가 없어 보충할 수 없습니다.");
    return;
  }

  this.shelf.currentStock += restockAmount;
  this.warehouse.stock = availableWarehouseStock;

  EventBus.emit(EVENTS.RESTOCK_COMPLETED, {
    day: GameState.day,
    productId: this.getResolvedProductId(this.shelf.productId),
    quantity: restockAmount,
    source: "player_shelf_restock"
  });

  this.isPlayerBusy = false;
  this.restockPhase = null;
  this.setCarryingBoxType(null);
  this.setWarehouseBoxState("closed");

  this.showActionMessage(
    `진열대 보충 완료! 상품 ${restockAmount}개를 채웠습니다. 진열대: ${this.shelf.currentStock}/${this.shelf.maxStock}, 창고 재고: ${availableWarehouseStock}개`
  );

  console.log("[PlayerActionSystem] 진열대 보충 완료:", {
    shelfStock: this.shelf.currentStock,
    warehouseStock: availableWarehouseStock
  });
},

  handleCleaningAction(options = {}) {
    if (this.isPlayerBusy) {
      this.showActionMessage("지금은 다른 행동을 할 수 없습니다.");
      return;
    }

    if (options.requireNear === true && !this.isNearCleaningZone()) {
      this.showActionMessage("청소 도구가 있는 곳에 더 가까이 가야 합니다.");
      return;
    }

    EventBus.emit(EVENTS.PLAYER_ACTION_RECORDED, {
      day: GameState.day,
      actionType: "cleaning",
      orderId: null,
      productId: null,
      source: options.source ?? "player_action_system"
    });

    EventBus.emit(SANITATION_CLEANING_REQUESTED, {
      day: GameState.day,
      actorType: "player",
      source: options.source ?? "player_action_system"
    });
  },

  startCleaningBusyState(data = {}) {
    const durationMs = Math.max(1000, Number(data.durationMs) || 5000);

    this.clearCleaningCountdownTimer();
    this.isPlayerBusy = true;
    this.restockPhase = "cleaning";
    this.restockRemainingSeconds = Math.ceil(durationMs / 1000);
    this.showActionMessage(`청소 중입니다... ${this.restockRemainingSeconds}초`);

    this.cleaningCountdownTimerId = setInterval(() => {
      this.restockRemainingSeconds -= 1;

      if (this.restockRemainingSeconds > 0) {
        this.showActionMessage(`청소 중입니다... ${this.restockRemainingSeconds}초`);
      }
    }, 1000);
  },

  finishCleaningBusyState(message = "청소 완료!") {
    this.clearCleaningCountdownTimer();

    if (this.restockPhase === "cleaning") {
      this.isPlayerBusy = false;
      this.restockPhase = null;
      this.restockRemainingSeconds = 0;
    }

    this.showActionMessage(message);
  },

  clearCleaningCountdownTimer() {
    if (!this.cleaningCountdownTimerId) return;

    clearInterval(this.cleaningCountdownTimerId);
    this.cleaningCountdownTimerId = null;
  },

  showActionMessage(message) {
    const normalizedMessage = String(message ?? "").trim();

    if (!normalizedMessage) {
      return;
    }

    EventBus.emit(PLAYER_DIALOGUE_REQUESTED, {
      message: normalizedMessage,
      duration: 2600
    });
  },

  handlePointerAction(event) {
    const actionNode = event.target.closest?.("[data-player-action]");

    if (!actionNode) return;

    const actionType = actionNode.dataset.playerAction;

    if (!actionType) return;

    if (this.isPlayerBusy) {
      this.showActionMessage("지금은 다른 행동을 할 수 없습니다.");
      return;
    } 

    if (actionType === "cleaning") {
      this.handleCleaningAction({ source: "player_action_system_pointer" });
      return;
    }

    if (this.isCheckoutAction(actionType) && !this.tryLockCheckoutInput()) {
      return;
    }

    EventBus.emit(EVENTS.PLAYER_ACTION_RECORDED, {
      day: GameState.day,
      actionType,
      orderId: actionNode.dataset.orderId ?? null,
      productId: actionNode.dataset.productId ?? null,
      source: "player_action_system"
    });

    if (this.isCheckoutAction(actionType)) {
      this.handleCheckoutAction();
    }
  },

  isCheckoutAction(actionType) {
    return actionType === "checkout" || actionType === "checkout_counter";
  },

  tryLockCheckoutInput() {
    if (this.isCheckoutInputLocked) {
      return false;
    }

    this.isCheckoutInputLocked = true;

    setTimeout(() => {
      this.isCheckoutInputLocked = false;
    }, 800);

    return true;
  },

  handleStaffAutoCheckoutRequest(data = {}) {
    if (
      GameState.phase !== GAME_PHASE.STORE_RUNNING ||
      data.day !== GameState.day
    ) {
      this.emitStaffAutoCheckoutResult(false, data, "invalid_phase_or_day");
      return;
    }

    const staff = data.staff ?? GameState.staff?.hired ?? null;

    if (!staff) {
      this.emitStaffAutoCheckoutResult(false, data, "no_staff");
      return;
    }

    const checkoutPayload = this.performCheckout({
      source: "staff_auto_checkout",
      actorType: "staff",
      actorId: staff.id,
      actorName: staff.name,
      checkoutIdPrefix: "staff-checkout",
      onlyWaitingCustomer: true,
      suppressNoCustomerMessage: true,
      successMessage: (payload) => {
        return `${staff.name} 알바가 ${payload.productName} 계산을 도왔습니다.`;
      }
    });

    if (!checkoutPayload) {
      this.emitStaffAutoCheckoutResult(false, data, "no_waiting_customer");
    }
  },

  performCheckout(options = {}) {
    const checkoutPayload = this.createCheckoutPayload(options);

    if (!checkoutPayload) {
      return null;
    }

    if (this.shouldDelayCheckout(checkoutPayload, options)) {
      this.scheduleDelayedCheckout(checkoutPayload, options);
      return checkoutPayload;
    }

    this.completeCheckout(checkoutPayload, options);

    return checkoutPayload;
  },

  shouldDelayCheckout(checkoutPayload = {}, options = {}) {
    if (options.skipNuisanceDelay === true) {
      return false;
    }

    return (
      checkoutPayload.customerTypeId === "difficult" ||
      checkoutPayload.isNuisance === true ||
      Boolean(checkoutPayload.nuisanceProfileId) ||
      Number(checkoutPayload.nuisanceCheckoutDelayMs) > 0
    );
  },

  scheduleDelayedCheckout(checkoutPayload = {}, options = {}) {
    const customerId = checkoutPayload.customerId;

    if (!customerId || this.pendingNuisanceCheckoutCustomerIds.has(customerId)) {
      return;
    }

    this.pendingNuisanceCheckoutCustomerIds.add(customerId);

    if (options.actorType !== "staff") {
      this.isPlayerBusy = true;
    }

    const delayMs = Math.max(
      0,
      Number(checkoutPayload.nuisanceCheckoutDelayMs) || NUISANCE_CHECKOUT_DELAY_MS
    );
    const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));

    this.showActionMessage(`진상 손님 응대 중입니다... ${delaySeconds}초`);

    setTimeout(() => {
      this.pendingNuisanceCheckoutCustomerIds.delete(customerId);

      if (options.actorType !== "staff") {
        this.isPlayerBusy = false;
      }

      this.completeCheckout(checkoutPayload, options);
    }, delayMs);
  },

  completeCheckout(checkoutPayload = {}, options = {}) {
    EventBus.emit(EVENTS.CHECKOUT_COMPLETED, checkoutPayload);

    if (typeof options.successMessage === "function") {
      this.showActionMessage(options.successMessage(checkoutPayload));
    }

    if (options.actorType === "staff") {
      this.emitStaffAutoCheckoutResult(true, options, null, checkoutPayload);
    }
  },

  emitStaffAutoCheckoutResult(success, request = {}, reason = null, checkoutPayload = null) {
    EventBus.emit(STAFF_EVENTS.AUTO_CHECKOUT_COMPLETED, {
      day: GameState.day,
      success,
      reason,
      staffId: request.actorId ?? request.staff?.id ?? null,
      staffName: request.actorName ?? request.staff?.name ?? null,
      checkoutId: checkoutPayload?.checkoutId ?? null,
      customerId: checkoutPayload?.customerId ?? null,
      productId: checkoutPayload?.productId ?? null,
      productName: checkoutPayload?.productName ?? null,
      amount: checkoutPayload?.amount ?? 0
    });
  },

  handleCheckoutAction() {
    this.performCheckout({
      source: "player_action_system",
      actorType: "player",
      checkoutIdPrefix: "checkout",
      successMessage: (checkoutPayload) => {
        return `계산해드릴게요. ${checkoutPayload.productName} 계산 완료 (+${checkoutPayload.amount.toLocaleString("ko-KR")}원)`;
      }
    });
  },

  createCheckoutPayload(options = {}) {
    const customer = options.onlyWaitingCustomer
      ? this.getWaitingCheckoutCustomerPayload()
      : CustomerSystem.getCheckoutCustomerPayload?.();

    if (!customer) {
      if (options.suppressNoCustomerMessage) {
        return null;
      }

      this.showActionMessage("계산 가능한 손님이 없습니다.");
      console.warn("[PlayerActionSystem] 계산 가능한 손님이 없습니다.");
      return null;
    }

    const wantedProductId = customer.wantedProductId;
    const carriedProductId = customer.carriedProductId ?? null;
    const quantity = 1;

    if (!wantedProductId) {
      this.showActionMessage("손님의 요청 상품 정보가 없습니다.");
      console.warn("[PlayerActionSystem] 손님의 요청 상품 정보가 없습니다.", customer);
      return null;
    }

    const availableProduct = carriedProductId
      ? (
          InventorySystem.getStockQuantity?.(carriedProductId) >= quantity
            ? { id: carriedProductId }
            : null
        )
      : InventorySystem.findAvailableProductForRequest?.(wantedProductId, quantity);

    if (!availableProduct) {
      CustomerSystem.handleStockShortageForCustomer?.(
        customer.customerId,
        "stock_shortage"
      );

      this.showActionMessage("판매 가능한 재고가 없습니다.");
      console.warn("[PlayerActionSystem] 판매 가능한 재고가 없습니다.", {
        customerId: customer.customerId,
        wantedProductId
      });

      return null;
    }

    const product = getProductById(availableProduct.id);

    if (!product) {
      this.showActionMessage("실제 판매 상품을 찾을 수 없습니다.");
      console.warn("[PlayerActionSystem] 실제 판매 상품을 찾을 수 없습니다.", {
        productId: availableProduct.id
      });

      return null;
    }

    this.checkoutSequence += 1;

    const checkoutIdPrefix = options.checkoutIdPrefix ?? "checkout";
    const actorType = options.actorType ?? "player";

    return {
      checkoutId: `${checkoutIdPrefix}-${GameState.day}-${customer.customerId}-${this.checkoutSequence}`,
      day: GameState.day,
      customerId: customer.customerId,
      customerTypeId: customer.customerTypeId ?? null,
      customerTypeName: customer.customerTypeName ?? "",
      isNuisance: customer.isNuisance === true,
      nuisanceProfileId: customer.nuisanceProfileId ?? null,
      nuisanceCheckoutDelayMs: Number(customer.nuisanceCheckoutDelayMs) || 0,
      wantedProductId,
      productId: product.id,
      productName: product.name,
      quantity,
      amount: product.salePrice * quantity,
      source: options.source ?? "player_action_system",
      actorType,
      actorId: options.actorId ?? null,
      actorName: options.actorName ?? null
    };
  },

  getWaitingCheckoutCustomerPayload() {
    const waitingCustomer = CustomerSystem.getWaitingCustomers?.()[0] ?? null;

    if (!waitingCustomer) {
      return null;
    }

    if (typeof CustomerSystem.createCustomerPayload === "function") {
      return CustomerSystem.createCustomerPayload(waitingCustomer);
    }

    return {
      customerId: waitingCustomer.id,
      wantedProductId: waitingCustomer.wantedProductId,
      carriedProductId: waitingCustomer.carriedProductId ?? null
    };
  }
};
