/*
  UpgradeSystem.js

  담당:
  - 1번 담당자

  역할:
  - 업그레이드 단계 진입
  - 업그레이드 목록 관리
  - 업그레이드 선택 처리
  - 성공/실패 결과에 따른 업그레이드 메시지 처리
  - 정산 결과 확인 후 업그레이드 선택 UI 표시
  - 다음 Day 준비 이벤트 전달

  규칙:
  - 다른 시스템 직접 호출 금지
  - EventBus로만 연결
  - 날짜는 실제 Date가 아니라 GameState.day 기준 사용
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

  lastResultData: null,
  nextDayTimerId: null,
  isUpgradeSelected: false,

  init() {
    EventBus.on(EVENTS.RESULT_CALCULATED, (resultData) => {
      this.lastResultData = resultData;

      /*
        정산 결과 확인 버튼을 누른 뒤
        업그레이드 선택 단계로 이동한다.
      */
      UIManager.showResultModal(resultData, () => {
        EventBus.emit(EVENTS.UPGRADE_PHASE_STARTED, resultData);
      });
    });

    EventBus.on(EVENTS.UPGRADE_PHASE_STARTED, (resultData) => {
      this.startUpgradePhase(resultData);
    });
  },

  startUpgradePhase(resultData = this.lastResultData) {
    if (this.isUpgradeSelected && this.nextDayTimerId) {
      return;
    }

    this.clearNextDayTimer();
    this.isUpgradeSelected = false;

    GameState.phase = GAME_PHASE.UPGRADE;

    UIManager.showMessage("업그레이드 1개를 선택해주세요.");
    UIManager.showUpgradeOptions(this.availableUpgrades);

    UIManager.showUpgradeModal(
      this.availableUpgrades,
      (selectedUpgradeId) => {
        this.selectUpgrade(selectedUpgradeId);
      },
      resultData
    );

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);
  },

  selectUpgrade(upgradeId) {
    if (this.isUpgradeSelected) {
      return;
    }

    const selectedUpgrade = this.availableUpgrades.find((upgrade) => {
      return upgrade.id === upgradeId;
    });

    if (!selectedUpgrade) {
      console.warn("존재하지 않는 업그레이드입니다:", upgradeId);
      return;
    }

    this.isUpgradeSelected = true;

    const appliedUpgrade = {
      ...selectedUpgrade,
      selectedDay: GameState.day
    };

    GameState.upgrades.push(appliedUpgrade);

    this.applyUpgrade(appliedUpgrade);

    EventBus.emit(EVENTS.UPGRADE_SELECTED, {
      day: GameState.day,
      upgrade: appliedUpgrade,
      upgradeEffects: GameState.upgradeEffects,
      resultData: this.lastResultData
    });

    this.clearNextDayTimer();

    this.nextDayTimerId = setTimeout(() => {
      this.nextDayTimerId = null;

      EventBus.emit(EVENTS.NEXT_DAY_READY, {
        currentDay: GameState.day,
        selectedUpgrade: appliedUpgrade,
        upgradeEffects: GameState.upgradeEffects,
        resultData: this.lastResultData
      });
    }, 700);
  },

  applyUpgrade(upgrade) {
    this.ensureUpgradeEffects();

    if (upgrade.effectType === "CHECKOUT_SPEED") {
      GameState.upgradeEffects.checkoutSpeedBonus += upgrade.value;
    }

    if (upgrade.effectType === "SHELF_CAPACITY") {
      GameState.upgradeEffects.shelfCapacityBonus += upgrade.value;
    }

    if (upgrade.effectType === "MENTAL_RECOVERY") {
      GameState.mental = Math.min(100, GameState.mental + upgrade.value);
    }

    UIManager.showMessage(`${upgrade.name} 업그레이드가 적용되었습니다.`);
    UIManager.render();
  },

  ensureUpgradeEffects() {
    if (GameState.upgradeEffects) {
      return;
    }

    GameState.upgradeEffects = {
      checkoutSpeedBonus: 0,
      shelfCapacityBonus: 0
    };
  },

  clearNextDayTimer() {
    if (!this.nextDayTimerId) return;

    clearTimeout(this.nextDayTimerId);
    this.nextDayTimerId = null;
  }
};
