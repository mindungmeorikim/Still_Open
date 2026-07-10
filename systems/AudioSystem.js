/*
  AudioSystem.js
  Role: BGM and SFX playback bridge for existing game events.
*/

import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";
import { GameState } from "../core/GameState.js";

const AUDIO_BASE_PATH = "./assets/audio/";
const AUDIO_SETTINGS_KEY = "today_normal_open_settings_v1";
const CUSTOMER_RANDOM_EVENT_TRIGGERED = "CUSTOMER_RANDOM_EVENT_TRIGGERED";
const ORDER_CONFIRMATION_FAILED = "ORDER_CONFIRMATION_FAILED";
const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 1,
  sfxVolume: 1
});

const BGM = {
  title: { src: "bgm_title_loop.mp3", volume: 0.38 },
  store: { src: "bgm_store_day_loop.mp3", volume: 0.3 },
  result: { src: "bgm_result_loop.mp3", volume: 0.32 }
};

const SFX = {
  checkoutSuccess: { src: "checkout_success.mp3", volume: 0.55 },
  currencyDiamond: { src: "currency_diamond_gain.mp3", volume: 0.58 },
  currencyGold: { src: "currency_gold_gain.mp3", volume: 0.5 },
  dayStart: { src: "day_start.mp3", volume: 0.58 },
  eventFail: { src: "event_fail.mp3", volume: 0.58 },
  eventPopup: { src: "event_popup.mp3", volume: 0.48 },
  eventSuccess: { src: "event_success.mp3", volume: 0.58 },
  orderConfirm: { src: "order_confirm.mp3", volume: 0.5 },
  shelfRefill: { src: "shelf_refill.mp3", volume: 0.48 },
  storeClose: { src: "store_close.mp3", volume: 0.58 },
  uiClick: { src: "ui_click.mp3", volume: 0.35 },
  uiDisabled: { src: "ui_disabled.mp3", volume: 0.42 }
};

function toAudioPath(filename) {
  return `${AUDIO_BASE_PATH}${filename}`;
}

function getDiamondBalance() {
  return Math.max(0, Math.floor(Number(GameState.bm?.diamond) || 0));
}

function normalizeVolume(value, fallback = 1) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, numberValue));
}

