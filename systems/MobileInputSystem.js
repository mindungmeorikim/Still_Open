/*
  MobileInputSystem.js

  역할
  - 모바일 조이스틱 입력 처리
  - 키보드 WASD 입력과 충돌하지 않도록 PlayerMovementSystem.mobileInput에만 모바일 방향 입력 전달
  - 상호작용은 별도 버튼 없이 계산대/진열대/청소 오브젝트 직접 터치로 처리
*/

import { PlayerMovementSystem } from "./PlayerMovementSystem.js";
import { PlayerActionSystem } from "./PlayerActionSystem.js";

export const MobileInputSystem = {
  joystickBase: null,
  joystickThumb: null,

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

    if (!this.joystickBase || !this.joystickThumb) {
      return;
    }

    this.bindJoystickEvents();
  },

  bindJoystickEvents() {
    this.joystickBase.addEventListener("pointerdown", (event) => {
      this.isDragging = true;
      this.activeTouchId = event.pointerId;

      this.joystickBase.setPointerCapture?.(event.pointerId);
      this.updateJoystickByPointer(event);
      this.applyMobileMovementToPlayer();

      event.preventDefault();
    });

    window.addEventListener("pointermove", (event) => {
      if (!this.isDragging) return;
      if (event.pointerId !== this.activeTouchId) return;

      this.updateJoystickByPointer(event);
      this.applyMobileMovementToPlayer();
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

    this.clearMobileMovementInput();
  },

  update() {
    if (PlayerActionSystem.isPlayerBusy) {
      this.moveX = 0;
      this.moveY = 0;
      this.clearMobileMovementInput();
      return;
    }

    this.applyMobileMovementToPlayer();
  },

  applyMobileMovementToPlayer() {
    if (typeof PlayerMovementSystem?.setMobileInput === "function") {
      PlayerMovementSystem.setMobileInput(this.moveX, this.moveY);
      return;
    }

    // 구버전 fallback: setMobileInput이 없는 작업본에서도 조이스틱은 동작하게 유지한다.
    // 단, 최신 패치에서는 PlayerMovementSystem.mobileInput을 사용하므로 WASD와 충돌하지 않는다.
    if (!PlayerMovementSystem?.keys) {
      return;
    }

    if (!this.isDragging && this.moveX === 0 && this.moveY === 0) {
      return;
    }

    PlayerMovementSystem.keys.left = this.moveX < -this.deadZone;
    PlayerMovementSystem.keys.right = this.moveX > this.deadZone;
    PlayerMovementSystem.keys.up = this.moveY < -this.deadZone;
    PlayerMovementSystem.keys.down = this.moveY > this.deadZone;
  },

  clearMobileMovementInput() {
    if (typeof PlayerMovementSystem?.clearMobileInput === "function") {
      PlayerMovementSystem.clearMobileInput();
    }
  }
};
