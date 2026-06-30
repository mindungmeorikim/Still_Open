/*
  RandomEventSystem.js

  Role:
  - Select customer-only surprise random events while a customer waits at the counter.
  - Roll once per customer with an adjustable 15~20% occurrence chance.
  - Apply Day/type probability, mental modifiers, and repeat limits after occurrence succeeds.
  - Build UI-ready payloads.
  - Does not directly change revenue or inventory.
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import { getDayScenario } from "../data/DayScenarioData.js";
import {
  CUSTOMER_EVENT_DETAILS,
  CUSTOMER_EVENT_TYPES,
  getAvailableEventDetails,
  getCustomerEventDetail
} from "../data/EventData.js";
import { InventorySystem } from "./InventorySystem.js";

const EVENT_TYPE_RATE_BY_DAY = Object.freeze({
  1: Object.freeze({ positive: 45, neutral: 30, negative: 25 }),
  2: Object.freeze({ positive: 35, neutral: 30, negative: 35 }),
  3: Object.freeze({ positive: 30, neutral: 25, negative: 45 }),
  4: Object.freeze({ positive: 25, neutral: 25, negative: 50 }),
  5: Object.freeze({ positive: 20, neutral: 25, negative: 55 })
});

const EVENT_TYPE_LABELS = Object.freeze({
  [CUSTOMER_EVENT_TYPES.POSITIVE]: "긍정",
  [CUSTOMER_EVENT_TYPES.NEUTRAL]: "중립",
  [CUSTOMER_EVENT_TYPES.NEGATIVE]: "부정"
});

const SURPRISE_EVENT_CHANCE_MIN = 0.1;
const SURPRISE_EVENT_CHANCE_BASE = 0.1;
const SURPRISE_EVENT_CHANCE_MAX = 0.1;
const MAX_EVENTS_PER_CUSTOMER_PER_DAY = 1;

export const RandomEventSystem = {
  stateDay: null,
  rollTick: 0,
  evaluatedCustomerKeys: new Set(),
  customerTriggerCountByKey: new Map(),
  appliedChoiceEffectKeys: new Set(),
  lastEventId: null,
  lastEventType: null,
  sameTypeStreak: 0,

  getCurrentDay() {
    return Math.max(1, Math.floor(Number(GameState.day) || 1));
  },

  resetDailyStateIfNeeded(day = this.getCurrentDay()) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));

    if (this.stateDay === safeDay) {
      return;
    }

    this.stateDay = safeDay;
    this.rollTick = 0;
    this.evaluatedCustomerKeys.clear();
    this.customerTriggerCountByKey.clear();
    this.appliedChoiceEffectKeys.clear();
    this.lastEventId = null;
    this.lastEventType = null;
    this.sameTypeStreak = 0;
  },

  createCustomerKey(customer, day = this.getCurrentDay()) {
    const customerId = customer?.customerId ?? customer?.id ?? "unknown";
    return `${Math.max(1, Math.floor(Number(day) || 1))}:${customerId}`;
  },

  getCustomerTriggerCount(customer, day = this.getCurrentDay()) {
    this.resetDailyStateIfNeeded(day);
    return this.customerTriggerCountByKey.get(this.createCustomerKey(customer, day)) ?? 0;
  },

  canRollForCustomer(customer, day = this.getCurrentDay()) {
    if (!customer?.typeId) {
      return false;
    }

    this.resetDailyStateIfNeeded(day);

    const customerKey = this.createCustomerKey(customer, day);
    const triggerCount = this.customerTriggerCountByKey.get(customerKey) ?? 0;

    return (
      !this.evaluatedCustomerKeys.has(customerKey) &&
      triggerCount < MAX_EVENTS_PER_CUSTOMER_PER_DAY
    );
  },

  markCustomerRollAttempted(customer, day = this.getCurrentDay()) {
    this.resetDailyStateIfNeeded(day);

    if (!customer?.typeId) {
      return;
    }

    this.evaluatedCustomerKeys.add(this.createCustomerKey(customer, day));
  },

  markCustomerEventTriggered(customer, day = this.getCurrentDay()) {
    this.resetDailyStateIfNeeded(day);

    if (!customer?.typeId) {
      return;
    }

    const customerKey = this.createCustomerKey(customer, day);
    const currentCount = this.customerTriggerCountByKey.get(customerKey) ?? 0;

    this.evaluatedCustomerKeys.add(customerKey);
    this.customerTriggerCountByKey.set(
      customerKey,
      Math.min(MAX_EVENTS_PER_CUSTOMER_PER_DAY, currentCount + 1)
    );
  },

  createChoiceStatEffects(choice = {}) {
    const sourceEffects = choice.effects ?? {};
    const statEffects = { ...sourceEffects };
    const satisfaction = Number(sourceEffects.satisfaction);
    const mental = Number(sourceEffects.mental);
    const revenue = Number(sourceEffects.revenue);
    const cost = Number(sourceEffects.cost);

    statEffects.satisfaction = Number.isFinite(satisfaction) ? satisfaction : 0;
    statEffects.mental = Number.isFinite(mental) ? mental : 0;
    statEffects.revenue = Number.isFinite(revenue) ? revenue : 0;
    statEffects.cost = Number.isFinite(cost) ? cost : 0;
    statEffects.applyRevenue = sourceEffects.applyRevenue === true;
    statEffects.applyCost = sourceEffects.applyCost === true;
    statEffects.applyInventory = sourceEffects.applyInventory === true;
    statEffects.requireInventoryForRevenue =
      sourceEffects.requireInventoryForRevenue === true;
    statEffects.economicMode = sourceEffects.economicMode ?? "stat_only";
    statEffects.inventoryChanges = Array.isArray(choice.inventoryChanges)
      ? choice.inventoryChanges.map((change) => ({ ...change }))
      : Array.isArray(sourceEffects.inventoryChanges)
        ? sourceEffects.inventoryChanges.map((change) => ({ ...change }))
        : [];

    return statEffects;
  },

  getScenarioEventRateMultiplier(day = this.getCurrentDay()) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const scenario = getDayScenario(safeDay);
    const scenarioRate = Number(scenario?.eventRateMultiplier);

    return Number.isFinite(scenarioRate) && scenarioRate > 0
      ? scenarioRate
      : 1;
  },

  getBaseOccurrenceChance(customer = null) {
    const mental = Number(GameState.mental);
    const satisfaction = Number(GameState.satisfaction);
    const customerChance = Number(customer?.eventChance);
    let chance = SURPRISE_EVENT_CHANCE_BASE;

    if (Number.isFinite(customerChance) && customerChance >= 0.15 && customerChance <= 0.2) {
      chance = customerChance;
    }

    if (Number.isFinite(mental) && mental <= 30) {
      chance -= 0.03;
    }

    if (Number.isFinite(satisfaction) && satisfaction <= 30) {
      chance += 0.02;
    }

    return Math.min(
      SURPRISE_EVENT_CHANCE_MAX,
      Math.max(SURPRISE_EVENT_CHANCE_MIN, chance)
    );
  },

  getEventOccurrenceChance(customer, day = this.getCurrentDay()) {
    if (!customer) {
      return 0;
    }

    const baseChance = this.getBaseOccurrenceChance(customer);
    const scenarioRate = this.getScenarioEventRateMultiplier(day);
    const difficultyRate = Number(GameState.difficulty?.eventRate) || 1;
    const scaledChance = baseChance * Math.sqrt(Math.max(0.5, scenarioRate * difficultyRate));

    return Math.min(
      SURPRISE_EVENT_CHANCE_MAX,
      Math.max(SURPRISE_EVENT_CHANCE_MIN, scaledChance)
    );
  },

  getEventChance(customer, eventDetail, day = this.getCurrentDay()) {
    if (!customer || !eventDetail) {
      return 0;
    }

    return this.getEventOccurrenceChance(customer, day);
  },

  canTriggerEvent(customer, eventDetail, randomValue = Math.random()) {
    if (!customer || !eventDetail) {
      return false;
    }

    const safeRandomValue = Math.min(Math.max(Number(randomValue) || 0, 0), 1);
    const eventChance = this.getEventChance(customer, eventDetail);

    return safeRandomValue < eventChance;
  },

  getTypeRatesByDay(day = this.getCurrentDay()) {
    const safeDay = Math.max(1, Math.floor(Number(day) || 1));
    const cappedDay = Math.min(5, safeDay);
    const baseRates = EVENT_TYPE_RATE_BY_DAY[cappedDay] ?? EVENT_TYPE_RATE_BY_DAY[5];

    return {
      positive: baseRates.positive,
      neutral: baseRates.neutral,
      negative: baseRates.negative
    };
  },

  applyMentalRateModifier(rates) {
    const mental = Number(GameState.mental);
    const adjustedRates = { ...rates };

    if (Number.isFinite(mental) && mental <= 15) {
      adjustedRates.positive += 35;
      adjustedRates.neutral -= 5;
      adjustedRates.negative -= 30;
    } else if (Number.isFinite(mental) && mental <= 30) {
      adjustedRates.positive += 20;
      adjustedRates.negative -= 20;
    } else if (Number.isFinite(mental) && mental >= 70) {
      adjustedRates.positive -= 5;
      adjustedRates.negative += 5;
    }

    return this.normalizeTypeRates(adjustedRates);
  },

  normalizeTypeRates(rates) {
    const normalizedRates = {
      positive: Math.max(0, Number(rates.positive) || 0),
      neutral: Math.max(0, Number(rates.neutral) || 0),
      negative: Math.max(0, Number(rates.negative) || 0)
    };
    const total =
      normalizedRates.positive + normalizedRates.neutral + normalizedRates.negative;

    if (total <= 0) {
      return { positive: 34, neutral: 33, negative: 33 };
    }

    return normalizedRates;
  },

  removeTypeFromRates(rates, eventType) {
    return this.normalizeTypeRates({
      ...rates,
      [eventType]: 0
    });
  },

  shouldForcePositiveType() {
    const mental = Number(GameState.mental);

    return (
      this.lastEventType === CUSTOMER_EVENT_TYPES.NEGATIVE &&
      this.sameTypeStreak >= 2 &&
      Number.isFinite(mental) &&
      mental <= 20
    );
  },

  pickEventType(rates, randomValue = Math.random()) {
    const safeRates = this.normalizeTypeRates(rates);
    const total = safeRates.positive + safeRates.neutral + safeRates.negative;
    const target = Math.min(Math.max(Number(randomValue) || 0, 0), 0.999999) * total;

    if (target < safeRates.positive) {
      return CUSTOMER_EVENT_TYPES.POSITIVE;
    }

    if (target < safeRates.positive + safeRates.neutral) {
      return CUSTOMER_EVENT_TYPES.NEUTRAL;
    }

    return CUSTOMER_EVENT_TYPES.NEGATIVE;
  },

  getCandidateTypeOrder(preferredType, rates) {
    const types = [
      CUSTOMER_EVENT_TYPES.POSITIVE,
      CUSTOMER_EVENT_TYPES.NEUTRAL,
      CUSTOMER_EVENT_TYPES.NEGATIVE
    ];
    const remainingTypes = types
      .filter((type) => type !== preferredType)
      .sort((first, second) => {
        return (Number(rates[second]) || 0) - (Number(rates[first]) || 0);
      });

    return [preferredType, ...remainingTypes];
  },

  getAvailableEventsForCustomer(customer, day = this.getCurrentDay(), eventType = null) {
    if (!customer?.typeId) {
      return [];
    }

    return getAvailableEventDetails(day, customer.typeId, eventType);
  },

  getFilteredEventsByType(customer, eventType, day = this.getCurrentDay()) {
    return this.getAvailableEventsForCustomer(customer, day, eventType).filter((eventDetail) => {
      return eventDetail.id !== this.lastEventId;
    });
  },

  pickWeightedEvent(eventDetails) {
    if (!Array.isArray(eventDetails) || eventDetails.length === 0) {
      return null;
    }

    const weightedEvents = eventDetails.map((eventDetail) => {
      return {
        eventDetail,
        weight: Math.max(1, Number(eventDetail.priority) || 1)
      };
    });
    const totalWeight = weightedEvents.reduce((sum, entry) => {
      return sum + entry.weight;
    }, 0);
    let target = Math.random() * totalWeight;

    for (const entry of weightedEvents) {
      target -= entry.weight;

      if (target <= 0) {
        return entry.eventDetail;
      }
    }

    return weightedEvents[weightedEvents.length - 1].eventDetail;
  },

  pickEventTargetCustomer(customers = [], day = this.getCurrentDay()) {
    this.resetDailyStateIfNeeded(day);
    this.rollTick += 1;

    const candidates = Array.isArray(customers)
      ? customers.filter((customer) => {
          return this.canRollForCustomer(customer, day);
        })
      : [];

    if (candidates.length === 0) {
      return null;
    }

    const weightedCustomers = candidates.map((customer) => {
      return {
        customer,
        weight: Math.max(1, Math.round(this.getEventOccurrenceChance(customer, day) * 100))
      };
    });
    const totalWeight = weightedCustomers.reduce((sum, entry) => {
      return sum + entry.weight;
    }, 0);
    let target = Math.random() * totalWeight;

    for (const entry of weightedCustomers) {
      target -= entry.weight;

      if (target <= 0) {
        return entry.customer;
      }
    }

    return weightedCustomers[weightedCustomers.length - 1].customer;
  },

  pickEventForCustomer(customer, randomValue = Math.random()) {
    const day = this.getCurrentDay();

    if (!customer?.typeId) {
      return null;
    }

    this.resetDailyStateIfNeeded(day);

    if (!this.canRollForCustomer(customer, day)) {
      return null;
    }

    this.markCustomerRollAttempted(customer, day);

    const occurrenceChance = this.getEventOccurrenceChance(customer, day);
    const occurrenceRandomValue = Math.min(Math.max(Number(randomValue) || 0, 0), 1);

    if (occurrenceRandomValue >= occurrenceChance) {
      return null;
    }

    let typeRates = this.applyMentalRateModifier(this.getTypeRatesByDay(day));
    const blockedEventTypes = new Set();

    if (
      this.sameTypeStreak >= 2 &&
      (this.lastEventType === CUSTOMER_EVENT_TYPES.POSITIVE ||
        this.lastEventType === CUSTOMER_EVENT_TYPES.NEGATIVE)
    ) {
      blockedEventTypes.add(this.lastEventType);
      typeRates = this.removeTypeFromRates(typeRates, this.lastEventType);
    }

    if (this.shouldForcePositiveType()) {
      blockedEventTypes.add(CUSTOMER_EVENT_TYPES.NEGATIVE);
      typeRates = this.removeTypeFromRates(typeRates, CUSTOMER_EVENT_TYPES.NEGATIVE);
    }

    const preferredType = this.shouldForcePositiveType()
      ? CUSTOMER_EVENT_TYPES.POSITIVE
      : this.pickEventType(typeRates);
    const candidateTypeOrder = this.getCandidateTypeOrder(preferredType, typeRates)
      .filter((eventType) => {
        return !blockedEventTypes.has(eventType);
      });

    for (const eventType of candidateTypeOrder) {
      const candidates = this.getFilteredEventsByType(customer, eventType, day);

      if (candidates.length > 0) {
        return this.pickWeightedEvent(candidates);
      }
    }

    return null;
  },

  recordTriggeredEvent(eventDetail, customer = null) {
    if (!eventDetail?.id || !eventDetail?.type) {
      return;
    }

    if (this.lastEventType === eventDetail.type) {
      this.sameTypeStreak += 1;
    } else {
      this.sameTypeStreak = 1;
    }

    this.lastEventId = eventDetail.id;
    this.lastEventType = eventDetail.type;
    this.markCustomerEventTriggered(customer);
  },

  createEventPayload(customer, eventDetail) {
    if (!customer || !eventDetail) {
      return null;
    }

    const detail =
      getCustomerEventDetail(eventDetail.id) ??
      CUSTOMER_EVENT_DETAILS.find((candidate) => {
        return candidate.id === eventDetail.id;
      });

    if (!detail) {
      return null;
    }

    const choices = Array.isArray(detail.choices)
      ? detail.choices.map((choice) => {
          const missingRequirements =
            this.getMissingProductInventoryRequirements(choice);
          const disabled =
            this.isChoiceBlockedByMissingProductStock(choice);

          return {
            choiceId: choice.id,
            label: choice.label,
            description: choice.description,
            disabled,
            disabledReason: disabled ? "필요 재고 부족" : null,
            missingRequirements,
            resultTitle: choice.resultTitle,
            customerReaction: choice.customerReaction,
            playerThought: choice.playerThought,
            resultText: choice.resultText,
            specialEffect: choice.specialEffect,
            inventoryChanges: Array.isArray(choice.inventoryChanges)
              ? choice.inventoryChanges.map((change) => ({ ...change }))
              : [],
            effects: this.createChoiceStatEffects(choice)
          };
        })
      : [];

    if (
      choices.length === 0 ||
      choices.every((choice) => {
        return choice.disabled === true;
      })
    ) {
      return null;
    }

    this.recordTriggeredEvent(detail, customer);

    const customerId = customer.customerId ?? customer.id ?? null;

    return {
      day: this.getCurrentDay(),
      eventInstanceId: `customer-event-${this.getCurrentDay()}-${customerId ?? "unknown"}-${this.rollTick}`,
      eventId: detail.id,
      eventType: detail.type,
      eventTypeLabel: detail.typeLabel ?? EVENT_TYPE_LABELS[detail.type] ?? "이벤트",
      eventTitle: detail.title,
      eventSummary: detail.summary,
      dialogue: detail.dialogue,
      customerId,
      customerTypeId: customer.customerTypeId ?? customer.typeId ?? null,
      customerTypeName: customer.customerTypeName ?? customer.typeName ?? "",
      wantedProductId: customer.wantedProductId ?? null,
      wantedProductName: customer.wantedProductName ?? "",
      choices,
      ui: detail.ui ?? {}
    };
  },

  applyCustomerEventChoiceEffects(eventPayload = {}, choice = {}) {
    const day = Math.max(1, Math.floor(Number(eventPayload.day) || GameState.day || 1));

    this.resetDailyStateIfNeeded(day);

    const effectKey = this.createChoiceEffectKey(eventPayload, choice, day);

    if (!effectKey) {
      return {
        success: false,
        reason: "missing_effect_key",
        appliedRevenue: 0,
        appliedPenalty: 0,
        inventoryResult: null
      };
    }

    if (this.appliedChoiceEffectKeys.has(effectKey)) {
      return {
        success: false,
        reason: "duplicate_choice_effect",
        appliedRevenue: 0,
        appliedPenalty: 0,
        inventoryResult: null
      };
    }

    this.appliedChoiceEffectKeys.add(effectKey);

    const effects = choice.effects ?? {};
    const revenue = Number(effects.revenue) || 0;
    const cost = Number(effects.cost) || 0;
    const inventoryChanges = this.getApplicableInventoryChanges(choice);
    const productInventoryRequirements =
      this.getChoiceProductInventoryRequirements(choice);
    const details = {
      day,
      eventInstanceId: eventPayload.eventInstanceId ?? null,
      eventId: eventPayload.eventId ?? null,
      eventTitle: eventPayload.eventTitle ?? null,
      customerId: eventPayload.customerId ?? null,
      choiceId: choice.choiceId ?? choice.id ?? null,
      reason: "customer_event_choice"
    };
    let inventoryResult = null;

    if (
      effects.applyRevenue === true &&
      revenue > 0 &&
      productInventoryRequirements.length > 0 &&
      !this.hasStockForProductInventoryRequirements(productInventoryRequirements)
    ) {
      return {
        success: false,
        reason: "inventory_shortage_revenue_blocked",
        effectKey,
        appliedRevenue: 0,
        appliedPenalty: 0,
        inventoryResult: {
          success: false,
          reason: "stock_shortage",
          failedChange: productInventoryRequirements.find((requirement) => {
            return requirement.availableQuantity < requirement.requiredQuantity;
          }) ?? productInventoryRequirements[0],
          appliedChanges: [],
          skippedChanges: []
        }
      };
    }

    if (effects.applyInventory === true) {
      inventoryResult = InventorySystem.applyEventInventoryChanges(
        inventoryChanges,
        details
      );
    }

    const shouldBlockRevenue =
      effects.requireInventoryForRevenue === true &&
      inventoryResult &&
      inventoryResult.success === false;
    let appliedRevenue = 0;
    let appliedPenalty = 0;

    if (effects.applyRevenue === true && revenue > 0 && !shouldBlockRevenue) {
      appliedRevenue = revenue;

      EventBus.emit(EVENTS.REVENUE_CHANGED, {
        ...details,
        amount: revenue,
        source: "customer_event",
        economicMode: effects.economicMode ?? "event_revenue"
      });
    }

    if (effects.applyRevenue === true && revenue < 0) {
      appliedPenalty += Math.abs(revenue);
    }

    if (effects.applyCost === true && cost > 0) {
      appliedPenalty += cost;
    }

    if (appliedPenalty > 0) {
      EventBus.emit(EVENTS.EVENT_PENALTY_RECORDED, {
        ...details,
        amount: appliedPenalty,
        source: "customer_event",
        economicMode: revenue < 0 ? "event_revenue_loss" : "event_cost"
      });
    }

    return {
      success: true,
      reason: shouldBlockRevenue ? "inventory_failed_revenue_blocked" : "applied",
      effectKey,
      appliedRevenue,
      appliedPenalty,
      inventoryResult
    };
  },

  createChoiceEffectKey(eventPayload = {}, choice = {}, day = this.getCurrentDay()) {
    const eventId = eventPayload.eventId;
    const choiceId = choice.choiceId ?? choice.id;

    if (!eventId || !choiceId) {
      return null;
    }

    const customerId = eventPayload.customerId ?? "unknown";
    const eventInstanceId = eventPayload.eventInstanceId ?? "no-instance";

    return `${day}:${customerId}:${eventId}:${choiceId}:${eventInstanceId}`;
  },

  getApplicableInventoryChanges(choice = {}) {
    const effects = choice.effects ?? {};
    const changes =
      Array.isArray(choice.inventoryChanges) && choice.inventoryChanges.length > 0
        ? choice.inventoryChanges
        : Array.isArray(effects.inventoryChanges)
          ? effects.inventoryChanges
          : [];

    return changes.filter((change) => {
      return change.apply === true && change.productId && Number(change.quantity) !== 0;
    });
  },

  getChoiceProductInventoryRequirements(choice = {}) {
    const requiredQuantityByProductId = new Map();

    this.getApplicableInventoryChanges(choice).forEach((change) => {
      const quantity = Math.floor(Number(change.quantity) || 0);

      if (quantity >= 0) {
        return;
      }

      const currentQuantity =
        requiredQuantityByProductId.get(change.productId) ?? 0;

      requiredQuantityByProductId.set(
        change.productId,
        currentQuantity + Math.abs(quantity)
      );
    });

    return [...requiredQuantityByProductId.entries()].map(
      ([productId, requiredQuantity]) => {
        return {
          productId,
          requiredQuantity,
          availableQuantity: InventorySystem.getStockQuantity(productId)
        };
      }
    );
  },

  hasStockForProductInventoryRequirements(requirements = []) {
    return requirements.every((requirement) => {
      return requirement.availableQuantity >= requirement.requiredQuantity;
    });
  },

  getMissingProductInventoryRequirements(choice = {}) {
    return this.getChoiceProductInventoryRequirements(choice)
      .filter((requirement) => {
        return requirement.availableQuantity < requirement.requiredQuantity;
      })
      .map((requirement) => {
        return { ...requirement };
      });
  },

  isChoiceBlockedByMissingProductStock(choice = {}) {
    const effects = choice.effects ?? {};
    const revenue = Number(effects.revenue) || 0;
    const requirements = this.getChoiceProductInventoryRequirements(choice);

    return (
      effects.applyRevenue === true &&
      revenue > 0 &&
      requirements.length > 0 &&
      !this.hasStockForProductInventoryRequirements(requirements)
    );
  },

  createRandomEventCandidatePayload(customer, randomValue = Math.random()) {
    if (!customer?.typeId) {
      return null;
    }

    const eventDetail = this.pickEventForCustomer(customer, randomValue);

    if (!eventDetail) {
      return null;
    }

    return this.createEventPayload(customer, eventDetail);
  }
};
