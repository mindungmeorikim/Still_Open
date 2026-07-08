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
  PRODUCTS,
  PRODUCT_CATEGORIES,
  PRODUCT_DISPLAY_CATEGORIES,
  PRODUCT_SHELF_IDS,
  getProductById
} from "../data/ProductData.js";
import { CustomerSystem } from "./CustomerSystem.js";
import { InventorySystem } from "./InventorySystem.js";
import { BMSystem } from "./BMSystem.js";
import { SHELF_INSTANCES } from "../data/ShelfPlacementData.js";
import { getCleaningPointByZoneId } from "../data/CleaningPointData.js";
import { getShelfInstanceIdByProductId } from "../data/ProductShelfMapData.js";

const STAFF_EVENTS = {
  AUTO_CHECKOUT_REQUESTED: "STAFF_AUTO_CHECKOUT_REQUESTED",
  AUTO_CHECKOUT_COMPLETED: "STAFF_AUTO_CHECKOUT_COMPLETED"
};

const TUTORIAL_PRACTICE_RESET_REQUESTED = "TUTORIAL_PRACTICE_RESET_REQUESTED";
const PLAYER_DIALOGUE_REQUESTED = "PLAYER_DIALOGUE_REQUESTED";
const PLAYER_POSITION_CHANGED = "PLAYER_POSITION_CHANGED";
const ORDER_DELIVERY_PICKUP_REQUESTED = "ORDER_DELIVERY_PICKUP_REQUESTED";
const SANITATION_CLEANING_REQUESTED = "SANITATION_CLEANING_REQUESTED";
const SHELF_STOCK_CONSUMED = "SHELF_STOCK_CONSUMED";
const SHELF_STOCK_CHANGED = "SHELF_STOCK_CHANGED";
const SANITATION_CLEANING_STARTED = "SANITATION_CLEANING_STARTED";
const SANITATION_CLEANING_COMPLETED = "SANITATION_CLEANING_COMPLETED";
const SANITATION_CLEANING_FAILED = "SANITATION_CLEANING_FAILED";
const NUISANCE_CHECKOUT_DELAY_MS = 5000;
const PLAYER_CHECKOUT_DELAY_MS = 3000;
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
  shelfStocks: {},

  shelf: {
    shelfId: PRODUCT_SHELF_IDS.BASIC,
    nodeId: "shelf-zone",
    x: 540,
    y: 680,
    productId: "potato_chips",
    currentStock: 0,
    maxStock: 8
  },

  shelves: {
    [PRODUCT_SHELF_IDS.FRIDGE]: {
      shelfId: PRODUCT_SHELF_IDS.FRIDGE,
      nodeId: "beverage-fridge-zone",
      x: 705,
      y: 492,
      productId: "water",
      currentStock: 0,
      maxStock: 8
    },
    [PRODUCT_SHELF_IDS.FRESH]: {
      shelfId: PRODUCT_SHELF_IDS.FRESH,
      nodeId: "fresh-shelf-zone",
      x: 650,
      y: 585,
      productId: "triangle_kimbap",
      currentStock: 0,
      maxStock: 8
    },
    [PRODUCT_SHELF_IDS.WARMER]: {
      shelfId: PRODUCT_SHELF_IDS.WARMER,
      nodeId: "food-warmer-zone",
      x: 624,
      y: 540,
      productId: "sausage_hotbar",
      currentStock: 0,
      maxStock: 8
    }
  },

  activeShelfId: PRODUCT_SHELF_IDS.BASIC,

  warehouse: {
    stock: 0
  },

  interactionDistance: 100,
  checkoutInteractionDistance: 75,
  restockDuration: 5000,
  
  restockTimerId: null,
  restockRemainingSeconds: 0,
  restockPhase: null,

  autoMoveTimerId: null,
  autoMoveSpeed: 4,

  warehouseZone: {
    x: 210,
    y: 575,
    standX: 250,
    standY: 580
  },

  deliveryBoxZone: {
    x: 478,
    y: 615,
    standX: 470,
    standY: 630
  },

  cleaningZone: {
    x: 735,
    y: 520,
    interactionDistance: 100
  },

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.initializeWarehouseBoxState();
    this.bindCounterCheckoutAction();
    this.bindPointerActions();
    this.bindKeyboardActions();
    // BM 최종본 기준 알바는 자동 계산 전담이 아니므로 자동 계산 이벤트 바인딩을 하지 않는다.
    this.bindDeliveryBoxEvents();
    this.bindSanitationEvents();
    this.bindShelfStockEvents();

    EventBus.on(TUTORIAL_PRACTICE_RESET_REQUESTED, () => {
      this.resetTutorialPracticeActions();
    });

    this.getShelfSlots();
    this.syncShelfStocksToGameState("init");
  },

  resetTutorialPracticeActions() {
    if (this.restockTimerId) {
      clearInterval(this.restockTimerId);
      this.restockTimerId = null;
    }

    if (this.cleaningCountdownTimerId) {
      clearInterval(this.cleaningCountdownTimerId);
      this.cleaningCountdownTimerId = null;
    }

    this.isPlayerBusy = false;
    this.restockRemainingSeconds = 0;
    this.restockPhase = null;
    this.setDeliveryBoxInteractionSuppressed(false);
    this.setCarryingBoxType(null);
    this.setDeliveryBoxState(null);
    this.setWarehouseBoxState("closed");
    this.shelfStocks = {};
    this.getShelfSlots();
    this.syncShelfStocksToGameState("tutorial_practice_reset");
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
    // Deprecated: 알바 자동 계산은 최종 BM/기획에서 제거됨.
    // 알바 역할은 창고/진열대/청소 보조로 제한한다.
  },

  bindDeliveryBoxEvents() {
    EventBus.on(ORDER_DELIVERY_PICKUP_REQUESTED, (data = {}) => {
      this.handleDeliveryBoxPickupRequested(data);
    });
  },

  bindShelfStockEvents() {
    EventBus.on(SHELF_STOCK_CONSUMED, (data = {}) => {
      this.handleShelfStockConsumed(data);
    });

    EventBus.on(EVENTS.STOCK_ORGANIZED, (data = {}) => {
      this.handleOrderShelfAutoFill(data);
    });

    EventBus.on(EVENTS.STORE_OPENED, () => {
      this.ensureShelfStocksSeededFromInventory();
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

  isCustomerEventModalInteractionLocked() {
    return Boolean(
      document.body?.classList?.contains("is-customer-event-modal-active")
    );
  },

  handleKeyboardAction(event) {
  if (this.isCustomerEventModalInteractionLocked()) {
    if (this.isInteractionKey(event)) {
      event.preventDefault();
      event.stopPropagation();
    }

    return;
  }

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
    if (this.isCustomerEventModalInteractionLocked()) {
      return;
    }

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
      this.handleShelfRestockAction({
        shelfId: target.shelfId,
        shelfInstanceId: target.shelfInstanceId
      });
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

  handleShelfRestockAction(options = {}) {
    if (this.isPlayerBusy) {
      this.showActionMessage("지금은 다른 행동을 할 수 없습니다.");
      return;
    } 

    if (!GameState.player) return;

    let shelf = this.getShelfSlot(options.shelfInstanceId ?? options.shelfId);

    if (!this.isNearShelf(shelf)) {
      this.showActionMessage("진열대에 더 가까이 가야 합니다.");
      return;
    }

    let capacity = this.getShelfCapacityForSlot(shelf);
    let currentStock = this.getShelfCurrentStock(shelf);

    if (currentStock > 0) {
      const restockableShelf = this.findNearbyRestockableShelf(shelf.instanceId);

      if (restockableShelf) {
        shelf = restockableShelf;
        capacity = this.getShelfCapacityForSlot(shelf);
        currentStock = this.getShelfCurrentStock(shelf);
      } else {
        this.showActionMessage(
          `아직 상품이 남아 있습니다. (${currentStock}/${capacity})`
        );
        return;
      }
    }

    let availableWarehouseStock = this.getAvailableWarehouseStock(shelf.productId);

    if (availableWarehouseStock <= 0) {
      const restockableShelf = this.findNearbyRestockableShelf(shelf.instanceId);

      if (restockableShelf) {
        shelf = restockableShelf;
        capacity = this.getShelfCapacityForSlot(shelf);
        currentStock = this.getShelfCurrentStock(shelf);
        availableWarehouseStock = this.getAvailableWarehouseStock(shelf.productId);
      } else {
        this.showActionMessage("창고에 입고된 재고가 없습니다. 먼저 발주 물류를 정리해주세요.");
        return;
      }
    }

    this.startShelfRestock(shelf);
  },

  getShelfCurrentStock(shelf = this.shelf) {
    return Math.max(
      0,
      Math.floor(Number(shelf?.currentStock) || 0)
    );
  },

  getNearbyShelfTargets() {
    return this.getShelfSlots()
      .map((shelf) => {
        const distance = this.getDistanceToZone(shelf.nodeId, shelf);
        const interactionDistance =
          Number(shelf.interactionDistance) || this.interactionDistance;
        const productId = this.getResolvedProductId(shelf.productId);
        const currentStock = this.getShelfCurrentStock(shelf);
        const availableWarehouseStock = this.getAvailableWarehouseStock(productId);

        return {
          type: "shelf",
          shelf,
          shelfId: shelf.shelfId,
          shelfInstanceId: shelf.instanceId,
          productId,
          currentStock,
          availableWarehouseStock,
          interactionDistance,
          distance,
          isEmpty: currentStock <= 0,
          isRestockable: currentStock <= 0 && availableWarehouseStock > 0
        };
      })
      .filter((target) => (
        target.distance !== null &&
        target.distance <= target.interactionDistance
      ));
  },

  getShelfInteractionPriority(target = {}) {
    if (target.isRestockable) {
      return 0;
    }

    if (target.isEmpty) {
      return 1;
    }

    return 2;
  },

  findNearbyRestockableShelf(excludedShelfInstanceId = null) {
    const restockableTarget = this.getNearbyShelfTargets()
      .filter((target) => (
        target.isRestockable &&
        (!excludedShelfInstanceId || target.shelfInstanceId !== excludedShelfInstanceId)
      ))
      .sort((first, second) => first.distance - second.distance)[0];

    return restockableTarget?.shelf ?? null;
  },

  isNearShelf(shelf = this.shelf) {
    const targetShelf = this.getShelfSlot(
      shelf?.instanceId ?? shelf?.shelfInstanceId ?? shelf?.shelfId ?? shelf
    );

    const distance = this.getDistanceToZone(targetShelf.nodeId, targetShelf);
    const interactionDistance =
      Number(targetShelf.interactionDistance) || this.interactionDistance;

    return distance !== null && distance <= interactionDistance;
  },

  getCounterInteractionDistance() {
    return Math.max(40, Number(this.checkoutInteractionDistance) || 75);
  },

  isNearCounter() {
    const distance = this.getDistanceToZone("counter-zone", null);

    return distance !== null && distance <= this.getCounterInteractionDistance();
  },

  isNearCleaningZone() {
    const activeCleaningPoint = this.getActiveCleaningPoint();
    const distance = this.getDistanceToZone("cleaning-zone", activeCleaningPoint);
    const interactionDistance =
      Number(activeCleaningPoint.interactionDistance) || this.interactionDistance;

    return distance !== null && distance <= interactionDistance;
  },

  getPrimaryInteractionTarget() {
    const shelfTargets = this.getNearbyShelfTargets()
      .sort((first, second) => {
        const priorityGap =
          this.getShelfInteractionPriority(first) -
          this.getShelfInteractionPriority(second);

        if (priorityGap !== 0) {
          return priorityGap;
        }

        return first.distance - second.distance;
      });

    const emptyShelfTarget = shelfTargets.find((target) => {
      return target.isRestockable || target.isEmpty;
    });

    if (emptyShelfTarget) {
      return emptyShelfTarget;
    }

    const activeCleaningPoint = this.getActiveCleaningPoint();
    const cleaningDistance = this.getDistanceToZone("cleaning-zone", activeCleaningPoint);
    const cleaningInteractionDistance =
      Number(activeCleaningPoint.interactionDistance) || this.interactionDistance;

    if (
      cleaningDistance !== null &&
      cleaningDistance <= cleaningInteractionDistance
    ) {
      return {
        type: "cleaning",
        distance: cleaningDistance,
        targetZoneId: activeCleaningPoint.zoneId,
        dirtySpotId: activeCleaningPoint.id
      };
    }

    const counterDistance = this.getDistanceToZone("counter-zone", null);

    if (
      counterDistance !== null &&
      counterDistance <= this.getCounterInteractionDistance()
    ) {
      return {
        type: "counter",
        distance: counterDistance
      };
    }

    return shelfTargets[0] ?? null;
  },

  isShelfZoneUnlocked(shelf) {
    const unlockedZoneIds = GameState.expansion?.unlockedZoneIds;

    if (!Array.isArray(unlockedZoneIds)) {
      return shelf?.zoneId === "zone_basic";
    }

    return unlockedZoneIds.includes(shelf?.zoneId);
  },

  getShelfSlots() {
    const slots = SHELF_INSTANCES
      .filter((shelf) => this.isShelfZoneUnlocked(shelf))
      .map((shelf) => {
        const stockKey = shelf.instanceId;
        const defaultProductId = this.getDefaultProductIdForShelf(shelf);

        if (!this.shelfStocks[stockKey]) {
          this.shelfStocks[stockKey] = {
            products: {
              [defaultProductId]: {
                currentStock: 0,
                maxStock: 8
              }
            }
          };
        }

        const stockData = this.shelfStocks[stockKey];
        const productIds = Object.keys(stockData.products ?? {});
        const primaryProductId = productIds[0] ?? defaultProductId;
        const primaryStock = stockData.products?.[primaryProductId] ?? {
          currentStock: 0,
          maxStock: 8
        };

        return {
          ...shelf,
          productId: primaryProductId,
          products: stockData.products,
          currentStock: primaryStock.currentStock,
          maxStock: primaryStock.maxStock ?? 8
        };
      });

    this.syncShelfStocksToGameState("get_shelf_slots");

    return slots;
  },

  syncShelfStocksToGameState(reason = "shelf_stock_sync") {
    GameState.shelfStocks = Object.fromEntries(
      Object.entries(this.shelfStocks).map(([instanceId, stock]) => {
        const shelfConfig =
          SHELF_INSTANCES.find((shelf) => shelf.instanceId === instanceId) ?? null;

        const products = Object.fromEntries(
          Object.entries(stock.products ?? {}).map(([productId, productStock]) => {
            const resolvedProductId = this.getResolvedProductId(productId);
            const maxStock = Math.max(
              1,
              Math.floor(Number(productStock.maxStock) || 8)
            );

            return [
              resolvedProductId,
              {
                productId: resolvedProductId,
                currentStock: Math.max(
                  0,
                  Math.floor(Number(productStock.currentStock) || 0)
                ),
                maxStock
              }
            ];
          })
        );

        return [
          instanceId,
          {
            products,
            shelfId: shelfConfig?.shelfId ?? null,
            reason
          }
        ];
      })
    );
  },

  isTutorialFlowActive() {
    return Boolean(
      typeof document !== "undefined" &&
      document.body?.classList?.contains("is-tutorial-active")
    );
  },

  handleOrderShelfAutoFill(data = {}) {
    if (this.isTutorialFlowActive()) {
      return;
    }

    const source = String(data.source ?? "").trim();

    if (source !== "delivery_box_sorted" && source !== "order_delivery_compat") {
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    let changed = false;

    items.forEach((item) => {
      const didChange = this.applyShelfAutoFillForProduct(item.productId, item.quantity, {
        mode: "add",
        reason: "order_stock_organized"
      });

      changed = changed || didChange;
    });

    if (changed) {
      this.syncShelfStocksToGameState("order_stock_organized");
      EventBus.emit(SHELF_STOCK_CHANGED, {
        day: GameState.day,
        success: true,
        reason: "order_stock_organized",
        source
      });
      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    }
  },

  ensureShelfStocksSeededFromInventory() {
    if (this.isTutorialFlowActive()) {
      return;
    }

    const snapshot = InventorySystem.getInventorySnapshot?.() ?? {};
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];

    if (items.length === 0) {
      return;
    }

    let changed = false;

    items.forEach((item) => {
      const didChange = this.applyShelfAutoFillForProduct(item.productId, item.quantity, {
        mode: "ensure",
        reason: "store_open_inventory_seed"
      });

      changed = changed || didChange;
    });

    if (changed) {
      this.syncShelfStocksToGameState("store_open_inventory_seed");
      EventBus.emit(SHELF_STOCK_CHANGED, {
        day: GameState.day,
        success: true,
        reason: "store_open_inventory_seed",
        source: "store_opened"
      });
      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    }
  },

  applyShelfAutoFillForProduct(productId, quantity = 0, options = {}) {
    const resolvedProductId = this.getResolvedProductId(productId);
    const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));

    if (!resolvedProductId || safeQuantity <= 0) {
      return false;
    }

    const product = getProductById(resolvedProductId);
    const shelfInstanceId = getShelfInstanceIdByProductId(resolvedProductId);
    const targetShelf = this.getShelfSlot(
      shelfInstanceId ?? product?.targetShelfInstanceId ?? product?.shelfId
    );

    if (!targetShelf || !this.isShelfZoneUnlocked(targetShelf)) {
      return false;
    }

    const stockKey = targetShelf.instanceId;

    if (!this.shelfStocks[stockKey]) {
      this.shelfStocks[stockKey] = {
        products: {}
      };
    }

    if (!this.shelfStocks[stockKey].products) {
      this.shelfStocks[stockKey].products = {};
    }

    const productStock = this.shelfStocks[stockKey].products[resolvedProductId] ?? {};
    const capacity = Math.max(
      1,
      Math.floor(
        Number(productStock.maxStock) ||
        Number(targetShelf.maxStock) ||
        8
      )
    );
    const currentStock = Math.max(
      0,
      Math.floor(Number(productStock.currentStock) || 0)
    );
    const nextStock = options.mode === "ensure"
      ? Math.max(currentStock, Math.min(capacity, safeQuantity))
      : Math.min(capacity, currentStock + safeQuantity);

    if (nextStock === currentStock) {
      return false;
    }

    this.shelfStocks[stockKey].products[resolvedProductId] = {
      productId: resolvedProductId,
      currentStock: nextStock,
      maxStock: capacity
    };

    return true;
  },

  getReservedCarriedQuantity(productId, exceptCustomerId = null) {
    const resolvedProductId = this.getResolvedProductId(productId);

    if (!resolvedProductId || typeof CustomerSystem.getReservedCarriedQuantity !== "function") {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(Number(CustomerSystem.getReservedCarriedQuantity(resolvedProductId, exceptCustomerId)) || 0)
    );
  },

  handleShelfStockConsumed(data = {}) {
    const resolvedProductId = this.getResolvedProductId(data.productId);
    const quantity = Math.max(1, Math.floor(Number(data.quantity) || 1));
    const requestedShelfInstanceId = data.shelfInstanceId ?? null;

    if (!resolvedProductId) {
      return false;
    }

    const slots = this.getShelfSlots();

    const candidates = slots
      .map((slot) => {
        const productStock = slot.products?.[resolvedProductId] ?? null;

        return {
          ...slot,
          productStock
        };
      })
      .filter((slot) => {
        if (requestedShelfInstanceId && slot.instanceId !== requestedShelfInstanceId) {
          return false;
        }

        return (
          slot.productStock &&
          Math.max(0, Math.floor(Number(slot.productStock.currentStock) || 0)) >= quantity
        );
      });

    const targetSlot = candidates[0] ?? null;

    if (!targetSlot) {
      EventBus.emit(SHELF_STOCK_CHANGED, {
        day: GameState.day,
        success: false,
        reason: "shelf_stock_shortage",
        productId: resolvedProductId,
        quantity,
        shelfInstanceId: requestedShelfInstanceId,
        source: data.source ?? "customer_pickup"
      });
      return false;
    }

    const previousStock = Math.max(
      0,
      Math.floor(Number(targetSlot.productStock.currentStock) || 0)
    );

    const nextStock = Math.max(0, previousStock - quantity);

    this.shelfStocks[targetSlot.instanceId].products[resolvedProductId] = {
      ...this.shelfStocks[targetSlot.instanceId].products[resolvedProductId],
      productId: resolvedProductId,
      currentStock: nextStock,
      maxStock: targetSlot.productStock.maxStock ?? 8
    };

    this.syncShelfStocksToGameState("customer_pickup");

    EventBus.emit(SHELF_STOCK_CHANGED, {
      day: GameState.day,
      success: true,
      productId: resolvedProductId,
      quantity,
      shelfId: targetSlot.shelfId,
      shelfInstanceId: targetSlot.instanceId,
      previousStock,
      currentStock: nextStock,
      source: data.source ?? "customer_pickup"
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return true;
  },

  getDefaultProductIdForShelf(shelf) {
    const shelfInstanceId = shelf?.instanceId ?? null;
    const shelfId = shelf?.shelfId ?? shelf;

    const matchedProduct = PRODUCTS.find((product) => {
      return product.targetShelfInstanceId === shelfInstanceId;
    });

    if (matchedProduct?.id) {
      return matchedProduct.id;
    }

    if (shelfId === PRODUCT_SHELF_IDS.FRIDGE) {
      return "water";
    }

    if (shelfId === PRODUCT_SHELF_IDS.FRESH) {
      return "triangle_kimbap";
    }

    if (shelfId === PRODUCT_SHELF_IDS.WARMER) {
      return "sausage_hotbar";
    }

    return "potato_chips";
  },

  getShelfSlot(shelfKey = PRODUCT_SHELF_IDS.BASIC) {
    if (shelfKey && typeof shelfKey === "object") {
      return shelfKey;
    }

    const slots = this.getShelfSlots();

    return (
      slots.find((shelf) => shelf.instanceId === shelfKey) ||
      slots.find((shelf) => shelf.shelfId === shelfKey) ||
      slots[0] ||
      this.shelf
    );
  },

  getShelfCapacityForSlot(shelf = this.shelf) {
    const shelfMaxStock = Math.floor(Number(shelf.maxStock) || 8);

    //const capacity = product?.shelfId
      //? BMSystem.getShelfCapacity(product.shelfId)
      //: 0;

    return Math.max(1, shelfMaxStock);
  },

  getActiveCleaningPoint() {
    const sanitationState = GameState.sanitation ?? {};
    const point = sanitationState.activeCleaningPoint;

    if (
      point &&
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y))
    ) {
      return {
        ...this.cleaningZone,
        ...point,
        x: Number(point.x),
        y: Number(point.y),
        interactionDistance: Number(point.interactionDistance) || this.cleaningZone.interactionDistance || this.interactionDistance
      };
    }

    return getCleaningPointByZoneId(sanitationState.dirtyZoneId);
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
    const playerWidth = Number(playerNode?.offsetWidth) || 58;
    const playerHeight = Number(playerNode?.offsetHeight) || 102;

    return {
      x: (Number(player.x) || 0) + playerWidth / 2,
      y: (Number(player.y) || 0) + playerHeight / 2
    };
  },

  getZoneCenter(zoneId, fallback = null) {
    if (
      fallback &&
      Number.isFinite(Number(fallback.x)) &&
      Number.isFinite(Number(fallback.y))
    ) {
      const hasInteractionPosition =
        Number.isFinite(Number(fallback.interactionX)) &&
        Number.isFinite(Number(fallback.interactionY));

      if (hasInteractionPosition) {
        return {
          x: Number(fallback.interactionX),
          y: Number(fallback.interactionY)
        };
      }

      return {
        x:
          Number(fallback.x) +
          (Number(fallback.width) || 0) / 2 +
          (Number(fallback.interactionOffsetX) || 0),
        y:
          Number(fallback.y) +
          (Number(fallback.height) || 0) / 2 +
          (Number(fallback.interactionOffsetY) || 0)
      };
    }

    const zoneNode = document.getElementById(zoneId);

    if (zoneNode) {
      return {
        x: (Number(zoneNode.offsetLeft) || 0) + (Number(zoneNode.offsetWidth) || 0) / 2,
        y: (Number(zoneNode.offsetTop) || 0) + (Number(zoneNode.offsetHeight) || 0) / 2
      };
    }

    return fallback;
  },

   
 getPlayerStandPositionForZone(zoneId, fallbackPosition) {
  if (
    fallbackPosition &&
    Number.isFinite(Number(fallbackPosition.standX)) &&
    Number.isFinite(Number(fallbackPosition.standY))
  ) {
    return {
      x: Number(fallbackPosition.standX),
      y: Number(fallbackPosition.standY)
    };
  }

  const zoneCenter = this.getZoneCenter(zoneId, fallbackPosition);

  if (!zoneCenter) {
    return fallbackPosition;
  }

  const playerNode = document.getElementById("player-zone");
  const playerWidth = Number(playerNode?.offsetWidth) || 58;
  const playerHeight = Number(playerNode?.offsetHeight) || 102;

  return {
    x: zoneCenter.x - playerWidth / 2,
    y: zoneCenter.y - playerHeight + 20
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

  setDeliveryBoxInteractionSuppressed(isSuppressed) {
    const nextValue = isSuppressed === true;

    if (GameState.deliveryBoxInteractionSuppressed === nextValue) {
      return;
    }

    GameState.deliveryBoxInteractionSuppressed = nextValue;
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
    this.setDeliveryBoxInteractionSuppressed(true);
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
            this.setDeliveryBoxInteractionSuppressed(false);
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

    const totalStock = Math.max(0, Math.floor(Number(
      InventorySystem.getStockQuantity?.(resolvedProductId)
    ) || 0));
    const reservedCarriedStock = this.getReservedCarriedQuantity(resolvedProductId);

    return Math.max(0, totalStock - reservedCarriedStock);
  },

  startShelfRestock(shelf = this.shelf) {
  const targetShelf = this.getShelfSlot(shelf.instanceId ?? shelf.shelfInstanceId ?? shelf.shelfId);
  this.activeShelfId = targetShelf.shelfId;
  this.isPlayerBusy = true;
  this.setCarryingBoxType(null);

  this.showActionMessage("창고로 이동 중입니다.");

  this.movePlayerToWarehouse(() => {
    this.startTimedRestockPhase({
      phase: "warehouse",
      message: "창고에서 상품을 꺼내는 중입니다",
      onComplete: () => {
        this.setCarryingBoxType(this.getCarryingBoxTypeForProduct(targetShelf.productId));
        this.showActionMessage("진열대로 이동 중입니다.");

        this.movePlayerToShelf(targetShelf, () => {
          this.startTimedRestockPhase({
            phase: "shelf",
            message: "진열대에 상품을 채우는 중입니다",
            onComplete: () => {
              this.completeShelfRestock(targetShelf);
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

    EventBus.emit(PLAYER_POSITION_CHANGED, GameState);
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

movePlayerToShelf(shelf = this.shelf, onComplete) {
  const targetShelf = this.getShelfSlot(
    shelf.instanceId ?? shelf.shelfInstanceId ?? shelf.shelfId
  );
  this.movePlayerToPosition(
    this.getPlayerStandPositionForZone(targetShelf.nodeId, targetShelf),
    onComplete
  );
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
  const durationMs = this.getAssistedActionDurationMs(phase, this.restockDuration);
  this.restockRemainingSeconds = Math.ceil(durationMs / 1000);
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
  }, durationMs);
},

getStaffAssistPower(type = "shelf") {
  const staff = GameState.staff?.hired;

  if (!staff) {
    return 0;
  }

  const base = Math.max(0, Math.floor(Number(staff.stats?.[type]) || 0));
  const bonus = Math.max(0, Math.floor(Number(GameState.bm?.staffAbilityUpgrade?.abilities?.[type]) || 0));

  return Math.min(5, base + bonus);
},

getAssistTypeForActionPhase(phase = "shelf") {
  if (phase === "warehouse" || phase === "delivery") {
    return "warehouse";
  }

  if (phase === "cleaning") {
    return "cleaning";
  }

  return "shelf";
},

getAssistedActionDurationMs(phase = "shelf", baseDurationMs = this.restockDuration) {
  const safeBaseDuration = Math.max(1000, Math.floor(Number(baseDurationMs) || this.restockDuration));
  const assistType = this.getAssistTypeForActionPhase(phase);
  const assistPower = this.getStaffAssistPower(assistType);
  const reductionRate = Math.min(0.4, assistPower * 0.08);
  const reducedDuration = Math.round(safeBaseDuration * (1 - reductionRate));

  return Math.max(1800, reducedDuration);
},

completeShelfRestock(shelf = this.getShelfSlot(this.activeShelfId)) {
  const targetShelf = this.getShelfSlot(
    shelf.instanceId ?? shelf.shelfInstanceId ?? shelf.shelfId
  );

  const productId = this.getResolvedProductId(targetShelf.productId);
  const productStock = targetShelf.products?.[productId] ?? {
    currentStock: 0,
    maxStock: 8
  };

  const capacity = Math.max(1, Math.floor(Number(productStock.maxStock) || 8));
  const currentStock = Math.max(0, Math.floor(Number(productStock.currentStock) || 0));
  const needStock = capacity - currentStock;
  const availableWarehouseStock = this.getAvailableWarehouseStock(productId);
  const restockAmount = Math.min(needStock, availableWarehouseStock);

  if (restockAmount <= 0) {
    this.isPlayerBusy = false;
    this.restockPhase = null;
    this.setCarryingBoxType(null);
    this.setWarehouseBoxState("closed");
    this.showActionMessage("창고에 입고된 재고가 없어 보충할 수 없습니다.");
    return;
  }

  const nextStock = currentStock + restockAmount;

  if (!this.shelfStocks[targetShelf.instanceId]) {
    this.shelfStocks[targetShelf.instanceId] = {
      products: {}
    };
  }

  if (!this.shelfStocks[targetShelf.instanceId].products) {
    this.shelfStocks[targetShelf.instanceId].products = {};
  }

  this.shelfStocks[targetShelf.instanceId].products[productId] = {
    productId,
    currentStock: nextStock,
    maxStock: capacity
  };

  this.syncShelfStocksToGameState("player_shelf_restock");

  EventBus.emit(EVENTS.RESTOCK_COMPLETED, {
    day: GameState.day,
    productId,
    shelfId: targetShelf.shelfId,
    quantity: restockAmount,
    source: "player_shelf_restock"
  });

  this.isPlayerBusy = false;
  this.restockPhase = null;
  this.setCarryingBoxType(null);
  this.setWarehouseBoxState("closed");

  this.showActionMessage(
    `진열대 보충 완료! ${restockAmount}개를 채웠습니다. 진열대: ${nextStock}/${capacity}, 창고 재고: ${availableWarehouseStock}개`
  );
},

  handleCleaningAction(options = {}) {
    if (this.isPlayerBusy) {
      this.showActionMessage("지금은 다른 행동을 할 수 없습니다.");
      return;
    }

    const staffAssistState = GameState.staffAssist ?? {};
    const isStaffCleaningActive = (
      staffAssistState.taskType === "cleaning" &&
      ["cleaning", "returning"].includes(staffAssistState.status)
    );

    if (isStaffCleaningActive) {
      this.showActionMessage("알바생이 청소 중입니다. 잠시 후 다시 시도해주세요.");
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

    const activeCleaningPoint = this.getActiveCleaningPoint();

    EventBus.emit(SANITATION_CLEANING_REQUESTED, {
      day: GameState.day,
      actorType: "player",
      targetZoneId: activeCleaningPoint.zoneId,
      dirtyZoneId: activeCleaningPoint.zoneId,
      dirtySpotId: activeCleaningPoint.id,
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

    if (this.isCustomerEventModalInteractionLocked()) {
      event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }

    if (this.isPlayerBusy) {
      this.showActionMessage("지금은 다른 행동을 할 수 없습니다.");
      return;
    } 

    if (actionType === "cleaning") {
      this.handleCleaningAction({
        source: "player_action_system_pointer",
        requireNear: true
      });
      return;
    }

    if (actionType === "shelf_restock" || actionType === "shelf") {
      this.handleShelfRestockAction({
        shelfId: actionNode.dataset.shelfId,
        shelfInstanceId: actionNode.dataset.shelfInstanceId
      });
      return;
    }

    if (this.isCheckoutAction(actionType)) {
      if (!this.isNearCounter()) {
        this.showActionMessage("계산대에 더 가까이 가야 합니다.");
        return;
      }

      if (!this.tryLockCheckoutInput()) {
        return;
      }
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
    // Deprecated: 알바는 자동 계산을 수행하지 않는다.
    // 외부에서 구버전 STAFF_AUTO_CHECKOUT_REQUESTED가 들어와도 계산 처리를 진행하지 않는다.
    this.emitStaffAutoCheckoutResult(false, data, "staff_checkout_disabled");
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

    if (this.shouldUsePlayerCheckoutDelay(checkoutPayload, options)) {
      this.schedulePlayerCheckout(checkoutPayload, options);
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

  shouldUsePlayerCheckoutDelay(checkoutPayload = {}, options = {}) {
    if (options.skipPlayerCheckoutDelay === true) {
      return false;
    }

    return (options.actorType ?? checkoutPayload.actorType ?? "player") === "player";
  },

  schedulePlayerCheckout(checkoutPayload = {}, options = {}) {
    if (options.actorType !== "staff") {
      this.isPlayerBusy = true;
    }

    const delayMs = PLAYER_CHECKOUT_DELAY_MS;
    const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));

    this.showActionMessage(`계산 중입니다... ${delaySeconds}초`);

    setTimeout(() => {
      if (options.actorType !== "staff") {
        this.isPlayerBusy = false;
      }

      this.completeCheckout(checkoutPayload, options);
    }, delayMs);
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
    if (!this.validateCheckoutStockBeforeComplete(checkoutPayload, options)) {
      return null;
    }

    EventBus.emit(EVENTS.CHECKOUT_COMPLETED, checkoutPayload);

    if (typeof options.successMessage === "function") {
      this.showActionMessage(options.successMessage(checkoutPayload));
    }

    if (options.actorType === "staff") {
      this.emitStaffAutoCheckoutResult(true, options, null, checkoutPayload);
    }
  },

  validateCheckoutStockBeforeComplete(checkoutPayload = {}, options = {}) {
    const productId = this.getResolvedProductId(checkoutPayload.productId);
    const quantity = Math.max(1, Math.floor(Number(checkoutPayload.quantity) || 1));
    const availableQuantity = Math.max(
      0,
      Math.floor(Number(InventorySystem.getStockQuantity?.(productId)) || 0)
    );

    if (productId && availableQuantity >= quantity) {
      return true;
    }

    CustomerSystem.handleStockShortageForCustomer?.(
      checkoutPayload.customerId,
      "checkout_stock_shortage"
    );

    this.showActionMessage("계산 직전 재고가 부족해 판매를 취소했습니다.");
    console.warn("[PlayerActionSystem] 계산 직전 재고 부족으로 계산을 차단했습니다.", {
      customerId: checkoutPayload.customerId,
      productId,
      requestedQuantity: quantity,
      availableQuantity
    });

    if (options.actorType === "staff") {
      this.emitStaffAutoCheckoutResult(false, options, "checkout_stock_shortage", checkoutPayload);
    }

    return false;
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

    if (
      customer.status !== "waiting" ||
      customer.currentZone !== "counter"
    ) {
      this.showActionMessage("계산대에서 상품을 든 손님만 계산할 수 있습니다.");
      console.warn("[PlayerActionSystem] 계산 준비가 되지 않은 손님입니다.", customer);
      return null;
    }

    if (!carriedProductId) {
      this.showActionMessage("손님이 아직 상품을 고르지 않았습니다.");
      console.warn("[PlayerActionSystem] 상품을 들지 않은 손님은 계산할 수 없습니다.", customer);
      return null;
    }

    if (!wantedProductId) {
      this.showActionMessage("손님의 요청 상품 정보가 없습니다.");
      console.warn("[PlayerActionSystem] 손님의 요청 상품 정보가 없습니다.", customer);
      return null;
    }

    const availableProduct = carriedProductId
        ? { id: carriedProductId }
        : null;

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

    const checkoutAvailableQuantity = Math.max(
      0,
      Math.floor(Number(InventorySystem.getStockQuantity?.(product.id)) || 0)
    );

    if (checkoutAvailableQuantity < quantity) {
      CustomerSystem.handleStockShortageForCustomer?.(
        customer.customerId,
        "checkout_stock_shortage"
      );

      this.showActionMessage("계산 가능한 재고가 부족합니다.");
      console.warn("[PlayerActionSystem] 계산 payload 생성 전 재고 부족으로 계산을 차단했습니다.", {
        customerId: customer.customerId,
        productId: product.id,
        requestedQuantity: quantity,
        availableQuantity: checkoutAvailableQuantity
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
      productName: BMSystem.getProductDisplayName(product),
      quantity,
      amount: BMSystem.getProductSalePrice(product) * quantity,
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
