// MobileUI.js
// 모바일 조이스틱 / 상호작용 버튼 UI 생성 전용
// 아직 실제 이동/상호작용 로직과 연결하지 않음

export const MobileUI = {
  root: null,

  init() {
    if (!this.isMobileLike()) {
      return;
    }

    if (document.getElementById("mobile-controls")) {
      return;
    }

    this.createMobileControls();
  },


  isMobileLike() {
    return true;
  },
  //빌드때는 주석처리 해제
  // isMobileLike() {
  //   return (
  //     "ontouchstart" in window ||
  //     navigator.maxTouchPoints > 0 ||
  //     window.matchMedia("(pointer: coarse)").matches
  //   );
  // },

  createMobileControls() {
    const root = document.createElement("div");
    root.id = "mobile-controls";
    root.className = "mobile-controls";

    root.innerHTML = `
      <div id="mobile-joystick" class="mobile-joystick" aria-label="이동 조이스틱">
        <div id="mobile-joystick-base" class="mobile-joystick-base">
          <div id="mobile-joystick-thumb" class="mobile-joystick-thumb"></div>
        </div>
      </div>
    `;

    const gameRoot = document.getElementById("game-root");
    (gameRoot || document.body).appendChild(root);
    this.root = root;
  },
};
