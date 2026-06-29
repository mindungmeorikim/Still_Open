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

export const UIManager = {
  resultModal: null,
  upgradeModal: null,
  endingModal: null,
  dayScenarioModal: null,
  orderModal: null,
  eventModal: null,
  eventModalOnClose: null,
  eventModalCloseTimerId: null,
  isEventModalClosing: false,
  productPanel: null,
  expansionPanel: null,
  expansionState: null,
  pendingOrderPhaseData: null,
  orderDraftQuantities: {},
  orderDeliveredData: null,
  inventoryByProductId: {},

  init() {
    this.bindButtons();
    this.bindGameEvents();
    this.bindDayStartEvents();
    this.bindInventoryEvents();
    this.bindExpansionEvents();
    this.bindEndingEvents();
    this.bindOrderEvents();
    this.createDayScenarioModal();
    this.createOrderModal();
    this.createResultModal();
    this.createUpgradeModal();
    this.createEndingModal();
    this.createCustomerEventModal();
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
  },

  bindDayStartEvents() {
    EventBus.on(EVENTS.DAY_STARTED, (data) => {
      this.pendingOrderPhaseData = null;
      this.showDayScenarioModal(data.dayScenario);
    });

    EventBus.on(EVENTS.ORDER_PHASE_STARTED, (data) => {
      this.pendingOrderPhaseData = data;

      if (!this.isDayScenarioModalVisible()) {
        this.showOrderModal(data);
      }
    });
  },

  bindOrderEvents() {
    EventBus.on(EVENTS.ORDER_DELIVERED, (data) => {
      this.showOrderDelivered(data);
    });
  },

  bindInventoryEvents() {
    EventBus.on(EVENTS.INVENTORY_CHANGED, (data) => {
      const items = Array.isArray(data.items) ? data.items : [];

      this.inventoryByProductId = items.reduce((inventoryMap, item) => {
        inventoryMap[item.productId] = item;
        return inventoryMap;
      }, {});

      this.renderProductCards();
    });
  },

  bindExpansionEvents() {
    EventBus.on(EVENTS.EXPANSION_COMPLETED, (data) => {
      this.expansionState = data.expansionState ?? this.expansionState;
      this.showExpansionMessage(data.message ?? "매장 확장이 완료되었습니다.");
      this.renderExpansionZones(this.expansionState);
    });

    EventBus.on(EVENTS.EXPANSION_FAILED, (data) => {
      this.expansionState = data.expansionState ?? this.expansionState;
      this.showExpansionMessage(data.message ?? "확장 조건을 다시 확인해주세요.");
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

    const customers = CustomerSystem.getRenderableCustomers();

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
      this.renderCustomerInfo(customerNode, customer);
      customerNode.title = `${customer.typeName} / ${customer.wantedProductName}`;
    });
  },

  applyCustomerQueueOffset(customerNode, customer, counterQueueIndexes) {
    const queueIndex = counterQueueIndexes.get(customer.customerId) ?? 0;
    const isCounterCustomer = customer.currentZone === "counter";
    const queueOffset = isCounterCustomer ? queueIndex * 28 : 0;

    customerNode.dataset.queueIndex = isCounterCustomer ? String(queueIndex) : "";
    customerNode.style.setProperty("--queue-x", `${queueOffset * -1}px`);
    customerNode.style.setProperty("--queue-y", `${Math.round(queueOffset * -0.45)}px`);
    customerNode.style.zIndex = isCounterCustomer ? String(40 - queueIndex) : "";
  },

  getCustomerClassName(customer) {
    return [
      "customer-npc",
      `customer-type-${customer.typeId}`,
      `customer-status-${customer.status}`,
      `customer-mood-${customer.mood}`,
      `customer-zone-${customer.currentZone}`,
      this.getCustomerWaitStateClass(customer)
    ].join(" ");
  },

  getCustomerWaitStateClass(customer) {
    if (customer.status !== "waiting") {
      return "";
    }

    const waitTime = Math.ceil(Number(customer.waitTime) || 0);

    if (waitTime <= 5) {
      return "customer-wait-danger";
    }

    if (waitTime <= 10) {
      return "customer-wait-impatient";
    }

    return "";
  },

  renderCustomerInfo(customerNode, customer) {
    const typeLabel = document.createElement("span");
    const productLabel = document.createElement("span");
    const productName = customer.wantedProductName ?? "";
    const typeName = customer.typeName || this.getCustomerDisplayText(customer);

    typeLabel.className = "customer-type-label";
    typeLabel.textContent = this.getCustomerTypeLabelText(customer, typeName);

    productLabel.className = "customer-product-label";
    productLabel.textContent = productName;

    const fragments = [typeLabel, productLabel];
    const speechText = this.getCustomerSpeechText(customer);

    if (speechText) {
      const speechBubble = document.createElement("span");

      speechBubble.className = "customer-speech-bubble";
      speechBubble.textContent = speechText;
      fragments.unshift(speechBubble);
    }

    if (customer.status === "waiting") {
      const waitTime = Math.max(0, Math.ceil(Number(customer.waitTime) || 0));

      productLabel.textContent = `${productName} \u00B7 ${waitTime}\uCD08`;
    }

    customerNode.replaceChildren(...fragments);
  },

  getCustomerSpeechText(customer) {
    const waitTime = Math.ceil(Number(customer.waitTime) || 0);
    const speechByType = {
      normal: {
        browsing: "\uC624\uB298\uC740 \uBB50 \uBA39\uC9C0?",
        waiting: "\uACC4\uC0B0 \uBD80\uD0C1\uD574\uC694",
        urgent: "\uC870\uAE08 \uAC78\uB9AC\uB124\uC694",
        leaving: "\uB2E4\uC74C\uC5D0 \uC62C\uAC8C\uC694"
      },
      student: {
        browsing: "\uC0BC\uAC01\uAE40\uBC25 \uC788\uB098?",
        waiting: "\uC218\uC5C5 \uB2A6\uACA0\uB2E4",
        urgent: "\uC9C0\uAC01\uD558\uACA0\uB2E4",
        leaving: "\uB2E4\uB978 \uB370 \uAC08\uB798\uC694"
      },
      office_worker: {
        browsing: "\uCEE4\uD53C\uBD80\uD130 \uC0AC\uC57C\uACA0\uB2E4",
        waiting: "\uD68C\uC758 \uC804\uC5D0 \uAC00\uC57C \uD558\uB294\uB370",
        urgent: "\uD68C\uC758 \uB2A6\uACA0\uB124",
        leaving: "\uC2DC\uAC04 \uC5C6\uC5B4\uC11C \uAC11\uB2C8\uB2E4"
      },
      hurried: {
        browsing: "\uBE68\uB9AC \uC0AC\uACE0 \uAC00\uC57C\uC9C0",
        waiting: "\uBE68\uB9AC\uC694!",
        urgent: "\uC9C4\uC9DC \uB2A6\uACA0\uC5B4\uC694!",
        leaving: "\uADF8\uB0E5 \uAC08\uAC8C\uC694"
      },
      difficult: {
        browsing: "\uD589\uC0AC \uC0C1\uD488 \uC5B4\uB514\uC788\uC5B4\uC694?",
        waiting: "\uC810\uC7A5 \uBD88\uB7EC\uC8FC\uC138\uC694",
        urgent: "\uB098 \uBA3C\uC800 \uD574\uC918\uC694",
        leaving: "\uB2E4\uC2DC\uB294 \uC548 \uC640\uC694"
      }
    };
    const speech = speechByType[customer.typeId] ?? speechByType.normal;

    if (customer.status === "leaving") {
      return speech.leaving;
    }

    if (customer.status === "waiting" && waitTime <= 10) {
      return speech.urgent;
    }

    if (customer.status === "waiting") {
      return speech.waiting;
    }

    if (customer.status === "shopping" || customer.status === "entering") {
      return speech.browsing;
    }

    return "";
  },

  getCustomerTypeLabelText(customer, typeName) {
    if (customer.typeId !== "difficult") {
      return typeName;
    }

    const prefix = customer.mood === "angry" ? "\uD83D\uDE21" : "\uD83D\uDCA2";

    return `${prefix} ${typeName}`;
  },

  getCustomerDisplayText(customer) {
    const typeLabels = {
      normal: "\uC77C\uBC18",
      student: "\uD559\uC0DD",
      office_worker: "\uD68C\uC0AC\uC6D0",
      hurried: "\uAE09\uD55C \uC190\uB2D8",
      difficult: "\uC9C4\uC0C1 \uC190\uB2D8"
    };

    return typeLabels[customer.typeId] ?? "\uC190\uB2D8";
  },

  render() {
    this.renderProductCards();
    this.renderExpansionZones();
    this.renderControlButtons();
    this.renderPlayer();
    document.getElementById("day-info").textContent = `Day ${GameState.day}`;
    document.getElementById("money-info").textContent = `₩${GameState.money.toLocaleString()}`;
    document.getElementById("satisfaction-info").textContent = `만족도 ${GameState.satisfaction}`;
    document.getElementById("mental-info").textContent = `멘탈 ${GameState.mental}`;
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
    const existingPanel = document.getElementById("expansion-panel");

    if (existingPanel) {
      this.expansionPanel = existingPanel;
      return;
    }

    const gameScreen = document.getElementById("game-screen");
    const storeArea = document.getElementById("store-area");

    if (!gameScreen) return;

    const expansionPanel = document.createElement("section");

    expansionPanel.id = "expansion-panel";
    expansionPanel.setAttribute("aria-labelledby", "expansion-panel-title");
    expansionPanel.innerHTML = `
      <div class="expansion-panel-header">
        <h2 id="expansion-panel-title">매장 확장</h2>
        <span id="expansion-unlock-summary"></span>
      </div>
      <div id="expansion-effect-summary" class="expansion-effect-summary"></div>
      <div id="expansion-zone-grid" class="expansion-zone-grid"></div>
      <p id="expansion-message">먼지 낀 옆 구역을 눌러 확장 조건을 확인하세요.</p>
    `;

    if (storeArea?.nextElementSibling) {
      gameScreen.insertBefore(expansionPanel, storeArea.nextElementSibling);
    } else {
      gameScreen.appendChild(expansionPanel);
    }

    this.expansionPanel = expansionPanel;
  },

  renderExpansionZones(expansionState = this.expansionState) {
    this.createExpansionPanel();

    if (expansionState) {
      this.expansionState = expansionState;
    }

    const zoneGrid = document.getElementById("expansion-zone-grid");
    const unlockSummary = document.getElementById("expansion-unlock-summary");

    if (!zoneGrid) return;

    const zoneStates = this.getExpansionZoneViewModels(this.expansionState);
    const unlockedCount = zoneStates.filter((zone) => zone.isUnlocked).length;

    if (unlockSummary) {
      unlockSummary.textContent = `${unlockedCount} / ${zoneStates.length}`;
    }

    this.renderExpansionEffects(this.getExpansionEffectsViewModel(zoneStates));

    zoneGrid.innerHTML = zoneStates.map((zone) => {
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
      const stockText = Number.isFinite(quantity) ? `${quantity}개` : "-";
      const nextExpireDay = inventoryItem?.nextExpireDay;
      const expireText = Number.isFinite(nextExpireDay)
        ? `Day ${nextExpireDay}`
        : "-";

      return `
        <article
          class="product-card${isLocked ? " is-locked" : ""}"
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
      `정산 완료 | 매출 ₩${resultData.revenue.toLocaleString()} / 순이익 ₩${resultData.profit.toLocaleString()}`
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
        <p id="day-scenario-story" class="day-scenario-story"></p>
        <ul id="day-scenario-features" class="day-scenario-features"></ul>
        <p id="day-scenario-tip" class="day-scenario-tip"></p>
        <button id="day-scenario-confirm-button" class="day-scenario-confirm-button" type="button">
          영업 준비하기
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
    const story = document.getElementById("day-scenario-story");
    const features = document.getElementById("day-scenario-features");
    const tip = document.getElementById("day-scenario-tip");
    const confirmButton = document.getElementById("day-scenario-confirm-button");
    const featureItems = Array.isArray(scenarioData.features)
      ? scenarioData.features
      : [];

    title.textContent = scenarioData.title ?? `Day ${GameState.day}. 영업 시작`;
    subtitle.textContent = scenarioData.subtitle ?? "오늘의 편의점 운영을 준비합니다.";
    story.textContent = scenarioData.story ?? "발주와 재고 정리를 마친 뒤 편의점을 오픈하세요.";
    tip.textContent = scenarioData.tip ?? "보유금과 재고를 확인하고 발주 수량을 정하세요.";
    confirmButton.textContent = scenarioData.ctaText ?? "발주 준비하기";

    features.innerHTML = featureItems.map((feature) => {
      return `<li>${feature}</li>`;
    }).join("");

    confirmButton.onclick = () => {
      this.hideDayScenarioModal();

      if (this.pendingOrderPhaseData) {
        this.showOrderModal(this.pendingOrderPhaseData);
      }
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

  renderOrderDraft() {
    const body = document.getElementById("order-modal-body");

    if (!body) return;

    const products = this.getOrderableProducts();
    const totalCost = this.getOrderTotalCost(products);
    const isOverBudget = totalCost > GameState.money;

    body.innerHTML = `
      <div class="order-modal-header">
        <h2>컴퓨터 발주</h2>
        <p>오늘 판매할 상품 수량을 정하고 발주를 확정하세요.</p>
      </div>

      <div class="order-product-list">
        ${products.map((product) => {
          const inventoryItem = this.inventoryByProductId[product.id];
          const quantity = this.orderDraftQuantities[product.id] ?? 0;
          const stockQuantity = Number.isFinite(inventoryItem?.quantity)
            ? inventoryItem.quantity
            : 0;

          return `
            <article class="order-product-row" data-product-id="${product.id}">
              <div>
                <strong>${product.name}</strong>
                <span>현재 재고 ${stockQuantity}개</span>
              </div>
              <div class="order-product-prices">
                <span>매입 ₩${product.purchasePrice.toLocaleString()}</span>
                <span>판매 ₩${product.salePrice.toLocaleString()}</span>
              </div>
              <div class="order-quantity-controls">
                <button class="order-qty-button" type="button" data-action="decrease" data-product-id="${product.id}">-</button>
                <strong>${quantity}</strong>
                <button class="order-qty-button" type="button" data-action="increase" data-product-id="${product.id}">+</button>
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

    this.bindOrderDraftControls(products);
  },

  bindOrderDraftControls(products = []) {
    document.querySelectorAll(".order-qty-button").forEach((button) => {
      button.onclick = () => {
        const productId = button.dataset.productId;
        const currentQuantity = this.orderDraftQuantities[productId] ?? 0;
        const nextQuantity =
          button.dataset.action === "increase"
            ? currentQuantity + 1
            : Math.max(0, currentQuantity - 1);

        this.orderDraftQuantities[productId] = nextQuantity;
        this.renderOrderDraft();
      };
    });

    const confirmButton = document.getElementById("order-confirm-button");

    if (!confirmButton) return;

    confirmButton.onclick = () => {
      if (confirmButton.disabled) return;

      this.showOrderWaiting();

      EventBus.emit(EVENTS.ORDER_CONFIRMED, {
        day: GameState.day,
        items: products.map((product) => {
          return {
            productId: product.id,
            productName: product.name,
            quantity: this.orderDraftQuantities[product.id] ?? 0,
            purchasePrice: product.purchasePrice,
            salePrice: product.salePrice
          };
        }),
        totalCost: this.getOrderTotalCost(products)
      });
    };
  },

  showOrderWaiting() {
    const body = document.getElementById("order-modal-body");

    if (!body) return;

    body.innerHTML = `
      <div class="order-delivery-state">
        <h2>발주 전송 완료</h2>
        <p>거래처에서 상품을 보내는 중입니다.</p>
      </div>
    `;
  },

  showOrderDelivered(orderData = {}) {
    if (!this.orderModal) {
      this.createOrderModal();
    }

    const body = document.getElementById("order-modal-body");
    const deliveredItems = Array.isArray(orderData.items)
      ? orderData.items.filter((item) => item.quantity > 0)
      : [];

    if (!body) return;

    this.orderDeliveredData = orderData;
    this.orderModal.classList.remove("hidden");

    const dayLabel = document.getElementById("order-modal-day-label");

    if (dayLabel) {
      dayLabel.textContent = `Day ${orderData.day ?? GameState.day}`;
    }

    body.innerHTML = `
      <div class="order-delivery-state">
        <h2>상품이 도착했습니다</h2>
        <p>${orderData.message ?? "입고 상품을 정리해주세요."}</p>
        <div class="order-delivered-list">
          ${
            deliveredItems.length > 0
              ? deliveredItems.map((item) => {
                  return `<div><span>${item.productName}</span><strong>${item.quantity}개</strong></div>`;
                }).join("")
              : "<div><span>입고 상품 없음</span><strong>0개</strong></div>"
          }
        </div>
        <button id="stock-organized-button" class="stock-organized-button" type="button">
          재고 정리 완료
        </button>
      </div>
    `;

    const organizedButton = document.getElementById("stock-organized-button");

    organizedButton.onclick = () => {
      EventBus.emit(EVENTS.STOCK_ORGANIZED, {
        day: orderData.day ?? GameState.day,
        orderId: orderData.orderId ?? null
      });

      this.hideOrderModal();
      this.showMessage("재고 정리 완료. 편의점 오픈 버튼을 눌러주세요.");
    };
  },

  hideOrderModal() {
    if (!this.orderModal) return;

    this.orderModal.classList.add("hidden");
  },

  getOrderableProducts() {
    return PRODUCTS.filter((product) => {
      return product.unlockDay <= GameState.day;
    });
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
      <div class="modal-content">
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

    const resultText = resultData.success ? "성공" : "실패";
    const mvpText = resultData.mvpTestDataApplied
      ? `<p class="modal-note">※ 임시 MVP 테스트 데이터가 적용되었습니다.</p>`
      : "";

    title.textContent = `Day ${resultData.day} 정산 결과`;

    body.innerHTML = `
      <div class="result-summary ${resultData.success ? "success" : "fail"}">
        결과: ${resultText}
      </div>

      <div class="result-row">
        <span>매출</span>
        <strong>₩${resultData.revenue.toLocaleString()}</strong>
      </div>

      <div class="result-row">
        <span>목표 매출</span>
        <strong>₩${resultData.targetRevenue.toLocaleString()}</strong>
      </div>

      <div class="result-row">
        <span>순이익</span>
        <strong>₩${resultData.profit.toLocaleString()}</strong>
      </div>

      <div class="result-row">
        <span>만족도</span>
        <strong>${resultData.satisfaction} / ${resultData.targetSatisfaction}</strong>
      </div>

      <div class="result-row">
        <span>멘탈</span>
        <strong>${resultData.mental}</strong>
      </div>

      <div class="result-row">
        <span>손님 수</span>
        <strong>${resultData.totalCustomers}</strong>
      </div>

      <div class="result-row">
        <span>계산 성공</span>
        <strong>${resultData.checkoutSuccessCount}</strong>
      </div>

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
          먼지 나는 작은 편의점이 세계 최고의 K-편의점으로 성장했습니다.
        </p>

        <div id="ending-modal-reward" class="ending-reward-box"></div>

        <button id="ending-continue-button" class="ending-continue-button" type="button">
          무한모드 계속하기
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
      "작은 편의점에서 시작해 최고의 K-편의점으로 성장했습니다.";

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

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <h2 id="customer-event-modal-title">손님 이벤트</h2>
        <p id="customer-event-modal-meta" style="margin: 0 0 12px; color: #666666; font-size: 13px; text-align: center;"></p>
        <p id="customer-event-modal-dialogue" style="margin: 0 0 12px; padding: 12px; border-radius: 8px; background: #f7f7f7; font-weight: 700;"></p>
        <p id="customer-event-modal-summary" style="margin: 0 0 14px; color: #555555; font-size: 14px;"></p>
        <div id="customer-event-choice-list" style="display: grid; gap: 10px;"></div>
        <p id="customer-event-result-text" hidden style="margin: 14px 0 0; padding: 12px; border-radius: 8px; background: #eef5ef; color: #31533b; font-weight: 700;"></p>
        <button id="customer-event-close-button" type="button" style="width: 100%; margin-top: 14px;">
          확인
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.eventModal = modal;
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

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const metaParts = [
      payload.customerTypeName,
      payload.wantedProductName,
      payload.day ? `Day ${payload.day}` : ""
    ].filter(Boolean);

    if (this.eventModalCloseTimerId) {
      clearTimeout(this.eventModalCloseTimerId);
      this.eventModalCloseTimerId = null;
    }

    const choiceSelectedCallback =
      typeof onChoiceSelected === "function" ? onChoiceSelected : null;

    this.eventModalOnClose = typeof onClose === "function" ? onClose : null;
    this.isEventModalClosing = false;
    title.textContent = payload.eventTitle || "손님 이벤트";
    meta.textContent = metaParts.join(" · ");
    dialogue.textContent = payload.dialogue || "손님이 말을 걸었습니다.";
    summary.textContent = payload.eventSummary || "";
    choiceList.innerHTML = "";
    resultText.textContent = "";
    resultText.hidden = true;
    closeButton.hidden = true;

    choices.forEach((choice) => {
      const button = document.createElement("button");
      const label = document.createElement("strong");
      const description = document.createElement("span");

      button.type = "button";
      button.className = "customer-event-choice-button";
      button.dataset.choiceId = choice.choiceId ?? "";
      button.style.width = "100%";
      button.style.minHeight = "56px";
      button.style.padding = "12px";
      button.style.display = "grid";
      button.style.gap = "4px";
      button.style.textAlign = "left";

      label.textContent = choice.label || "선택지";
      description.textContent = choice.description || "";
      description.style.fontSize = "12px";
      description.style.opacity = "0.82";

      button.appendChild(label);
      button.appendChild(description);

      button.onclick = () => {
        if (this.isEventModalClosing) {
          return;
        }

        this.isEventModalClosing = true;
        const choiceButtons = choiceList.querySelectorAll("button");

        choiceButtons.forEach((choiceButton) => {
          choiceButton.disabled = true;
        });

        if (choiceSelectedCallback) {
          choiceSelectedCallback(choice);
        }

        resultText.textContent = choice.resultText || "선택했습니다.";
        resultText.hidden = false;

        this.eventModalCloseTimerId = setTimeout(() => {
          this.eventModalCloseTimerId = null;
          this.hideCustomerEventModal();
        }, 1200);
      };

      choiceList.appendChild(button);
    });

    if (choices.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent = "선택지가 없습니다.";
      emptyMessage.style.margin = "0";
      emptyMessage.style.color = "#666666";
      choiceList.appendChild(emptyMessage);
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
