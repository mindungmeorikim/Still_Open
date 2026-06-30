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
import { EVENTS } from "../core/Constants.js";
import { getProductById } from "../data/ProductData.js";
import { CustomerSystem } from "./CustomerSystem.js";
import { InventorySystem } from "./InventorySystem.js";

export const PlayerActionSystem = {
  isInitialized: false,
  checkoutSequence: 0,
  isCheckoutInputLocked: false,
  isPlayerBusy: false,

  shelf: {
    x: 45,
    y: 45,
    currentStock: 0,
    maxStock: 3
  },

  warehouse: {
    stock: 25
  },

  interactionDistance: 120,
  restockDuration: 5000,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.bindCounterCheckoutAction();
    this.bindPointerActions();
    this.bindKeyboardActions();
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

    if (this.isNearCounter()) {
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
      return;
    }

    this.handleShelfRestockAction();
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

    if (this.warehouse.stock <= 0) {
      this.showActionMessage("창고에 재고가 없습니다.");
      return;
    } 

    this.startShelfRestock();
  },

  isNearShelf() {
    const playerCenter = this.getPlayerCenter();
    const shelfCenter = this.getZoneCenter("shelf-zone", this.shelf);

    const dx = playerCenter.x - shelfCenter.x;
    const dy = playerCenter.y - shelfCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.interactionDistance;
  },

  isNearCounter() {
    if (!GameState.player) {
      return false;
    }

    const playerCenter = this.getPlayerCenter();
    const counterCenter = this.getZoneCenter("counter-zone", null);

    if (!counterCenter) {
      return false;
    }

    const dx = playerCenter.x - counterCenter.x;
    const dy = playerCenter.y - counterCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= this.interactionDistance;
  },

  getPlayerCenter() {
    const player = GameState.player ?? { x: 0, y: 0 };

    return {
      x: (Number(player.x) || 0) + 36,
      y: (Number(player.y) || 0) + 22
    };
  },

  getZoneCenter(zoneId, fallback = null) {
    const zoneNode = document.getElementById(zoneId);
    const storeNode = document.getElementById("store-area");

    if (zoneNode && storeNode) {
      const zoneRect = zoneNode.getBoundingClientRect();
      const storeRect = storeNode.getBoundingClientRect();

      return {
        x: zoneRect.left - storeRect.left + zoneRect.width / 2,
        y: zoneRect.top - storeRect.top + zoneRect.height / 2
      };
    }

    return fallback;
  },

  startShelfRestock() {
    this.isPlayerBusy = true;
    this.showActionMessage("진열대 재고를 채우는 중...");

    setTimeout(() => {
      const needStock = this.shelf.maxStock - this.shelf.currentStock;
      const restockAmount = Math.min(needStock, this.warehouse.stock);

      this.shelf.currentStock += restockAmount;
      this.warehouse.stock -= restockAmount;

      this.isPlayerBusy = false;
      this.showActionMessage(
        `진열대에 상품 ${restockAmount}개를 채웠습니다. 진열대: (${this.shelf.currentStock}/${this.shelf.maxStock}), 창고: ${this.warehouse.stock}`
    );
    
    console.log("[PlayerActionSystem] 진열대 보충 완료:", {
      shelfStock: this.shelf.currentStock,
      warehouseStock: this.warehouse.stock
    });
  }, this.restockDuration);
  },

  showActionMessage(message) {
    const messageNode =
      document.getElementById("message-log") ??
      document.getElementById("system-message");

    if (messageNode) {
      messageNode.textContent = message;
      return;
    }

    console.log(message);
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

  handleCheckoutAction() {
    const checkoutPayload = this.createCheckoutPayload();

    if (!checkoutPayload) {
      return;
    }

    EventBus.emit(EVENTS.CHECKOUT_COMPLETED, checkoutPayload);
    this.showActionMessage(
      `${checkoutPayload.productName} 계산 완료 (+${checkoutPayload.amount.toLocaleString("ko-KR")}원)`
    );
  },

  createCheckoutPayload() {
    const customer = CustomerSystem.getCheckoutCustomerPayload?.();

    if (!customer) {
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

    return {
      checkoutId: `checkout-${GameState.day}-${customer.customerId}-${this.checkoutSequence}`,
      day: GameState.day,
      customerId: customer.customerId,
      wantedProductId,
      productId: product.id,
      productName: product.name,
      quantity,
      amount: product.salePrice * quantity
    };
  }
};
