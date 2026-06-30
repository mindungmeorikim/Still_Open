/*
  UIManager.js
  역할: 화면 표시 및 버튼 이벤트 연결
  규칙: 시스템 직접 호출 금지, EventBus 사용
*/

import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { GameState } from "../core/GameState.js";
import { CustomerSystem } from "../systems/CustomerSystem.js";
import { PRODUCTS } from "../data/ProductData.js";
import {
  EXPANSION_ZONES,
  getPreviousExpansionZone
} from "../data/ExpansionData.js";

const STAFF_EVENTS = {
  HIRE_OFFERED: "STAFF_HIRE_OFFERED",
  HIRED: "STAFF_HIRED",
  HIRE_SKIPPED: "STAFF_HIRE_SKIPPED",
  STATE_CHANGED: "STAFF_STATE_CHANGED"
};

export const UIManager = {
  resultModal: null,
  upgradeModal: null,
  endingModal: null,
  dayScenarioModal: null,
  orderModal: null,
  staffHireModal: null,
  eventModal: null,
  eventModalOnClose: null,
  eventModalCloseTimerId: null,
  isEventModalClosing: false,
  inventorySummary: null,
  staffSummary: null,
  productPanel: null,
  expansionPanel: null,
  expansionState: null,
  pendingOrderPhaseData: null,
  orderDraftQuantities: {},
  orderDeliveredData: null,
  orderModalMode: "closed",
  orderListScrollTop: 0,
  expansionCarouselIndex: 0,
  selectedExpansionZoneId: null,
  isStoreExpansionPopoverVisible: false,
  inventoryByProductId: {},
  inventorySnapshot: null,
  pendingStaffHireData: null,

  init() {
    this.bindButtons();
    this.bindGameEvents();
    this.bindDayStartEvents();
    this.bindInventoryEvents();
    this.bindExpansionEvents();
    this.bindEndingEvents();
    this.bindOrderEvents();
    this.bindStaffEvents();
    this.createDayScenarioModal();
    this.createOrderModal();
    this.createStaffHireModal();
    this.createResultModal();
    this.createUpgradeModal();
    this.createEndingModal();
    this.createCustomerEventModal();
    this.createInventorySummary();
    this.createStaffSummary();
    this.createStoreComposition();
    this.createExpansionPanel();
    this.createProductPanel();
    this.render();
    this.renderCustomers();
    this.showMessage("게임 준비 완료. Day 시작 버튼을 눌러주세요.");
  },
    getPlayerNode() {
    const storeArea = document.getElementById("store-area");

    if (!storeArea) {
      return null;
    }

    let playerNode = document.getElementById("player-zone")

    if (!playerNode) {
      playerNode = document.createElement("div");
      playerNode.id = "player-zone";
      playerNode.className = "store-zone";
      playerNode.textContent = "플레이어";
      storeArea.appendChild(playerNode);
    }

    return playerNode;
  },

  renderPlayer() {
    const playerNode = this.getPlayerNode();

    if (!playerNode || !GameState.player) {
      return;
    }

    const x = Number(GameState.player.x) || 0;
    const y = Number(GameState.player.y) || 0;

    playerNode.style.left = `${x}px`;
    playerNode.style.top = `${y}px`;
  },

  bindButtons() {
    const startDayButton = document.getElementById("start-day-button");
    const openStoreButton = document.getElementById("open-store-button");
    const endDayButton = document.getElementById("end-day-button");

    startDayButton.addEventListener("click", () => {
      EventBus.emit(EVENTS.DAY_START_REQUESTED);
    });

    openStoreButton.addEventListener("click", () => {
      EventBus.emit(EVENTS.STORE_OPEN_REQUESTED);
    });

    endDayButton.addEventListener("click", () => {
      EventBus.emit(EVENTS.STORE_CLOSE_REQUESTED);
    });
  },

  bindGameEvents() {
    EventBus.on(EVENTS.GAME_STATE_CHANGED, () => {
      this.render();
      this.renderCustomers();
    });

    EventBus.on(EVENTS.CUSTOMER_LEFT, (data = {}) => {
      if (data.reason !== "wanted_product_out_of_stock") {
        return;
      }

      const message = data.wantedProductName
        ? `${data.wantedProductName}을 찾던 손님이 재고가 없어 돌아갔습니다.`
        : "원하던 상품이 없어 손님이 돌아갔습니다.";

      this.showMessage(message);
    });
  },

  bindDayStartEvents() {
    EventBus.on(EVENTS.DAY_STARTED, (data) => {
      this.pendingOrderPhaseData = null;
      this.pendingStaffHireData = null;
      this.showDayScenarioModal(data.dayScenario);
    });

    EventBus.on(EVENTS.ORDER_PHASE_STARTED, (data) => {
      this.pendingOrderPhaseData = data;

      if (
        !this.isDayScenarioModalVisible() &&
        !this.isStaffHireModalVisible()
      ) {
        this.continueDayStartFlow();
      }
    });
  },

  bindStaffEvents() {
    EventBus.on(STAFF_EVENTS.HIRE_OFFERED, (data = {}) => {
      this.pendingStaffHireData = data;

      if (
        !this.isDayScenarioModalVisible() &&
        !this.isStaffHireModalVisible()
      ) {
        this.continueDayStartFlow();
      }
    });

    EventBus.on(STAFF_EVENTS.STATE_CHANGED, (data = {}) => {
      this.renderStaffSummary(data.staff);
    });
  },

  bindOrderEvents() {
    EventBus.on(EVENTS.ORDER_DELIVERED, (data) => {
      this.handleOrderDelivered(data);
    });

    EventBus.on(EVENTS.STOCK_ORGANIZED, (data) => {
      if (data.source !== "delivery_box_sorted" && data.source !== "empty_order") {
        return;
      }

      this.clearDeliveryBox();
      this.orderDeliveredData = null;
      this.orderModalMode = "closed";
      this.hideOrderModal();

      this.showMessage(
        data.message ?? "재고 정리 완료. 편의점 오픈 버튼을 눌러주세요."
      );
    });
  },

  bindInventoryEvents() {
    EventBus.on(EVENTS.INVENTORY_CHANGED, (data) => {
      const items = Array.isArray(data.items) ? data.items : [];

      this.inventoryByProductId = items.reduce((inventoryMap, item) => {
        inventoryMap[item.productId] = item;
        return inventoryMap;
      }, {});
      this.inventorySnapshot = data;

      this.renderInventorySummary();
      this.renderProductCards();
    });
  },

  bindExpansionEvents() {
    EventBus.on(EVENTS.EXPANSION_COMPLETED, (data) => {
      const message = data.message ?? "매장 확장이 완료되었습니다.";

      this.expansionState = data.expansionState ?? this.expansionState;
      this.showExpansionMessage(message);
      this.showMessage(message);
      this.renderExpansionZones(this.expansionState);
    });

    EventBus.on(EVENTS.EXPANSION_FAILED, (data) => {
      const message = data.message ?? "확장 조건을 다시 확인해주세요.";

      this.expansionState = data.expansionState ?? this.expansionState;
      this.showExpansionMessage(message);
      this.showMessage(message);
      this.renderExpansionZones(this.expansionState);
    });
  },

  bindEndingEvents() {
    EventBus.on(EVENTS.ENDING_ACHIEVED, (data) => {
      this.showEndingModal(data);
    });
  },

  getCustomerLayer() {
    const storeArea = document.getElementById("store-area");

    if (!storeArea) {
      return null;
    }

    let customerLayer = document.getElementById("customer-layer");

    if (!customerLayer) {
      customerLayer = document.createElement("div");
      customerLayer.id = "customer-layer";
      storeArea.appendChild(customerLayer);
    }

    return customerLayer;
  },

  renderCustomers() {
    const customerLayer = this.getCustomerLayer();

    if (!customerLayer) {
      return;
    }

    const customers = CustomerSystem.getRenderableCustomers().filter((customer) => {
      return !(customer.status === "leaving" && customer.isSatisfied);
    });

    const visibleCustomerIds = new Set(
      customers.map((customer) => customer.customerId)
    );
    const existingNodes = new Map(
      [...customerLayer.querySelectorAll(".customer-npc")].map((node) => {
        return [node.dataset.customerId, node];
      })
    );

    existingNodes.forEach((node, customerId) => {
      if (!visibleCustomerIds.has(customerId)) {
        node.remove();
      }
    });

    const counterQueueIndexes = new Map();

    customers
      .map((customer, index) => {
        return { customer, index };
      })
      .filter(({ customer }) => {
        return customer.currentZone === "counter";
      })
      .sort((first, second) => {
        const firstQueueOrder = Number(first.customer.queueOrder);
        const secondQueueOrder = Number(second.customer.queueOrder);
        const firstSortOrder = Number.isFinite(firstQueueOrder)
          ? firstQueueOrder
          : Number.POSITIVE_INFINITY;
        const secondSortOrder = Number.isFinite(secondQueueOrder)
          ? secondQueueOrder
          : Number.POSITIVE_INFINITY;

        if (firstSortOrder !== secondSortOrder) {
          return firstSortOrder - secondSortOrder;
        }

        return first.index - second.index;
      })
      .forEach(({ customer }, queueIndex) => {
        counterQueueIndexes.set(customer.customerId, Math.min(queueIndex, 3));
      });

    customers.forEach((customer, index) => {
      let customerNode = existingNodes.get(customer.customerId);

      if (!customerNode) {
        customerNode = document.createElement("div");
        customerNode.className = "customer-npc";
        customerNode.dataset.customerId = customer.customerId;
        customerLayer.appendChild(customerNode);
      }

      customerNode.className = this.getCustomerClassName(customer);
      customerNode.style.setProperty("--customer-offset", `${(index % 4) * 16}px`);
      this.applyCustomerQueueOffset(customerNode, customer, counterQueueIndexes);
      this.renderCustomerNodeContent(customerNode, customer);
      customerNode.title = `${customer.typeName} / ${customer.wantedProductName}`;
    });
  },

  renderCustomerNodeContent(customerNode, customer) {
    customerNode.innerHTML = "";

    const label = document.createElement("span");
    label.className = "customer-label";
    label.textContent = this.getCustomerDisplayText(customer);
    customerNode.appendChild(label);

    if (customer.bubbleText) {
      const leavingBubble = document.createElement("span");
      leavingBubble.className = "customer-wanted-bubble";

      const leavingText = document.createElement("span");
      leavingText.className = "customer-wanted-text";
      leavingText.textContent = customer.bubbleText;
      leavingBubble.appendChild(leavingText);

      customerNode.appendChild(leavingBubble);
      return;
    }

    if (customer.currentZone !== "counter" || !customer.wantedProductName) {
      return;
    }

    const wantedBubble = document.createElement("span");
    const productName =
      customer.carriedProductName ?? customer.wantedProductName;

    wantedBubble.className = "customer-wanted-bubble";

    if (customer.carriedProductImagePath) {
      const productImage = document.createElement("img");
      productImage.className = "customer-wanted-image";
      productImage.src = customer.carriedProductImagePath;
      productImage.alt = productName;
      wantedBubble.appendChild(productImage);
    }

    const wantedText = document.createElement("span");
    wantedText.className = "customer-wanted-text";
    wantedText.textContent = productName;
    wantedBubble.appendChild(wantedText);

    customerNode.appendChild(wantedBubble);
  },

  applyCustomerQueueOffset(customerNode, customer, counterQueueIndexes) {
    const queueIndex = counterQueueIndexes.get(customer.customerId) ?? 0;
    const isCounterCustomer = customer.currentZone === "counter";
    const queueOffset = isCounterCustomer ? queueIndex * 18 : 0;

    customerNode.dataset.queueIndex = isCounterCustomer ? String(queueIndex) : "";
    customerNode.style.setProperty("--queue-x", `${queueOffset * -1}px`);
    customerNode.style.setProperty("--queue-y", `${queueOffset}px`);
    customerNode.style.zIndex = isCounterCustomer ? String(30 - queueIndex) : "";
  },

  getCustomerClassName(customer) {
    return [
      "customer-npc",
      `customer-type-${customer.typeId}`,
      `customer-status-${customer.status}`,
      `customer-mood-${customer.mood}`,
      `customer-zone-${customer.currentZone}`
    ].join(" ");
  },

  getCustomerDisplayText(customer) {
    const typeLabels = {
      normal: "일반",
      student: "학생",
      office_worker: "회사",
      hurried: "급함",
      difficult: "진상"
    };

    return typeLabels[customer.typeId] ?? "손님";
  },

  render() {
    this.renderInventorySummary();
    this.renderStaffSummary();
    this.renderProductCards();
    this.renderExpansionZones();
    this.renderControlButtons();
    this.renderPlayer();
    this.renderDeliveryBox(this.orderDeliveredData);
    document.getElementById("day-info").textContent = `Day ${GameState.day}`;
    document.getElementById("money-info").textContent = `₩${GameState.money.toLocaleString()}`;
    document.getElementById("satisfaction-info").textContent = `만족도 ${GameState.satisfaction}`;
    document.getElementById("mental-info").textContent = `멘탈 ${GameState.mental}`;
  },

  createStaffSummary() {
    const existingSummary = document.getElementById("staff-summary");

    if (existingSummary) {
      this.staffSummary = existingSummary;
      return existingSummary;
    }

    const topUi = document.getElementById("top-ui");
    const inventorySummary = document.getElementById("inventory-summary");
    const statusPanel = document.getElementById("status-panel");

    if (!topUi || !statusPanel) {
      return null;
    }

    const staffSummary = document.createElement("section");
    staffSummary.id = "staff-summary";
    staffSummary.className = "staff-summary";
    staffSummary.hidden = true;
    staffSummary.setAttribute("aria-live", "polite");
    staffSummary.innerHTML = `
      <div class="staff-summary-header">
        <strong>알바 근무 현황</strong>
        <span id="staff-summary-status">미고용</span>
      </div>
      <div id="staff-summary-body" class="staff-summary-body"></div>
    `;

    if (inventorySummary) {
      inventorySummary.insertAdjacentElement("afterend", staffSummary);
    } else {
      statusPanel.insertAdjacentElement("afterend", staffSummary);
    }

    this.staffSummary = staffSummary;

    return staffSummary;
  },

  renderStaffSummary(staffState = GameState.staff) {
    this.createStaffSummary();

    const summary = this.staffSummary;
    const status = document.getElementById("staff-summary-status");
    const body = document.getElementById("staff-summary-body");
    const hired = staffState?.hired ?? null;

    if (!summary || !status || !body) {
      return;
    }

    if (!hired) {
      summary.hidden = true;
      status.textContent = "미고용";
      body.innerHTML = "";
      return;
    }

    const expectedDailyWage = Number(hired.expectedDailyWage) ||
      (Number(hired.hourlyWage) || 0) * (Number(hired.shiftHours) || 3);
    const todayCheckoutCount = Math.max(
      0,
      Number(staffState?.todayCheckoutCount) || 0
    );

    summary.hidden = false;
    status.textContent = `${hired.name} 근무 중`;
    body.innerHTML = `
      <span>${hired.type}</span>
      <span>자동 계산 보조 중</span>
      <span>오늘 알바 계산 ${todayCheckoutCount}건</span>
      <span>시급 ₩${Number(hired.hourlyWage).toLocaleString("ko-KR")}</span>
      <span>예상 일급 ₩${expectedDailyWage.toLocaleString("ko-KR")}</span>
      <span>근태 ${hired.attendance}%</span>
      <span>${hired.ability}</span>
    `;
  },

  createInventorySummary() {
    const existingSummary = document.getElementById("inventory-summary");

    if (existingSummary) {
      this.inventorySummary = existingSummary;
      return existingSummary;
    }

    const topUi = document.getElementById("top-ui");
    const statusPanel = document.getElementById("status-panel");

    if (!topUi || !statusPanel) {
      return null;
    }

    const inventorySummary = document.createElement("section");
    inventorySummary.id = "inventory-summary";
    inventorySummary.setAttribute("aria-labelledby", "inventory-summary-title");
    inventorySummary.innerHTML = `
      <div class="inventory-summary-header">
        <strong id="inventory-summary-title">재고 현황</strong>
        <span id="inventory-summary-total">판매 가능 0개 / 전체 0개</span>
      </div>
      <div id="inventory-summary-list" class="inventory-summary-list"></div>
    `;

    statusPanel.insertAdjacentElement("afterend", inventorySummary);
    this.inventorySummary = inventorySummary;

    return inventorySummary;
  },

  renderInventorySummary() {
    this.createInventorySummary();

    const totalNode = document.getElementById("inventory-summary-total");
    const listNode = document.getElementById("inventory-summary-list");

    if (!totalNode || !listNode) {
      return;
    }

    const snapshot = this.inventorySnapshot ?? {};
    const items = Array.isArray(snapshot.items)
      ? snapshot.items
      : PRODUCTS.map((product) => {
          const inventoryItem = this.inventoryByProductId[product.id];

          return {
            productId: product.id,
            productName: product.name,
            unlockDay: product.unlockDay,
            isUnlocked: product.unlockDay <= GameState.day,
            quantity: Number(inventoryItem?.quantity) || 0
          };
        });
    const unlockedItems = items.filter((item) => {
      return item.isUnlocked || item.unlockDay <= GameState.day;
    });
    const totalQuantity = Number.isFinite(Number(snapshot.totalQuantity))
      ? Number(snapshot.totalQuantity)
      : unlockedItems.reduce((total, item) => {
          return total + (Number(item.quantity) || 0);
        }, 0);
    const sellableQuantity = Number.isFinite(
      Number(snapshot.sellableStockQuantityForCurrentDayRequests)
    )
      ? Number(snapshot.sellableStockQuantityForCurrentDayRequests)
      : totalQuantity;

    totalNode.textContent =
      `판매 가능 ${sellableQuantity.toLocaleString("ko-KR")}개 / 전체 ${totalQuantity.toLocaleString("ko-KR")}개`;

    if (unlockedItems.length === 0) {
      listNode.innerHTML = `<span class="inventory-summary-empty">해금된 상품이 없습니다.</span>`;
      return;
    }

    listNode.innerHTML = unlockedItems.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const stockClass = quantity <= 0
        ? " is-out"
        : quantity <= 2
          ? " is-low"
          : "";

      return `
        <span class="inventory-stock-chip${stockClass}" title="${item.productName} 재고 ${quantity}개">
          <span class="inventory-stock-name">${item.productName}</span>
          <strong>${quantity}개</strong>
        </span>
      `;
    }).join("");
  },

  renderControlButtons() {
    const startDayButton = document.getElementById("start-day-button");
    const openStoreButton = document.getElementById("open-store-button");
    const endDayButton = document.getElementById("end-day-button");

    if (startDayButton) {
      startDayButton.disabled = [
        GAME_PHASE.ORDER,
        GAME_PHASE.DAY_START,
        GAME_PHASE.STORE_RUNNING,
        GAME_PHASE.DAY_END,
        GAME_PHASE.RESULT,
        GAME_PHASE.UPGRADE
      ].includes(GameState.phase);
    }

    if (openStoreButton) {
      openStoreButton.disabled = GameState.phase !== GAME_PHASE.DAY_START;
    }

    if (endDayButton) {
      endDayButton.disabled = GameState.phase !== GAME_PHASE.STORE_RUNNING;
    }
  },

  createExpansionPanel() {
    this.createExpansionEffectSummary();

    const existingPanel = document.getElementById("expansion-panel");

    if (existingPanel) {
      this.expansionPanel = existingPanel;
      return;
    }

    const gameScreen = document.getElementById("game-screen");
    const messagePanel = document.getElementById("message-panel");

    if (!gameScreen) return;

    const expansionPanel = document.createElement("section");

    expansionPanel.id = "expansion-panel";
    expansionPanel.setAttribute("aria-labelledby", "expansion-panel-title");
    expansionPanel.innerHTML = `
      <div class="expansion-panel-header">
        <h2 id="expansion-panel-title">매장 확장</h2>
        <span id="expansion-unlock-summary"></span>
      </div>
      <div class="expansion-carousel-controls">
        <button id="expansion-carousel-prev" class="expansion-carousel-button" type="button" aria-label="이전 확장 카드">←</button>
        <span id="expansion-carousel-position">1 / 1</span>
        <button id="expansion-carousel-next" class="expansion-carousel-button" type="button" aria-label="다음 확장 카드">→</button>
      </div>
      <div id="expansion-zone-grid" class="expansion-zone-grid"></div>
      <p id="expansion-message">먼지 낀 옆 구역을 눌러 확장 조건을 확인하세요.</p>
    `;

    if (messagePanel?.parentElement === gameScreen) {
      gameScreen.insertBefore(expansionPanel, messagePanel);
    } else {
      gameScreen.appendChild(expansionPanel);
    }

    this.expansionPanel = expansionPanel;
  },

  createExpansionEffectSummary() {
    const statusPanel = document.getElementById("status-panel");

    if (!statusPanel) return null;

    let effectSummary = document.getElementById("expansion-effect-summary");

    if (!effectSummary) {
      effectSummary = document.createElement("div");
      effectSummary.id = "expansion-effect-summary";
    }

    effectSummary.className = "expansion-effect-summary";
    const inventorySummary = document.getElementById("inventory-summary");

    if (inventorySummary) {
      inventorySummary.insertAdjacentElement("afterend", effectSummary);
    } else {
      statusPanel.insertAdjacentElement("afterend", effectSummary);
    }

    return effectSummary;
  },

  createStoreComposition() {
    const gameScreen = document.getElementById("game-screen");
    const storeArea = document.getElementById("store-area");

    if (!gameScreen || !storeArea) return null;

    let composition = document.getElementById("store-composition");

    if (!composition) {
      composition = document.createElement("section");
      composition.id = "store-composition";
      composition.setAttribute("aria-labelledby", "store-composition-title");
      composition.innerHTML = `
        <div class="store-composition-header">
          <h2 id="store-composition-title">매장 구성</h2>
        </div>
        <div class="store-composition-layout">
          <div class="base-store-map"></div>
          <div class="store-expansion-side">
            <div
              id="store-expansion-tiles"
              class="store-expansion-tiles"
              aria-label="확장 구역"
            ></div>
            <aside
              id="store-expansion-popover"
              class="store-expansion-popover expansion-condition-popover hidden"
              aria-live="polite"
            ></aside>
          </div>
        </div>
      `;

      if (storeArea.parentElement === gameScreen) {
        gameScreen.insertBefore(composition, storeArea);
      } else {
        const messagePanel = document.getElementById("message-panel");

        if (messagePanel?.parentElement === gameScreen) {
          gameScreen.insertBefore(composition, messagePanel);
        } else {
          gameScreen.appendChild(composition);
        }
      }
    }

    const baseStoreMap = composition.querySelector(".base-store-map");

    if (baseStoreMap && storeArea.parentElement !== baseStoreMap) {
      baseStoreMap.appendChild(storeArea);
    }

    return composition;
  },

  renderExpansionZones(expansionState = this.expansionState) {
    this.createExpansionPanel();

    if (expansionState) {
      this.expansionState = expansionState;
    }

    const zoneGrid = document.getElementById("expansion-zone-grid");
    const unlockSummary = document.getElementById("expansion-unlock-summary");
    const zoneStates = this.getExpansionZoneViewModels(this.expansionState);

    this.renderStoreExpansionZones(zoneStates);

    if (!zoneGrid) return;

    const unlockedCount = zoneStates.filter((zone) => zone.isUnlocked).length;
    const carouselIndex = this.getSafeExpansionCarouselIndex(zoneStates);
    const visibleZone = zoneStates[carouselIndex];

    if (unlockSummary) {
      unlockSummary.textContent = `${unlockedCount} / ${zoneStates.length}`;
    }

    this.renderExpansionEffects(this.getExpansionEffectsViewModel(zoneStates));
    this.renderExpansionCarouselControls(zoneStates, carouselIndex);

    zoneGrid.innerHTML = (visibleZone ? [visibleZone] : []).map((zone) => {
      const statusLabel = this.getExpansionStatusLabel(zone.status);
      const costText = zone.unlockCost > 0
        ? `₩${zone.unlockCost.toLocaleString()}`
        : "기본 구역";
      const actionText = zone.isUnlocked
        ? "완료"
        : zone.isAvailable
          ? "확장"
          : "조건 부족";

      return `
        <article
          class="expansion-zone-tile expansion-zone-${zone.status}"
          data-zone-id="${zone.id}"
          tabindex="${zone.isUnlocked ? "-1" : "0"}"
        >
          <div class="expansion-zone-fog" aria-hidden="true"></div>

          <div class="expansion-zone-content">
            <div class="expansion-zone-topline">
              <span class="expansion-zone-status">${statusLabel}</span>
              <span class="expansion-zone-cost">${costText}</span>
            </div>

            <h3>${zone.name}</h3>
            <p>${zone.description}</p>

            <dl class="expansion-zone-conditions">
              <div class="${zone.conditions.hasRequiredDay ? "is-met" : "is-missing"}">
                <dt>필요 Day</dt>
                <dd>${zone.requiredDay}</dd>
              </div>
              <div class="${zone.conditions.hasEnoughMoney ? "is-met" : "is-missing"}">
                <dt>확장 비용</dt>
                <dd>${costText}</dd>
              </div>
              <div class="${zone.conditions.previousUnlocked ? "is-met" : "is-missing"}">
                <dt>이전 구역</dt>
                <dd>${zone.previousZoneName}</dd>
              </div>
            </dl>

            <button
              class="expansion-action-button"
              type="button"
              data-zone-id="${zone.id}"
              ${zone.isAvailable ? "" : "disabled"}
            >
              ${actionText}
            </button>
          </div>
        </article>
      `;
    }).join("");

    this.bindExpansionZoneEvents(zoneStates);
    this.bindExpansionCarouselControls(zoneStates);
  },

  renderStoreExpansionZones(zoneStates = []) {
    this.createStoreComposition();

    const tilesNode = document.getElementById("store-expansion-tiles");

    if (!tilesNode) return;

    const displayNames = {
      zone_extra_shelf: "Lv.2 추가 진열 구역",
      zone_cold_food: "Lv.3 냉장·도시락 구역",
      zone_premium_store: "Lv.4 프리미엄 매장 구역"
    };
    const objectLabels = {
      zone_extra_shelf: "추가 진열대",
      zone_cold_food: "냉장 상품 구역",
      zone_premium_store: "프리미엄 매장 구역"
    };
    const visualZones = zoneStates.filter((zone) => zone.level > 1);
    const selectedZoneExists = visualZones.some((zone) => {
      return zone.id === this.selectedExpansionZoneId;
    });

    if (!selectedZoneExists) {
      this.selectedExpansionZoneId = visualZones[0]?.id ?? null;
    }

    tilesNode.innerHTML = visualZones.map((zone) => {
      const displayName = displayNames[zone.id] ?? zone.name;
      const objectLabel = objectLabels[zone.id] ?? "추가 진열 구역";
      const statusText = this.getStoreExpansionStatusText(zone);
      const selectedClass =
        this.isStoreExpansionPopoverVisible && zone.id === this.selectedExpansionZoneId
          ? " is-selected"
          : "";

      return `
        <button
          class="store-expansion-tile store-expansion-${zone.status}${selectedClass}"
          type="button"
          data-zone-id="${zone.id}"
          data-zone-level="${zone.level}"
          aria-label="${displayName} ${statusText}"
          aria-expanded="${this.isStoreExpansionPopoverVisible && zone.id === this.selectedExpansionZoneId ? "true" : "false"}"
        >
          <span class="store-expansion-tile-icon" aria-hidden="true">
            ${zone.isUnlocked ? "✓" : "🔒"}
          </span>
          <strong>${displayName}</strong>
          <span class="store-expansion-tile-status">${statusText}</span>
          <span class="store-expansion-tile-object">
            ${zone.isUnlocked ? objectLabel : "박스더미"}
          </span>
          <span class="store-expansion-tile-hint">
            ${zone.isUnlocked ? "추가 공간 사용 중" : "확장 조건 보기"}
          </span>
        </button>
      `;
    }).join("");

    const zonesById = visualZones.reduce((zoneMap, zone) => {
      zoneMap[zone.id] = zone;
      return zoneMap;
    }, {});

    tilesNode.querySelectorAll(".store-expansion-tile").forEach((zoneNode) => {
      zoneNode.onclick = () => {
        const zone = zonesById[zoneNode.dataset.zoneId];

        if (!zone) return;

        const isSameVisibleZone =
          this.isStoreExpansionPopoverVisible &&
          this.selectedExpansionZoneId === zone.id;

        if (isSameVisibleZone) {
          this.closeStoreExpansionPopover();
          return;
        }

        this.selectedExpansionZoneId = zone.id;
        this.isStoreExpansionPopoverVisible = true;
        this.showMessage(
          zone.isUnlocked
            ? "확장 완료된 구역입니다."
            : "아직 확장되지 않은 구역입니다."
        );
        this.renderStoreExpansionZones(zoneStates);
      };
    });

    this.renderStoreExpansionPopover(zonesById[this.selectedExpansionZoneId]);
  },

  closeStoreExpansionPopover() {
    const popover = document.getElementById("store-expansion-popover");

    this.isStoreExpansionPopoverVisible = false;

    if (popover) {
      popover.classList.add("hidden");
      popover.classList.remove("is-visible");
      popover.removeAttribute("data-active-level");
      popover.innerHTML = "";
    }

    document.querySelectorAll(".store-expansion-tile.is-selected").forEach((tile) => {
      tile.classList.remove("is-selected");
    });
  },

  renderStoreExpansionPopover(zone) {
    const popover = document.getElementById("store-expansion-popover");

    if (!popover) return;

    if (!this.isStoreExpansionPopoverVisible || !zone) {
      popover.classList.add("hidden");
      popover.classList.remove("is-visible");
      popover.removeAttribute("data-active-level");
      popover.innerHTML = "";
      return;
    }

    const costText = zone.unlockCost > 0
      ? `₩${zone.unlockCost.toLocaleString()}`
      : "기본 구역";
    const statusText = this.getStoreExpansionStatusText(zone);
    const actionText = zone.isUnlocked
      ? "확장 완료"
      : zone.isAvailable
        ? "확장하기"
        : "조건 부족";

    popover.classList.remove("hidden");
    popover.classList.add("is-visible");
    popover.dataset.activeLevel = String(zone.level);
    popover.innerHTML = `
      <div class="store-expansion-popover-header">
        <div class="store-expansion-popover-title">
          <span>확장 조건</span>
          <strong>${zone.name}</strong>
        </div>
        <button
          class="store-expansion-popover-close"
          type="button"
          aria-label="확장 조건 닫기"
        >×</button>
      </div>
      <p class="store-expansion-popover-message">
        ${zone.isUnlocked ? "확장 완료된 구역입니다." : "아직 확장되지 않은 구역입니다."}
      </p>
      <dl class="store-expansion-condition-list">
        <div class="${zone.conditions.hasRequiredDay ? "is-met" : "is-missing"}">
          <dt>필요 Day</dt>
          <dd>${zone.requiredDay}</dd>
        </div>
        <div class="${zone.conditions.hasEnoughMoney ? "is-met" : "is-missing"}">
          <dt>확장 비용</dt>
          <dd>${costText}</dd>
        </div>
        <div class="${zone.conditions.previousUnlocked ? "is-met" : "is-missing"}">
          <dt>이전 구역</dt>
          <dd>${zone.previousZoneName}</dd>
        </div>
        <div>
          <dt>현재 상태</dt>
          <dd>${statusText}</dd>
        </div>
      </dl>
      <button
        class="store-expansion-popover-action"
        type="button"
        data-zone-id="${zone.id}"
        ${zone.isAvailable ? "" : "disabled"}
      >
        ${actionText}
      </button>
    `;

    const closeButton = popover.querySelector(".store-expansion-popover-close");
    const actionButton = popover.querySelector(".store-expansion-popover-action");

    if (closeButton) {
      closeButton.onclick = (event) => {
        event.stopPropagation();
        this.closeStoreExpansionPopover();
      };
    }

    if (!actionButton) return;

    actionButton.onclick = (event) => {
      event.stopPropagation();

      if (actionButton.disabled) return;

      EventBus.emit(EVENTS.EXPANSION_REQUESTED, {
        day: GameState.day,
        zoneId: actionButton.dataset.zoneId
      });
    };

    this.positionStoreExpansionPopover(zone.id);
  },

  positionStoreExpansionPopover(zoneId) {
    const popover = document.getElementById("store-expansion-popover");
    const side = document.querySelector(".store-expansion-side");
    const tile = document.querySelector(`.store-expansion-tile[data-zone-id="${zoneId}"]`);

    if (!popover || !side || !tile) {
      return;
    }

    if (window.matchMedia("(max-width: 760px)").matches) {
      popover.style.left = "";
      popover.style.top = "";
      popover.style.width = "";
      popover.style.removeProperty("--popover-arrow-left");
      return;
    }

    const popoverWidth = 220;
    const sideWidth = side.clientWidth || popoverWidth;
    const tileCenter = tile.offsetLeft + tile.clientWidth / 2;
    const preferredLeft = Math.round(tileCenter - popoverWidth / 2);
    const safeLeft = Math.min(
      Math.max(preferredLeft, 0),
      Math.max(sideWidth - popoverWidth, 0)
    );

    const hintNode = tile.querySelector(".store-expansion-tile-hint");
    const hintBottom = hintNode
      ? hintNode.offsetTop + hintNode.offsetHeight
      : Math.round(tile.clientHeight * 0.48);

    const popoverTop = Math.min(
      hintBottom + 12,
      Math.max(tile.clientHeight - 250, 120)
    );
    const arrowLeft = Math.round(tileCenter - safeLeft);

    popover.style.left = `${safeLeft}px`;
    popover.style.top = `${tile.offsetTop + popoverTop}px`;
    popover.style.width = `${popoverWidth}px`;
    popover.style.setProperty("--popover-arrow-left", `${arrowLeft}px`);
  },

  getStoreExpansionStatusText(zone) {
    if (zone.isUnlocked) {
      return "확장 완료";
    }

    if (zone.isAvailable) {
      return "미확장";
    }

    return "조건 부족";
  },

  getSafeExpansionCarouselIndex(zoneStates = []) {
    const lastIndex = Math.max(0, zoneStates.length - 1);

    this.expansionCarouselIndex = Math.min(
      Math.max(0, this.expansionCarouselIndex),
      lastIndex
    );

    return this.expansionCarouselIndex;
  },

  renderExpansionCarouselControls(zoneStates = [], carouselIndex = 0) {
    const prevButton = document.getElementById("expansion-carousel-prev");
    const nextButton = document.getElementById("expansion-carousel-next");
    const position = document.getElementById("expansion-carousel-position");
    const totalCount = zoneStates.length;

    if (position) {
      position.textContent = `${totalCount > 0 ? carouselIndex + 1 : 0} / ${totalCount}`;
    }

    if (prevButton) {
      prevButton.disabled = carouselIndex <= 0;
    }

    if (nextButton) {
      nextButton.disabled = totalCount === 0 || carouselIndex >= totalCount - 1;
    }
  },

  bindExpansionCarouselControls(zoneStates = []) {
    const prevButton = document.getElementById("expansion-carousel-prev");
    const nextButton = document.getElementById("expansion-carousel-next");
    const lastIndex = Math.max(0, zoneStates.length - 1);

    if (prevButton) {
      prevButton.onclick = () => {
        if (prevButton.disabled) return;

        this.expansionCarouselIndex = Math.max(0, this.expansionCarouselIndex - 1);
        this.renderExpansionZones(this.expansionState);
      };
    }

    if (nextButton) {
      nextButton.onclick = () => {
        if (nextButton.disabled) return;

        this.expansionCarouselIndex = Math.min(lastIndex, this.expansionCarouselIndex + 1);
        this.renderExpansionZones(this.expansionState);
      };
    }
  },

  getExpansionZoneViewModels(expansionState = null) {
    const stateUnlockedZoneIds = expansionState?.unlockedZoneIds;
    const unlockedZoneIds = new Set(
      Array.isArray(stateUnlockedZoneIds)
        ? stateUnlockedZoneIds
        : EXPANSION_ZONES
            .filter((zone) => zone.defaultUnlocked)
            .map((zone) => zone.id)
    );

    return EXPANSION_ZONES.map((zone) => {
      const previousZone = getPreviousExpansionZone(zone);
      const previousUnlocked =
        !previousZone || unlockedZoneIds.has(previousZone.id);
      const hasEnoughMoney = GameState.money >= zone.unlockCost;
      const hasRequiredDay = GameState.day >= zone.requiredDay;
      const isUnlocked = unlockedZoneIds.has(zone.id);
      const isAvailable =
        !isUnlocked && previousUnlocked && hasEnoughMoney && hasRequiredDay;
      const status = isUnlocked
        ? "unlocked"
        : isAvailable
          ? "available"
          : "locked";

      return {
        ...zone,
        status,
        isUnlocked,
        isAvailable,
        previousZoneName: previousZone?.name ?? "없음",
        missingRequirements: this.getExpansionMissingRequirements(zone, {
          previousZone,
          previousUnlocked,
          hasEnoughMoney,
          hasRequiredDay
        }),
        conditions: {
          previousUnlocked,
          hasEnoughMoney,
          hasRequiredDay
        }
      };
    });
  },

  getExpansionEffectsViewModel(zoneStates = []) {
    const stateEffects = this.expansionState?.effects;

    if (stateEffects) {
      return {
        customerSpawnRateBonus:
          Number(stateEffects.customerSpawnRateBonus) || 0,
        targetRevenueBonus:
          Number(stateEffects.targetRevenueBonus) || 0,
        storeSizeBonus:
          Number(stateEffects.storeSizeBonus) || 0
      };
    }

    return zoneStates
      .filter((zone) => zone.isUnlocked)
      .reduce((totalEffects, zone) => {
        const effects = zone.effects ?? {};

        return {
          customerSpawnRateBonus:
            totalEffects.customerSpawnRateBonus +
            (Number(effects.customerSpawnRateBonus) || 0),
          targetRevenueBonus:
            totalEffects.targetRevenueBonus +
            (Number(effects.targetRevenueBonus) || 0),
          storeSizeBonus:
            totalEffects.storeSizeBonus +
            (Number(effects.storeSizeBonus) || 0)
        };
      }, {
        customerSpawnRateBonus: 0,
        targetRevenueBonus: 0,
        storeSizeBonus: 0
      });
  },

  renderExpansionEffects(effects) {
    this.createExpansionEffectSummary();

    const effectSummary = document.getElementById("expansion-effect-summary");

    if (!effectSummary) return;

    const customerBonusPercent = Math.round(
      effects.customerSpawnRateBonus * 100
    );

    effectSummary.innerHTML = `
      <strong>현재 매장 효과</strong>
      <div class="expansion-effect-list">
        <span class="expansion-effect-item">
          손님 방문 +${customerBonusPercent}%
        </span>
        <span class="expansion-effect-item">
          목표 매출 +₩${effects.targetRevenueBonus.toLocaleString()}
        </span>
        <span class="expansion-effect-item">
          매장 규모 Lv.${effects.storeSizeBonus}
        </span>
      </div>
    `;
  },

  getExpansionMissingRequirements(zone, conditions) {
    const missingRequirements = [];

    if (!conditions.previousUnlocked && conditions.previousZone) {
      missingRequirements.push(`${conditions.previousZone.name} 확장 필요`);
    }

    if (!conditions.hasRequiredDay) {
      missingRequirements.push(`Day ${zone.requiredDay} 필요`);
    }

    if (!conditions.hasEnoughMoney) {
      missingRequirements.push(`₩${zone.unlockCost.toLocaleString()} 필요`);
    }

    return missingRequirements;
  },

  getExpansionStatusLabel(status) {
    const statusLabels = {
      unlocked: "확장 완료",
      available: "확장 가능",
      locked: "미확장"
    };

    return statusLabels[status] ?? "미확장";
  },

  bindExpansionZoneEvents(zoneStates = []) {
    const zonesById = zoneStates.reduce((zoneMap, zone) => {
      zoneMap[zone.id] = zone;
      return zoneMap;
    }, {});

    document.querySelectorAll(".expansion-zone-tile").forEach((tile) => {
      const showGuide = () => {
        const zone = zonesById[tile.dataset.zoneId];

        if (!zone) return;

        if (zone.status === "locked") {
          EventBus.emit(EVENTS.EXPANSION_REQUESTED, {
            day: GameState.day,
            zoneId: zone.id
          });
          return;
        }

        this.showExpansionMessage(this.getExpansionGuideMessage(zone));
      };

      tile.onclick = (event) => {
        if (event.target.closest?.(".expansion-action-button")) return;

        showGuide();
      };

      tile.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        showGuide();
      };
    });

    document.querySelectorAll(".expansion-action-button").forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();

        if (button.disabled) return;

        EventBus.emit(EVENTS.EXPANSION_REQUESTED, {
          day: GameState.day,
          zoneId: button.dataset.zoneId
        });
      };
    });
  },

  getExpansionGuideMessage(zone) {
    if (zone.isUnlocked) {
      return `${zone.name}은 이미 밝게 정리된 구역입니다.`;
    }

    if (zone.isAvailable) {
      return `${zone.name} 확장 가능! 버튼을 누르면 ₩${zone.unlockCost.toLocaleString()}이 차감됩니다.`;
    }

    return `${zone.name} 확장 조건: ${zone.missingRequirements.join(" / ")}`;
  },

  showExpansionMessage(message) {
    this.createExpansionPanel();

    const messageNode = document.getElementById("expansion-message");

    if (!messageNode) return;

    messageNode.textContent = message;
  },

  createProductPanel() {
    const existingPanel = document.getElementById("product-panel");

    if (existingPanel) {
      this.productPanel = existingPanel;
      return;
    }

    const gameScreen = document.getElementById("game-screen");
    const messagePanel = document.getElementById("message-panel");

    if (!gameScreen) return;

    const productPanel = document.createElement("section");

    productPanel.id = "product-panel";
    productPanel.setAttribute("aria-labelledby", "product-panel-title");
    productPanel.innerHTML = `
      <div class="product-panel-header">
        <h2 id="product-panel-title">상품 진열대</h2>
        <span id="product-unlock-summary"></span>
      </div>
      <div id="product-card-grid" class="product-card-grid"></div>
    `;

    if (messagePanel) {
      gameScreen.insertBefore(productPanel, messagePanel);
    } else {
      gameScreen.appendChild(productPanel);
    }

    this.productPanel = productPanel;
  },

  renderProductCards() {
    const productGrid = document.getElementById("product-card-grid");
    const unlockSummary = document.getElementById("product-unlock-summary");

    if (!productGrid) return;

    const unlockedCount = PRODUCTS.filter((product) => {
      return product.unlockDay <= GameState.day;
    }).length;

    if (unlockSummary) {
      unlockSummary.textContent = `${unlockedCount} / ${PRODUCTS.length}`;
    }

    const orderItems = PRODUCTS.map((product) => {
      return {
        productId: product.id,
        productName: product.name,
        isUnlocked: product.unlockDay <= GameState.day
      };
    });

    productGrid.innerHTML = PRODUCTS.map((product) => {
      const inventoryItem = this.inventoryByProductId[product.id];
      const isLocked = product.unlockDay > GameState.day;
      const quantity = inventoryItem?.quantity;
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
      const stockText = Number.isFinite(quantity) ? `${quantity}개` : "-";
      const nextExpireDay = inventoryItem?.nextExpireDay;
      const expireText = Number.isFinite(nextExpireDay)
        ? `Day ${nextExpireDay}`
        : "-";
      const stockStatusClass = !isLocked && safeQuantity <= 0
        ? " is-out-of-stock"
        : !isLocked && safeQuantity <= 2
          ? " is-low-stock"
          : "";

      return `
        <article
          class="product-card${isLocked ? " is-locked" : ""}${stockStatusClass}"
          data-product-id="${product.id}"
        >
          <div class="product-image-wrap">
            <img
              class="product-image"
              src="${product.imagePath}"
              alt="${product.name}"
              loading="lazy"
              decoding="async"
            />
            ${
              isLocked
                ? `<span class="product-lock-badge">Day ${product.unlockDay} 해금</span>`
                : safeQuantity <= 0
                  ? `<span class="product-lock-badge product-stock-badge">재고 없음</span>`
                : ""
            }
          </div>

          <div class="product-card-content">
            <span class="product-category">
              ${this.getProductCategoryLabel(product.category)}
            </span>
            <h3>${product.name}</h3>

            <dl class="product-card-stats">
              <div>
                <dt>판매가</dt>
                <dd>₩${product.salePrice.toLocaleString()}</dd>
              </div>
              <div>
                <dt>재고</dt>
                <dd>${stockText}</dd>
              </div>
              <div>
                <dt>다음 폐기</dt>
                <dd>${expireText}</dd>
              </div>
            </dl>

            <button
              class="product-order-button"
              type="button"
              data-product-id="${product.id}"
              ${isLocked ? "disabled" : ""}
            >
              발주
            </button>
          </div>
        </article>
      `;
    }).join("");

    this.bindProductOrderButtons(orderItems);
  },

  bindProductOrderButtons(items = []) {
    const productsById = items.reduce((productMap, product) => {
      productMap[product.productId] = product;
      return productMap;
    }, {});

    document.querySelectorAll(".product-order-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;

        const productId = button.dataset.productId;
        const product = productsById[productId];

        if (!product) return;

        this.emitOrderRequest(product);
      };
    });
  },

  emitOrderRequest(product, quantity = 1) {
    EventBus.emit(EVENTS.ORDER_BUTTON_CLICKED, {
      day: GameState.day,
      productId: product.productId,
      productName: product.productName
    });

    EventBus.emit(EVENTS.ORDER_REQUESTED, {
      day: GameState.day,
      productId: product.productId,
      productName: product.productName,
      quantity
    });
  },

  getProductCategoryLabel(category) {
    const categoryLabels = {
      snack: "과자",
      drink: "음료",
      ready_meal: "즉석식품",
      instant_food: "간편식",
      fresh_food: "신선식품"
    };

    return categoryLabels[category] ?? "상품";
  },

  showMessage(message) {
    document.getElementById("system-message").textContent = message;
  },

  showResult(resultData) {
    this.showMessage(
      `정산 완료 | ${resultData.resultSummaryText ?? "오늘 영업 결과를 확인하세요."}`
    );
  },

  showUpgradeOptions(upgrades) {
    console.log("업그레이드 목록:", upgrades);
  },

  createDayScenarioModal() {
    if (document.getElementById("day-scenario-modal")) {
      this.dayScenarioModal = document.getElementById("day-scenario-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "day-scenario-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content day-scenario-modal-content">
        <p class="day-scenario-kicker">오늘의 영업 브리핑</p>
        <h2 id="day-scenario-title" class="day-scenario-title"></h2>
        <p id="day-scenario-subtitle" class="day-scenario-subtitle"></p>

        <div class="day-scenario-goal-box" aria-label="오늘의 목표">
          <div>
            <span>목표 매출</span>
            <strong id="day-scenario-target-revenue"></strong>
          </div>
          <div>
            <span>목표 만족도</span>
            <strong id="day-scenario-target-satisfaction"></strong>
          </div>
        </div>

        <section class="day-scenario-market-box" aria-label="오늘의 상권 정보">
          <div class="day-scenario-market-header">
            <span id="day-scenario-weather" class="day-scenario-weather"></span>
            <strong id="day-scenario-market-headline"></strong>
          </div>
          <p id="day-scenario-market-message"></p>
          <div class="day-scenario-recommend-box">
            <span>추천 발주 상품</span>
            <ul id="day-scenario-recommend-list"></ul>
          </div>
        </section>

        <p id="day-scenario-story" class="day-scenario-story"></p>
        <ul id="day-scenario-features" class="day-scenario-features"></ul>
        <p id="day-scenario-tip" class="day-scenario-tip"></p>
        <button id="day-scenario-confirm-button" class="day-scenario-confirm-button" type="button">
          발주하러 가기
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.dayScenarioModal = modal;
  },

  showDayScenarioModal(scenarioData = {}) {
    if (!this.dayScenarioModal) {
      this.createDayScenarioModal();
    }

    const title = document.getElementById("day-scenario-title");
    const subtitle = document.getElementById("day-scenario-subtitle");
    const targetRevenue = document.getElementById("day-scenario-target-revenue");
    const targetSatisfaction = document.getElementById("day-scenario-target-satisfaction");
    const weather = document.getElementById("day-scenario-weather");
    const marketHeadline = document.getElementById("day-scenario-market-headline");
    const marketMessage = document.getElementById("day-scenario-market-message");
    const recommendList = document.getElementById("day-scenario-recommend-list");
    const story = document.getElementById("day-scenario-story");
    const features = document.getElementById("day-scenario-features");
    const tip = document.getElementById("day-scenario-tip");
    const confirmButton = document.getElementById("day-scenario-confirm-button");
    const featureItems = Array.isArray(scenarioData.features)
      ? scenarioData.features
      : [];
    const marketInfo = scenarioData.marketInfo ?? {};
    const recommendedProducts = this.getRecommendedProducts(scenarioData);

    title.textContent = scenarioData.title ?? `Day ${GameState.day}. 영업 시작`;
    subtitle.textContent = scenarioData.subtitle ?? "오늘의 편의점 운영을 준비합니다.";
    targetRevenue.textContent = `₩${GameState.dailyGoal.targetRevenue.toLocaleString()}`;
    targetSatisfaction.textContent = `${GameState.dailyGoal.targetSatisfaction}%`;
    weather.textContent = marketInfo.weatherLabel ?? "상권 정보";
    marketHeadline.textContent = marketInfo.headline ?? "오늘의 수요 정보를 확인하세요.";
    marketMessage.textContent = marketInfo.message ?? "추천 상품을 참고해서 발주 수량을 정해보세요.";
    story.textContent = scenarioData.story ?? "발주와 재고 정리를 마친 뒤 편의점을 오픈하세요.";
    tip.textContent = scenarioData.tip ?? "보유금과 재고를 확인하고 발주 수량을 정하세요.";
    confirmButton.textContent = scenarioData.ctaText ?? "발주하러 가기";

    recommendList.innerHTML = recommendedProducts.length > 0
      ? recommendedProducts.map((product) => {
          const reason = this.getRecommendedProductReason(scenarioData, product.id);

          return `
            <li>
              <strong>${product.name}</strong>
              <span>${reason}</span>
            </li>
          `;
        }).join("")
      : `<li><strong>추천 상품 미정</strong><span>내일 회의 후 상품 데이터가 확정되면 자동으로 표시됩니다.</span></li>`;

    features.innerHTML = featureItems.map((feature) => {
      return `<li>${feature}</li>`;
    }).join("");

    confirmButton.onclick = () => {
      this.hideDayScenarioModal();
      this.continueDayStartFlow();
    };

    this.dayScenarioModal.classList.remove("hidden");
  },

  hideDayScenarioModal() {
    if (!this.dayScenarioModal) return;

    this.dayScenarioModal.classList.add("hidden");
  },

  isDayScenarioModalVisible() {
    return (
      this.dayScenarioModal &&
      !this.dayScenarioModal.classList.contains("hidden")
    );
  },

  continueDayStartFlow() {
    if (this.shouldShowPendingStaffHireModal()) {
      this.showStaffHireModal(this.pendingStaffHireData);
      return;
    }

    if (this.pendingOrderPhaseData) {
      this.showOrderModal(this.pendingOrderPhaseData);
    }
  },

  shouldShowPendingStaffHireModal() {
    const staffData = this.pendingStaffHireData;

    return Boolean(
      staffData &&
      staffData.day === GameState.day &&
      !staffData.staff?.hired
    );
  },

  isStaffHireModalVisible() {
    return (
      this.staffHireModal &&
      !this.staffHireModal.classList.contains("hidden")
    );
  },

  getRecommendedProducts(scenarioData = this.pendingOrderPhaseData?.dayScenario ?? {}) {
    const recommendedIds = this.getRecommendedProductIdSet(scenarioData);

    return PRODUCTS.filter((product) => recommendedIds.has(product.id));
  },

  getRecommendedProductIdSet(scenarioData = this.pendingOrderPhaseData?.dayScenario ?? {}) {
    const recommendedProductIds = Array.isArray(scenarioData.recommendedProductIds)
      ? scenarioData.recommendedProductIds
      : [];
    const existingProductIds = new Set(PRODUCTS.map((product) => product.id));

    return new Set(
      recommendedProductIds.filter((productId) => {
        const product = PRODUCTS.find((item) => item.id === productId);

        return existingProductIds.has(productId) && product?.unlockDay <= GameState.day;
      })
    );
  },

  getRecommendedProductReason(scenarioData = {}, productId) {
    const reasons = scenarioData.recommendedProductReasons ?? {};

    return reasons[productId] ?? "오늘 상권에서 수요 증가 예상";
  },

  createStaffHireModal() {
    if (document.getElementById("staff-hire-modal")) {
      this.staffHireModal = document.getElementById("staff-hire-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "staff-hire-modal";
    modal.className = "modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "staff-hire-title");

    modal.innerHTML = `
      <div class="modal-content staff-hire-modal-content">
        <div class="staff-hire-header">
          <span class="staff-hire-kicker">Day 3 오픈</span>
          <h2 id="staff-hire-title">알바 고용 게시판</h2>
          <p>오늘부터 3시간 단기 알바를 고용할 수 있습니다. 이번 버전에서는 급여 차감과 능력치 효과는 적용하지 않습니다.</p>
        </div>
        <div id="staff-hire-list" class="staff-hire-list"></div>
        <button id="staff-hire-skip-button" class="staff-hire-skip-button" type="button">
          오늘은 넘기기
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.staffHireModal = modal;
  },

  showStaffHireModal(staffData = {}) {
    if (!this.staffHireModal) {
      this.createStaffHireModal();
    }

    const list = document.getElementById("staff-hire-list");
    const skipButton = document.getElementById("staff-hire-skip-button");
    const candidates = Array.isArray(staffData.candidates)
      ? staffData.candidates
      : [];
    const shiftHours = Number(staffData.shiftHours) || 3;

    if (!list || !skipButton) {
      return;
    }

    list.innerHTML = candidates.map((candidate) => {
      const hourlyWage = Number(candidate.hourlyWage) || 0;
      const expectedDailyWage = Number(candidate.expectedDailyWage) ||
        hourlyWage * shiftHours;

      return `
        <article class="staff-candidate-card" data-staff-id="${candidate.id}">
          <div class="staff-candidate-title">
            <strong>${candidate.name}</strong>
            <span>${candidate.type}</span>
          </div>
          <dl class="staff-candidate-stats">
            <div>
              <dt>시급</dt>
              <dd>₩${hourlyWage.toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt>예상 일급</dt>
              <dd>₩${expectedDailyWage.toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt>근태</dt>
              <dd>${candidate.attendance}%</dd>
            </div>
          </dl>
          <p class="staff-candidate-ability">${candidate.ability}</p>
          <button class="staff-hire-button" type="button" data-staff-id="${candidate.id}">
            고용하기
          </button>
        </article>
      `;
    }).join("");

    list.querySelectorAll(".staff-hire-button").forEach((button) => {
      button.onclick = () => {
        const candidateId = button.dataset.staffId;

        EventBus.emit(STAFF_EVENTS.HIRED, {
          day: GameState.day,
          candidateId
        });

        this.pendingStaffHireData = null;
        this.hideStaffHireModal();
        this.continueDayStartFlow();
      };
    });

    skipButton.onclick = () => {
      EventBus.emit(STAFF_EVENTS.HIRE_SKIPPED, {
        day: GameState.day
      });

      this.pendingStaffHireData = null;
      this.hideStaffHireModal();
      this.continueDayStartFlow();
    };

    this.staffHireModal.classList.remove("hidden");
  },

  hideStaffHireModal() {
    if (!this.staffHireModal) return;

    this.staffHireModal.classList.add("hidden");
  },

  createOrderModal() {
    if (document.getElementById("order-modal")) {
      this.orderModal = document.getElementById("order-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "order-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content order-modal-content">
        <div class="order-computer-frame">
          <div class="order-computer-topbar">
            <span>STORE-ORDER</span>
            <span id="order-modal-day-label">Day ${GameState.day}</span>
          </div>
          <div id="order-modal-body"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    this.orderModal = modal;
  },

  showOrderModal(orderData = {}) {
    if (!this.orderModal) {
      this.createOrderModal();
    }

    this.pendingOrderPhaseData = orderData;
    this.orderDeliveredData = null;
    this.orderModalMode = "draft";
    this.clearDeliveryBox();
    this.orderDraftQuantities = this.getOrderableProducts().reduce(
      (quantityMap, product) => {
        quantityMap[product.id] = 0;
        return quantityMap;
      },
      {}
    );

    const dayLabel = document.getElementById("order-modal-day-label");

    if (dayLabel) {
      dayLabel.textContent = `Day ${GameState.day}`;
    }

    this.renderOrderDraft();
    this.orderModal.classList.remove("hidden");

    EventBus.emit(EVENTS.ORDER_MODAL_OPENED, {
      day: GameState.day,
      productCount: this.getOrderableProducts().length
    });
  },

  renderOrderDraft(options = {}) {
    const body = document.getElementById("order-modal-body");
    const previousList = document.querySelector(".order-product-list");
    const previousScrollTop = options.preserveScroll
      ? previousList?.scrollTop ?? this.orderListScrollTop
      : 0;

    if (!body) return;

    const products = PRODUCTS;
    const orderableProducts = this.getOrderableProducts();
    const orderableProductIds = new Set(
      orderableProducts.map((product) => product.id)
    );
    const totalCost = this.getOrderTotalCost(orderableProducts);
    const isOverBudget = totalCost > GameState.money;
    const dayScenario = this.pendingOrderPhaseData?.dayScenario ?? {};
    const recommendedProductIds = this.getRecommendedProductIdSet(dayScenario);

    body.innerHTML = `
      <div class="order-modal-header">
        <h2>컴퓨터 발주</h2>
        <p>오늘 판매할 상품 수량을 정하고 발주를 확정하세요.</p>
        <p class="order-market-note">[오늘 추천] 배지가 붙은 상품은 오늘 상권 정보 기준으로 수요가 높을 수 있습니다.</p>
      </div>

      <div class="order-product-list">
        ${products.map((product) => {
          const inventoryItem = this.inventoryByProductId[product.id];
          const isOrderable = orderableProductIds.has(product.id);
          const quantity = isOrderable
            ? this.orderDraftQuantities[product.id] ?? 0
            : 0;
          const stockQuantity = Number.isFinite(inventoryItem?.quantity)
            ? inventoryItem.quantity
            : 0;
          const orderStatusText = isOrderable
            ? "발주 가능"
            : this.getOrderUnavailableReason(product);
          const isRecommended = recommendedProductIds.has(product.id);

          return `
            <article class="order-product-row${isOrderable ? "" : " is-order-unavailable"}${isRecommended ? " is-recommended" : ""}" data-product-id="${product.id}">
              <div class="order-product-main">
                <img
                  class="order-product-thumb"
                  src="${product.imagePath}"
                  alt="${product.name}"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <strong class="order-product-title">
                    ${product.name}
                    ${isRecommended ? `<span class="order-recommend-badge">오늘 추천</span>` : ""}
                  </strong>
                  <span>현재 재고 ${stockQuantity}개</span>
                  <em class="order-product-status">${orderStatusText}</em>
                </div>
              </div>
              <div class="order-product-prices">
                <span>매입 ₩${product.purchasePrice.toLocaleString()}</span>
                <span>판매 ₩${product.salePrice.toLocaleString()}</span>
              </div>
              <div class="order-quantity-controls">
                <button class="order-qty-button" type="button" data-action="decrease" data-product-id="${product.id}" ${isOrderable ? "" : "disabled"}>-</button>
                <strong>${quantity}</strong>
                <button class="order-qty-button" type="button" data-action="increase" data-product-id="${product.id}" ${isOrderable ? "" : "disabled"}>+</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>

      <div class="order-total-box">
        <div>
          <span>예상 발주 비용</span>
          <strong>₩${totalCost.toLocaleString()}</strong>
        </div>
        <div>
          <span>보유금</span>
          <strong>₩${GameState.money.toLocaleString()}</strong>
        </div>
      </div>

      <p class="order-budget-message${isOverBudget ? " is-warning" : ""}">
        ${isOverBudget ? "보유금보다 발주 비용이 큽니다." : "수량 0으로도 발주 확정이 가능합니다."}
      </p>

      <button id="order-confirm-button" class="order-confirm-button" type="button" ${isOverBudget ? "disabled" : ""}>
        발주 확정
      </button>
    `;

    this.bindOrderDraftControls(orderableProducts);

    if (options.preserveScroll) {
      const nextList = document.querySelector(".order-product-list");

      if (nextList) {
        nextList.scrollTop = previousScrollTop;
      }
    }
  },

  bindOrderDraftControls(products = []) {
    document.querySelectorAll(".order-qty-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;

        const productId = button.dataset.productId;

        if (!(productId in this.orderDraftQuantities)) return;

        const currentQuantity = this.orderDraftQuantities[productId] ?? 0;
        const nextQuantity =
          button.dataset.action === "increase"
            ? currentQuantity + 1
            : Math.max(0, currentQuantity - 1);

        const orderList = document.querySelector(".order-product-list");
        this.orderListScrollTop = orderList?.scrollTop ?? this.orderListScrollTop;
        this.orderDraftQuantities[productId] = nextQuantity;
        this.renderOrderDraft({ preserveScroll: true });
      };
    });

    const confirmButton = document.getElementById("order-confirm-button");

    if (!confirmButton) return;

    confirmButton.onclick = () => {
      if (confirmButton.disabled) return;

      this.showOrderWaiting();

      EventBus.emit(EVENTS.ORDER_CONFIRMED, {
        day: GameState.day,
        items: products
          .map((product) => {
            return {
              productId: product.id,
              productName: product.name,
              quantity: this.orderDraftQuantities[product.id] ?? 0,
              purchasePrice: product.purchasePrice,
              salePrice: product.salePrice,
              imagePath: product.imagePath
            };
          })
          .filter((item) => item.quantity > 0),
        totalCost: this.getOrderTotalCost(products)
      });
    };
  },

  showOrderWaiting() {
    const body = document.getElementById("order-modal-body");

    if (!body) return;

    this.orderModalMode = "waiting";

    body.innerHTML = `
      <div class="order-delivery-state">
        <h2>발주 전송 완료</h2>
        <p>거래처에서 상품을 보내는 중입니다. 약 3초 뒤 가게 앞에 택배 박스가 도착합니다.</p>
      </div>
    `;
  },

  handleOrderDelivered(orderData = {}) {
    const deliveredItems = this.getDeliveredItems(orderData);

    this.orderDeliveredData = orderData;

    if (orderData.isCompleted || deliveredItems.length === 0) {
      this.clearDeliveryBox();
      this.hideOrderModal();
      return;
    }

    this.renderDeliveryBox(orderData);

    if (this.orderModalMode === "delivery") {
      this.showOrderDelivered(orderData);
      return;
    }

    this.hideOrderModal();
    this.showMessage("가게 앞에 택배 박스가 도착했습니다. 박스를 클릭해 열어주세요.");
  },

  renderDeliveryBox(orderData = this.orderDeliveredData) {
    const storeArea = document.getElementById("store-area");

    if (!storeArea) return;

    const deliveredItems = this.getDeliveredItems(orderData);
    const hasOpenDelivery = Boolean(orderData && deliveredItems.length > 0 && !orderData.isCompleted);
    let deliveryBox = document.getElementById("delivery-box-zone");

    if (!hasOpenDelivery) {
      this.clearDeliveryBox();
      return;
    }

    const remainingCount = deliveredItems.filter((item) => !item.isSorted).length;

    if (!deliveryBox) {
      deliveryBox = document.createElement("button");
      deliveryBox.id = "delivery-box-zone";
      deliveryBox.className = "delivery-box-zone";
      deliveryBox.type = "button";
      storeArea.appendChild(deliveryBox);
    }

    deliveryBox.innerHTML = `
      <span class="delivery-box-icon">📦</span>
      <span>택배 박스</span>
      <strong>${remainingCount}종 정리 필요</strong>
    `;

    deliveryBox.onclick = () => {
      EventBus.emit(EVENTS.PLAYER_ACTION_RECORDED, {
        day: orderData.day ?? GameState.day,
        actionType: "open_delivery_box",
        orderId: orderData.orderId ?? null,
        source: "delivery_box_zone"
      });

      this.showOrderDelivered(this.orderDeliveredData);
    };
  },

  clearDeliveryBox() {
    const deliveryBox = document.getElementById("delivery-box-zone");

    if (deliveryBox) {
      deliveryBox.remove();
    }
  },

  showOrderDelivered(orderData = {}) {
    if (!this.orderModal) {
      this.createOrderModal();
    }

    const body = document.getElementById("order-modal-body");
    const deliveredItems = this.getDeliveredItems(orderData);
    const remainingCount = deliveredItems.filter((item) => !item.isSorted).length;

    if (!body) return;

    this.orderDeliveredData = orderData;
    this.orderModalMode = "delivery";
    this.orderModal.classList.remove("hidden");

    const dayLabel = document.getElementById("order-modal-day-label");

    if (dayLabel) {
      dayLabel.textContent = `Day ${orderData.day ?? GameState.day}`;
    }

    body.innerHTML = `
      <div class="order-delivery-state">
        <h2>택배 박스 열기</h2>
        <p>
          상품 이미지를 누르면 해당 상품이 재고로 정리됩니다.
          남은 상품 ${remainingCount}종을 모두 정리해야 편의점을 오픈할 수 있습니다.
        </p>
        <div class="order-delivered-grid">
          ${
            deliveredItems.length > 0
              ? deliveredItems.map((item) => {
                  const isSorted = Boolean(item.isSorted);

                  return `
                    <button
                      class="delivered-product-button${isSorted ? " is-sorted" : ""}"
                      type="button"
                      data-product-id="${item.productId}"
                      ${isSorted ? "disabled" : ""}
                    >
                      <img
                        class="delivered-product-image"
                        src="${item.imagePath ?? ""}"
                        alt="${item.productName}"
                        loading="lazy"
                        decoding="async"
                      />
                      <span>${item.productName}</span>
                      <strong>${item.quantity}개</strong>
                      <em>${isSorted ? "정리 완료" : "클릭해서 정리"}</em>
                    </button>
                  `;
                }).join("")
              : "<div class=\"order-empty-delivery\">정리할 상품이 없습니다.</div>"
          }
        </div>
      </div>
    `;

    this.bindDeliveredProductButtons(orderData);
  },

  bindDeliveredProductButtons(orderData = {}) {
    document.querySelectorAll(".delivered-product-button").forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (button.disabled) return;

        const productId = button.dataset.productId;
        const deliveredGrid = document.querySelector(".order-delivered-grid");
        const previousScrollTop = deliveredGrid?.scrollTop ?? 0;

        EventBus.emit(EVENTS.PLAYER_ACTION_RECORDED, {
          day: orderData.day ?? GameState.day,
          actionType: "sort_delivery_item",
          orderId: orderData.orderId ?? null,
          productId,
          source: "delivery_box_modal"
        });

        requestAnimationFrame(() => {
          const updatedDeliveredGrid = document.querySelector(".order-delivered-grid");

          if (updatedDeliveredGrid) {
            updatedDeliveredGrid.scrollTop = previousScrollTop;
          }
        });
      };
    });
  },

  getDeliveredItems(orderData = {}) {
    return Array.isArray(orderData?.items)
      ? orderData.items.filter((item) => item.quantity > 0)
      : [];
  },

  hideOrderModal() {
    if (!this.orderModal) return;

    this.orderModal.classList.add("hidden");

    if (this.orderModalMode !== "delivery") {
      this.orderModalMode = "closed";
    }
  },

  getOrderableProducts() {
    return PRODUCTS.filter((product) => {
      return product.unlockDay <= GameState.day;
    });
  },

  getOrderUnavailableReason(product) {
    if (product.unlockDay > GameState.day) {
      return `Day ${product.unlockDay} 해금`;
    }

    return "발주 조건 확인 필요";
  },

  getOrderTotalCost(products = this.getOrderableProducts()) {
    return products.reduce((totalCost, product) => {
      const quantity = this.orderDraftQuantities[product.id] ?? 0;

      return totalCost + product.purchasePrice * quantity;
    }, 0);
  },

  createResultModal() {
    if (document.getElementById("result-modal")) {
      this.resultModal = document.getElementById("result-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "result-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content result-modal-content">
        <h2 id="result-modal-title">정산 결과</h2>

        <div id="result-modal-body"></div>

        <button id="result-confirm-button" type="button">
          확인
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.resultModal = modal;
  },

  showResultModal(resultData, onConfirm) {
    if (!this.resultModal) {
      this.createResultModal();
    }

    const title = document.getElementById("result-modal-title");
    const body = document.getElementById("result-modal-body");
    const confirmButton = document.getElementById("result-confirm-button");

    const resultText = resultData.success ? "오늘 영업 성공" : "오늘 영업 실패";
    const resultChecks = Array.isArray(resultData.resultChecks)
      ? resultData.resultChecks
      : [];
    const nextStepText = resultData.nextStepText ??
      "정산 확인 후 업그레이드를 선택하고 다음 Day로 진행합니다.";
    const mvpText = resultData.mvpTestDataApplied
      ? `<p class="modal-note">※ 임시 MVP 테스트 데이터가 적용되었습니다.</p>`
      : "";
    const staffResult = resultData.staff ?? {};
    const staffResultRows = staffResult.hired
      ? `
        <div class="result-row result-row-staff">
          <span>알바 계산</span>
          <strong>${staffResult.name} ${Number(staffResult.checkoutCount) || 0}건</strong>
        </div>
        <div class="result-row result-row-staff">
          <span>알바 인건비</span>
          <strong>-₩${Number(staffResult.wageCost || 0).toLocaleString("ko-KR")}</strong>
        </div>
      `
      : "";

    title.textContent = `Day ${resultData.day} 정산 결과`;

    body.innerHTML = `
      <div class="result-summary ${resultData.success ? "success" : "fail"}">
        <strong>${resultText}</strong>
        <span>${resultData.resultSummaryText ?? ""}</span>
      </div>

      <div class="result-check-list">
        ${resultChecks.map((check) => {
          return `
            <div class="result-check ${check.success ? "success" : "fail"}">
              <div class="result-check-main">
                <span>${check.label}</span>
                <strong>${check.statusText}</strong>
              </div>
              <div class="result-check-value">${check.valueText}</div>
              <p>${check.detailText}</p>
            </div>
          `;
        }).join("")}
      </div>

      <p class="result-section-title">영업 기록</p>

      <div class="result-row">
        <span>매출 / 목표</span>
        <strong>₩${resultData.revenue.toLocaleString()} / ₩${resultData.targetRevenue.toLocaleString()}</strong>
      </div>

      <div class="result-row">
        <span>순이익</span>
        <strong>₩${resultData.profit.toLocaleString()}</strong>
      </div>

      <div class="result-row">
        <span>병맛 점수</span>
        <strong>${(resultData.bmScore ?? resultData.bmBonus ?? 0).toLocaleString()}</strong>
      </div>

      <div class="result-row">
        <span>만족도</span>
        <strong>${resultData.satisfaction} / ${resultData.targetSatisfaction}</strong>
      </div>

      <div class="result-row">
        <span>멘탈</span>
        <strong>${resultData.mental} / 100</strong>
      </div>

      <div class="result-row">
        <span>손님 수</span>
        <strong>${resultData.totalCustomers}</strong>
      </div>

      <div class="result-row">
        <span>계산 성공</span>
        <strong>${resultData.checkoutSuccessCount}</strong>
      </div>

      ${staffResultRows}

      <p class="result-next-step">${nextStepText}</p>

      ${mvpText}
    `;

    confirmButton.onclick = () => {
      this.hideResultModal();

      if (typeof onConfirm === "function") {
        onConfirm();
      }
    };

    this.resultModal.classList.remove("hidden");
  },

  hideResultModal() {
    if (!this.resultModal) return;

    this.resultModal.classList.add("hidden");
  },

  createEndingModal() {
    if (document.getElementById("ending-modal")) {
      this.endingModal = document.getElementById("ending-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "ending-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content ending-modal-content">
        <p class="ending-kicker">최종 목표 달성</p>
        <h2 id="ending-modal-title" class="ending-title">세계 1등 편의점 달성!</h2>

        <p id="ending-modal-description" class="ending-description">
          Day 5까지 버틴 편의점은 이제 Day 6부터 무한모드 영업에 도전합니다.
        </p>

        <div id="ending-modal-reward" class="ending-reward-box"></div>

        <button id="ending-continue-button" class="ending-continue-button" type="button">
          Day 6 무한모드로 계속하기
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.endingModal = modal;
  },

  showEndingModal(endingData = {}) {
    if (!this.endingModal) {
      this.createEndingModal();
    }

    const title = document.getElementById("ending-modal-title");
    const description = document.getElementById("ending-modal-description");
    const rewardBox = document.getElementById("ending-modal-reward");
    const continueButton = document.getElementById("ending-continue-button");
    const effects = endingData.effects ?? {};
    const customerBonusPercent = Math.round(
      (Number(effects.customerSpawnRateBonus) || 0) * 100
    );
    const targetRevenueBonus = Number(effects.targetRevenueBonus) || 0;
    const storeSizeBonus = Number(effects.storeSizeBonus) || 0;

    title.textContent = endingData.endingTitle ?? "세계 1등 편의점 달성!";
    description.textContent = endingData.endingDescription ??
      "Day 5까지 버틴 편의점은 이제 Day 6부터 무한모드 영업에 도전합니다.";

    rewardBox.innerHTML = `
      <div class="ending-reward-row">
        <span>달성 Day</span>
        <strong>Day ${endingData.day ?? GameState.day}</strong>
      </div>
      <div class="ending-reward-row">
        <span>최종 구역</span>
        <strong>${endingData.zoneName ?? "프리미엄 매장 구역"}</strong>
      </div>
      <div class="ending-reward-row">
        <span>손님 방문</span>
        <strong>+${customerBonusPercent}%</strong>
      </div>
      <div class="ending-reward-row">
        <span>목표 매출</span>
        <strong>+₩${targetRevenueBonus.toLocaleString()}</strong>
      </div>
      <div class="ending-reward-row">
        <span>매장 규모</span>
        <strong>Lv.${storeSizeBonus}</strong>
      </div>
    `;

    continueButton.onclick = () => {
      this.hideEndingModal();

      EventBus.emit(EVENTS.ENDING_MODAL_CLOSED, {
        day: GameState.day,
        zoneId: endingData.zoneId ?? null,
        zoneName: endingData.zoneName ?? ""
      });
    };

    this.endingModal.classList.remove("hidden");
  },

  hideEndingModal() {
    if (!this.endingModal) return;

    this.endingModal.classList.add("hidden");
  },

  createUpgradeModal() {
    if (document.getElementById("upgrade-modal")) {
      this.upgradeModal = document.getElementById("upgrade-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "upgrade-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content upgrade-modal-content">
        <h2 id="upgrade-modal-title">업그레이드 선택</h2>

        <p id="upgrade-modal-description" class="upgrade-modal-description">
          오늘의 보상으로 업그레이드 1개를 선택하세요.
        </p>

        <div id="upgrade-modal-list"></div>
      </div>
    `;

    document.body.appendChild(modal);

    this.upgradeModal = modal;
  },

  showUpgradeModal(upgrades, onSelect, resultData = null) {
    if (!this.upgradeModal) {
      this.createUpgradeModal();
    }

    const title = document.getElementById("upgrade-modal-title");
    const description = document.getElementById("upgrade-modal-description");
    const list = document.getElementById("upgrade-modal-list");

    const resultText = resultData && resultData.success
      ? "목표 달성 보상"
      : "다음 영업 준비";

    title.textContent = "업그레이드 선택";
    description.textContent = `${resultText}으로 업그레이드 1개를 선택하세요.`;

    list.innerHTML = "";

    let alreadySelected = false;

    upgrades.forEach((upgrade) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "upgrade-card";
      button.dataset.upgradeId = upgrade.id;

      button.innerHTML = `
        <strong>${upgrade.name}</strong>
        <span>${upgrade.description}</span>
      `;

      button.onclick = () => {
        if (alreadySelected) return;

        alreadySelected = true;

        const upgradeButtons = list.querySelectorAll(".upgrade-card");
        upgradeButtons.forEach((upgradeButton) => {
          upgradeButton.disabled = true;
        });

        this.hideUpgradeModal();

        if (typeof onSelect === "function") {
          onSelect(upgrade.id);
        }
      };

      list.appendChild(button);
    });

    this.upgradeModal.classList.remove("hidden");
  },

  createCustomerEventModal() {
    if (document.getElementById("customer-event-modal")) {
      this.eventModal = document.getElementById("customer-event-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "customer-event-modal";
    modal.className = "modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "customer-event-modal-title");

    modal.innerHTML = `
      <div class="modal-content customer-event-modal-content">
        <h2 id="customer-event-modal-title">고객 이벤트</h2>
        <p id="customer-event-modal-meta" class="customer-event-modal-meta"></p>
        <p id="customer-event-modal-dialogue" class="customer-event-modal-dialogue"></p>
        <p id="customer-event-modal-summary" class="customer-event-modal-summary"></p>
        <div id="customer-event-choice-list" class="customer-event-choice-list"></div>
        <div id="customer-event-result-text" class="customer-event-result-text" hidden></div>
        <button id="customer-event-close-button" class="customer-event-close-button" type="button" hidden>
          확인
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.eventModal = modal;
  },


  formatCustomerEventSignedNumber(value) {
    const safeValue = Number(value) || 0;
    const sign = safeValue > 0 ? "+" : "";

    return `${sign}${safeValue.toLocaleString("ko-KR")}`;
  },

  createCustomerEventResultLine(label, value) {
    const item = document.createElement("li");
    item.textContent = `${label} ${value}`;
    return item;
  },

  formatCustomerEventInventoryChanges(inventoryChanges = []) {
    const changes = Array.isArray(inventoryChanges) ? inventoryChanges : [];
    const visibleChanges = changes.filter((change) => {
      return Number(change.quantity) !== 0;
    });

    if (visibleChanges.length === 0) {
      return "재고 변화 없음";
    }

    return visibleChanges.map((change) => {
      const label = change.label ?? change.productId ?? change.itemKey ?? "재고";
      const quantity = Number(change.quantity) || 0;
      const sign = quantity > 0 ? "+" : "";

      return `${label} ${sign}${quantity}`;
    }).join(", ");
  },

  formatCustomerEventApplicationResult(result = null) {
    if (!result) {
      return "실제 반영: 만족도/멘탈";
    }

    if (result.reason === "duplicate_choice_effect") {
      return "실제 반영: 이미 처리된 선택";
    }

    const appliedParts = [];

    if (Number(result.appliedRevenue) > 0) {
      appliedParts.push(`매출 +${Number(result.appliedRevenue).toLocaleString("ko-KR")}원`);
    }

    if (Number(result.appliedPenalty) > 0) {
      appliedParts.push(`손실/비용 -${Number(result.appliedPenalty).toLocaleString("ko-KR")}원`);
    }

    if (result.inventoryResult?.success === true) {
      const appliedChanges = Array.isArray(result.inventoryResult.appliedChanges)
        ? result.inventoryResult.appliedChanges
        : [];

      if (appliedChanges.length > 0) {
        appliedParts.push(`재고 ${this.formatCustomerEventInventoryChanges(appliedChanges)}`);
      }
    }

    if (result.inventoryResult?.success === false) {
      appliedParts.push("재고 부족으로 매출/재고 반영 차단");
    }

    if (appliedParts.length === 0) {
      appliedParts.push("만족도/멘탈");
    }

    return `실제 반영: ${appliedParts.join(" / ")}`;
  },

  createCustomerEventResultNode(choice = {}) {
    const wrapper = document.createElement("div");
    const title = document.createElement("strong");
    const customerReaction = document.createElement("p");
    const playerThought = document.createElement("p");
    const changesList = document.createElement("ul");
    const specialEffect = document.createElement("p");
    const applicationResult = document.createElement("p");
    const effects = choice.effects ?? {};
    const revenue = Number(effects.revenue) || 0;
    const cost = Number(effects.cost) || 0;
    const satisfaction = Number(effects.satisfaction) || 0;
    const mental = Number(effects.mental) || 0;
    const inventoryChanges =
      Array.isArray(choice.inventoryChanges) && choice.inventoryChanges.length > 0
        ? choice.inventoryChanges
        : effects.inventoryChanges;

    wrapper.className = "customer-event-result-card";
    title.className = "customer-event-result-title";
    title.textContent = choice.resultTitle || "선택 결과";

    customerReaction.className = "customer-event-result-reaction";
    customerReaction.textContent = choice.customerReaction
      ? `손님 반응: “${choice.customerReaction}”`
      : (choice.resultText || "선택했습니다.");

    playerThought.className = "customer-event-result-thought";
    playerThought.textContent = choice.playerThought
      ? `종업원 속마음: “${choice.playerThought}”`
      : "";

    changesList.className = "customer-event-result-changes";
    changesList.appendChild(
      this.createCustomerEventResultLine(
        "매출",
        `${this.formatCustomerEventSignedNumber(revenue)}원`
      )
    );

    if (cost !== 0) {
      changesList.appendChild(
        this.createCustomerEventResultLine(
          "비용",
          `-${Math.abs(cost).toLocaleString("ko-KR")}원`
        )
      );
    }

    changesList.appendChild(
      this.createCustomerEventResultLine(
        "만족도",
        this.formatCustomerEventSignedNumber(satisfaction)
      )
    );
    changesList.appendChild(
      this.createCustomerEventResultLine(
        "멘탈",
        this.formatCustomerEventSignedNumber(mental)
      )
    );
    changesList.appendChild(
      this.createCustomerEventResultLine(
        "재고",
        this.formatCustomerEventInventoryChanges(inventoryChanges)
      )
    );

    specialEffect.className = "customer-event-result-special";
    specialEffect.textContent = `특수 효과: ${choice.specialEffect || "없음"}`;

    applicationResult.className = "customer-event-result-application";
    applicationResult.textContent = this.formatCustomerEventApplicationResult(
      choice.effectApplicationResult
    );

    wrapper.appendChild(title);
    wrapper.appendChild(customerReaction);

    if (choice.playerThought) {
      wrapper.appendChild(playerThought);
    }

    wrapper.appendChild(changesList);
    wrapper.appendChild(specialEffect);
    wrapper.appendChild(applicationResult);

    return wrapper;
  },

  showCustomerEventModal(payload = {}, onClose = null, onChoiceSelected = null) {
    if (!this.eventModal) {
      this.createCustomerEventModal();
    }

    if (!this.eventModal || !payload) {
      return;
    }

    const title = document.getElementById("customer-event-modal-title");
    const meta = document.getElementById("customer-event-modal-meta");
    const dialogue = document.getElementById("customer-event-modal-dialogue");
    const summary = document.getElementById("customer-event-modal-summary");
    const choiceList = document.getElementById("customer-event-choice-list");
    const resultText = document.getElementById("customer-event-result-text");
    const closeButton = document.getElementById("customer-event-close-button");

    if (!title || !meta || !dialogue || !summary || !choiceList || !resultText || !closeButton) {
      return;
    }

    if (this.eventModalCloseTimerId) {
      clearTimeout(this.eventModalCloseTimerId);
      this.eventModalCloseTimerId = null;
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const metaParts = [
      payload.customerTypeName,
      payload.wantedProductName,
      payload.day ? `Day ${payload.day}` : ""
    ].filter(Boolean);
    const choiceSelectedCallback =
      typeof onChoiceSelected === "function" ? onChoiceSelected : null;

    this.eventModalOnClose = typeof onClose === "function" ? onClose : null;
    this.isEventModalClosing = false;
    title.textContent = payload.eventTitle || "고객 이벤트";
    meta.textContent = metaParts.join(" / ");
    dialogue.textContent = payload.dialogue || "손님이 말을 걸었습니다.";
    summary.textContent = payload.eventSummary || "";
    choiceList.innerHTML = "";
    choiceList.hidden = false;
    resultText.innerHTML = "";
    resultText.hidden = true;
    closeButton.hidden = true;

    choices.forEach((choice) => {
      const button = document.createElement("button");
      const label = document.createElement("strong");
      const description = document.createElement("span");
      const disabledReason = document.createElement("span");

      button.type = "button";
      button.className = "customer-event-choice-button";
      button.dataset.choiceId = choice.choiceId ?? "";
      button.disabled = choice.disabled === true;

      if (choice.disabled) {
        button.classList.add("is-disabled");
      }

      label.textContent = choice.label || "선택지";
      description.textContent = choice.description || "";

      button.appendChild(label);
      button.appendChild(description);

      if (choice.disabled && choice.disabledReason) {
        disabledReason.className = "customer-event-choice-disabled-reason";
        disabledReason.textContent = choice.disabledReason;
        button.appendChild(disabledReason);
      }

      button.onclick = () => {
        if (this.isEventModalClosing || choice.disabled) {
          return;
        }

        this.isEventModalClosing = true;
        choiceList.querySelectorAll("button").forEach((choiceButton) => {
          choiceButton.disabled = true;
        });

        const effectApplicationResult = choiceSelectedCallback
          ? choiceSelectedCallback(choice, payload)
          : null;
        const resultChoice = {
          ...choice,
          effectApplicationResult
        };

        choiceList.hidden = true;
        resultText.innerHTML = "";
        resultText.appendChild(this.createCustomerEventResultNode(resultChoice));
        resultText.hidden = false;
        closeButton.hidden = false;
        closeButton.focus?.();
      };

      choiceList.appendChild(button);
    });

    if (choices.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "customer-event-empty";
      emptyMessage.textContent = "선택지가 없습니다.";
      choiceList.appendChild(emptyMessage);
      closeButton.hidden = false;
    }

    closeButton.onclick = () => {
      this.hideCustomerEventModal();
    };

    this.eventModal.classList.remove("hidden");
  },

  hideCustomerEventModal() {
    if (!this.eventModal) return;

    if (this.eventModalCloseTimerId) {
      clearTimeout(this.eventModalCloseTimerId);
      this.eventModalCloseTimerId = null;
    }

    this.eventModal.classList.add("hidden");

    const onClose = this.eventModalOnClose;
    this.eventModalOnClose = null;
    this.isEventModalClosing = false;

    if (typeof onClose === "function") {
      onClose();
    }
  },

  hideUpgradeModal() {
    if (!this.upgradeModal) return;

    this.upgradeModal.classList.add("hidden");
  }
};
