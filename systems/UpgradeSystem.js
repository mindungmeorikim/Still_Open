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
import { ResultSystem } from "./ResultSystem.js";

export const UpgradeSystem = {
  availableUpgrades: [
    {
      id: "mental_breath",
      name: "잠깐 심호흡",
      description: "무료로 멘탈을 15 회복합니다.",
      effectType: "MENTAL_RECOVERY",
      value: 15,
      costType: "free",
      costAmount: 0,
      priceText: "무료"
    },
    {
      id: "mental_coffee",
      name: "편의점 커피 한잔",
      description: "골드 3,000을 사용해 멘탈을 30 회복합니다.",
      effectType: "MENTAL_RECOVERY",
      value: 30,
      costType: "gold",
      costAmount: 3000,
      priceText: "3,000골드"
    },
    {
      id: "mental_special_rest",
      name: "점장님의 특급 휴식",
      description: "다이아 10개를 사용해 멘탈을 60 회복합니다.",
      effectType: "MENTAL_RECOVERY",
      value: 60,
      costType: "diamond",
      costAmount: 10,
      priceText: "10다이아"
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
      UIManager.showResultModal(
        resultData,
        () => {
          if (resultData.infiniteGameOver?.isGameOver) {
            UIManager.showInfiniteGameOverModal(resultData.infiniteGameOver);
            return;
          }

          EventBus.emit(EVENTS.UPGRADE_PHASE_STARTED, resultData);
        },
        {
          onReward2xAdComplete: (currentResultData) => {
            return ResultSystem.applyReward2xAdBonus(currentResultData);
          },
          onMentalRecoveryAdComplete: (currentResultData) => {
            return ResultSystem.applyMentalRecoveryAdBonus(currentResultData);
          }
        }
      );
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

    const recoveryOptions = this.getRecoveryOptionsForRender();

    UIManager.showMessage("멘탈 회복 선택지 1개를 선택해주세요.");
    UIManager.showUpgradeOptions(recoveryOptions);

    UIManager.showUpgradeModal(
      recoveryOptions,
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
      console.warn("존재하지 않는 멘탈 회복 선택지입니다:", upgradeId);
      return;
    }

    const validation = this.validateRecoveryOption(selectedUpgrade);

    if (!validation.success) {
      UIManager.showMessage(validation.message);
      UIManager.showUpgradeModal(
        this.getRecoveryOptionsForRender(),
        (selectedRecoveryId) => {
          this.selectUpgrade(selectedRecoveryId);
        },
        this.lastResultData
      );
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
    this.applyRecoveryCost(upgrade);

    if (upgrade.effectType === "MENTAL_RECOVERY") {
      GameState.mental = Math.min(100, GameState.mental + upgrade.value);
    }

    UIManager.showMessage(`${upgrade.name} 적용 완료! 멘탈 +${upgrade.value}`);
    UIManager.render();
  },

  getRecoveryOptionsForRender() {
    return this.availableUpgrades.map((option) => {
      const validation = this.validateRecoveryOption(option);

      return {
        ...option,
        canSelect: validation.success,
        disabledReason: validation.success ? "" : validation.message
      };
    });
  },

  validateRecoveryOption(option = {}) {
    const costType = option.costType ?? "free";
    const costAmount = Math.max(0, Math.floor(Number(option.costAmount) || 0));

    if (costType === "gold" && GameState.money < costAmount) {
      return {
        success: false,
        reason: "not_enough_gold",
        message: `골드가 부족합니다. 필요 골드: ${costAmount.toLocaleString("ko-KR")}`
      };
    }

    if (costType === "diamond") {
      this.ensureBMState();

      if ((Number(GameState.bm.diamond) || 0) < costAmount) {
        return {
          success: false,
          reason: "not_enough_diamond",
          message: `다이아가 부족합니다. 필요 다이아: ${costAmount.toLocaleString("ko-KR")}`
        };
      }
    }

    return {
      success: true,
      reason: "available",
      message: "선택 가능합니다."
    };
  },

  applyRecoveryCost(option = {}) {
    const costType = option.costType ?? "free";
    const costAmount = Math.max(0, Math.floor(Number(option.costAmount) || 0));

    if (costAmount <= 0 || costType === "free") {
      return;
    }

    if (costType === "gold") {
      GameState.money = Math.max(0, GameState.money - costAmount);
      return;
    }

    if (costType === "diamond") {
      this.ensureBMState();
      GameState.bm.diamond = Math.max(0, (Number(GameState.bm.diamond) || 0) - costAmount);
    }
  },

  ensureBMState() {
    if (!GameState.bm || typeof GameState.bm !== "object") {
      GameState.bm = {};
    }

    GameState.bm.diamond = Math.max(0, Math.floor(Number(GameState.bm.diamond) || 0));
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
