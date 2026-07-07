/*
  RewardInboxUI.js

  Minimal reward inbox UI. Reward grant logic stays in RewardInboxSystem.
*/

import { EventBus } from "../core/EventBus.js";
import { RewardInboxSystem, REWARD_INBOX_EVENTS } from "../systems/RewardInboxSystem.js";
import { BM_ASSETS } from "../data/BMAssetMap.js";
import { RewardCodeUI } from "./RewardCodeUI.js";

export const RewardInboxUI = {
  isInitialized: false,
  modal: null,
  lastMessage: "",
  lastMessageType: "",

  getGameModalHost() {
    return document.getElementById("game-root") ?? document.body;
  },

  mountGameModal(modal) {
    if (!modal) return null;

    const host = this.getGameModalHost();

    if (host && modal.parentElement !== host) {
      host.appendChild(modal);
    }

    return modal;
  },

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    RewardCodeUI.init();

    EventBus.on(REWARD_INBOX_EVENTS.UPDATED, () => {
      this.render();
      this.renderBadge();
    });

    EventBus.on(REWARD_INBOX_EVENTS.CLAIMED, (result = {}) => {
      this.lastMessage = result.message ?? "보상을 수령했습니다.";
      this.lastMessageType = "success";
      this.render();
      this.renderBadge();
    });

    EventBus.on(REWARD_INBOX_EVENTS.CLAIM_FAILED, (result = {}) => {
      this.lastMessage = result.message ?? "보상을 수령할 수 없습니다.";
      this.lastMessageType = "error";
      this.render();
    });
  },

  ensureEntryButton(topIconMenu = document.getElementById("top-icon-menu"), beforeNode = null) {
    if (!topIconMenu) return null;

    let button = document.getElementById("reward-inbox-button");

    const insertBeforeNode = beforeNode?.parentElement === topIconMenu
      ? beforeNode
      : topIconMenu.firstChild;

    if (!button) {
      button = document.createElement("button");
      button.id = "reward-inbox-button";
      button.className = "hud-icon-button reward-inbox-button";
    }

    if (insertBeforeNode !== button && (
      button.parentElement !== topIconMenu ||
      (insertBeforeNode && button.nextElementSibling !== insertBeforeNode)
    )) {
      topIconMenu.insertBefore(button, insertBeforeNode);
    }

    button.type = "button";
    button.disabled = false;
    button.hidden = false;
    button.tabIndex = 0;
    button.title = "보상함";
    button.setAttribute("aria-label", "보상함 열기");
    button.setAttribute("aria-disabled", "false");
    button.removeAttribute("aria-hidden");
    button.innerHTML = `
      <span class="reward-inbox-button-icon" aria-hidden="true">
        <img src="./assets/ui/icons/reward_inbox_gift.svg" alt="" draggable="false" />
      </span>
      <span class="top-icon-button-label">보상함</span>
      <span id="reward-inbox-badge" class="reward-inbox-badge"></span>
    `;
    button.onclick = () => this.open();

    this.renderBadge();

    return button;
  },

  createModal() {
    let modal = document.getElementById("reward-inbox-modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "reward-inbox-modal";
      modal.className = "modal reward-inbox-modal hidden";
      modal.innerHTML = `
        <div class="reward-inbox-modal-content" role="dialog" aria-modal="true" aria-labelledby="reward-inbox-title">
          <header class="reward-inbox-modal-header">
            <div class="reward-inbox-title-block">
              <span class="reward-inbox-eyebrow">INBOX</span>
              <h2 id="reward-inbox-title">보상함</h2>
              <p>도착한 선물과 쿠폰을 확인하세요.</p>
            </div>
            <span class="reward-inbox-header-gift" aria-hidden="true">
              <img src="./assets/ui/icons/reward_inbox_gift.svg" alt="" draggable="false" />
            </span>
            <button id="reward-inbox-close-button" class="reward-inbox-close-button" type="button" aria-label="보상함 닫기">×</button>
          </header>
          <div class="reward-inbox-toolbar">
            <p id="reward-inbox-message" class="reward-inbox-message" role="status" aria-live="polite"></p>
            <button id="reward-inbox-claim-all-button" class="reward-inbox-claim-all-button" type="button">모두 받기</button>
          </div>
          <div id="reward-inbox-list" class="reward-inbox-list"></div>
          <div class="reward-inbox-coupon-area">
            ${RewardCodeUI.createInboxPanelMarkup()}
          </div>
        </div>
      `;
      this.mountGameModal(modal);
    }

    this.modal = modal;
    this.bindModal();
    this.render();

    return modal;
  },

  showModal() {
    if (!this.modal) {
      this.createModal();
    }

    this.render();
    this.modal.classList.remove("hidden");
    document.getElementById("reward-inbox-close-button")?.focus();
  },

  open() {
    this.showModal();
  },

  hideModal() {
    if (!this.modal) return;

    this.modal.classList.add("hidden");
    document.getElementById("reward-inbox-button")?.focus();
  },

  bindModal() {
    if (!this.modal) return;

    const closeButton = this.modal.querySelector("#reward-inbox-close-button");
    const claimAllButton = this.modal.querySelector("#reward-inbox-claim-all-button");

    if (closeButton) {
      closeButton.onclick = () => this.hideModal();
    }

    if (claimAllButton) {
      claimAllButton.onclick = () => {
        if (claimAllButton.disabled) return;
        const result = RewardInboxSystem.claimAllRewards();
        this.lastMessage = result.message;
        this.lastMessageType = result.success ? "success" : "error";
        this.render();
        this.renderBadge();
      };
    }

    RewardCodeUI.bind(this.modal);

    this.modal.onclick = (event) => {
      if (event.target === this.modal) {
        this.hideModal();
      }
    };
  },

  render() {
    if (!this.modal) return;

    const listNode = this.modal.querySelector("#reward-inbox-list");
    const messageNode = this.modal.querySelector("#reward-inbox-message");
    const claimAllButton = this.modal.querySelector("#reward-inbox-claim-all-button");
    const rewards = RewardInboxSystem.getInboxRewards().filter((reward) => reward.claimed !== true && reward.isExpired !== true);
    const claimableCount = RewardInboxSystem.getClaimableRewardCount();

    if (messageNode) {
      messageNode.textContent = this.lastMessage || (claimableCount > 0 ? `${claimableCount}개의 보상을 받을 수 있습니다.` : "");
      messageNode.classList.toggle("is-success", this.lastMessageType === "success");
      messageNode.classList.toggle("is-error", this.lastMessageType === "error");
    }

    if (claimAllButton) {
      claimAllButton.disabled = claimableCount <= 0;
    }

    if (!listNode) return;

    if (rewards.length === 0) {
      listNode.innerHTML = `
        <article class="reward-inbox-empty">
          <strong>현재 받을 수 있는 보상이 없습니다.</strong>
        </article>
      `;
      return;
    }

    listNode.innerHTML = rewards.map((reward) => this.createRewardCardMarkup(reward)).join("");
    this.bindClaimButtons();
  },

  renderBadge() {
    const badge = document.getElementById("reward-inbox-badge");
    const button = document.getElementById("reward-inbox-button");
    const claimableCount = RewardInboxSystem.getClaimableRewardCount();

    if (badge) {
      badge.textContent = claimableCount > 0 ? String(claimableCount) : "";
      badge.hidden = claimableCount <= 0;
    }

    if (button) {
      button.classList.toggle("has-claimable-rewards", claimableCount > 0);
    }
  },

  bindClaimButtons() {
    this.modal?.querySelectorAll(".reward-inbox-claim-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const result = RewardInboxSystem.claimReward(button.dataset.rewardId);
        this.lastMessage = result.message ?? "";
        this.lastMessageType = result.success ? "success" : "error";
        this.render();
        this.renderBadge();
      };
    });
  },

  createRewardCardMarkup(reward = {}) {
    const isClaimed = reward.claimed === true;
    const isExpired = reward.isExpired === true;
    const canClaim = !isClaimed && !isExpired;
    const stateLabel = isClaimed ? "수령 완료" : isExpired ? "만료" : "수령 가능";
    const buttonText = isClaimed ? "받음" : isExpired ? "만료" : "수령";

    return `
      <article class="reward-inbox-card ${isClaimed ? "is-claimed" : ""} ${isExpired ? "is-expired" : ""}">
        <span class="reward-inbox-card-icon" aria-hidden="true">${this.getRewardCardIcon(reward)}</span>
        <div class="reward-inbox-card-main">
          <span class="reward-inbox-state">${stateLabel}</span>
          <strong>${this.escapeHtml(reward.title)}</strong>
          <p>${this.escapeHtml(reward.message)}</p>
          <div class="reward-inbox-reward-list">
            ${reward.rewards.map((entry) => `<span>${this.createRewardLabel(entry)}</span>`).join("")}
          </div>
        </div>
        <button class="reward-inbox-claim-button" type="button" data-reward-id="${this.escapeHtml(reward.id)}" ${canClaim ? "" : "disabled"}>${buttonText}</button>
      </article>
    `;
  },

  getRewardCardIcon(reward = {}) {
    const rewardTypes = Array.isArray(reward.rewards)
      ? reward.rewards.map((entry) => entry?.type).filter(Boolean)
      : [];

    if (rewardTypes.includes("diamond")) return "💎";
    if (rewardTypes.includes("gold")) return "🪙";
    if (rewardTypes.includes("contract_ticket")) return "📄";
    if (rewardTypes.includes("skip_ticket")) return "⏩";
    return "🎁";
  },

  createRewardLabel(entry = {}) {
    const amount = Math.max(0, Math.floor(Number(entry.amount) || 0)).toLocaleString("ko-KR");
    const labels = {
      gold: "골드",
      diamond: "다이아",
      skip_ticket: "스킵권",
      contract_ticket: "판매권",
      item: entry.itemId || "아이템"
    };

    if (entry.type === "contract_ticket") {
      const productCount = Array.isArray(entry.productIds) && entry.productIds.length > 0
        ? entry.productIds.length
        : entry.productId
          ? 1
          : Number(entry.amount) || 0;

      return `${labels[entry.type]} ${productCount.toLocaleString("ko-KR")}개`;
    }

    return `${labels[entry.type] ?? "보상"} ${amount}개`;
  },

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};
