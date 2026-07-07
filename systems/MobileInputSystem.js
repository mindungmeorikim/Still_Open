/*
  MobileInputSystem.js

  역할
  - 모바일 조이스틱 입력 처리
  - PlayerMovementSystem의 keys 값에 모바일 방향 입력 전달
  - 상호작용 버튼 터치 시 E키 입력과 동일하게 처리
*/

import { PlayerMovementSystem } from "./PlayerMovementSystem.js";
import { PlayerActionSystem } from "./PlayerActionSystem.js";

export const MobileInputSystem = {
  joystickBase: null,
  joystickThumb: null,
  interactButton: null,

  isInitialized: false,
  isDragging: false,
  activeTouchId: null,

  maxDistance: 42,
  deadZone: 0.18,

  moveX: 0,
  moveY: 0,

  init() {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    this.joystickBase = document.getElementById("mobile-joystick-base");
    this.joystickThumb = document.getElementById("mobile-joystick-thumb");
    this.interactButton = document.getElementById("mobile-interact-button");

    if (!this.joystickBase || !this.joystickThumb) {
      return;
    }

    this.bindJoystickEvents();
    this.bindInteractButtonEvents();
  },

  bindJoystickEvents() {
    this.joystickBase.addEventListener("pointerdown", (event) => {
      this.isDragging = true;
      this.activeTouchId = event.pointerId;

      this.joystickBase.setPointerCapture?.(event.pointerId);
      this.updateJoystickByPointer(event);

      event.preventDefault();
    });

    window.addEventListener("pointermove", (event) => {
      if (!this.isDragging) return;
      if (event.pointerId !== this.activeTouchId) return;

      this.updateJoystickByPointer(event);
      event.preventDefault();
    });

    window.addEventListener("pointerup", (event) => {
      if (event.pointerId !== this.activeTouchId) return;

      this.resetJoystick();
      event.preventDefault();
    });

    window.addEventListener("pointercancel", (event) => {
      if (event.pointerId !== this.activeTouchId) return;

      this.resetJoystick();
      event.preventDefault();
    });
  },

  bindInteractButtonEvents() {
    if (!this.interactButton) {
      return;
    }

    this.interactButton.addEventListener("pointerdown", (event) => {
      this.triggerKeyboardInteract();
      event.preventDefault();
    });
  },

  updateJoystickByPointer(event) {
    const rect = this.joystickBase.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;

    const distance = Math.sqrt(rawX * rawX + rawY * rawY);
    const limitedDistance = Math.min(distance, this.maxDistance);

    const angle = Math.atan2(rawY, rawX);

    const limitedX = Math.cos(angle) * limitedDistance;
    const limitedY = Math.sin(angle) * limitedDistance;

    this.joystickThumb.style.transform =
    `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;

    const normalizedX = limitedX / this.maxDistance;
    const normalizedY = limitedY / this.maxDistance;

    this.moveX = Math.abs(normalizedX) < this.deadZone ? 0 : normalizedX;
    this.moveY = Math.abs(normalizedY) < this.deadZone ? 0 : normalizedY;
  },

  resetJoystick() {
    this.isDragging = false;
    this.activeTouchId = null;
    this.moveX = 0;
    this.moveY = 0;

    if (this.joystickThumb) {
      this.joystickThumb.style.transform = "translate(-50%, -50%)";
    }

    this.clearPlayerMovementKeys();
  },

  update() {
    if (PlayerActionSystem.isPlayerBusy) {
      this.moveX = 0;
      this.moveY = 0;
      this.clearPlayerMovementKeys();
      return;
    }

    this.applyMobileMovementToPlayerKeys();
  },

  applyMobileMovementToPlayerKeys() {
    if (!PlayerMovementSystem?.keys) {
      return;
    }

    PlayerMovementSystem.keys.left = this.moveX < -this.deadZone;
    PlayerMovementSystem.keys.right = this.moveX > this.deadZone;
    PlayerMovementSystem.keys.up = this.moveY < -this.deadZone;
    PlayerMovementSystem.keys.down = this.moveY > this.deadZone;
  },

  clearPlayerMovementKeys() {
    if (!PlayerMovementSystem?.keys) {
      return;
    }

    PlayerMovementSystem.keys.left = false;
    PlayerMovementSystem.keys.right = false;
    PlayerMovementSystem.keys.up = false;
    PlayerMovementSystem.keys.down = false;
  },

  triggerKeyboardInteract() {
    const keydownEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      keyCode: 32,
      which: 32,
      bubbles: true
    });

    const keyupEvent = new KeyboardEvent("keyup", {
      key: " ",
      code: "Space",
      keyCode: 32,
      which: 32,
      bubbles: true
    });

    window.dispatchEvent(keydownEvent);
    window.dispatchEvent(keyupEvent);
  }
};  