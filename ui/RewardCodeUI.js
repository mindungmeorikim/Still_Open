/*
  RewardCodeUI.js

  쿠폰/커뮤니티 보상 코드 입력용 최소 UI입니다.
  실제 검증과 지급은 RewardCodeSystem을 통해 처리합니다.
*/

import { RewardCodeSystem, REWARD_CODE_EVENTS } from "../systems/RewardCodeSystem.js";
import { EventBus } from "../core/EventBus.js";

export const RewardCodeUI = {
  isInitialized: false,
  lastResult: null,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    EventBus.on(REWARD_CODE_EVENTS.REDEEM_SUCCEEDED, (result = {}) => {
      this.lastResult = result;
      this.renderResult(result);
    });

    EventBus.on(REWARD_CODE_EVENTS.REDEEM_FAILED, (result = {}) => {
      this.lastResult = result;
      this.renderResult(result);
    });
  },

  createPanelMarkup(options = {}) {
    const {
      sectionClass = "bm-shop-section reward-code-panel",
      introClass = "bm-shop-subtab-intro reward-code-intro",
      title = "쿠폰 코드",
      helperText = "커뮤니티 이벤트 보상 코드를 입력하세요.",
      placeholder = "LAUNCH-DIA-100",
      buttonText = "확인"
    } = options;
    const resultClass = this.lastResult
      ? this.lastResult.success ? "is-success" : "is-error"
      : "";
    const message = this.lastResult?.message ?? "";

    return `
      <section class="${sectionClass}" aria-labelledby="reward-code-title">
        <div class="${introClass}">
          <strong id="reward-code-title">${title}</strong>
          ${helperText ? `<span>${helperText}</span>` : ""}
        </div>
        <form id="reward-code-form" class="reward-code-form" autocomplete="off">
          <label class="sr-only" for="reward-code-input">쿠폰 코드 입력</label>
          <input
            id="reward-code-input"
            class="reward-code-input"
            name="reward-code"
            type="text"
            inputmode="text"
            placeholder="${placeholder}"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <button id="reward-code-submit-button" class="reward-code-submit-button" type="submit">${buttonText}</button>
        </form>
        <p id="reward-code-message" class="reward-code-message ${resultClass}" role="status" aria-live="polite">${message}</p>
      </section>
    `;
  },

  createInboxPanelMarkup() {
    return this.createPanelMarkup({
      sectionClass: "reward-code-panel reward-inbox-coupon-panel",
      introClass: "reward-code-intro reward-inbox-coupon-intro",
      title: "쿠폰 코드 입력",
      helperText: "",
      placeholder: "쿠폰 코드를 입력하세요",
      buttonText: "등록"
    });
  },

  bind(root = document) {
    const scope = root ?? document;
    const form = scope.querySelector("#reward-code-form");
    const input = scope.querySelector("#reward-code-input");
    const submitButton = scope.querySelector("#reward-code-submit-button");

    if (!form || !input || !submitButton) return;

    form.onsubmit = (event) => {
      event.preventDefault();

      if (submitButton.disabled) return;

      const code = input.value;
      submitButton.disabled = true;

      const result = RewardCodeSystem.redeemCode(code);
      this.lastResult = result;
      this.renderResult(result, scope);

      if (result.success) {
        input.value = "";
      }

      submitButton.disabled = false;
      input.focus();
    };
  },

  renderResult(result = this.lastResult, root = document) {
    const scope = root ?? document;
    const messageNode = scope.querySelector("#reward-code-message");

    if (!messageNode || !result) return;

    messageNode.textContent = result.message ?? "";
    messageNode.classList.toggle("is-success", result.success === true);
    messageNode.classList.toggle("is-error", result.success !== true);
  }
};
