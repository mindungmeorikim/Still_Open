/*
  EventBus.js
  공통 파일 - 임의 수정 금지
  역할: 시스템 간 이벤트 연결
*/

export const EventBus = {
  events: {},

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }

    this.events[eventName].push(callback);
  },

  emit(eventName, data = {}) {
    const listeners = this.events[eventName];

    if (!listeners) return;

    listeners.forEach((callback) => {
      callback(data);
    });
  },

  off(eventName, callback) {
    if (!this.events[eventName]) return;

    this.events[eventName] = this.events[eventName].filter(
      (listener) => listener !== callback
    );
  }
};