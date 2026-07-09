const DESKTOP_MODE = "desktop";
const TABLET_MODE = "tablet";
const MOBILE_LANDSCAPE_MODE = "mobile-landscape";
const MOBILE_SMALL_MODE = "mobile-small";
const MOBILE_LANDSCAPE_CLASS = "is-mobile-landscape";
const COMPACT_LANDSCAPE_CLASS = "is-compact-landscape";

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

function getPointerContext() {
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches === true;
  const maxTouchPoints = typeof navigator !== "undefined"
    ? Number(navigator.maxTouchPoints || 0)
    : 0;
  const hasTouch = maxTouchPoints > 0 || "ontouchstart" in window;

  return {
    isCoarsePointer,
    hasTouch
  };
}

function getAspectRatio(width, height) {
  return height > 0 ? width / height : 0;
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
    left: Math.round(viewport.offsetLeft + (viewport.width - frameWidth) / 2),
    top: Math.round(viewport.offsetTop + (viewport.height - frameHeight) / 2),
    width: Math.round(frameWidth),
    height: Math.round(frameHeight)
  };
}

function detectMode(width, height) {
  const isLandscape = width >= height;
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const aspectRatio = getAspectRatio(width, height);
  const { isCoarsePointer, hasTouch } = getPointerContext();
  const isTouchLike = isCoarsePointer || hasTouch;
  const isCompactLandscape =
    isLandscape &&
    (
      (height <= 820 && aspectRatio >= 1.45) ||
      (isTouchLike && aspectRatio >= 1.25)
    );

  if (isLandscape && ((height <= 560 && aspectRatio >= 1.45) || width <= 760)) {
    return MOBILE_SMALL_MODE;
  }

  if (isCompactLandscape) {
    return MOBILE_LANDSCAPE_MODE;
  }

  if (isLandscape && (height <= 640 || width <= 1180 || isCoarsePointer)) {
    return MOBILE_LANDSCAPE_MODE;
  }

  if (shortSide <= 720 || longSide <= 1280 || isTouchLike) {
    return TABLET_MODE;
  }

  return DESKTOP_MODE;
}

function getScales(mode, width, height) {
  if (mode === MOBILE_SMALL_MODE) {
    return {
      uiScale: clamp(height / 560, 0.62, 0.76),
      hudScale: clamp(height / 620, 0.52, 0.64),
      bottomScale: clamp(height / 620, 0.56, 0.68),
      joystickScale: clamp(height / 680, 0.50, 0.64),
      popupScale: clamp(height / 620, 0.68, 0.80)
    };
  }

  if (mode === MOBILE_LANDSCAPE_MODE) {
    return {
      uiScale: clamp(height / 760, 0.72, 0.86),
      hudScale: clamp(height / 820, 0.56, 0.74),
      bottomScale: clamp(height / 840, 0.60, 0.76),
      joystickScale: clamp(height / 920, 0.56, 0.70),
      popupScale: clamp(height / 780, 0.76, 0.88)
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
      zoomBias: 0.78,
      focusPaddingBias: 0.56,
      topBias: 0.58,
      bottomBias: 0.68,
      leftBias: 0.62,
      rightBias: 0.66
    };
  }

  if (mode === MOBILE_LANDSCAPE_MODE) {
    return {
      zoomBias: 0.84,
      focusPaddingBias: 0.66,
      topBias: 0.64,
      bottomBias: 0.76,
      leftBias: 0.68,
      rightBias: 0.72
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
    const isCompactLandscape = mode === MOBILE_LANDSCAPE_MODE || mode === MOBILE_SMALL_MODE;
    const safeTopPx = isCompact ? Math.round(clamp(viewport.height * 0.012, 4, 10)) : 0;
    const safeBottomPx = isCompact ? Math.round(clamp(viewport.height * 0.014, 5, 12)) : 0;
    const popupPadding = Math.round(clamp(18 * scales.popupScale, 8, 18));
    const modalMaxWidth = Math.max(280, frame.width - popupPadding * 2);
    const modalMaxHeight = Math.max(180, frame.height - popupPadding * 2);
    const cameraProfile = getCameraProfile(mode);
    const hudButtonSize = Math.round(isCompactLandscape
      ? clamp(viewport.height * 0.072 * scales.hudScale, 28, 42)
      : clamp(viewport.height * 0.078 * scales.hudScale, 28, 48));
    const dayCardWidth = Math.round(isCompactLandscape
      ? clamp(frame.width * 0.095, 78, 108)
      : clamp(viewport.width * 0.14, 88, 128));
    const dayCardHeight = Math.round(isCompactLandscape
      ? clamp(viewport.height * 0.076, 34, 46)
      : clamp(viewport.height * 0.11, 40, 56));
    const statusWidth = Math.round(isCompactLandscape
      ? clamp(frame.width * 0.33, 220, 360)
      : clamp(viewport.width * 0.44, 230, 470));
    const topUiRight = Math.round(isCompactLandscape
      ? clamp(frame.width * 0.18, 188, 224)
      : clamp(viewport.width * 0.2, 128, 168));
    const bottomActionWidth = Math.round(isCompactLandscape
      ? clamp(frame.width * 0.27, 176, 300)
      : clamp(viewport.width * 0.38, 218, 360));
    const bottomStartWidth = Math.round(isCompactLandscape
      ? clamp(frame.width * 0.145, 104, 170)
      : clamp(viewport.width * 0.18, 126, 210));
    const dockButtonHeight = Math.round(isCompactLandscape
      ? clamp(viewport.height * 0.082 * scales.bottomScale, 34, 46)
      : clamp(viewport.height * 0.112, 42, 58));
    const openButtonHeight = Math.round(isCompactLandscape
      ? clamp(viewport.height * 0.092 * scales.bottomScale, 40, 54)
      : clamp(viewport.height * 0.124, 48, 66));
    const joystickSize = Math.round(isCompactLandscape
      ? clamp(viewport.height * 0.13 * scales.joystickScale, 46, 68)
      : clamp(viewport.height * 0.16 * scales.joystickScale, 56, 84));
    const joystickBottom = Math.round(safeBottomPx + dockButtonHeight + (isCompactLandscape ? 8 : 12));
    const cameraControlsTop = Math.round(safeTopPx + dayCardHeight + 8);
    const nextState = {
      mode,
      width: viewport.width,
      height: viewport.height,
      isLandscape: viewport.width >= viewport.height,
      isCompact,
      isMobileLandscape: isCompactLandscape,
      isCompactLandscape,
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
    const isMobileLandscape = state.isMobileLandscape === true;
    const isCompactLandscape = state.isCompactLandscape === true;
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
    root.classList.toggle(MOBILE_LANDSCAPE_CLASS, isMobileLandscape);
    root.classList.toggle(COMPACT_LANDSCAPE_CLASS, isCompactLandscape);

    if (gameRoot) {
      gameRoot.dataset.responsiveMode = state.mode;
      gameRoot.dataset.responsiveCompact = state.isCompact ? "true" : "false";
      gameRoot.classList.toggle(MOBILE_LANDSCAPE_CLASS, isMobileLandscape);
      gameRoot.classList.toggle(COMPACT_LANDSCAPE_CLASS, isCompactLandscape);
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
