/*
  UpgradeSystem.js

  담당:
  - 1번 담당자

  역할:
  - 업그레이드 단계 진입
  - 업그레이드 목록 관리
  - 업그레이드 선택 처리
  - 다음 Day 준비 이벤트 전달

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { UIManager } from "../ui/UIManager.js";

export const UpgradeSystem = {
  availableUpgrades: [
    {
      id: "fast_checkout",
      name: "빠른 계산",
      description: "계산 처리 효율이 증가합니다.",
      effectType: "CHECKOUT_SPEED",
      value: 1
    },
    {
      id: "better_shelf",
      name: "넓은 진열대",
      description: "진열대 운영 효율이 증가합니다.",
      effectType: "SHELF_CAPACITY",
      value: 1
    },
    {
      id: "mental_recovery",
      name: "퇴근 후 떡볶이",
      description: "멘탈을 15 회복합니다.",
      effectType: "MENTAL_RECOVERY",
      value: 15
    }
  ],

  init() {
    EventBus.on(EVENTS.RESULT_CALCULATED, (resultData) => {
      EventBus.emit(EVENTS.UPGRADE_PHASE_STARTED, resultData);
    });

    EventBus.on(EVENTS.UPGRADE_PHASE_STARTED, () => {
      this.startUpgradePhase();
    });
  },

  startUpgradePhase() {
    GameState.phase = GAME_PHASE.UPGRADE;

    UIManager.showMessage("업그레이드 단계입니다. v1.5에서는 첫 번째 업그레이드가 자동 선택됩니다.");
    UIManager.showUpgradeOptions(this.availableUpgrades);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    this.selectUpgrade(this.availableUpgrades[0].id);
  },

  selectUpgrade(upgradeId) {
    const selectedUpgrade = this.availableUpgrades.find(
      (upgrade) => upgrade.id === upgradeId
    );

    if (!selectedUpgrade) {
      console.warn("존재하지 않는 업그레이드입니다:", upgradeId);
      return;
    }

    GameState.upgrades.push(selectedUpgrade);

    this.applyUpgrade(selectedUpgrade);

    EventBus.emit(EVENTS.UPGRADE_SELECTED, {
      day: GameState.day,
      upgrade: selectedUpgrade
    });

    EventBus.emit(EVENTS.NEXT_DAY_READY, {
      currentDay: GameState.day,
      selectedUpgrade
    });
  },

  applyUpgrade(upgrade) {
    if (upgrade.effectType === "MENTAL_RECOVERY") {
      GameState.mental = Math.min(100, GameState.mental + upgrade.value);
    }

    UIManager.showMessage(`${upgrade.name} 업그레이드가 적용되었습니다.`);
    UIManager.render();
  }
};