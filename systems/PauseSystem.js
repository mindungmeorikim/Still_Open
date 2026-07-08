/*
  PauseSystem.js

  역할:
  - 영업 중 P 키 / 일시정지 버튼으로 게임 진행을 멈추고 재개한다.
  - 진상 이벤트 모달 일시정지와 충돌하지 않도록 별도 상태로 관리한다.
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { GameFlowSystem } from "./GameFlowSystem.js";
import { CustomerSystem } from "./CustomerSystem.js";

const PAUSE_EVENTS = Object.freeze({
  PAUSED: "GAME_PAUSED",
  RESUMED: "GAME_RESUMED"
});

export const PauseSystem = {
  isInitialized: false,
  isPaused: false,
  button: null,
  overlay: null,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.isPaused = false;
    document.body?.classList?.remove("is-game-paused");

    this.createPauseUi();
    this.bindKeyboardShortcut();
    this.bindFlowEvents();
    this.updatePauseUi();
  },

  bindKeyboardShortcut() {
    window.addEventListener("keydown", (event) => {
      this.handleKeyDown(event);
    }, true);
  },

  bindFlowEvents() {
    EventBus.on(EVENTS.STORE_OPENED, () => {
      this.forceResume("store_opened");
      this.updatePauseUi();
    });

    EventBus.on(EVENTS.STORE_CLOSED, () => {
      this.forceResume("store_closed");
      this.updatePauseUi();
    });

    EventBus.on(EVENTS.DAY_STARTED, () => {
      this.forceResume("day_started");
      this.updatePauseUi();
    });

    EventBus.on(EVENTS.GAME_STATE_CHANGED, () => {
      if (GameState.phase !== GAME_PHASE.STORE_RUNNING && this.isPaused) {
        this.forceResume("phase_changed");
      }

      if (this.isCustomerEventModalActive() && this.isPaused) {
        this.forceResume("customer_event_modal_active");
      }

      this.updatePauseUi();
    });
  },

  createPauseUi() {
    const existingButton = document.getElementById("game-pause-button");
    const existingOverlay = document.getElementById("game-pause-overlay");

    if (existingButton) {
      this.button = existingButton;
      this.button.onclick = null;
      this.button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.togglePause("button");
      });
    }

    if (existingOverlay) {
      this.overlay = existingOverlay;
      this.overlay.hidden = true;
      this.overlay.classList.add("hidden");
      this.overlay.setAttribute("aria-hidden", "true");
      this.bindOverlayResumeButton();
      this.placePauseButtonNearSettings();
      return;
    }

    const button = this.button ?? document.createElement("button");
    button.id = "game-pause-button";
    button.className = "hud-icon-button game-pause-button";
    button.type = "button";
    button.hidden = true;
    button.tabIndex = -1;
    button.title = "일시정지";
    button.setAttribute("aria-label", "게임 일시정지");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <span class="game-pause-button-icon" aria-hidden="true">⏸</span>
      <span class="top-icon-button-label game-pause-button-label">일시정지</span>
    `;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.togglePause("button");
    });

    const overlay = document.createElement("div");
    overlay.id = "game-pause-overlay";
    overlay.className = "game-pause-overlay hidden";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-labelledby", "game-pause-title");
    overlay.innerHTML = `
      <div class="game-pause-panel">
        <h2 id="game-pause-title">일시정지</h2>
        <p>영업이 일시정지되었습니다.</p>
        <p class="game-pause-hint">P 키를 다시 누르거나 아래 버튼을 누르면 재개됩니다.</p>
        <button id="game-pause-resume-button" class="game-pause-resume-button" type="button">계속하기</button>
      </div>
    `;

    overlay.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const uiRoot = document.getElementById("game-root") ?? document.body;
    uiRoot.appendChild(overlay);

    this.button = button;
    this.overlay = overlay;
    this.bindOverlayResumeButton();
    this.placePauseButtonNearSettings();
  },

  bindOverlayResumeButton() {
    this.overlay?.querySelector("#game-pause-resume-button")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.resume("overlay_button");
    });
  },

  placePauseButtonNearSettings() {
    if (!this.button) return;

    const uiRoot = document.getElementById("game-root") ?? document.body;
    const topIconMenu = document.getElementById("top-icon-menu");
    const settingsButton = document.getElementById("ingame-settings-button")
      ?? topIconMenu?.querySelector('button[aria-label="설정"], .ingame-settings-button')
      ?? null;

    if (topIconMenu) {
      if (settingsButton && settingsButton.parentElement === topIconMenu) {
        topIconMenu.insertBefore(this.button, settingsButton);
      } else if (this.button.parentElement !== topIconMenu) {
        topIconMenu.appendChild(this.button);
      }
      return;
    }

    if (this.button.parentElement !== uiRoot) {
      uiRoot.appendChild(this.button);
    }
  },

  handleKeyDown(event) {
    if (!this.isPauseShortcut(event)) {
      return;
    }

    if (this.isTypingTarget(event.target)) {
      return;
    }

    if (event.repeat) {
      event.preventDefault();
      return;
    }

    if (!this.isPaused && !this.canPause()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.togglePause("keyboard");
  },

  isPauseShortcut(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return false;
    }

    return event.code === "KeyP" || String(event.key ?? "").toLowerCase() === "p";
  },

  isTypingTarget(target) {
    const tagName = target?.tagName?.toLowerCase?.() ?? "";

    return Boolean(
      target?.isContentEditable ||
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select"
    );
  },

  isCustomerEventModalActive() {
    return Boolean(
      document.body?.classList?.contains("is-customer-event-modal-active")
    );
  },

  canPause() {
    return (
      GameState.phase === GAME_PHASE.STORE_RUNNING &&
      !this.isCustomerEventModalActive()
    );
  },

  togglePause(source = "unknown") {
    if (this.isPaused) {
      this.resume(source);
      return;
    }

    this.pause(source);
  },

  pause(source = "unknown") {
    if (this.isPaused || !this.canPause()) {
      this.updatePauseUi();
      return false;
    }

    this.isPaused = true;
    document.body?.classList?.add("is-game-paused");

    GameFlowSystem.pauseDayTimer();
    CustomerSystem.pauseCustomerWaitTime();

    this.updatePauseUi();

    EventBus.emit(PAUSE_EVENTS.PAUSED, {
      day: GameState.day,
      phase: GameState.phase,
      source
    });

    return true;
  },

  resume(source = "unknown") {
    if (!this.isPaused) {
      this.isPaused = false;
      document.body?.classList?.remove("is-game-paused");
      this.updatePauseUi();
      return false;
    }

    this.isPaused = false;
    document.body?.classList?.remove("is-game-paused");

    if (GameState.phase === GAME_PHASE.STORE_RUNNING) {
      GameFlowSystem.resumeDayTimer();
      CustomerSystem.resumeCustomerWaitTime();
    }

    this.updatePauseUi();

    EventBus.emit(PAUSE_EVENTS.RESUMED, {
      day: GameState.day,
      phase: GameState.phase,
      source
    });

    return true;
  },

  forceResume(source = "unknown") {
    const wasPaused = this.isPaused;

    this.isPaused = false;
    document.body?.classList?.remove("is-game-paused");
    this.updatePauseUi();

    if (!wasPaused) {
      return;
    }

    EventBus.emit(PAUSE_EVENTS.RESUMED, {
      day: GameState.day,
      phase: GameState.phase,
      source,
      forced: true
    });
  },

  updatePauseUi() {
    this.placePauseButtonNearSettings();

    const isStoreRunning = GameState.phase === GAME_PHASE.STORE_RUNNING;
    const isCustomerEventModalActive = this.isCustomerEventModalActive();
    const canShowButton = isStoreRunning && !isCustomerEventModalActive;

    if (!isStoreRunning || isCustomerEventModalActive) {
      this.isPaused = false;
      document.body?.classList?.remove("is-game-paused");
    }

    if (this.button) {
      this.button.hidden = !canShowButton;
      this.button.disabled = !canShowButton;
      this.button.tabIndex = canShowButton ? 0 : -1;
      this.button.classList.toggle("is-active", this.isPaused);
      this.button.setAttribute("aria-pressed", this.isPaused ? "true" : "false");
      this.button.setAttribute("aria-label", this.isPaused ? "게임 계속하기" : "게임 일시정지");

      const icon = this.button.querySelector(".game-pause-button-icon");
      const label = this.button.querySelector(".game-pause-button-label");

      if (icon) icon.textContent = this.isPaused ? "▶" : "⏸";
      if (label) label.textContent = this.isPaused ? "계속" : "일시정지";
    }

    if (this.overlay) {
      this.overlay.hidden = !this.isPaused;
      this.overlay.classList.toggle("hidden", !this.isPaused);
      this.overlay.setAttribute("aria-hidden", this.isPaused ? "false" : "true");
    }
  }
};
