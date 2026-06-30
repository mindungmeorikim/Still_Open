/*
  CustomerSystem.js

  담당:
  - 3번 담당자 작업물 병합용 변환
  - v2.2.1 팀장 병합 안정화

  역할:
  - 손님 NPC 생성
  - 손님 타입 결정
  - 손님별 구매 희망 상품 결정
  - 손님 상태 / 구역 / 대기시간 관리
  - 계산 완료 시 만족 손님 처리
  - 대기시간 초과 시 화남 / 이탈 처리
  - 랜덤 이벤트 후보 손님 조회 준비

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
  - GameState.todayStats 직접 수정 금지
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
  - Date.now() 사용 금지
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";

import {
  CUSTOMER_STATUS,
  CUSTOMER_ZONES,
  CUSTOMER_TYPES,
  CUSTOMER_WANTED_PRODUCTS
} from "../data/CustomerData.js";
import { getDayScenario } from "../data/DayScenarioData.js";
import {
  getProductById,
  getProductsByCustomerRequestId,
  getUnlockedProducts
} from "../data/ProductData.js";
import { RandomEventSystem } from "./RandomEventSystem.js";

export const CustomerSystem = {
  customers: [],
  customerIdCounter: 0,
  routeTimerId: null,
  spawnTimerId: null,
  isWaitTimePaused: false,
  isCustomerFlowPaused: false,
  targetSpawnCount: 0,
  spawnedCustomerCount: 0,
  counterQueueOrderCounter: 0,
  inventoryByProductId: {},

  init() {
    EventBus.on(EVENTS.STORE_OPENED, () => {
      this.startCustomerFlow();
    });

    EventBus.on(EVENTS.CHECKOUT_COMPLETED, (data) => {
      const checkoutData = this.normalizeCheckoutCompletedPayload(data);

      this.handleCheckoutCompleted(checkoutData);
    });

    EventBus.on(EVENTS.INVENTORY_CHANGED, (data) => {
      this.handleInventoryChanged(data);
    });

    EventBus.on(EVENTS.STORE_CLOSED, () => {
      this.closeCustomerFlow();
    });
  },

  startCustomerFlow() {
    this.resetCustomersForDay();

    this.targetSpawnCount = this.getSpawnCountByDay();
    this.spawnedCustomerCount = 0;
    this.isCustomerFlowPaused = false;
    this.isWaitTimePaused = false;

    this.spawnNextCustomer();
    this.startSpawnTimer();

    this.startRouteTimer();

    console.log(
      `[CustomerSystem] Day ${GameState.day} 손님 ${this.targetSpawnCount}명 순차 생성 시작`
    );
  },

  resetCustomersForDay() {
    this.stopRouteTimer();
    this.stopSpawnTimer();

    this.customers = [];
    this.customerIdCounter = 0;
    this.targetSpawnCount = 0;
    this.spawnedCustomerCount = 0;
    this.counterQueueOrderCounter = 0;
    this.isCustomerFlowPaused = false;
    this.isWaitTimePaused = false;
  },

  handleInventoryChanged(data = {}) {
    const items = Array.isArray(data.items) ? data.items : [];

    this.inventoryByProductId = items.reduce((inventoryMap, item) => {
      inventoryMap[item.productId] = item;
      return inventoryMap;
    }, {});
  },

  getSpawnCountByDay() {
    const difficultyRate = GameState.difficulty?.customerSpawnRate ?? 1;
    const targetRevenue = Math.max(
      0,
      Number(GameState.dailyGoal?.targetRevenue) || 0
    );
    const expectedAverageSalePrice = this.getExpectedAverageSalePrice();
    const revenueBasedCount =
      expectedAverageSalePrice > 0
        ? Math.ceil((targetRevenue / expectedAverageSalePrice) * 1.1)
        : 0;
    const fallbackCount = 8 + Math.floor(GameState.day * 2);
    const baseCount = Math.max(fallbackCount, revenueBasedCount);

    return Math.max(6, Math.min(60, Math.floor(baseCount * difficultyRate)));
  },

  getExpectedAverageSalePrice() {
    const wantedProducts = this.getAvailableWantedProducts();
    const wantedProductIds = new Set(
      wantedProducts.map((product) => product.id)
    );
    const salePrices = getUnlockedProducts(GameState.day)
      .filter((product) => {
        return (
          wantedProductIds.has(product.id) ||
          (product.customerRequestIds ?? []).some((requestId) => {
            return wantedProductIds.has(requestId);
          })
        );
      })
      .map((product) => Number(product.salePrice))
      .filter((salePrice) => {
        return Number.isFinite(salePrice) && salePrice > 0;
      });

    if (salePrices.length === 0) {
      return 0;
    }

    const totalSalePrice = salePrices.reduce((total, salePrice) => {
      return total + salePrice;
    }, 0);

    return totalSalePrice / salePrices.length;
  },

  addCustomers(count) {
    const safeCount = Math.max(0, Math.floor(count));

    for (let i = 0; i < safeCount; i += 1) {
      const customer = this.createCustomer();

      this.customers.push(customer);

      EventBus.emit(EVENTS.CUSTOMER_ENTERED, this.createCustomerPayload(customer));
    }

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  spawnNextCustomer() {
    if (this.isCustomerFlowPaused) {
      return false;
    }

    if (this.spawnedCustomerCount >= this.targetSpawnCount) {
      this.stopSpawnTimer();
      return false;
    }

    this.addCustomers(1);
    this.spawnedCustomerCount += 1;

    if (this.spawnedCustomerCount >= this.targetSpawnCount) {
      this.stopSpawnTimer();
    }

    return true;
  },

  startSpawnTimer() {
    this.stopSpawnTimer();

    if (this.spawnedCustomerCount >= this.targetSpawnCount) {
      return;
    }

    this.spawnTimerId = setInterval(() => {
      if (this.isCustomerFlowPaused) {
        return;
      }

      this.spawnNextCustomer();
    }, this.getSpawnIntervalMsByDay());
  },

  stopSpawnTimer() {
    if (!this.spawnTimerId) return;

    clearInterval(this.spawnTimerId);
    this.spawnTimerId = null;
  },

  getSpawnIntervalMsByDay() {
    const day = Math.max(1, Math.floor(Number(GameState.day) || 1));
    const intervalSeconds = Math.max(2, 4.5 - day * 0.5);

    return Math.floor(intervalSeconds * 1000);
  },

  createCustomer() {
    const customerType = this.pickCustomerType();
    const wantedProduct = this.decideWantedProduct(customerType);
    const routeState = this.getRouteStateByStatus(CUSTOMER_STATUS.ENTERING);

    this.customerIdCounter += 1;

    return {
      id: `customer-${GameState.day}-${this.customerIdCounter}`,

      typeId: customerType.id,
      typeName: customerType.name,

      patience: customerType.patience,
      spendBias: customerType.spendBias,
      eventChance: this.getCustomerEventChance(customerType),

      wantedProductId: wantedProduct.id,
      wantedProductName: wantedProduct.name,
      carriedProductId: null,
      carriedProductName: null,
      carriedProductImagePath: null,

      status: routeState.status,
      currentZone: routeState.currentZone,
      targetZone: routeState.targetZone,

      enteringTime: this.getDefaultEnteringTime(),
      shoppingTime: this.getShoppingTimeByCustomerType(customerType),
      waitTime: customerType.patience,
      queueOrder: null,
      mood: "neutral",

      isSatisfied: false,
      hasReportedAngry: false,
      hasReportedLeft: false
    };
  },

  pickCustomerType() {
    const weightedTypes = CUSTOMER_TYPES.map((type) => {
      return {
        type,
        weight: this.getCustomerTypeWeight(type)
      };
    }).filter((entry) => {
      return entry.weight > 0;
    });

    const safeWeightedTypes =
      weightedTypes.length > 0
        ? weightedTypes
        : CUSTOMER_TYPES.map((type) => {
            return { type, weight: type.weight };
          });

    const totalWeight = safeWeightedTypes.reduce((sum, entry) => {
      return sum + entry.weight;
    }, 0);

    let target = Math.random() * totalWeight;

    for (const entry of safeWeightedTypes) {
      target -= entry.weight;

      if (target <= 0) {
        return entry.type;
      }
    }

    return safeWeightedTypes[safeWeightedTypes.length - 1].type;
  },

  decideWantedProduct(customerType) {
    const preferredProductIds = customerType.preferredProductIds ?? [];
    const availableWantedProducts = this.getAvailableWantedProducts();

    const candidateProducts =
      preferredProductIds.length > 0
        ? availableWantedProducts.filter((product) => {
            return preferredProductIds.includes(product.id);
          })
        : availableWantedProducts;

    const safeCandidates =
      candidateProducts.length > 0
        ? candidateProducts
        : availableWantedProducts.length > 0
          ? availableWantedProducts
          : CUSTOMER_WANTED_PRODUCTS;

    const randomIndex = Math.floor(Math.random() * safeCandidates.length);

    return safeCandidates[randomIndex];
  },

  getCurrentDayScenario() {
    return getDayScenario(GameState.day);
  },

  getCustomerTypeWeight(customerType) {
    const scenario = this.getCurrentDayScenario();
    const scenarioWeight = Number(
      scenario.customerTypeWeights?.[customerType.id]
    );

    if (Number.isFinite(scenarioWeight)) {
      return Math.max(0, scenarioWeight);
    }

    return Math.max(0, Number(customerType.weight) || 0);
  },

  getCustomerEventChance(customerType) {
    const baseChance = Number(customerType.eventChance) || 0;
    const difficultyRate = Number(GameState.difficulty?.eventRate) || 1;
    const scenarioRate =
      Number(this.getCurrentDayScenario().eventRateMultiplier) || 1;

    return Math.min(0.95, baseChance * difficultyRate * scenarioRate);
  },

  getAvailableWantedProducts() {
    const scenario = this.getCurrentDayScenario();
    const scenarioWantedProductIds = new Set(scenario.wantedProductIds ?? []);
    const unlockedProducts = getUnlockedProducts(GameState.day);
    const unlockedRequestIds = new Set();

    unlockedProducts.forEach((product) => {
      unlockedRequestIds.add(product.id);

      (product.customerRequestIds ?? []).forEach((requestId) => {
        unlockedRequestIds.add(requestId);
      });
    });

    const candidates = CUSTOMER_WANTED_PRODUCTS.filter((product) => {
      const isInScenario =
        scenarioWantedProductIds.size === 0 ||
        scenarioWantedProductIds.has(product.id);
      const isUnlocked = unlockedRequestIds.has(product.id);

      return isInScenario && isUnlocked;
    });

    if (candidates.length > 0) {
      return candidates;
    }

    return CUSTOMER_WANTED_PRODUCTS.filter((product) => {
      return unlockedRequestIds.has(product.id);
    });
  },

  startRouteTimer() {
    this.stopRouteTimer();

    /*
      실제 Date 객체는 사용하지 않음.
      1초마다 게임 내 손님 상태만 갱신한다.
    */
    this.routeTimerId = setInterval(() => {
      this.updateCustomersByTick(1);
    }, 1000);
  },

  stopRouteTimer() {
    if (!this.routeTimerId) return;

    clearInterval(this.routeTimerId);
    this.routeTimerId = null;
  },

  pauseCustomerWaitTime() {
    this.isWaitTimePaused = true;
    this.isCustomerFlowPaused = true;
  },

  resumeCustomerWaitTime() {
    this.isWaitTimePaused = false;
    this.isCustomerFlowPaused = GameState.phase !== GAME_PHASE.STORE_RUNNING;
  },

  updateCustomersByTick(amount) {
    if (this.isCustomerFlowPaused) {
      return;
    }

    let changed = false;

    this.customers = this.customers.map((customer) => {
      if (customer.status === CUSTOMER_STATUS.ENTERING) {
        changed = true;
        return this.decreaseEnteringCustomerTime(customer, amount);
      }

      if (customer.status === CUSTOMER_STATUS.SHOPPING) {
        changed = true;
        return this.decreaseShoppingCustomerTime(customer, amount);
      }

      if (customer.status === CUSTOMER_STATUS.WAITING) {
        if (this.isWaitTimePaused) {
          return customer;
        }

        changed = true;
        return this.decreaseWaitingCustomerTime(customer, amount);
      }

      if (customer.status === CUSTOMER_STATUS.ANGRY) {
        changed = true;
        return this.markCustomerAsLeaving(customer, "angry_leave");
      }

      if (
        customer.status === CUSTOMER_STATUS.LEAVING &&
        customer.leaveReason === "wanted_product_out_of_stock" &&
        Number(customer.leavingRenderTime) > 0
      ) {
        changed = true;
        return {
          ...customer,
          leavingRenderTime: Math.max(
            0,
            Number(customer.leavingRenderTime) - amount
          )
        };
      }

      return customer;
    });

    if (changed) {
      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
    }
  },

  transitionCustomerStatus(customer, nextStatus) {
    const routeState = this.getRouteStateByStatus(nextStatus);

    return {
      ...customer,
      status: routeState.status,
      currentZone: routeState.currentZone,
      targetZone: routeState.targetZone
    };
  },

  getRouteStateByStatus(status) {
    const routeMap = {
      [CUSTOMER_STATUS.ENTERING]: {
        status: CUSTOMER_STATUS.ENTERING,
        currentZone: CUSTOMER_ZONES.DOOR,
        targetZone: CUSTOMER_ZONES.SHELF
      },
      [CUSTOMER_STATUS.SHOPPING]: {
        status: CUSTOMER_STATUS.SHOPPING,
        currentZone: CUSTOMER_ZONES.SHELF,
        targetZone: CUSTOMER_ZONES.COUNTER
      },
      [CUSTOMER_STATUS.WAITING]: {
        status: CUSTOMER_STATUS.WAITING,
        currentZone: CUSTOMER_ZONES.COUNTER,
        targetZone: CUSTOMER_ZONES.COUNTER
      },
      [CUSTOMER_STATUS.CHECKOUT]: {
        status: CUSTOMER_STATUS.CHECKOUT,
        currentZone: CUSTOMER_ZONES.COUNTER,
        targetZone: CUSTOMER_ZONES.EXIT
      },
      [CUSTOMER_STATUS.LEAVING]: {
        status: CUSTOMER_STATUS.LEAVING,
        currentZone: CUSTOMER_ZONES.EXIT,
        targetZone: CUSTOMER_ZONES.EXIT
      },
      [CUSTOMER_STATUS.ANGRY]: {
        status: CUSTOMER_STATUS.ANGRY,
        currentZone: CUSTOMER_ZONES.COUNTER,
        targetZone: CUSTOMER_ZONES.EXIT
      }
    };

    return routeMap[status] ?? routeMap[CUSTOMER_STATUS.ENTERING];
  },

  getDefaultEnteringTime() {
    return 2;
  },

  decreaseEnteringCustomerTime(customer, amount) {
    const safeAmount = Math.max(0, Number(amount) || 0);
    const rawEnteringTime = Number(customer.enteringTime);
    const currentEnteringTime = Number.isFinite(rawEnteringTime)
      ? Math.max(0, rawEnteringTime)
      : this.getDefaultEnteringTime();
    const nextEnteringTime = Math.max(0, currentEnteringTime - safeAmount);

    if (nextEnteringTime <= 0) {
      return {
        ...this.transitionCustomerStatus(customer, CUSTOMER_STATUS.SHOPPING),
        enteringTime: 0
      };
    }

    return {
      ...customer,
      enteringTime: nextEnteringTime
    };
  },

  getShoppingTimeByCustomerType(customerType) {
    const shoppingTimeMap = {
      hurried: 2,
      office_worker: 2,
      normal: 3,
      student: 3,
      difficult: 4
    };

    return shoppingTimeMap[customerType.id] ?? 3;
  },

  decreaseShoppingCustomerTime(customer, amount) {
    const safeAmount = Math.max(0, Number(amount) || 0);
    const currentShoppingTime = Math.max(0, Number(customer.shoppingTime) || 0);
    const nextShoppingTime = Math.max(0, currentShoppingTime - safeAmount);

    if (nextShoppingTime <= 0) {
      const carriedProduct = this.findStockedProductForRequest(
        customer.wantedProductId,
        1,
        customer.id
      );

      if (!carriedProduct) {
        return this.markCustomerAsLeaving({
          ...customer,
          shoppingTime: 0
        }, "wanted_product_out_of_stock");
      }

      const waitingCustomer = {
        ...this.transitionCustomerStatus(customer, CUSTOMER_STATUS.WAITING),
        shoppingTime: 0,
        carriedProductId: carriedProduct.id,
        carriedProductName: carriedProduct.name,
        carriedProductImagePath: carriedProduct.imagePath
      };

      return this.assignCounterQueueOrder(waitingCustomer);
    }

    return {
      ...customer,
      shoppingTime: nextShoppingTime
    };
  },

  assignCounterQueueOrder(customer) {
    if (Number.isFinite(Number(customer.queueOrder))) {
      return customer;
    }

    this.counterQueueOrderCounter += 1;

    return {
      ...customer,
      queueOrder: this.counterQueueOrderCounter
    };
  },

  decreaseWaitingCustomerTime(customer, amount) {
    const safeAmount = Math.max(0, Number(amount) || 0);
    const nextWaitTime = Math.max(0, customer.waitTime - safeAmount);

    const updatedCustomer = {
      ...customer,
      waitTime: nextWaitTime,
      mood: this.getMoodByWaitingPressure(customer, nextWaitTime)
    };

    if (nextWaitTime <= 0) {
      return this.markCustomerAsAngry(updatedCustomer, "wait_timeout");
    }

    return updatedCustomer;
  },

  findStockedProductForRequest(requestId, quantity = 1, customerId = null) {
    const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const candidates = getProductsByCustomerRequestId(requestId)
      .filter((product) => {
        return product.unlockDay <= GameState.day;
      })
      .map((product) => {
        const stockQuantity = Number(
          this.inventoryByProductId[product.id]?.quantity
        ) || 0;
        const reservedQuantity = this.getReservedCarriedQuantity(
          product.id,
          customerId
        );

        return {
          ...product,
          availableQuantity: Math.max(0, stockQuantity - reservedQuantity),
          nextExpireDay:
            this.inventoryByProductId[product.id]?.nextExpireDay ??
            Number.POSITIVE_INFINITY
        };
      })
      .filter((product) => {
        return product.availableQuantity >= safeQuantity;
      })
      .sort((first, second) => {
        if (first.nextExpireDay !== second.nextExpireDay) {
          return first.nextExpireDay - second.nextExpireDay;
        }

        return first.name.localeCompare(second.name);
      });

    return candidates[0] ?? null;
  },

  getReservedCarriedQuantity(productId, exceptCustomerId = null) {
    return this.customers.reduce((total, customer) => {
      if (
        customer.id === exceptCustomerId ||
        customer.carriedProductId !== productId ||
        customer.isSatisfied ||
        customer.hasReportedLeft ||
        customer.status === CUSTOMER_STATUS.LEAVING
      ) {
        return total;
      }

      return total + 1;
    }, 0);
  },

  getMoodByWaitingPressure(customer, waitTime) {
    const patience = Math.max(1, Number(customer.patience) || 1);
    const waitRatio = Math.max(0, waitTime) / patience;
    const angryThreshold = customer.typeId === "difficult" ? 0.6 : 0.25;

    if (waitRatio <= angryThreshold) {
      return "angry";
    }

    if (waitRatio <= 0.5) {
      return "impatient";
    }

    return customer.mood === "angry" ? "impatient" : "neutral";
  },

  markCustomerAsAngry(customer, reason = "unknown") {
    if (customer.hasReportedAngry) {
      return customer;
    }

    const angryCustomer = {
      ...customer,
      status: CUSTOMER_STATUS.ANGRY,
      mood: "angry",
      currentZone: CUSTOMER_ZONES.COUNTER,
      targetZone: CUSTOMER_ZONES.EXIT,
      hasReportedAngry: true
    };

    EventBus.emit(EVENTS.CUSTOMER_ANGRY, {
      ...this.createCustomerPayload(angryCustomer),
      reason
    });

    return angryCustomer;
  },

  markCustomerAsLeaving(customer, reason = "unknown") {
    if (customer.hasReportedLeft) {
      return customer;
    }

    const isWantedProductOutOfStock =
      reason === "wanted_product_out_of_stock";

    const leavingCustomer = {
      ...customer,
      status: CUSTOMER_STATUS.LEAVING,
      currentZone: isWantedProductOutOfStock
        ? CUSTOMER_ZONES.DOOR
        : CUSTOMER_ZONES.EXIT,
      targetZone: CUSTOMER_ZONES.EXIT,
      leaveReason: reason,
      ...(isWantedProductOutOfStock
        ? {
            leavingRenderTime: 2,
            bubbleText: "앗, 찾던 상품이 없네… 다음에 올게요."
          }
        : {}),
      hasReportedLeft: true
    };

    EventBus.emit(EVENTS.CUSTOMER_LEFT, {
      ...this.createCustomerPayload(leavingCustomer),
      reason
    });

    return leavingCustomer;
  },

  handleCheckoutCompleted(data = {}) {
    const customer = this.getCheckoutCustomerForCompletion(data);

    if (!customer) {
      console.warn("[CustomerSystem] 계산 가능한 손님이 없습니다.");
      return;
    }

    if (
      data.wantedProductId &&
      data.wantedProductId !== customer.wantedProductId
    ) {
      console.warn(
        `[CustomerSystem] Checkout product mismatch: expected ${customer.wantedProductId}, received ${data.wantedProductId}`
      );
    }

    this.enrichCheckoutPayload(data, customer);

    const checkedOutCustomer = {
      ...customer,
      status: CUSTOMER_STATUS.LEAVING,
      currentZone: CUSTOMER_ZONES.EXIT,
      targetZone: CUSTOMER_ZONES.EXIT,
      isSatisfied: true,
      mood: "neutral",

      /*
        CUSTOMER_LEFT는 이탈/손실 손님 통계로 사용하기 때문에
        만족한 손님은 CUSTOMER_LEFT를 emit하지 않는다.
      */
      hasReportedLeft: true
    };

    this.replaceCustomer(checkedOutCustomer);

    EventBus.emit(EVENTS.CUSTOMER_SATISFIED, {
      ...this.createCustomerPayload(checkedOutCustomer),
      checkoutId: data.checkoutId ?? null,
      productId: data.productId ?? null,
      productName: data.productName ?? null,
      quantity: data.quantity ?? 1,
      checkoutAmount: data.amount ?? 0
    });

    console.log(
      `[CustomerSystem] ${checkedOutCustomer.typeName} 계산 완료: ${checkedOutCustomer.wantedProductName}`
    );

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  enrichCheckoutPayload(data = {}, customer = null) {
    if (!customer) {
      return data;
    }

    const quantity = Math.max(1, Math.floor(Number(data.quantity) || 1));
    const carriedProduct =
      getProductById(customer.carriedProductId) ??
      this.findStockedProductForRequest(
        customer.wantedProductId,
        quantity,
        customer.id
      );

    data.day = Math.max(1, Math.floor(Number(data.day) || GameState.day || 1));
    data.customerId = data.customerId ?? customer.id;
    data.wantedProductId = data.wantedProductId ?? customer.wantedProductId;
    data.checkoutId =
      data.checkoutId ??
      `checkout-${data.day}-${customer.id}`;
    data.quantity = quantity;

    if (carriedProduct) {
      const shouldNormalizeAmount = !data.productId;

      data.productId = data.productId ?? carriedProduct.id;
      data.productName = data.productName ?? carriedProduct.name;

      if (
        shouldNormalizeAmount ||
        !Number.isFinite(Number(data.amount)) ||
        Number(data.amount) <= 0
      ) {
        data.amount = carriedProduct.salePrice * quantity;
      }
    }

    return data;
  },

  normalizeCheckoutCompletedPayload(data = {}) {
    if (data.day === undefined || data.day === null) {
      data.day = GameState.day;
    }

    return data;
  },

  getCheckoutCustomerForCompletion(data = {}) {
    if (data.customerId) {
      const customer = this.getCustomerById(data.customerId);

      if (customer && this.isCheckoutCandidate(customer)) {
        return customer;
      }

      console.warn(
        `[CustomerSystem] Checkout customer not found or unavailable: ${data.customerId}`
      );

      return null;
    }

    return this.getNextCheckoutCustomer();
  },

  closeCustomerFlow() {
    this.stopRouteTimer();
    this.stopSpawnTimer();
    this.isCustomerFlowPaused = false;
    this.isWaitTimePaused = false;

    this.customers = this.customers.map((customer) => {
      const shouldLeave =
        customer.status !== CUSTOMER_STATUS.LEAVING &&
        !customer.isSatisfied &&
        !customer.hasReportedLeft;

      if (!shouldLeave) {
        return customer;
      }

      return this.markCustomerAsLeaving(customer, "store_closed");
    });

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  replaceCustomer(updatedCustomer) {
    this.customers = this.customers.map((customer) => {
      if (customer.id !== updatedCustomer.id) {
        return customer;
      }

      return updatedCustomer;
    });
  },

  getCustomerById(customerId) {
    if (!customerId) {
      return null;
    }

    return this.customers.find((customer) => {
      return customer.id === customerId;
    }) ?? null;
  },

  createCustomerPayload(customer) {
    return {
      day: GameState.day,

      customerId: customer.id,
      customerTypeId: customer.typeId,
      customerTypeName: customer.typeName,

      wantedProductId: customer.wantedProductId,
      wantedProductName: customer.wantedProductName,
      carriedProductId: customer.carriedProductId ?? null,
      carriedProductName: customer.carriedProductName ?? null,
      carriedProductImagePath: customer.carriedProductImagePath ?? null,

      status: customer.status,
      currentZone: customer.currentZone,
      targetZone: customer.targetZone,
      waitTime: customer.waitTime,
      mood: customer.mood
    };
  },

  createRenderableCustomerPayload(customer) {
    return {
      customerId: customer.id,
      typeId: customer.typeId,
      typeName: customer.typeName,
      wantedProductId: customer.wantedProductId,
      wantedProductName: customer.wantedProductName,
      carriedProductId: customer.carriedProductId ?? null,
      carriedProductName: customer.carriedProductName ?? null,
      carriedProductImagePath:
        customer.carriedProductImagePath ??
        getProductById(customer.carriedProductId)?.imagePath ??
        null,
      status: customer.status,
      currentZone: customer.currentZone,
      targetZone: customer.targetZone,
      waitTime: customer.waitTime,
      mood: customer.mood,
      queueOrder: customer.queueOrder,
      isSatisfied: customer.isSatisfied,
      leaveReason: customer.leaveReason ?? null,
      leavingRenderTime: customer.leavingRenderTime ?? 0,
      bubbleText: customer.bubbleText ?? null
    };
  },

  getRenderableCustomers() {
    return this.customers
      .filter((customer) => {
        const shouldRenderLeavingCustomer =
          customer.status === CUSTOMER_STATUS.LEAVING &&
          customer.leaveReason === "wanted_product_out_of_stock" &&
          Number(customer.leavingRenderTime) > 0;

        return (
          shouldRenderLeavingCustomer ||
          (
            customer.status !== CUSTOMER_STATUS.LEAVING &&
            !customer.hasReportedLeft
          )
        );
      })
      .map((customer) => {
        return this.createRenderableCustomerPayload(customer);
      });
  },

  getCustomersByStatus(status) {
    return this.customers.filter((customer) => {
      return customer.status === status;
    });
  },

  getCustomersByZone(zone) {
    return this.customers.filter((customer) => {
      return customer.currentZone === zone;
    });
  },

  getCustomersNearDoor() {
    return this.getCustomersByZone(CUSTOMER_ZONES.DOOR);
  },

  getCustomersNearShelf() {
    return this.getCustomersByZone(CUSTOMER_ZONES.SHELF);
  },

  getWaitingCustomers() {
    return this.customers.filter((customer) => {
      return (
        customer.status === CUSTOMER_STATUS.WAITING &&
        customer.currentZone === CUSTOMER_ZONES.COUNTER &&
        !customer.isSatisfied &&
        !customer.hasReportedLeft
      );
    });
  },

  /*
    v2.2.1 병합 안정화:
    계산 대상 손님 조회 범위를 보완한다.

    우선순위:
    1. 계산대에서 waiting 상태인 손님
    2. 계산대 근처에 있는 active 손님
    3. shopping 상태 손님
    4. entering 상태 손님

    이유:
    - 테스트 타이밍에 따라 손님이 아직 waiting 상태가 아닐 수 있음
    - 팀원 시스템 연결 전까지 계산 이벤트가 먼저 발생해도 NPC 만족 처리가 가능해야 함
  */
  getCheckoutCandidates() {
    return this.customers.filter((customer) => {
      return this.isCheckoutCandidate(customer);
    });
  },

  isCheckoutCandidate(customer) {
    if (!customer) {
      return false;
    }

    return (
      !customer.isSatisfied &&
      !customer.hasReportedLeft &&
      customer.status !== CUSTOMER_STATUS.LEAVING
    );
  },

  getNextCheckoutCustomer() {
    const waitingCustomer = this.getWaitingCustomers()[0];

    if (waitingCustomer) {
      return waitingCustomer;
    }

    const candidates = this.getCheckoutCandidates();

    const counterCustomer = candidates.find((customer) => {
      return customer.currentZone === CUSTOMER_ZONES.COUNTER;
    });

    if (counterCustomer) {
      return counterCustomer;
    }

    const shoppingCustomer = candidates.find((customer) => {
      return customer.status === CUSTOMER_STATUS.SHOPPING;
    });

    if (shoppingCustomer) {
      return shoppingCustomer;
    }

    const enteringCustomer = candidates.find((customer) => {
      return customer.status === CUSTOMER_STATUS.ENTERING;
    });

    if (enteringCustomer) {
      return enteringCustomer;
    }

    return null;
  },

  markCustomerAsCheckout(customerId) {
    const customer = this.getCustomerById(customerId);

    if (!this.isCheckoutCandidate(customer)) {
      return null;
    }

    const checkoutCustomer = this.transitionCustomerStatus(
      customer,
      CUSTOMER_STATUS.CHECKOUT
    );

    this.replaceCustomer(checkoutCustomer);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return this.createCustomerPayload(checkoutCustomer);
  },

  handleStockShortageForCustomer(customerId, reason = "stock_shortage") {
    const customer = this.getCustomerById(customerId);

    if (!this.isCheckoutCandidate(customer)) {
      return null;
    }

    /*
      Prepared for a future EventBus contract with checkout or inventory systems.
      This is intentionally not wired to InventorySystem or PlayerActionSystem yet.
    */
    const updatedCustomer =
      customer.typeId === "difficult"
        ? this.markCustomerAsAngry(customer, reason)
        : this.markCustomerAsLeaving(customer, reason);

    this.replaceCustomer(updatedCustomer);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    return this.createCustomerPayload(updatedCustomer);
  },

  getAngryCustomers() {
    return this.getCustomersByStatus(CUSTOMER_STATUS.ANGRY);
  },

  getActiveCustomers() {
    return this.customers.filter((customer) => {
      return (
        customer.status !== CUSTOMER_STATUS.LEAVING &&
        !customer.isSatisfied &&
        !customer.hasReportedLeft
      );
    });
  },

  getCheckoutCustomerPayload() {
    const customer = this.getNextCheckoutCustomer();

    if (!customer) {
      return null;
    }

    return this.createCustomerPayload(customer);
  },

  getAvailableEventsForCustomer(customer) {
    return RandomEventSystem.getAvailableEventsForCustomer(customer, GameState.day);
  },

  canTriggerCustomerEvent(customer, randomValue = Math.random()) {
    const event = this.pickCustomerEvent(customer, randomValue);

    if (!event) {
      return false;
    }

    return RandomEventSystem.canTriggerEvent(customer, event, randomValue);
  },

  pickCustomerEvent(customer, randomValue = Math.random()) {
    return RandomEventSystem.pickEventForCustomer(customer, randomValue);
  },

  getRandomEventTargetCustomer() {
    const candidates = this.getWaitingCustomers().filter((customer) => {
      return this.getAvailableEventsForCustomer(customer).length > 0;
    });

    return RandomEventSystem.pickEventTargetCustomer(candidates, GameState.day);
  },

  createRandomEventCandidatePayload() {
    const customer = this.getRandomEventTargetCustomer();

    if (!customer) {
      return null;
    }

    const eventDetail = this.pickCustomerEvent(customer);

    if (!eventDetail) {
      return null;
    }

    return RandomEventSystem.createEventPayload(customer, eventDetail);
  }
};
