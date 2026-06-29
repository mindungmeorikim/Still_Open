/*
  RandomEventSystem.js

  Role:
  - Select available customer event details.
  - Build UI-ready event payloads.
  - Does not emit events or apply effects yet.
*/

import { GameState } from "../core/GameState.js";
import { getDayScenario } from "../data/DayScenarioData.js";
import {
  CUSTOMER_EVENT_DETAILS,
  getAvailableEventDetails,
  getCustomerEventDetail
} from "../data/EventData.js";

export const RandomEventSystem = {
  getCurrentDay() {
    return Math.max(1, Math.floor(Number(GameState.day) || 1));
  },

  createChoiceStatEffects(choice = {}) {
    const sourceEffects = choice.effects ?? {};
    const statEffects = {};
    const satisfaction = Number(sourceEffects.satisfaction);
    const mental = Number(sourceEffects.mental);

    if (Number.isFinite(satisfaction)) {
      statEffects.satisfaction = satisfaction;
    }

    if (Number.isFinite(mental)) {
      statEffects.mental = mental;
    }

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

  getAvailableEventsForCustomer(customer, day = this.getCurrentDay()) {
    if (!customer?.typeId) {
      return [];
    }

    return getAvailableEventDetails(day, customer.typeId);
  },

  getEventChance(customer, eventDetail, day = this.getCurrentDay()) {
    if (!customer || !eventDetail) {
      return 0;
    }

    const customerChance = Number(customer.eventChance) || 0;
    const eventChance = Number(eventDetail.baseChance) || 0;
    const scenarioRate = this.getScenarioEventRateMultiplier(day);
    const difficultyRate = Number(GameState.difficulty?.eventRate) || 1;
    const baseChance = Math.max(customerChance, eventChance);

    return Math.min(0.95, baseChance * scenarioRate * difficultyRate);
  },

  canTriggerEvent(
    customer,
    eventDetail,
    randomValue = Math.random()
  ) {
    if (!customer || !eventDetail) {
      return false;
    }

    const safeRandomValue = Math.min(Math.max(Number(randomValue) || 0, 0), 1);
    const eventChance = this.getEventChance(customer, eventDetail);

    return safeRandomValue < eventChance;
  },

  pickEventForCustomer(customer, randomValue = Math.random()) {
    if (!customer?.typeId) {
      return null;
    }

    const availableEvents = this.getAvailableEventsForCustomer(customer);

    if (availableEvents.length === 0) {
      return null;
    }

    const triggerableEvents = availableEvents.filter((eventDetail) => {
      return this.canTriggerEvent(customer, eventDetail, randomValue);
    });

    if (triggerableEvents.length === 0) {
      return null;
    }

    return triggerableEvents
      .slice()
      .sort((first, second) => {
        return (Number(second.priority) || 0) - (Number(first.priority) || 0);
      })[0];
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
          return {
            choiceId: choice.id,
            label: choice.label,
            description: choice.description,
            resultText: choice.resultText,
            effects: this.createChoiceStatEffects(choice)
          };
        })
      : [];

    return {
      day: this.getCurrentDay(),
      eventId: detail.id,
      eventTitle: detail.title,
      eventSummary: detail.summary,
      dialogue: detail.dialogue,
      customerId: customer.customerId ?? customer.id ?? null,
      customerTypeId: customer.customerTypeId ?? customer.typeId ?? null,
      customerTypeName: customer.customerTypeName ?? customer.typeName ?? "",
      wantedProductId: customer.wantedProductId ?? null,
      wantedProductName: customer.wantedProductName ?? "",
      choices,
      ui: detail.ui ?? {}
    };
  },

  createRandomEventCandidatePayload(
    customer,
    randomValue = Math.random()
  ) {
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