export const AudioSystem = {
  bgmAudio: {},
  sfxAudio: {},
  currentBgmKey: null,
  pendingBgmKey: null,
  isInitialized: false,
  isUnlocked: false,
  isMuted: false,
  settings: { ...DEFAULT_AUDIO_SETTINGS },
  lastSfxPlayedAt: {},
  lastDiamondBalance: 0,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.lastDiamondBalance = getDiamondBalance();
    this.settings = this.loadSettings();

    this.prepareAudio();
    this.bindUnlockEvents();
    this.bindGameEvents();
    this.bindUiClickEvents();
  },

  prepareAudio() {
    if (typeof Audio === "undefined") return;

    Object.entries(BGM).forEach(([key, config]) => {
      const audio = new Audio();
      audio.preload = "none";
      audio.src = toAudioPath(config.src);
      audio.loop = true;
      audio.volume = this.getBgmVolume(config);
      this.bgmAudio[key] = audio;
    });

    Object.entries(SFX).forEach(([key, config]) => {
      const audio = new Audio();
      audio.preload = "none";
      audio.src = toAudioPath(config.src);
      audio.volume = this.getSfxVolume(config);
      this.sfxAudio[key] = audio;
    });
  },

  bindUnlockEvents() {
    if (typeof window === "undefined") return;

    const unlock = () => {
      this.isUnlocked = true;

      if (this.pendingBgmKey) {
        this.playBgm(this.pendingBgmKey);
      }

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
  },

  bindGameEvents() {
    EventBus.on(EVENTS.GAME_INIT, () => this.playBgm("title"));
    EventBus.on(EVENTS.STORE_OPENED, () => {
      this.playSfx("dayStart");
      this.playBgm("store");
    });
    EventBus.on(EVENTS.RESULT_CALCULATED, () => this.playBgm("result"));

    EventBus.on(EVENTS.STORE_CLOSED, () => this.playSfx("storeClose"));
    EventBus.on(EVENTS.ORDER_CONFIRMED, () => this.playSfx("orderConfirm"));
    EventBus.on(EVENTS.RESTOCK_COMPLETED, () => this.playSfx("shelfRefill", { throttleMs: 180 }));
    EventBus.on(EVENTS.CHECKOUT_COMPLETED, () => this.playSfx("checkoutSuccess", { throttleMs: 120 }));
    EventBus.on(EVENTS.REVENUE_CHANGED, (data = {}) => {
      if (Number(data.amount) > 0) {
        this.playSfx("currencyGold", { delayMs: 90, throttleMs: 180 });
      }
    });

    EventBus.on(EVENTS.CUSTOMER_SATISFIED, () => this.playSfx("eventSuccess", { throttleMs: 220 }));
    EventBus.on(EVENTS.CUSTOMER_ANGRY, () => this.playSfx("eventFail", { throttleMs: 220 }));
    EventBus.on(CUSTOMER_RANDOM_EVENT_TRIGGERED, () => this.playSfx("eventPopup", { throttleMs: 300 }));
    EventBus.on(EVENTS.EXPANSION_COMPLETED, () => this.playSfx("eventSuccess"));
    EventBus.on(EVENTS.EXPANSION_FAILED, () => this.playSfx("uiDisabled"));
    EventBus.on(ORDER_CONFIRMATION_FAILED, () => this.playSfx("uiDisabled"));

    EventBus.on(EVENTS.GAME_STATE_CHANGED, () => this.syncDiamondSfx());
  },

  bindUiClickEvents() {
    if (typeof document === "undefined") return;

    document.addEventListener(
      "click",
      (event) => {
        const button = event.target?.closest?.("button, [role='button'], .clickable, .bm-shop-tab, .bm-shop-sub-tab");
        if (!button) return;

        const isDisabled =
          button.disabled ||
          button.getAttribute("aria-disabled") === "true" ||
          button.classList.contains("disabled") ||
          button.classList.contains("is-disabled");

        this.playSfx(isDisabled ? "uiDisabled" : "uiClick", { throttleMs: 45 });
      },
      true
    );
  },

  syncDiamondSfx() {
    const nextBalance = getDiamondBalance();

    if (nextBalance > this.lastDiamondBalance) {
      this.playSfx("currencyDiamond", { throttleMs: 250 });
    }

    this.lastDiamondBalance = nextBalance;
  },

  playBgm(key) {
    if (!BGM[key] || this.isMuted) return;

    this.pendingBgmKey = key;

    if (!this.settings.bgmEnabled) {
      this.stopCurrentBgm();
      return;
    }

    if (!this.isUnlocked) return;

    if (this.currentBgmKey === key) {
      const current = this.bgmAudio[key];
      if (current?.paused) {
        current.play().catch(() => {});
      }
      return;
    }

    this.stopCurrentBgm();

    const audio = this.bgmAudio[key];
    if (!audio) return;

    audio.currentTime = 0;
    audio.volume = this.getBgmVolume(BGM[key]);
    audio.play()
      .then(() => {
        this.currentBgmKey = key;
      })
      .catch(() => {
        this.pendingBgmKey = key;
      });
  },

  stopCurrentBgm() {
    if (!this.currentBgmKey) return;

    const current = this.bgmAudio[this.currentBgmKey];
    if (current) {
      current.pause();
      current.currentTime = 0;
    }

    this.currentBgmKey = null;
  },

  playSfx(key, options = {}) {
    if (!SFX[key] || this.isMuted || !this.isUnlocked || !this.settings.sfxEnabled) return;

    const now = Date.now();
    const throttleMs = Number(options.throttleMs) || 0;
    const lastPlayedAt = this.lastSfxPlayedAt[key] || 0;

    if (throttleMs > 0 && now - lastPlayedAt < throttleMs) {
      return;
    }

    this.lastSfxPlayedAt[key] = now;

    const play = () => {
      const baseAudio = this.sfxAudio[key];
      if (!baseAudio) return;

      const audio = baseAudio.cloneNode(true);
      audio.volume = this.getSfxVolume(SFX[key]);
      audio.play().catch(() => {});
    };

    const delayMs = Number(options.delayMs) || 0;
    if (delayMs > 0) {
      window.setTimeout(play, delayMs);
      return;
    }

    play();
  },

  setMuted(isMuted) {
    this.isMuted = !!isMuted;

    if (this.isMuted) {
      this.stopCurrentBgm();
      return;
    }

    if (this.pendingBgmKey) {
      this.playBgm(this.pendingBgmKey);
    }
  },

  getBgmVolume(config = {}) {
    return normalizeVolume(config.volume, 1) * normalizeVolume(this.settings.bgmVolume, 1);
  },

  getSfxVolume(config = {}) {
    return normalizeVolume(config.volume, 1) * normalizeVolume(this.settings.sfxVolume, 1);
  },

  getSettings() {
    return { ...this.settings };
  },

  setBgmEnabled(isEnabled) {
    this.applySettings({ bgmEnabled: !!isEnabled });
  },

  setSfxEnabled(isEnabled) {
    this.applySettings({ sfxEnabled: !!isEnabled });
  },

  setBgmVolume(volume) {
    this.applySettings({ bgmVolume: normalizeVolume(volume, this.settings.bgmVolume) });
  },

  setSfxVolume(volume) {
    this.applySettings({ sfxVolume: normalizeVolume(volume, this.settings.sfxVolume) });
  },

  applySettings(partialSettings = {}) {
    this.settings = this.normalizeSettings({
      ...this.settings,
      ...partialSettings
    });
    this.saveSettings();
    this.updateAudioVolumes();

    if (!this.settings.bgmEnabled) {
      this.stopCurrentBgm();
      return;
    }

    if (this.pendingBgmKey && !this.isMuted) {
      this.playBgm(this.pendingBgmKey);
    }
  },

  updateAudioVolumes() {
    Object.entries(this.bgmAudio).forEach(([key, audio]) => {
      if (audio && BGM[key]) {
        audio.volume = this.getBgmVolume(BGM[key]);
      }
    });

    Object.entries(this.sfxAudio).forEach(([key, audio]) => {
      if (audio && SFX[key]) {
        audio.volume = this.getSfxVolume(SFX[key]);
      }
    });
  },

  normalizeSettings(settings = {}) {
    return {
      bgmEnabled: settings.bgmEnabled !== false,
      sfxEnabled: settings.sfxEnabled !== false,
      bgmVolume: normalizeVolume(settings.bgmVolume, DEFAULT_AUDIO_SETTINGS.bgmVolume),
      sfxVolume: normalizeVolume(settings.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume)
    };
  },

  loadSettings() {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }

    try {
      const rawSettings = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
      const savedSettings = rawSettings ? JSON.parse(rawSettings) : {};

      return this.normalizeSettings(savedSettings?.audio ?? savedSettings);
    } catch (error) {
      console.warn("[AudioSystem] 오디오 설정을 불러오지 못했습니다.", error);
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
  },

  saveSettings() {
    if (typeof window === "undefined" || !window.localStorage) return;

    try {
      const rawSettings = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
      const savedSettings = rawSettings ? JSON.parse(rawSettings) : {};
      const nextSettings = {
        ...(savedSettings && typeof savedSettings === "object" ? savedSettings : {}),
        audio: this.getSettings()
      };

      window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(nextSettings));
    } catch (error) {
      console.warn("[AudioSystem] 오디오 설정을 저장하지 못했습니다.", error);
    }
  }
};
