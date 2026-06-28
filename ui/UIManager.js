/*
  UIManager.js
  역할: 화면 표시 및 버튼 이벤트 연결
  규칙: 시스템 직접 호출 금지, EventBus 사용
*/

import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import { GameState } from "../core/GameState.js";
import { CustomerSystem } from "../systems/CustomerSystem.js";

export const UIManager = {
  resultModal: null,

  init() {
    this.bindButtons();
    this.bindGameEvents();
    this.createResultModal();
    this.render();
    this.renderCustomers();
    this.showMessage("게임 준비 완료. Day 시작 버튼을 눌러주세요.");
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
      customerNode.textContent = this.getCustomerDisplayText(customer);
      customerNode.title = `${customer.typeName} / ${customer.wantedProductName}`;
    });
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
    document.getElementById("day-info").textContent = `Day ${GameState.day}`;
    document.getElementById("money-info").textContent = `₩${GameState.money.toLocaleString()}`;
    document.getElementById("satisfaction-info").textContent = `만족도 ${GameState.satisfaction}`;
    document.getElementById("mental-info").textContent = `멘탈 ${GameState.mental}`;
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
  }
};
