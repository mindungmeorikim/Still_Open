/*
  ModalFlowGuardSystem.js

  영업 중 상점/설정/보상함 등 조작을 가리는 모달이 열리면 손님과 영업 시간을
  함께 멈추고, 모달을 닫은 뒤 짧은 조작 복귀 시간을 준다.
  진상 이벤트 모달과 수동 일시정지는 각각 전용 시스템에서 처리한다.
*/

import { GameState } from "../core/GameState.js";
import { GAME_PHASE } from "../core/Constants.js";
import { GameFlowSystem } from "./GameFlowSystem.js";
import { CustomerSystem } from "./CustomerSystem.js";

const CHECK_INTERVAL_MS = 150;
const MODAL_CLOSE_GRACE_MS = 800;
const EXCLUDED_MODAL_IDS = new Set([
  "customer-event-modal",
  "result-modal",
  "upgrade-modal",
  "ending-modal",
  "infinite-game-over-modal"
]);

export const ModalFlowGuardSystem = {
  isInitialized: false,
  checkTimerId: null,
  resumeTimerId: null,
  ownsFlowPause: false,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.checkTimerId = window.setInterval(() => {
      this.evaluate();
    }, CHECK_INTERVAL_MS);
  },

  evaluate() {
    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) {
      this.cancelResumeTimer();
      this.ownsFlowPause = false;
      document.body?.classList?.remove("is-modal-flow-guard-active");
      return;
    }

    const hasBlockingModal = this.hasBlockingModalOpen();

    if (hasBlockingModal) {
      this.cancelResumeTimer();

      if (!this.ownsFlowPause) {
        this.ownsFlowPause = true;
        document.body?.classList?.add("is-modal-flow-guard-active");
        GameFlowSystem.pauseDayTimer();
        CustomerSystem.pauseCustomerWaitTime();
      }

      return;
    }

    if (!this.ownsFlowPause || this.resumeTimerId) {
      return;
    }

    this.resumeTimerId = window.setTimeout(() => {
      this.resumeTimerId = null;

      if (
        !this.ownsFlowPause ||
        GameState.phase !== GAME_PHASE.STORE_RUNNING ||
        this.hasBlockingModalOpen() ||
        document.body?.classList?.contains("is-game-paused") ||
        document.body?.classList?.contains("is-customer-event-modal-active")
      ) {
        return;
      }

      this.ownsFlowPause = false;
      document.body?.classList?.remove("is-modal-flow-guard-active");
      CustomerSystem.resumeCustomerWaitTime({ graceMs: MODAL_CLOSE_GRACE_MS });
      window.setTimeout(() => {
        if (
          GameState.phase === GAME_PHASE.STORE_RUNNING &&
          !this.hasBlockingModalOpen() &&
          !document.body?.classList?.contains("is-game-paused") &&
          !document.body?.classList?.contains("is-customer-event-modal-active")
        ) {
          GameFlowSystem.resumeDayTimer();
        }
      }, MODAL_CLOSE_GRACE_MS);
    }, 0);
  },

  hasBlockingModalOpen() {
    return [...document.querySelectorAll(".modal")].some((modal) => {
      if (EXCLUDED_MODAL_IDS.has(modal.id)) return false;
      if (modal.hidden === true) return false;
      if (modal.classList.contains("hidden")) return false;
      if (modal.getAttribute("aria-hidden") === "true") return false;

      const computedStyle = window.getComputedStyle?.(modal);
      return computedStyle?.display !== "none" && computedStyle?.visibility !== "hidden";
    });
  },

  cancelResumeTimer() {
    if (this.resumeTimerId) {
      window.clearTimeout(this.resumeTimerId);
    }

    this.resumeTimerId = null;
  }
};
