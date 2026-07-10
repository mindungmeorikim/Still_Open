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
import { getStoreObjectCollisionRects } from "../data/CollisionData.js";
import {
  arePointsInWalkableAreas,
  getNearestPointInWalkableAreas,
  getStoreWalkableAreas,
  isPointInCenterProbeWalkableArea
} from "../data/WalkableAreaData.js";

const PLAYER_POSITION_CHANGED = "PLAYER_POSITION_CHANGED";

export const PlayerMovementSystem = {
  keys: {
    up: false,
    down: false,
    left: false,
    right: false
  },

  mobileInput: {
    x: 0,
    y: 0
  },

  setMobileInput(x = 0, y = 0) {
    const nextX = Number(x);
    const nextY = Number(y);

    this.mobileInput.x = Number.isFinite(nextX) ? this.clamp(nextX, -1, 1) : 0;
    this.mobileInput.y = Number.isFinite(nextY) ? this.clamp(nextY, -1, 1) : 0;
  },

  clearMobileInput() {
    this.mobileInput.x = 0;
    this.mobileInput.y = 0;
  },

  defaultPlayer: {
    x: 610,
    y: 640,
    speed: 4,
    direction: "down"
  },

  defaultPlayerSize: {
    width: 58,
    height: 102
  },

  playerFootCollisionBox: {
    width: 24,
    height: 14,
    offsetY: 6
  },

  playerWalkableProbe: {
    // 이동 가능 영역은 발 중앙점 하나가 아니라 발 주변 가로 라인을 함께 검사한다.
    // 오브젝트 충돌 박스와는 별개이며, 벽 외곽에 몸이 붙어 보이는 현상을 줄이기 위한 시각 보정값이다.
    halfWidth: 22,
    upperOffsetY: 6
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

    const sourcePlayer = GameState.player;
    const shouldSnapLegacyStart = this.isLegacyStartPosition(sourcePlayer);

    GameState.player = {
      ...this.defaultPlayer,
      ...sourcePlayer
    };

    if (shouldSnapLegacyStart) {
      GameState.player.x = this.defaultPlayer.x;
      GameState.player.y = this.defaultPlayer.y;
    }

    this.clampPlayerToAllowedMovement(GameState.player);
    EventBus.emit(PLAYER_POSITION_CHANGED, GameState);
  },

  isLegacyStartPosition(player = {}) {
    const x = Math.round(Number(player.x));
    const y = Math.round(Number(player.y));

    return (
      (x === 600 && y === 705) ||
      (x === 610 && y === 548) ||
      (x === 610 && y === 650)
    );
  },

  bindKeyboardEvents() {
    window.addEventListener("keydown", (event) => {
      this.handleKeyChange(event, true);
    });

    window.addEventListener("keyup", (event) => {
      this.handleKeyChange(event, false);
    });
  },

  isTutorialMovementLocked() {
    const body = document.body;

    return Boolean(
      body?.classList?.contains("is-tutorial-active") &&
      !body.classList.contains("is-tutorial-movement-allowed")
    );
  },

  isCustomerEventModalMovementLocked() {
    return Boolean(
      document.body?.classList?.contains("is-customer-event-modal-active")
    );
  },

  isGamePausedMovementLocked() {
    return Boolean(
      document.body?.classList?.contains("is-game-paused")
    );
  },

  isMovementLocked() {
    return (
      this.isTutorialMovementLocked() ||
      this.isCustomerEventModalMovementLocked() ||
      this.isGamePausedMovementLocked()
    );
  },

  clearMovementKeys() {
    this.keys.up = false;
    this.keys.down = false;
    this.keys.left = false;
    this.keys.right = false;
    this.clearMobileInput();
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

      if (this.isMovementLocked()) {
        this.clearMovementKeys();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        return;
      }
    }
  },

  update() {
    if (!GameState.player) {
      this.initializePlayer();
    }

    if (this.isMovementLocked()) {
      this.clearMovementKeys();
      return;
    }

    const player = GameState.player;
    const baseSpeed = Number(player.speed) || this.defaultPlayer.speed;
    // 배포 플레이 기준 이동 체감만 소폭 상향: 원래 속도의 55%.
    // WASD와 모바일 조이스틱에 동일 적용하며 저장 데이터·충돌 좌표는 변경하지 않는다.
    const speed = baseSpeed * 0.55;

    let moveX = 0;
    let moveY = 0;

    if (this.keys.left) moveX -= 1;
    if (this.keys.right) moveX += 1;
    if (this.keys.up) moveY -= 1;
    if (this.keys.down) moveY += 1;

    // 모바일 조이스틱 입력은 키보드 WASD 상태와 분리해서 합산한다.
    // 기존처럼 조이스틱이 PlayerMovementSystem.keys를 매 프레임 덮어쓰면
    // 조이스틱이 중앙에 있을 때 WASD 입력까지 false로 밀어버리는 문제가 생긴다.
    moveX += Number(this.mobileInput.x) || 0;
    moveY += Number(this.mobileInput.y) || 0;
    moveX = this.clamp(moveX, -1, 1);
    moveY = this.clamp(moveY, -1, 1);

    if (moveX === 0 && moveY === 0) {
      return;
    }

    player.direction = this.getDirectionFromMovement(moveX, moveY, player.direction);

    const isDiagonal = moveX !== 0 && moveY !== 0;
    const moveSpeed = isDiagonal ? speed * 0.707 : speed;

    const currentX = player.x;
    const currentY = player.y;
    const nextX = currentX + moveX * moveSpeed;
    const nextY = currentY + moveY * moveSpeed;

    const storeSize = this.getStoreAreaSize();
    const playerSize = this.getPlayerSize();
    const movementAreas = this.getAllowedMovementAreas(storeSize);

    player.x = this.clamp(nextX, 0, storeSize.width - playerSize.width);
    player.y = currentY;
    if (this.isPlayerPositionBlocked(player, movementAreas)) {
      player.x = currentX;
    }

    player.y = this.clamp(nextY, 0, storeSize.height - playerSize.height);
    if (this.isPlayerPositionBlocked(player, movementAreas)) {
      player.y = currentY;
    }

    this.clampPlayerToWorldBounds(player, storeSize, playerSize);

    EventBus.emit(PLAYER_POSITION_CHANGED, GameState);
  },

  getDirectionFromMovement(moveX, moveY, fallbackDirection = "down") {
    if (moveX < 0 && moveY < 0) return "upLeft";
    if (moveX > 0 && moveY < 0) return "upRight";
    if (moveX < 0 && moveY > 0) return "downLeft";
    if (moveX > 0 && moveY > 0) return "downRight";
    if (moveY < 0) return "up";
    if (moveY > 0) return "down";
    if (moveX > 0) return "right";
    if (moveX < 0) return "left";

    return fallbackDirection || "down";
  },

  clampPlayerToAllowedMovement(player) {
    const storeSize = this.getStoreAreaSize();
    const playerSize = this.getPlayerSize();
    const movementAreas = this.getAllowedMovementAreas(storeSize);

    this.clampPlayerToWorldBounds(player, storeSize, playerSize);

    if (this.isPlayerInsideAllowedMovement(player, movementAreas)) {
      return;
    }

    const movementPoint = this.getPlayerMovementPoint(player);
    const nearestPoint = getNearestPointInWalkableAreas(movementPoint, movementAreas);
    const movementOffset = this.getPlayerMovementPointOffset();

    player.x = this.clamp(
      nearestPoint.x - movementOffset.x,
      0,
      storeSize.width - playerSize.width
    );
    player.y = this.clamp(
      nearestPoint.y - movementOffset.y,
      0,
      storeSize.height - playerSize.height
    );

    const nearestValidPosition = this.findNearestValidPlayerPosition(
      player,
      movementAreas,
      storeSize,
      playerSize
    );

    player.x = nearestValidPosition.x;
    player.y = nearestValidPosition.y;
  },

  clampPlayerToWorldBounds(player, storeSize = this.getStoreAreaSize(), playerSize = this.getPlayerSize()) {
    player.x = this.clamp(player.x, 0, storeSize.width - playerSize.width);
    player.y = this.clamp(player.y, 0, storeSize.height - playerSize.height);
  },

  isPlayerPositionBlocked(player = GameState.player, movementAreas = this.getAllowedMovementAreas(this.getStoreAreaSize())) {
    return (
      !this.isPlayerInsideAllowedMovement(player, movementAreas) ||
      this.isPlayerCollidingWithStoreObject(player)
    );
  },

  isPlayerInsideAllowedMovement(player = GameState.player, movementAreas = this.getAllowedMovementAreas(this.getStoreAreaSize())) {
    const movementPoint = this.getPlayerMovementPoint(player);

    if (isPointInCenterProbeWalkableArea(movementPoint, movementAreas)) {
      return true;
    }

    return arePointsInWalkableAreas(this.getPlayerWalkableProbePoints(player), movementAreas);
  },

  getPlayerWalkableProbePoints(player = GameState.player) {
    const movementPoint = this.getPlayerMovementPoint(player);
    const playerSize = this.getPlayerSize();
    const halfWidth = this.clamp(
      Number(this.playerWalkableProbe.halfWidth) || 0,
      Math.max(8, Number(this.playerFootCollisionBox.width) / 2 || 8),
      Math.max(8, playerSize.width / 2 - 3)
    );
    const upperOffsetY = Math.max(0, Number(this.playerWalkableProbe.upperOffsetY) || 0);

    return [
      movementPoint,
      { x: movementPoint.x - halfWidth, y: movementPoint.y },
      { x: movementPoint.x + halfWidth, y: movementPoint.y },
      { x: movementPoint.x, y: movementPoint.y - upperOffsetY }
    ];
  },

  findNearestValidPlayerPosition(player, movementAreas, storeSize, playerSize) {
    const basePosition = {
      x: this.clamp(Number(player?.x) || 0, 0, storeSize.width - playerSize.width),
      y: this.clamp(Number(player?.y) || 0, 0, storeSize.height - playerSize.height)
    };
    const candidatePlayer = {
      ...player,
      ...basePosition
    };

    if (this.isPlayerInsideAllowedMovement(candidatePlayer, movementAreas)) {
      return basePosition;
    }

    const scanSteps = [4, 8, 12, 16, 24, 32, 44, 56, 72];
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ];

    for (const step of scanSteps) {
      for (const [directionX, directionY] of directions) {
        const candidate = {
          x: this.clamp(basePosition.x + directionX * step, 0, storeSize.width - playerSize.width),
          y: this.clamp(basePosition.y + directionY * step, 0, storeSize.height - playerSize.height)
        };
        const testPlayer = {
          ...player,
          ...candidate
        };

        if (this.isPlayerInsideAllowedMovement(testPlayer, movementAreas)) {
          return candidate;
        }
      }
    }

    return basePosition;
  },

  getPlayerMovementPoint(player = GameState.player) {
    const movementOffset = this.getPlayerMovementPointOffset();

    return {
      x: (Number(player?.x) || 0) + movementOffset.x,
      y: (Number(player?.y) || 0) + movementOffset.y
    };
  },

  getPlayerMovementPointOffset() {
    const playerSize = this.getPlayerSize();
    const footHeight = Math.min(
      playerSize.height,
      Number(this.playerFootCollisionBox.height) || 12
    );
    const offsetY = Number(this.playerFootCollisionBox.offsetY) || 0;

    return {
      x: playerSize.width / 2,
      y: playerSize.height - offsetY - footHeight / 2
    };
  },

  getStoreAreaSize() {
    const worldMap = document.getElementById("store-world-map");
    const storeArea = document.getElementById("store-area");

    return {
      width: worldMap?.offsetWidth || storeArea?.clientWidth || 420,
      height: worldMap?.offsetHeight || storeArea?.clientHeight || 420
    };
  },

  getPlayerSize() {
    const playerNode = document.getElementById("player-zone");

    return {
      width: playerNode?.offsetWidth || this.defaultPlayerSize.width,
      height: playerNode?.offsetHeight || this.defaultPlayerSize.height
    };
  },

  getPlayerFootRect(player = GameState.player) {
    const playerSize = this.getPlayerSize();
    const footWidth = Math.min(
      playerSize.width,
      Number(this.playerFootCollisionBox.width) || playerSize.width
    );
    const footHeight = Math.min(
      playerSize.height,
      Number(this.playerFootCollisionBox.height) || 12
    );
    const offsetY = Number(this.playerFootCollisionBox.offsetY) || 0;

    return {
      x: (Number(player?.x) || 0) + (playerSize.width - footWidth) / 2,
      y: (Number(player?.y) || 0) + playerSize.height - footHeight - offsetY,
      width: footWidth,
      height: footHeight
    };
  },

  isPlayerCollidingWithStoreObject(player = GameState.player) {
    if (!player) return false;

    const footRect = this.getPlayerFootRect(player);
    const collisionRects = getStoreObjectCollisionRects(
      GameState.expansion?.unlockedZoneIds
    );

    return collisionRects.some((rect) => {
      return this.doRectsOverlap(footRect, rect);
    });
  },

  getAllowedMovementAreas(storeSize) {
    const movementAreas = getStoreWalkableAreas(
      GameState.expansion?.unlockedZoneIds,
      storeSize
    );

    if (movementAreas.length === 0) {
      return [
        {
          id: "fallback_full_store",
          kind: "rect",
          x: 0,
          y: 0,
          width: storeSize.width,
          height: storeSize.height
        }
      ];
    }

    return movementAreas;
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

  doRectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
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
