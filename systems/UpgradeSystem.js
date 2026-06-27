/*
  UpgradeSystem.js

  담당:
  - 1번 담당자

  역할:
  - 업그레이드 단계 진입
  - 업그레이드 목록 관리
  - 업그레이드 선택 처리
  - 성공/실패 결과에 따른 업그레이드 메시지 처리
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
  upgradeTimerId: null,
  nextDayTimerId: null,

  init() {
    EventBus.on(EVENTS.RESULT_CALCULATED, (resultData) => {
      this.lastResultData = resultData;

      /*
        정산 결과 메시지가 너무 빨리 업그레이드 메시지로 덮이지 않도록
        짧은 지연 후 업그레이드 단계 진입
      */
      this.upgradeTimerId = setTimeout(() => {
        EventBus.emit(EVENTS.UPGRADE_PHASE_STARTED, resultData);
      }, 900);
    });

    EventBus.on(EVENTS.UPGRADE_PHASE_STARTED, (resultData) => {
      this.startUpgradePhase(resultData);
    });
  },

  startUpgradePhase(resultData = this.lastResultData) {
    GameState.phase = GAME_PHASE.UPGRADE;

    const successText = resultData && resultData.success
      ? "목표 달성! 업그레이드를 적용합니다."
      : "목표 미달성. 다음 영업을 위해 기본 업그레이드를 적용합니다.";

    UIManager.showMessage(
      `${successText} v2.0에서는 업그레이드가 자동 선택됩니다.`
    );

    UIManager.showUpgradeOptions(this.availableUpgrades);

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    const autoUpgradeId = this.getAutoUpgradeId(resultData);

    this.upgradeTimerId = setTimeout(() => {
      this.selectUpgrade(autoUpgradeId);
    }, 900);
  },

  getAutoUpgradeId(resultData) {
    if (!resultData) {
      return "fast_checkout";
    }

    if (!resultData.mentalSuccess || resultData.mental <= 40) {
      return "mental_recovery";
    }

    if (!resultData.success) {
      return "mental_recovery";
    }

    return "fast_checkout";
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
      upgrade: selectedUpgrade,
      resultData: this.lastResultData
    });

    /*
      업그레이드 적용 메시지가 보인 뒤 다음 Day로 넘어가도록 처리
    */
    this.nextDayTimerId = setTimeout(() => {
      EventBus.emit(EVENTS.NEXT_DAY_READY, {
        currentDay: GameState.day,
        selectedUpgrade,
        resultData: this.lastResultData
      });
    }, 700);
  },

  applyUpgrade(upgrade) {
    if (upgrade.effectType === "MENTAL_RECOVERY") {
      GameState.mental = Math.min(100, GameState.mental + upgrade.value);
    }

    UIManager.showMessage(`${upgrade.name} 업그레이드가 적용되었습니다.`);
    UIManager.render();
  }
};