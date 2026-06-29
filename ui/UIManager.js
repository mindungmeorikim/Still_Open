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
  productPanel: null,
  expansionPanel: null,
  expansionState: null,
  pendingOrderPhaseData: null,
  orderDraftQuantities: {},
  orderDeliveredData: null,
  orderModalMode: "closed",
  orderListScrollTop: 0,
  expansionCarouselIndex: 0,
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
      customerNode.textContent = this.getCustomerDisplayText(customer);
      customerNode.title = `${customer.typeName} / ${customer.wantedProductName}`;
    });
  },

  applyCustomerQueueOffset(customerNode, customer, counterQueueIndexes) {
    const queueIndex = counterQueueIndexes.get(customer.customerId) ?? 0;
    const isCounterCustomer = customer.currentZone === "counter";
    const queueOffset = isCounterCustomer ? queueIndex * 18 : 0;

    customerNode.dataset.queueIndex = isCounterCustomer ? String(queueIndex) : "";
    customerNode.style.setProperty("--queue-x", `${queueOffset * -1}px`);
    customerNode.style.setProperty("--queue-y", `${queueOffset}px`);
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
      <div class="expansion-carousel-controls">
        <button id="expansion-carousel-prev" class="expansion-carousel-button" type="button" aria-label="이전 확장 카드">←</button>
        <span id="expansion-carousel-position">1 / 1</span>
        <button id="expansion-carousel-next" class="expansion-carousel-button" type="button" aria-label="다음 확장 카드">→</button>
      </div>
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

  createExpansionEffectSummary() {
    const statusPanel = document.getElementById("status-panel");

    if (!statusPanel) return null;

    let effectSummary = document.getElementById("expansion-effect-summary");

    if (!effectSummary) {
      effectSummary = document.createElement("div");
      effectSummary.id = "expansion-effect-summary";
    }

    effectSummary.className = "expansion-effect-summary";
    statusPanel.insertAdjacentElement("afterend", effectSummary);

    return effectSummary;
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

    body.innerHTML = `
      <div class="order-modal-header">
        <h2>컴퓨터 발주</h2>
        <p>오늘 판매할 상품 수량을 정하고 발주를 확정하세요.</p>
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

          return `
            <article class="order-product-row${isOrderable ? "" : " is-order-unavailable"}" data-product-id="${product.id}">
              <div class="order-product-main">
                <img
                  class="order-product-thumb"
                  src="${product.imagePath}"
                  alt="${product.name}"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <strong>${product.name}</strong>
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
        <span>병맛 점수</span>
        <strong>${(resultData.bmScore ?? resultData.bmBonus ?? 0).toLocaleString()}</strong>
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

  hideUpgradeModal() {
    if (!this.upgradeModal) return;

    this.upgradeModal.classList.add("hidden");
  }
};
