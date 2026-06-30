/*
  PlayerMovementSystem.js

  역할:
  - 플레이어 키보드 이동 처리
  - 방향키 / W A S D 입력 지원

  규칙:
  - 공통 파일 직접 수정 금지
  - EventBus로만 상태 변경 알림
  - 날짜 계산 없음
  - new Date(), Date.now() 사용 금지
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS } from "../core/Constants.js";

export const PlayerMovementSystem = {
  keys: {
    up: false,
    down: false,
    left: false,
    right: false
  },

  defaultPlayer: {
    x: 180,
    y: 160,
    speed: 4
  },

  defaultPlayerSize: {
    width: 78,
    height: 48
  },

  isInitialized: false,

  init() {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.initializePlayer();
    this.bindKeyboardEvents();
  },

  initializePlayer() {
    if (!GameState.player) {
      GameState.player = { ...this.defaultPlayer };
      EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
      return;
    }

    GameState.player = {
      ...this.defaultPlayer,
      ...GameState.player
    };
  },

  bindKeyboardEvents() {
    window.addEventListener("keydown", (event) => {
      this.handleKeyChange(event, true);
    });

    window.addEventListener("keyup", (event) => {
      this.handleKeyChange(event, false);
    });
  },

  handleKeyChange(event, isPressed) {
    const normalizedKey = event.key.toLowerCase();
    let isMovementKey = true;

    if (normalizedKey === "arrowup" || normalizedKey === "w") {
      this.keys.up = isPressed;
    } else if (normalizedKey === "arrowdown" || normalizedKey === "s") {
      this.keys.down = isPressed;
    } else if (normalizedKey === "arrowleft" || normalizedKey === "a") {
      this.keys.left = isPressed;
    } else if (normalizedKey === "arrowright" || normalizedKey === "d") {
      this.keys.right = isPressed;
    } else {
      isMovementKey = false;
    }

    if (isMovementKey) {
      event.preventDefault();
    }
  },

  update() {
    if (!GameState.player) {
      this.initializePlayer();
    }

    const player = GameState.player;
    const speed = Number(player.speed) || this.defaultPlayer.speed;

    let moveX = 0;
    let moveY = 0;

    if (this.keys.left) moveX -= 1;
    if (this.keys.right) moveX += 1;
    if (this.keys.up) moveY -= 1;
    if (this.keys.down) moveY += 1;

    if (moveX === 0 && moveY === 0) {
      return;
    }

    const isDiagonal = moveX !== 0 && moveY !== 0;
    const moveSpeed = isDiagonal ? speed * 0.707 : speed;

    player.x += moveX * moveSpeed;
    player.y += moveY * moveSpeed;
    this.clampPlayerToAllowedMovement(player);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  clampPlayerToAllowedMovement(player) {
    const storeSize = this.getStoreAreaSize();
    const playerSize = this.getPlayerSize();
    const movementRects = this.getAllowedMovementRects(storeSize);
    const playerCenter = {
      x: player.x + playerSize.width / 2,
      y: player.y + playerSize.height / 2
    };

    const isInsideAllowedRect = movementRects.some((rect) => {
      return this.isPointInsideRect(playerCenter, rect);
    });

    if (isInsideAllowedRect) {
      player.x = this.clamp(player.x, 0, storeSize.width - playerSize.width);
      player.y = this.clamp(player.y, 0, storeSize.height - playerSize.height);
      return;
    }

    const nearestPoint = this.getNearestPointInRects(playerCenter, movementRects);

    player.x = this.clamp(
      nearestPoint.x - playerSize.width / 2,
      0,
      storeSize.width - playerSize.width
    );
    player.y = this.clamp(
      nearestPoint.y - playerSize.height / 2,
      0,
      storeSize.height - playerSize.height
    );
  },

  getStoreAreaSize() {
    const storeArea = document.getElementById("store-area");

    return {
      width: storeArea?.clientWidth || 420,
      height: storeArea?.clientHeight || 420
    };
  },

  getPlayerSize() {
    const playerNode = document.getElementById("player-zone");

    return {
      width: playerNode?.offsetWidth || this.defaultPlayerSize.width,
      height: playerNode?.offsetHeight || this.defaultPlayerSize.height
    };
  },

  getAllowedMovementRects(storeSize) {
    const movementBounds = Array.isArray(GameState.expansion?.movementBounds)
      ? GameState.expansion.movementBounds
      : [];

    if (movementBounds.length === 0) {
      return [
        {
          x: 0,
          y: 0,
          width: storeSize.width,
          height: storeSize.height
        }
      ];
    }

    return movementBounds.map((bound) => {
      const x = this.toRatio(bound.x);
      const y = this.toRatio(bound.y);
      const width = this.toRatio(bound.width, 1);
      const height = this.toRatio(bound.height, 1);

      return {
        x: x * storeSize.width,
        y: y * storeSize.height,
        width: width * storeSize.width,
        height: height * storeSize.height
      };
    });
  },

  getNearestPointInRects(point, rects) {
    return rects.reduce((nearest, rect) => {
      const candidate = {
        x: this.clamp(point.x, rect.x, rect.x + rect.width),
        y: this.clamp(point.y, rect.y, rect.y + rect.height)
      };
      const distance =
        Math.abs(point.x - candidate.x) +
        Math.abs(point.y - candidate.y);

      if (!nearest || distance < nearest.distance) {
        return {
          ...candidate,
          distance
        };
      }

      return nearest;
    }, null) ?? { x: point.x, y: point.y };
  },

  isPointInsideRect(point, rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  },

  toRatio(value, fallback = 0) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return fallback;
    }

    return this.clamp(numberValue, 0, 1);
  },

  clamp(value, min, max) {
    const safeMax = Math.max(min, max);

    return Math.min(safeMax, Math.max(min, value));
  }
};
