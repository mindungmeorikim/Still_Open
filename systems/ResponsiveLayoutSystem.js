const DESKTOP_MODE = "desktop";
const TABLET_MODE = "tablet";
const MOBILE_LANDSCAPE_MODE = "mobile-landscape";
const MOBILE_SMALL_MODE = "mobile-small";

const RESPONSIVE_CHANGE_EVENT = "stillopen:responsive-layout-changed";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getVisualViewportSize() {
  const visualViewport = window.visualViewport;
  const fallbackWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const fallbackHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  return {
    width: Math.round(visualViewport?.width || fallbackWidth),
    height: Math.round(visualViewport?.height || fallbackHeight),
    offsetLeft: Math.round(visualViewport?.offsetLeft || 0),
    offsetTop: Math.round(visualViewport?.offsetTop || 0)
  };
}

function getGameFrameRect(viewport) {
  const gameRoot = document.getElementById("game-root");
  const rect = gameRoot?.getBoundingClientRect?.();

  if (rect?.width && rect?.height) {
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  const frameWidth = Math.min(viewport.width, viewport.height * 16 / 9);
  const frameHeight = Math.min(viewport.height, viewport.width * 9 / 16);

  return {
    left: Math.round((viewport.width - frameWidth) / 2),
    top: Math.round((viewport.height - frameHeight) / 2),
    width: Math.round(frameWidth),
    height: Math.round(frameHeight)
  };
}

function detectMode(width, height) {
  const isLandscape = width >= height;
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches === true;

  if (isLandscape && (height <= 430 || width <= 760)) {
    return MOBILE_SMALL_MODE;
  }

  if (isLandscape && (height <= 640 || width <= 1180 || isCoarsePointer)) {
    return MOBILE_LANDSCAPE_MODE;
  }

  if (shortSide <= 720 || longSide <= 1280 || isCoarsePointer) {
    return TABLET_MODE;
  }

  return DESKTOP_MODE;
}

function getScales(mode, width, height) {
  if (mode === MOBILE_SMALL_MODE) {
    return {
      uiScale: clamp(height / 430, 0.68, 0.78),
      hudScale: clamp(height / 460, 0.58, 0.68),
      bottomScale: clamp(height / 460, 0.62, 0.72),
      joystickScale: clamp(height / 520, 0.60, 0.70),
      popupScale: clamp(height / 500, 0.72, 0.82)
    };
  }

  if (mode === MOBILE_LANDSCAPE_MODE) {
    return {
      uiScale: clamp(height / 620, 0.78, 0.9),
      hudScale: clamp(height / 680, 0.66, 0.82),
      bottomScale: clamp(height / 680, 0.70, 0.84),
      joystickScale: clamp(height / 760, 0.66, 0.78),
      popupScale: clamp(height / 680, 0.80, 0.9)
    };
  }

  if (mode === TABLET_MODE) {
    return {
      uiScale: 0.94,
      hudScale: 0.9,
      bottomScale: 0.92,
      joystickScale: 0.86,
      popupScale: 0.94
    };
  }

  return {
    uiScale: 1,
    hudScale: 1,
    bottomScale: 1,
    joystickScale: 1,
    popupScale: 1
  };
}

function getCameraProfile(mode) {
  if (mode === MOBILE_SMALL_MODE) {
    return {
      zoomBias: 0.84,
      focusPaddingBias: 0.62,
      topBias: 0.66,
      bottomBias: 0.78,
      leftBias: 0.68,
      rightBias: 0.72
    };
  }

  if (mode === MOBILE_LANDSCAPE_MODE) {
    return {
      zoomBias: 0.9,
      focusPaddingBias: 0.72,
      topBias: 0.72,
      bottomBias: 0.84,
      leftBias: 0.74,
      rightBias: 0.8
    };
  }

  if (mode === TABLET_MODE) {
    return {
      zoomBias: 0.96,
      focusPaddingBias: 0.9,
      topBias: 0.9,
      bottomBias: 0.94,
      leftBias: 0.9,
      rightBias: 0.94
    };
  }

  return {
    zoomBias: 1,
    focusPaddingBias: 1,
    topBias: 1,
    bottomBias: 1,
    leftBias: 1,
    rightBias: 1
  };
}

function setVariables(target, variables) {
  if (!target) return;

  Object.entries(variables).forEach(([name, value]) => {
    target.style.setProperty(name, String(value));
  });
}

export const ResponsiveLayoutSystem = {
  mode: DESKTOP_MODE,
  state: null,
  lastSignature: "",
  subscribers: new Set(),
  resizeRafId: null,
  initialized: false,

  init() {
    if (this.initialized) {
      this.update({ force: true });
      return;
    }

    this.initialized = true;
    this.update({ force: true });

    const scheduleUpdate = () => this.scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    window.visualViewport?.addEventListener?.("resize", scheduleUpdate);
    window.visualViewport?.addEventListener?.("scroll", scheduleUpdate);

    requestAnimationFrame(() => this.update({ force: true }));
  },

  scheduleUpdate() {
    if (this.resizeRafId) return;

    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      this.update();
    });
  },

  subscribe(callback) {
    if (typeof callback !== "function") return () => {};

    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  },

  update(options = {}) {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return this.state;
    }

    const viewport = getVisualViewportSize();
    const mode = detectMode(viewport.width, viewport.height);
    const scales = getScales(mode, viewport.width, viewport.height);
    const frame = getGameFrameRect(viewport);
    const isCompact = mode !== DESKTOP_MODE;
    const safeTopPx = isCompact ? Math.round(clamp(viewport.height * 0.012, 4, 10)) : 0;
    const safeBottomPx = isCompact ? Math.round(clamp(viewport.height * 0.014, 5, 12)) : 0;
    const popupPadding = Math.round(clamp(18 * scales.popupScale, 8, 18));
    const modalMaxWidth = Math.max(280, frame.width - popupPadding * 2);
    const modalMaxHeight = Math.max(180, frame.height - popupPadding * 2);
    const cameraProfile = getCameraProfile(mode);
    const hudButtonSize = Math.round(clamp(viewport.height * 0.078 * scales.hudScale, 28, 48));
    const dayCardWidth = Math.round(clamp(viewport.width * 0.14, 88, 128));
    const dayCardHeight = Math.round(clamp(viewport.height * 0.11, 40, 56));
    const statusWidth = Math.round(clamp(viewport.width * 0.44, 230, 470));
    const topUiRight = Math.round(clamp(viewport.width * 0.2, 128, 168));
    const bottomActionWidth = Math.round(clamp(viewport.width * 0.38, 218, 360));
    const bottomStartWidth = Math.round(clamp(viewport.width * 0.18, 126, 210));
    const dockButtonHeight = Math.round(clamp(viewport.height * 0.112, 42, 58));
    const openButtonHeight = Math.round(clamp(viewport.height * 0.124, 48, 66));
    const joystickSize = Math.round(clamp(viewport.height * 0.16 * scales.joystickScale, 56, 84));
    const joystickBottom = Math.round(safeBottomPx + dockButtonHeight + 12);
    const cameraControlsTop = Math.round(safeTopPx + dayCardHeight + 8);
    const nextState = {
      mode,
      width: viewport.width,
      height: viewport.height,
      isLandscape: viewport.width >= viewport.height,
      isCompact,
      frame,
      safeTopPx,
      safeBottomPx,
      popupPadding,
      modalMaxWidth,
      modalMaxHeight,
      hudButtonSize,
      dayCardWidth,
      dayCardHeight,
      statusWidth,
      topUiRight,
      bottomActionWidth,
      bottomStartWidth,
      dockButtonHeight,
      openButtonHeight,
      joystickSize,
      joystickBottom,
      cameraControlsTop,
      ...scales,
      ...cameraProfile
    };
    const signature = [
      nextState.mode,
      nextState.width,
      nextState.height,
      frame.left,
      frame.top,
      frame.width,
      frame.height,
      nextState.uiScale.toFixed(3),
      nextState.hudScale.toFixed(3),
      nextState.bottomScale.toFixed(3),
      nextState.joystickScale.toFixed(3),
      nextState.popupScale.toFixed(3)
    ].join("|");

    if (!options.force && signature === this.lastSignature) {
      return this.state;
    }

    this.lastSignature = signature;
    this.mode = mode;
    this.state = nextState;
    this.applyState(nextState);
    this.notify(nextState);

    return nextState;
  },

  applyState(state) {
    const root = document.documentElement;
    const gameRoot = document.getElementById("game-root");
    const targets = [root, gameRoot].filter(Boolean);
    const variables = {
      "--ui-scale": state.uiScale.toFixed(3),
      "--hud-scale": state.hudScale.toFixed(3),
      "--bottom-scale": state.bottomScale.toFixed(3),
      "--joystick-scale": state.joystickScale.toFixed(3),
      "--popup-scale": state.popupScale.toFixed(3),
      "--safe-top": `calc(env(safe-area-inset-top, 0px) + ${state.safeTopPx}px)`,
      "--safe-bottom": `calc(env(safe-area-inset-bottom, 0px) + ${state.safeBottomPx}px)`,
      "--responsive-safe-top-px": `${state.safeTopPx}px`,
      "--responsive-safe-bottom-px": `${state.safeBottomPx}px`,
      "--game-frame-left": `${state.frame.left}px`,
      "--game-frame-top": `${state.frame.top}px`,
      "--game-frame-width": `${state.frame.width}px`,
      "--game-frame-height": `${state.frame.height}px`,
      "--responsive-modal-padding": `${state.popupPadding}px`,
      "--responsive-modal-max-width": `${state.modalMaxWidth}px`,
      "--responsive-modal-max-height": `${state.modalMaxHeight}px`,
      "--responsive-hud-button-size": `${state.hudButtonSize}px`,
      "--responsive-day-card-width": `${state.dayCardWidth}px`,
      "--responsive-day-card-height": `${state.dayCardHeight}px`,
      "--responsive-status-width": `${state.statusWidth}px`,
      "--responsive-top-ui-right": `${state.topUiRight}px`,
      "--responsive-bottom-action-width": `${state.bottomActionWidth}px`,
      "--responsive-bottom-start-width": `${state.bottomStartWidth}px`,
      "--responsive-dock-button-height": `${state.dockButtonHeight}px`,
      "--responsive-open-button-height": `${state.openButtonHeight}px`,
      "--responsive-joystick-size": `${state.joystickSize}px`,
      "--responsive-joystick-bottom": `${state.joystickBottom}px`,
      "--responsive-camera-controls-top": `${state.cameraControlsTop}px`
    };

    root.dataset.responsiveMode = state.mode;
    root.dataset.responsiveCompact = state.isCompact ? "true" : "false";

    if (gameRoot) {
      gameRoot.dataset.responsiveMode = state.mode;
      gameRoot.dataset.responsiveCompact = state.isCompact ? "true" : "false";
    }

    targets.forEach((target) => setVariables(target, variables));
  },

  notify(state) {
    const detail = { ...state };

    this.subscribers.forEach((callback) => {
      try {
        callback(detail);
      } catch (error) {
        console.warn("Responsive layout subscriber failed:", error);
      }
    });

    window.dispatchEvent(new CustomEvent(RESPONSIVE_CHANGE_EVENT, { detail }));
  },

  getState() {
    return this.state || this.update({ force: true });
  },

  isCompactMode() {
    return this.getState()?.isCompact === true;
  },

  getCameraZoomBias() {
    return Number(this.getState()?.zoomBias) || 1;
  },

  getCameraSafeAreaBias() {
    const state = this.getState();

    return {
      top: Number(state?.topBias) || 1,
      bottom: Number(state?.bottomBias) || 1,
      left: Number(state?.leftBias) || 1,
      right: Number(state?.rightBias) || 1
    };
  },

  getCameraFocusPaddingBias() {
    return Number(this.getState()?.focusPaddingBias) || 1;
  }
};
