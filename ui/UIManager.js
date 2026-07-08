/*
  UIManager.js
  역할: 화면 표시 및 버튼 이벤트 연결
  규칙: 시스템 직접 호출 금지, EventBus 사용
*/

import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";
import { GameState } from "../core/GameState.js";
import { CustomerSystem } from "../systems/CustomerSystem.js";
import { PRODUCTS, PRODUCT_SHELF_IDS } from "../data/ProductData.js";
import { SHELF_INSTANCES } from "../data/ShelfPlacementData.js";
import { getCleaningPointByZoneId } from "../data/CleaningPointData.js";
import { getStoreObjectCollisionRects } from "../data/CollisionData.js";
import {
  EXPANSION_ZONES,
  getPreviousExpansionZone
} from "../data/ExpansionData.js";
import {
  ASSET_PATHS,
  OBJECT_FACINGS,
  STOCK_VISUAL_OBJECT_TYPES,
  getCustomerAssetPath,
  getCustomerAssetVariantId,
  getObjectVisualAsset,
  getStaffAssetPath,
  getWarehouseBoxAsset
} from "../data/AssetData.js";
import { SaveSystem } from "../systems/SaveSystem.js";
import { AudioSystem } from "../systems/AudioSystem.js";
import { CURRENCY_EVENTS } from "../systems/EconomySystem.js";
import { BMSystem, BM_EVENTS } from "../systems/BMSystem.js";
import { DailyRewardSystem } from "../systems/DailyRewardSystem.js";
import { DailyMissionSystem, DAILY_MISSION_EVENTS } from "../systems/DailyMissionSystem.js";
import { RewardCodeSystem, REWARD_CODE_EVENTS } from "../systems/RewardCodeSystem.js";
import { RewardInboxSystem } from "../systems/RewardInboxSystem.js";
import { RewardInboxUI } from "./RewardInboxUI.js";
import { BM_ASSETS } from "../data/BMAssetMap.js";

const EXPANSION_CONSTRUCTION_STARTED = "EXPANSION_CONSTRUCTION_STARTED";
const INTERACTION_FEEDBACK_DISTANCE = 120;
const PLAYER_DIALOGUE_REQUESTED = "PLAYER_DIALOGUE_REQUESTED";
const PLAYER_POSITION_CHANGED = "PLAYER_POSITION_CHANGED";
const ORDER_CONFIRMATION_FAILED = "ORDER_CONFIRMATION_FAILED";
const SHELF_STOCK_CHANGED = "SHELF_STOCK_CHANGED";
const DEFAULT_WAREHOUSE_BOX_POSITION = Object.freeze({ x: 210, y: 575 });
const DEFAULT_CLEANING_POINT = Object.freeze(getCleaningPointByZoneId());
const TUTORIAL_ORDER_TARGET_PRODUCT_IDS = Object.freeze(["potato_chips", "water"]);
const TUTORIAL_PRACTICE_RESET_REQUESTED = "TUTORIAL_PRACTICE_RESET_REQUESTED";
const ORDER_VALIDATION_MESSAGES = Object.freeze({
  notEnoughGold: "골드가 부족합니다.",
  quantityExceeded: "발주 가능 수량을 초과했습니다.",
  emptyOrder: "발주할 상품을 선택해주세요.",
  lockedProduct: "발주할 수 없는 상품입니다."
});
const SANITATION_EVENTS = Object.freeze({
  CHANGED: "SANITATION_CHANGED",
  MESSAGE_REQUESTED: "SANITATION_MESSAGE_REQUESTED",
  CLEANING_STARTED: "SANITATION_CLEANING_STARTED",
  CLEANING_COMPLETED: "SANITATION_CLEANING_COMPLETED",
  CLEANING_FAILED: "SANITATION_CLEANING_FAILED"
});
const SANITATION_ASSETS = Object.freeze({
  icon: "./assets/ui/icons/sanitation_check.png",
  tools: "./assets/objects/cleaning/cleaning_tools.png",
  stain: "./assets/objects/cleaning/floor_stain.png",
  trash: "./assets/objects/cleaning/overflowing_trash_can.png",
  sparkle: "./assets/effects/cleaning/clean_sparkle.png"
});
const DEFAULT_SANITATION_STATE = Object.freeze({
  value: 100,
  status: "clean",
  isCleaningNeeded: false,
  isCleaning: false,
  cleaningDurationMs: 5000,
  dirtyZoneId: DEFAULT_CLEANING_POINT.zoneId,
  dirtySpotId: DEFAULT_CLEANING_POINT.id,
  activeCleaningPoint: DEFAULT_CLEANING_POINT,
  unlockedCleaningZoneCount: 1,
  sanitationPressureMultiplier: 1,
  settlementPenalty: {
    applies: false,
    satisfactionPenalty: 0,
    reason: "",
    sanitationValue: 100,
    status: "clean"
  }
});

const FOOD_WARMER_PRODUCT_IDS = new Set([
  "sausage_hotbar",
  "steamed_bun",
  "hoppang",
  "hotbar"
]);

const UI_TEXTBOX_VARIANTS = {
  normalCustomer: ASSET_PATHS.ui.textboxes.normalCustomer,
  player: ASSET_PATHS.ui.textboxes.player,
  badCustomer: ASSET_PATHS.ui.textboxes.badCustomer
};

const UI_IMAGE_BUTTON_VARIANTS = {
  commonBase: ASSET_PATHS.ui.buttons.common.base,
  commonLarge: ASSET_PATHS.ui.buttons.common.large,
  commonSmall: ASSET_PATHS.ui.buttons.common.small,
  titleStart: {
    normal: "./assets/title/buttons/start_base/title_start_button_base_normal.png",
    pressed: "./assets/title/buttons/start_base/title_start_button_base_pressed.png",
    disabled: "./assets/title/buttons/start_base/title_start_button_base_disabled.png"
  },
  iconBack: ASSET_PATHS.ui.buttons.icon.back,
  iconCancel: ASSET_PATHS.ui.buttons.icon.cancel,
  iconClose: ASSET_PATHS.ui.buttons.icon.close,
  iconConfirm: ASSET_PATHS.ui.buttons.icon.confirm,
  iconWarning: ASSET_PATHS.ui.buttons.icon.warning,
  specialContinue: ASSET_PATHS.ui.buttons.special.continue,
  specialSettings: ASSET_PATHS.ui.buttons.special.settings
};

const STAFF_EVENTS = {
  HIRE_OFFERED: "STAFF_HIRE_OFFERED",
  HIRED: "STAFF_HIRED",
  HIRE_SKIPPED: "STAFF_HIRE_SKIPPED",
  STATE_CHANGED: "STAFF_STATE_CHANGED"
};

const STAFF_ASSIST_EVENTS = Object.freeze({
  STATE_CHANGED: "STAFF_ASSIST_STATE_CHANGED",
  MESSAGE_REQUESTED: "STAFF_ASSIST_MESSAGE_REQUESTED"
});
const STAFF_SHIFT_ENTRY_REQUESTED = "STAFF_SHIFT_ENTRY_REQUESTED";
const STAFF_ENTRY_SPAWN_Y_OFFSET = 70;

const DEFAULT_STAFF_ASSIST_STATE = Object.freeze({
  status: "off_duty",
  label: "출근 대기 중",
  x: 577,
  y: 720,
  direction: "down",
  isMoving: false
});

const STAFF_ASSIST_STATUS_LABELS = Object.freeze({
  off_duty: "출근 대기 중",
  entering: "출근 중",
  idle: "대기 중",
  checking: "매장 상태 확인 중",
  warehouse: "창고 재고 확인 중",
  shelf: "진열 보조 중",
  cleaning: "청소 보조 중",
  returning: "복귀 중"
});

export const UIManager = {
  titleScreen: null,
  tutorialOverlay: null,
  tutorialHelpButton: null,
  tutorialStepIndex: 0,
  tutorialAutoShown: false,
  tutorialSessionStartedCompleted: false,
  tutorialMode: "guide",
  tutorialActionTarget: null,
  tutorialActionHandler: null,
  tutorialHighlightedTargets: [],
  tutorialPendingStepId: null,
  pendingFirstRunTutorialAfterDailyReward: false,
  tutorialCompletedKey: "stillOpen.tutorial.completed",
  tutorialLegacyCompletedKeys: [],
  tutorialHintPrefix: "stillOpen.tutorial.hint.",
  tutorialHighlightResizeHandler: null,
  tutorialInputGuardClickHandler: null,
  tutorialInputGuardPointerHandler: null,
  tutorialBlockedMessageTimerId: null,
  tutorialTargetProxy: null,
  tutorialTargetProxySource: null,
  tutorialTargetProxyClickHandler: null,
  settingsModal: null,
  settingsEscapeKeyBound: false,
  dailyRewardModal: null,
  dailyMissionModal: null,
  resultModal: null,
  upgradeModal: null,
  endingModal: null,
  infiniteGameOverModal: null,
  dayScenarioModal: null,
  orderModal: null,
  bmContractShopModal: null,
  bmPurchaseConfirmModal: null,
  bmShopActiveTab: "recommend",
  bmShopRenderRafId: null,
  staffHireModal: null,
  eventModal: null,
  eventModalOnClose: null,
  eventModalCloseTimerId: null,
  isEventModalClosing: false,
  inventorySummary: null,
  staffSummary: null,
  staffCharacter: null,
  productPanel: null,
  expansionPanel: null,
  expansionState: null,
  pendingOrderPhaseData: null,
  orderDraftQuantities: {},
  orderDeliveredData: null,
  orderModalMode: "closed",
  orderListScrollTop: 0,
  orderActiveCategory: "all",
  lastProductGridSignature: "",
  lastDeliveredGridSignature: "",
  lastExpansionPanelSignature: "",
  lastStoreExpansionTilesSignature: "",
  expansionCarouselIndex: 0,
  selectedExpansionZoneId: null,
  currentFocusedZoneId: "zone_basic",
  isStoreExpansionPopoverVisible: false,
  inventoryByProductId: {},
  inventorySnapshot: null,
  pendingStaffHireData: null,
  staffAssistState: { ...DEFAULT_STAFF_ASSIST_STATE },
  staffEntryVisualLockDay: null,
  sanitationState: { ...DEFAULT_SANITATION_STATE },
  notificationTimerId: null,
  isWorldCameraBound: false,
  sparkleTimeoutIds: {},
  assetEffectToastTimerId: null,
  worldCamera: {
    x: 0,
    y: 0,
    zoom: 1.15,
    minZoom: 0.45,
    fullZoom: 0.55,
    focusZoom: 1.55,
    maxZoom: 2.2,
    isDragging: false,
    wasDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startX: 0,
    startY: 0,
    pinchStartDistance: 0,
    pinchStartZoom: 1.55,
    resizeTimerId: null
  },

  init() {
    SaveSystem.init();
    DailyRewardSystem.init();
    DailyMissionSystem.init();
    RewardCodeSystem.init();
    RewardInboxSystem.init();
    RewardInboxUI.init();
    this.bindButtons();
    this.bindGameEvents();
    this.bindDebugCoordinateMode();
    this.bindDayStartEvents();
    this.bindInventoryEvents();
    this.bindExpansionEvents();
    this.bindBMEvents();
    this.bindSanitationEvents();
    this.bindEndingEvents();
    this.bindOrderEvents();
    this.bindStaffEvents();
    this.createDayScenarioModal();
    this.createOrderModal();
    this.createBMContractShopModal();
    this.createBMShopPurchaseConfirmModal();
    this.createStaffHireModal();
    this.createResultModal();
    this.createUpgradeModal();
    this.createEndingModal();
    this.createInfiniteGameOverModal();
    this.createCustomerEventModal();
    this.createTitleScreen();
    this.createSettingsModal();
    this.createDailyRewardModal();
    this.createDailyMissionModal();
    this.createTutorialOverlay();
    this.createTutorialHelpButton();
    RewardInboxUI.createModal();
    this.createInventorySummary();
    this.createStaffSummary();
    this.createDailyGoalPanel();
    this.createSanitationHud();
    this.createFocusedZonePanel();
    this.moveTopIconMenuToRoot();
    this.configureTopSettingsMenu();
    this.createStoreComposition();
    this.createStaffCharacter();
    this.createExpansionPanel();
    this.createProductPanel();
    this.prepareUiImageButtons();
    this.render();
    this.renderCustomers();
    this.showMessage("게임 준비 완료. Day 시작 버튼을 눌러주세요.");
    this.queueInitialCameraFocus();
    this.syncTutorialHelpButtonVisibility();
  },


  createTutorialHelpButton() {
    const gameRoot = document.getElementById("game-root");
    const topIconMenu = document.getElementById("top-icon-menu");

    if (!gameRoot && !topIconMenu) return null;

    let button = document.getElementById("tutorial-help-button");

    if (!button) {
      button = document.createElement("button");
      button.id = "tutorial-help-button";
      button.type = "button";
    }

    button.className = "hud-icon-button tutorial-help-button";
    button.disabled = false;
    button.hidden = false;
    button.tabIndex = 0;
    button.title = "도움말";
    button.setAttribute("aria-label", "튜토리얼 다시 보기");
    button.setAttribute("aria-disabled", "false");
    button.removeAttribute("aria-hidden");
    button.innerHTML = `
      <span class="tutorial-help-button-icon" aria-hidden="true">?</span>
      <span class="top-icon-button-label tutorial-help-button-label">도움말</span>
    `;

    const settingsButton = document.getElementById("ingame-settings-button")
      ?? topIconMenu?.querySelector('button[aria-label="설정"], .ingame-settings-button')
      ?? null;

    if (topIconMenu) {
      if (settingsButton && settingsButton.parentElement === topIconMenu) {
        topIconMenu.insertBefore(button, settingsButton);
      } else if (button.parentElement !== topIconMenu) {
        topIconMenu.appendChild(button);
      }
    } else if (gameRoot && button.parentElement !== gameRoot) {
      gameRoot.appendChild(button);
    }

    button.onclick = () => {
      this.showTutorialOverlay({ startIndex: 0, force: true, mode: "interactive" });
    };

    this.tutorialHelpButton = button;
    this.syncTutorialHelpButtonVisibility();

    return button;
  },

  syncTutorialHelpButtonVisibility() {
    const button = this.tutorialHelpButton ?? document.getElementById("tutorial-help-button");

    if (!button) return;

    const isTitleActive = document.body.classList.contains("is-title-screen-active");
    button.classList.toggle("hidden", isTitleActive);
  },

  createTutorialOverlay() {
    let overlay = document.getElementById("tutorial-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "tutorial-overlay";
      overlay.className = "tutorial-overlay hidden";
      overlay.setAttribute("aria-live", "polite");
      overlay.innerHTML = `
        <div class="tutorial-dim tutorial-dim--full" aria-hidden="true"></div>
        <div id="tutorial-highlight-ring" class="tutorial-highlight-ring hidden" aria-hidden="true"></div>
        <div id="tutorial-target-proxy-layer" class="tutorial-target-proxy-layer" aria-hidden="true"></div>
        <article class="tutorial-card" tabindex="-1">
          <header class="tutorial-card-header">
            <div>
              <p id="tutorial-kicker" class="tutorial-kicker">첫 영업 가이드</p>
              <h2 id="tutorial-title">튜토리얼</h2>
            </div>
          </header>
          <div class="tutorial-step-meta">
            <span id="tutorial-step-count">1 / 1</span>
            <span id="tutorial-step-target">기본 안내</span>
          </div>
          <p id="tutorial-description" class="tutorial-description"></p>
          <ul id="tutorial-bullets" class="tutorial-bullets"></ul>
          <p id="tutorial-tip" class="tutorial-tip"></p>
          <p id="tutorial-action-guide" class="tutorial-action-guide"></p>
          <footer class="tutorial-actions">
            <button id="tutorial-prev-button" class="tutorial-secondary-button" type="button">이전</button>
            <button id="tutorial-next-button" class="tutorial-primary-button" type="button">다음</button>
            <button id="tutorial-skip-button" class="tutorial-secondary-button tutorial-skip-button" type="button">튜토리얼 건너뛰기</button>
          </footer>
        </article>
      `;
      document.body.appendChild(overlay);
    }

    this.tutorialOverlay = overlay;
    this.bindTutorialOverlayButtons();

    return overlay;
  },

  bindTutorialOverlayButtons() {
    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");

    if (!overlay) return;

    const closeButton = overlay.querySelector("#tutorial-close-button");
    const prevButton = overlay.querySelector("#tutorial-prev-button");
    const nextButton = overlay.querySelector("#tutorial-next-button");
    const skipButton = overlay.querySelector("#tutorial-skip-button");

    if (closeButton) {
      closeButton.onclick = () => this.hideTutorialOverlay();
    }

    if (prevButton) {
      prevButton.onclick = () => this.moveTutorialStep(-1);
    }

    if (nextButton) {
      nextButton.onclick = () => this.moveTutorialStep(1);
    }

    if (skipButton) {
      skipButton.onclick = () => {
        this.completeTutorialAndCleanup({
          markCompleted: true,
          message: "튜토리얼을 건너뛰었습니다. 필요하면 오른쪽 위 도움말 버튼에서 다시 볼 수 있어요."
        });
      };
    }
  },

  getTutorialSteps() {
    const tutorialOrderPlusSelector = '#order-modal .order-product-card[data-tutorial-order-target="true"] .order-qty-button[data-action="increase"]:not(:disabled)';
    const tutorialOrderQuantitySelector = '#order-modal .order-product-card[data-tutorial-order-target="true"] .order-qty-button:not(:disabled)';

    return [
      {
        id: "start-day",
        selector: "#start-day-button",
        spotlightSelector: "#start-day-button",
        actionSelector: "#start-day-button",
        anchorSelector: "#start-day-button",
        targetLabel: "발주 버튼",
        title: "영업 준비 시작",
        description: `오늘 영업은 발주 준비부터 시작해요.
아래의 [발주] 버튼을 눌러주세요.`,
        bullets: [],
        tip: "",
        actionGuide: "[발주] 버튼 누르기",
        requireTargetClick: true,
        allowedActions: ["day:start-order"],
        advanceAfterTargetClickMs: 180,
        highlightPadding: 8
      },
      {
        id: "briefing-confirm",
        contextSelector: "#day-scenario-modal .day-scenario-modal-content",
        spotlightSelector: "#day-scenario-confirm-button",
        actionSelector: "#day-scenario-confirm-button",
        anchorSelector: "#day-scenario-confirm-button",
        targetLabel: "오늘 목표/상권 정보",
        title: "브리핑 확인",
        description: `오늘 목표와 상권 정보를 확인해요.
이 정보를 보고 어떤 상품을 주문할지 정할 수 있어요.
[발주하러 가기]를 눌러주세요.`,
        bullets: [],
        tip: "",
        actionGuide: "[발주하러 가기] 누르기",
        requireTargetClick: true,
        allowedActions: ["day:briefing-confirm"],
        advanceAfterTargetClickMs: 180,
        highlightPadding: 8,
        contextPadding: 10
      },
      {
        id: "order-quantity",
        contextSelector: "#order-modal .order-modal-content",
        spotlightSelector: tutorialOrderPlusSelector,
        actionSelector: tutorialOrderPlusSelector,
        anchorSelector: tutorialOrderPlusSelector,
        allowedSelectors: [tutorialOrderQuantitySelector],
        targetLabel: "상품 수량 선택",
        title: "상품 수량 선택",
        description: `상품의 [+] 버튼을 눌러 발주 수량을 1개 이상 선택하세요.
수량을 정한 뒤 [다음]을 누르면 확정 단계로 넘어갑니다.`,
        bullets: [],
        tip: "",
        actionGuide: "[+] 버튼으로 수량 선택",
        requireTargetClick: false,
        allowedActions: ["order:quantity"],
        requiresOrderQuantity: true,
        nextLabel: "다음",
        highlightPadding: 7,
        contextPadding: 10
      },
      {
        id: "order-confirm",
        contextSelector: "#order-modal .order-modal-content",
        spotlightSelector: "#order-confirm-button:not(:disabled)",
        actionSelector: "#order-confirm-button:not(:disabled)",
        anchorSelector: "#order-confirm-button:not(:disabled)",
        targetLabel: "발주 확정",
        title: "발주 확정",
        description: `수량을 정했다면 주문을 확정해요.
주문한 상품은 잠시 후 도착한 발주 박스로 나타나요.`,
        pendingDescription: "발주가 접수되었어요. 도착한 발주 박스가 나타날 때까지 잠시만 기다려주세요.",
        bullets: [],
        tip: "",
        actionGuide: "[발주 확정] 누르기",
        requireTargetClick: true,
        allowedActions: ["order:confirm"],
        waitForEvent: "order-delivered",
        pendingLabel: "배송 대기 중...",
        highlightPadding: 8,
        contextPadding: 10
      },
      {
        id: "delivery-box",
        selector: "#delivery-box-zone",
        spotlightSelector: "#delivery-box-zone",
        actionSelector: "#delivery-box-zone",
        anchorSelector: "#delivery-box-zone",
        targetLabel: "발주 박스",
        title: "발주 도착",
        description: `발주 박스가 도착했어요.
박스를 눌러 상품을 정리해보세요.`,
        pendingDescription: "발주 상품 정리 중이에요. 잠시만 기다려주세요.",
        bullets: [],
        tip: "",
        actionGuide: "[발주 박스] 누르기",
        requireTargetClick: true,
        allowedActions: ["delivery:open"],
        waitForEvent: "stock-organized",
        pendingLabel: "발주 상품 정리 중...",
        hideCardWhilePending: true,
        highlightPadding: 8
      },
      {
        id: "auto-shelf-guide",
        selector: "#zone1-basic-shelf-1",
        spotlightSelector: "#zone1-basic-shelf-1",
        anchorSelector: "#zone1-basic-shelf-1",
        targetLabel: "창고 정리 완료",
        title: "상품 정리 완료",
        description: `상품 정리가 끝났어요.
발주 상품이 창고 재고로 정리되었어요.
이제 다음 준비를 이어가볼게요.`,
        bullets: [],
        tip: "",
        actionGuide: "다음 안내 보기",
        requireTargetClick: false,
        highlightPadding: 8
      },
      {
        id: "checkout-guide",
        selector: "#counter-zone",
        spotlightSelector: "#counter-zone",
        anchorSelector: "#counter-zone",
        targetLabel: "계산대",
        title: "계산대",
        description: `영업 중 손님이 계산대로 오면
계산대를 눌러 결제를 처리하세요.`,
        bullets: [],
        tip: "",
        actionGuide: "다음 안내 보기",
        requireTargetClick: false,
        highlightPadding: 8
      },
      {
        id: "shelf-restock-guide",
        selector: "#zone1-basic-shelf-1",
        spotlightSelector: "#zone1-basic-shelf-1",
        anchorSelector: "#zone1-basic-shelf-1",
        targetLabel: "진열대 보충",
        title: "진열대 보충",
        description: `상품이 팔리면 진열대 재고가 줄어들어요.
영업 중 재고가 부족해지면 진열대를 눌러 보충하세요.`,
        bullets: [],
        tip: "",
        actionGuide: "다음 안내 보기",
        requireTargetClick: false,
        highlightPadding: 8
      },
      {
        id: "cleaning-guide",
        selector: "#cleaning-zone .cleaning-tools-image, #cleaning-zone",
        spotlightSelector: "#cleaning-zone .cleaning-tools-image, #cleaning-zone",
        anchorSelector: "#cleaning-zone .cleaning-tools-image, #cleaning-zone",
        targetLabel: "청소 도구",
        title: "청소",
        description: `매장이 더러워지면 위생이 떨어져요.
청소가 필요할 때 청소 도구를 눌러 정리하세요.`,
        bullets: [],
        tip: "",
        actionGuide: "다음 안내 보기",
        requireTargetClick: false,
        highlightPadding: 8
      },
      {
        id: "open-store",
        selector: "#open-store-button",
        spotlightSelector: "#open-store-button",
        actionSelector: "#open-store-button",
        anchorSelector: "#open-store-button",
        targetLabel: "첫 화면으로 이동",
        title: "연습 완료",
        description: `방금까지는 조작을 익히기 위한 연습이었어요.
[영업 시작] 버튼을 누르면 연습 기록을 정리하고 게임 첫 화면으로 돌아갑니다.
첫 화면에서 [새 매장 시작]을 눌러 진짜 Day 1을 발주부터 시작하세요.`,
        pendingDescription: "연습 기록을 정리하고 첫 화면으로 이동할 준비 중이에요. 잠시만 기다려주세요.",
        bullets: [],
        tip: "",
        actionGuide: "[영업 시작] 버튼 누르기",
        requireTargetClick: true,
        allowedActions: ["store:open"],
        pendingLabel: "첫 화면 이동 중...",
        hideSkipButton: true,
        highlightPadding: 8
      }
    ];
  },

  showFirstRunTutorialSoon() {
    if (this.tutorialAutoShown || this.isTutorialCompleted()) {
      return;
    }

    this.tutorialAutoShown = true;

    window.setTimeout(() => {
      if (document.body.classList.contains("is-title-screen-active")) {
        return;
      }

      this.showTutorialOverlay({ startIndex: 0, mode: "interactive" });
    }, 260);
  },

  enableTutorialInputGuard() {
    if (this.tutorialInputGuardClickHandler || this.tutorialInputGuardPointerHandler) {
      return;
    }

    this.tutorialInputGuardClickHandler = (event) => {
      this.handleTutorialInputCapture(event, "click");
    };
    this.tutorialInputGuardPointerHandler = (event) => {
      this.handleTutorialInputCapture(event, "pointerdown");
    };

    document.addEventListener("pointerdown", this.tutorialInputGuardPointerHandler, true);
    document.addEventListener("click", this.tutorialInputGuardClickHandler, true);
  },

  disableTutorialInputGuard() {
    if (this.tutorialInputGuardPointerHandler) {
      document.removeEventListener("pointerdown", this.tutorialInputGuardPointerHandler, true);
    }

    if (this.tutorialInputGuardClickHandler) {
      document.removeEventListener("click", this.tutorialInputGuardClickHandler, true);
    }

    this.tutorialInputGuardPointerHandler = null;
    this.tutorialInputGuardClickHandler = null;
  },

  handleTutorialInputCapture(event, eventType = "click") {
    if (!this.isInteractiveTutorialActive()) return true;

    if (this.tryActivateTutorialTargetProxyFromEvent(event, eventType)) {
      return false;
    }

    if (this.isTutorialEventAllowed(event)) {
      return true;
    }

    this.blockTutorialInputEvent(event, eventType);
    return false;
  },

  tryActivateTutorialTargetProxyFromEvent(event, eventType = "click") {
    if (!this.isInteractiveTutorialActive()) return false;
    if (!event || !["pointerdown", "click"].includes(eventType)) return false;
    if (typeof event.button === "number" && event.button !== 0) return false;

    const step = this.getCurrentTutorialStep();

    if (!this.shouldUseTutorialTargetProxy(step)) return false;

    const proxy = this.tutorialTargetProxy;
    const source = this.tutorialTargetProxySource;

    if (!proxy || !source || !document.body.contains(proxy)) return false;

    const clientX = Number(event.clientX);
    const clientY = Number(event.clientY);

    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

    const rect = proxy.getBoundingClientRect();
    const hitPadding = 4;
    const isInsideProxy = clientX >= rect.left - hitPadding
      && clientX <= rect.right + hitPadding
      && clientY >= rect.top - hitPadding
      && clientY <= rect.bottom + hitPadding;

    if (!isInsideProxy) return false;

    if (event.cancelable !== false) {
      event.preventDefault?.();
    }

    event.stopPropagation?.();
    event.stopImmediatePropagation?.();

    if (this.tutorialTargetProxyActivating) return true;

    this.tutorialTargetProxyActivating = true;

    window.setTimeout(() => {
      this.tutorialTargetProxyActivating = false;
    }, 240);

    this.activateTutorialTargetProxy(step, source, null);
    return true;
  },

  isTutorialEventAllowed(event) {
    if (!event) return true;

    const target = event.target instanceof Element ? event.target : event.target?.parentElement;

    if (!target) return true;

    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");

    if (overlay?.contains(target)) {
      return Boolean(target.closest("#tutorial-next-button, #tutorial-skip-button, [data-tutorial-target-proxy='true']"));
    }

    if (target.closest("[data-tutorial-target-proxy='true']")) {
      return true;
    }

    let step = this.getCurrentTutorialStep();

    if (this.syncOrderDeliveryTutorialArrival(step)) {
      step = this.getCurrentTutorialStep();
    }

    if (!step || this.tutorialPendingStepId === step.id) {
      return false;
    }

    const shouldAllowStepTarget = step.requireTargetClick === true || step.requiresOrderQuantity === true;
    const allowedSelectors = [
      shouldAllowStepTarget ? this.getTutorialActionSelector(step) : "",
      ...(shouldAllowStepTarget && Array.isArray(step.allowedSelectors) ? step.allowedSelectors : [])
    ]
      .map((selector) => String(selector ?? "").trim())
      .filter(Boolean);

    return allowedSelectors.some((selector) => {
      try {
        return Boolean(target.closest(selector));
      } catch (error) {
        return false;
      }
    });
  },

  blockTutorialInputEvent(event, eventType = "click") {
    if (event?.cancelable !== false) {
      event?.preventDefault?.();
    }

    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();

    if (eventType === "click") {
      this.showTutorialBlockedMessage();
    }
  },

  showTutorialBlockedMessage() {
    if (this.tutorialBlockedMessageTimerId) return;

    this.showMessage("지금은 튜토리얼에서 표시된 곳만 누를 수 있어요.", {
      duration: 1500
    });

    this.tutorialBlockedMessageTimerId = window.setTimeout(() => {
      this.tutorialBlockedMessageTimerId = null;
    }, 900);
  },

  guardTutorialAction(actionKey, event = null) {
    if (!this.isInteractiveTutorialActive()) return true;

    const step = this.getCurrentTutorialStep();
    const allowedActions = new Set(Array.isArray(step?.allowedActions) ? step.allowedActions : []);

    if (allowedActions.has(actionKey)) {
      return true;
    }

    this.blockTutorialInputEvent(event, "click");
    return false;
  },

  isTutorialOrderQuantityControlAllowed(button) {
    if (!this.isInteractiveTutorialActive()) return true;

    const step = this.getCurrentTutorialStep();

    if (step?.id !== "order-quantity") {
      return false;
    }

    return Boolean(button?.closest?.('[data-tutorial-order-target="true"]'));
  },

  ensureTutorialOrderTargetVisible(delayMs = 0) {
    if (!this.isInteractiveTutorialActive()) return;

    const step = this.getCurrentTutorialStep();

    if (step?.id !== "order-quantity") return;

    const syncAnchoredLayout = () => {
      if (!this.isInteractiveTutorialActive()) return;
      if (this.getCurrentTutorialStep()?.id !== "order-quantity") return;

      const list = document.querySelector(".order-product-list");

      if (list) {
        list.scrollTop = 0;
      }

      this.positionTutorialCard();
      this.updateTutorialHighlight();
      this.bindTutorialActionTarget();
    };
    const run = () => {
      syncAnchoredLayout();
      window.requestAnimationFrame(syncAnchoredLayout);
      window.setTimeout(syncAnchoredLayout, 120);
    };

    if (delayMs > 0) {
      window.setTimeout(run, delayMs);
    } else {
      run();
    }
  },

  showTutorialOverlay(options = {}) {
    const force = options.force === true;

    if (!force && this.isTutorialCompleted()) {
      return;
    }

    const steps = this.getTutorialSteps();
    const startIndex = Math.min(
      steps.length - 1,
      Math.max(0, Math.floor(Number(options.startIndex) || 0))
    );

    if (!this.tutorialOverlay) {
      this.createTutorialOverlay();
    }

    this.tutorialSessionStartedCompleted = this.isTutorialCompleted();
    this.tutorialStepIndex = startIndex;
    // 기본 튜토리얼은 항상 작은 말풍선형 체험 모드로 보여준다.
    // 도움말에서 다시 열 때도 큰 팝업형 가이드로 돌아가지 않게 한다.
    this.tutorialMode = options.mode === "guide" ? "guide" : "interactive";
    this.tutorialPendingStepId = null;
    this.tutorialOverlay.dataset.mode = this.tutorialMode;
    this.tutorialOverlay.classList.remove("hidden");
    this.tutorialOverlay.setAttribute("aria-hidden", "false");
    this.tutorialOverlay.style.pointerEvents = "none";
    document.body.classList.add("is-tutorial-active");
    this.syncTutorialGameFrameBounds();
    this.enableTutorialInputGuard();
    this.renderTutorialStep();

    if (!this.tutorialHighlightResizeHandler) {
      this.tutorialHighlightResizeHandler = () => this.refreshTutorialAnchoredLayout();
    }

    window.addEventListener("resize", this.tutorialHighlightResizeHandler);
    window.addEventListener("scroll", this.tutorialHighlightResizeHandler, true);

    window.requestAnimationFrame(() => {
      const card = this.tutorialOverlay?.querySelector(".tutorial-card");
      this.focusElementSafely(card);
      this.refreshTutorialAnchoredLayout();
    });
  },

  hideTutorialOverlay() {
    this.completeTutorialAndCleanup({ markCompleted: false, message: "" });
  },

  completeTutorialAndCleanup(options = {}) {
    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");
    const shouldMarkCompleted = options.markCompleted === true;
    const message = String(options.message ?? "").trim();

    if (shouldMarkCompleted) {
      this.markTutorialCompleted();
    }

    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement && overlay?.contains(activeElement)) {
      activeElement.blur();
    }

    this.unbindTutorialActionTarget();
    this.removeTutorialTargetProxy();
    this.hideTutorialHighlight();
    this.clearTutorialStepClass();
    this.clearTutorialGameFrameBounds();
    this.tutorialPendingStepId = null;
    this.tutorialSessionStartedCompleted = false;

    if (overlay) {
      overlay.classList.add("hidden");
      overlay.classList.remove("tutorial-overlay--card-hidden");
      overlay.setAttribute("aria-hidden", "true");
      overlay.dataset.mode = "hidden";
      overlay.style.pointerEvents = "none";

      overlay.querySelectorAll(".tutorial-dim").forEach((panel) => {
        if (!(panel instanceof HTMLElement)) return;
        panel.classList.add("hidden");
        panel.style.left = "0px";
        panel.style.top = "0px";
        panel.style.width = "0px";
        panel.style.height = "0px";
      });
    }

    document.body.classList.remove("is-tutorial-active");

    if (this.tutorialHighlightResizeHandler) {
      window.removeEventListener("resize", this.tutorialHighlightResizeHandler);
      window.removeEventListener("scroll", this.tutorialHighlightResizeHandler, true);
    }

    this.tutorialHighlightResizeHandler = null;
    this.disableTutorialInputGuard();

    if (message) {
      this.showMessage(message, { duration: options.duration ?? 3200 });
    }
  },

  clearTutorialStepClass() {
    document.body.classList.forEach((className) => {
      if (String(className).startsWith("is-tutorial-step-")) {
        document.body.classList.remove(className);
      }
    });
  },

  setTutorialStepClass(stepId = "") {
    this.clearTutorialStepClass();

    const normalizedStepId = String(stepId || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "-");

    if (normalizedStepId) {
      document.body.classList.add(`is-tutorial-step-${normalizedStepId}`);
    }
  },

  refreshTutorialAfterUiChange(delayMs = 80) {
    if (!this.isTutorialVisible()) return;

    window.setTimeout(() => {
      if (!this.isTutorialVisible()) return;

      if (this.syncOrderDeliveryTutorialArrival()) return;

      this.positionTutorialCard();
      this.updateTutorialHighlight();
      this.bindTutorialActionTarget();
    }, Math.max(0, Math.floor(Number(delayMs) || 0)));
  },

  getVisibleDeliveryBoxTarget() {
    return this.findVisibleTutorialTarget("#delivery-box-zone");
  },

  syncOrderDeliveryTutorialArrival(step = this.getCurrentTutorialStep()) {
    if (!this.isInteractiveTutorialActive()) return false;
    if (step?.id !== "order-confirm") return false;
    if (!this.getVisibleDeliveryBoxTarget()) return false;

    this.tutorialPendingStepId = null;
    return this.moveTutorialToStep("delivery-box");
  },

  getCurrentTutorialStep() {
    return this.getTutorialSteps()[this.tutorialStepIndex] ?? null;
  },

  getTutorialStepIndexById(stepId) {
    const normalizedStepId = String(stepId ?? "").trim();

    return this.getTutorialSteps().findIndex((step) => step.id === normalizedStepId);
  },

  isTutorialVisible() {
    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");

    return Boolean(overlay && !overlay.classList.contains("hidden"));
  },

  isInteractiveTutorialActive() {
    return this.isTutorialVisible() && this.tutorialMode === "interactive";
  },

  moveTutorialToStep(stepId, options = {}) {
    if (!this.isTutorialVisible()) return false;

    const nextIndex = this.getTutorialStepIndexById(stepId);

    if (nextIndex < 0 || nextIndex === this.tutorialStepIndex) {
      return false;
    }

    const delayMs = Math.max(0, Math.floor(Number(options.delayMs) || 0));
    const applyMove = () => {
      if (!this.isTutorialVisible()) return;

      this.tutorialStepIndex = nextIndex;
      this.renderTutorialStep();
    };

    if (delayMs > 0) {
      window.setTimeout(applyMove, delayMs);
    } else {
      applyMove();
    }

    return true;
  },

  maybeAdvanceInteractiveTutorial(eventName, options = {}) {
    if (!this.isInteractiveTutorialActive()) return false;

    const step = this.getCurrentTutorialStep();

    if (!step || step.waitForEvent !== eventName) {
      return false;
    }

    const currentIndex = this.tutorialStepIndex;
    const delayMs = Math.max(0, Math.floor(Number(options.delayMs) || 0));

    const advance = () => {
      if (
        this.isInteractiveTutorialActive() &&
        this.tutorialStepIndex === currentIndex
      ) {
        this.tutorialPendingStepId = null;
        this.moveTutorialStep(1, { fromAction: true });
      }
    };

    if (delayMs > 0) {
      window.setTimeout(advance, delayMs);
    } else {
      advance();
    }

    return true;
  },

  moveTutorialStep(direction = 1, options = {}) {
    const steps = this.getTutorialSteps();
    const nextIndex = this.tutorialStepIndex + direction;

    if (
      this.tutorialMode === "interactive" &&
      direction > 0 &&
      options.fromAction !== true
    ) {
      const step = this.getCurrentTutorialStep();

      if (step?.blockNextUntilEvent) {
        this.showMessage("현재 단계가 완료될 때까지 잠시 기다려주세요.", {
          duration: 2000
        });
        this.updateTutorialHighlight();
        return;
      }

      if (step?.requiresOrderQuantity && this.getOrderDraftTotalQuantity() <= 0) {
        this.showMessage("상품을 1개 이상 선택한 뒤 넘어갈 수 있습니다.", {
          duration: 2200
        });
        this.updateTutorialHighlight();
        return;
      }

      if (step?.requireTargetClick) {
        this.showMessage("노란 테두리로 표시된 곳을 직접 눌러야 다음으로 넘어갑니다.", {
          duration: 2200
        });
        this.updateTutorialHighlight();
        return;
      }
    }

    if (nextIndex >= steps.length) {
      this.completeTutorialAndCleanup({
        markCompleted: true,
        message: "튜토리얼을 완료했습니다. 오른쪽 위 도움말 버튼에서 다시 볼 수 있어요."
      });
      return;
    }

    this.tutorialStepIndex = Math.min(
      steps.length - 1,
      Math.max(0, nextIndex)
    );
    this.tutorialPendingStepId = null;
    this.renderTutorialStep();
  },

  renderTutorialStep() {
    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");
    const steps = this.getTutorialSteps();
    const step = steps[this.tutorialStepIndex] ?? steps[0];

    if (!overlay || !step) return;

    const title = overlay.querySelector("#tutorial-title");
    const kicker = overlay.querySelector("#tutorial-kicker");
    const count = overlay.querySelector("#tutorial-step-count");
    const target = overlay.querySelector("#tutorial-step-target");
    const description = overlay.querySelector("#tutorial-description");
    const bullets = overlay.querySelector("#tutorial-bullets");
    const tip = overlay.querySelector("#tutorial-tip");
    const actionGuide = overlay.querySelector("#tutorial-action-guide");
    const prevButton = overlay.querySelector("#tutorial-prev-button");
    const nextButton = overlay.querySelector("#tutorial-next-button");
    const card = overlay.querySelector(".tutorial-card");
    const isInteractiveMode = this.tutorialMode === "interactive";
    const isPendingStep = this.tutorialPendingStepId === step.id;
    const displayTitle = isInteractiveMode
      ? String(step.title ?? "튜토리얼").replace(/^\d+\.\s*/, "")
      : step.title;

    if (this.syncOrderDeliveryTutorialArrival(step)) return;

    this.setTutorialStepClass(step.id);

    if (title) title.textContent = displayTitle;
    if (kicker) {
      kicker.textContent = isInteractiveMode
        ? `첫 영업 가이드 ${this.tutorialStepIndex + 1}/${steps.length}`
        : "첫 영업 가이드";
    }
    if (count) count.textContent = `${this.tutorialStepIndex + 1} / ${steps.length}`;
    if (target) target.textContent = step.targetLabel ?? "게임 화면";
    if (description) {
      description.textContent = isPendingStep
        ? step.pendingDescription ?? step.pendingLabel ?? step.description ?? ""
        : step.description ?? "";
    }
    if (tip) tip.textContent = step.tip ?? "";
    if (actionGuide) {
      const guideText = isPendingStep ? step.pendingLabel ?? "진행 중..." : step.actionGuide ?? "";
      actionGuide.textContent = guideText;
      actionGuide.classList.toggle("hidden", !guideText);
    }

    if (bullets) {
      const bulletItems = Array.isArray(step.bullets) ? step.bullets : [];
      bullets.innerHTML = bulletItems
        .map((item) => `<li>${item}</li>`)
        .join("");
      bullets.classList.toggle("hidden", bulletItems.length === 0);
    }

    if (prevButton) {
      prevButton.disabled = this.tutorialStepIndex <= 0;
    }

    const skipButton = overlay.querySelector("#tutorial-skip-button");
    if (skipButton) {
      skipButton.classList.toggle("hidden", step.hideSkipButton === true || isPendingStep);
    }

    const actionSelector = this.getTutorialActionSelector(step);
    const highlightSelector = this.getTutorialHighlightSelector(step);
    const hasVisibleTarget = Boolean(highlightSelector && this.findVisibleTutorialTarget(highlightSelector));
    const hasActionTarget = Boolean(actionSelector && this.findVisibleTutorialTarget(actionSelector));
    const shouldWaitForTarget = this.tutorialMode === "interactive" && step.requireTargetClick && hasActionTarget && !isPendingStep;
    const shouldHideCardWhilePending = this.tutorialMode === "interactive" &&
      isPendingStep &&
      step.hideCardWhilePending === true;

    overlay.classList.toggle("tutorial-overlay--card-hidden", shouldHideCardWhilePending);

    if (nextButton) {
      const isLastStep = this.tutorialStepIndex >= steps.length - 1;
      nextButton.textContent = isPendingStep || step.blockNextUntilEvent
        ? step.pendingLabel ?? "진행 중..."
        : shouldWaitForTarget
          ? "표시된 곳 눌러보기"
          : step.nextLabel
            ? step.nextLabel
            : isLastStep
              ? "시작하기"
              : "다음";
      nextButton.disabled = Boolean(step.blockNextUntilEvent || isPendingStep);
      nextButton.classList.toggle("is-waiting-action", shouldWaitForTarget || Boolean(step.blockNextUntilEvent || isPendingStep));
    }

    if (card) {
      card.classList.toggle("tutorial-card--requires-action", shouldWaitForTarget);
      card.classList.toggle("tutorial-card--read-only", this.tutorialMode === "interactive" && !shouldWaitForTarget);
      card.classList.toggle("tutorial-card--missing-target", this.tutorialMode === "interactive" && step.requireTargetClick && !hasVisibleTarget);
      card.classList.toggle("tutorial-card--pending", isPendingStep);
      card.classList.toggle("tutorial-card--hidden-pending", shouldHideCardWhilePending);
    }

    if (shouldHideCardWhilePending) {
      this.unbindTutorialActionTarget();
      this.removeTutorialTargetProxy();
      this.hideTutorialHighlight();
      this.updateTutorialDimPanels();
      return;
    }

    this.syncTutorialTargetProxy(step);
    this.positionTutorialCard();
    this.updateTutorialHighlight();
    this.bindTutorialActionTarget();
  },

  syncTutorialGameFrameBounds() {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gameRoot = document.getElementById("game-root");
    const gameRect = gameRoot?.getBoundingClientRect?.();
    const hasGameBounds = Boolean(
      gameRect &&
      Number.isFinite(gameRect.left) &&
      Number.isFinite(gameRect.top) &&
      Number.isFinite(gameRect.width) &&
      Number.isFinite(gameRect.height) &&
      gameRect.width > 0 &&
      gameRect.height > 0
    );

    const frame = hasGameBounds
      ? {
          left: Math.max(0, gameRect.left),
          top: Math.max(0, gameRect.top),
          width: Math.min(viewportWidth, gameRect.right) - Math.max(0, gameRect.left),
          height: Math.min(viewportHeight, gameRect.bottom) - Math.max(0, gameRect.top)
        }
      : {
          left: 0,
          top: 0,
          width: viewportWidth,
          height: viewportHeight
        };

    frame.width = Math.max(0, frame.width);
    frame.height = Math.max(0, frame.height);

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--tutorial-game-left", `${Math.round(frame.left)}px`);
    rootStyle.setProperty("--tutorial-game-top", `${Math.round(frame.top)}px`);
    rootStyle.setProperty("--tutorial-game-width", `${Math.round(frame.width)}px`);
    rootStyle.setProperty("--tutorial-game-height", `${Math.round(frame.height)}px`);

    return frame;
  },

  clearTutorialGameFrameBounds() {
    const rootStyle = document.documentElement.style;
    rootStyle.removeProperty("--tutorial-game-left");
    rootStyle.removeProperty("--tutorial-game-top");
    rootStyle.removeProperty("--tutorial-game-width");
    rootStyle.removeProperty("--tutorial-game-height");
  },

  clampTutorialValue(value, min, max) {
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);

    return Math.min(upper, Math.max(lower, value));
  },

  getTutorialSafeBounds(rect = null, fallbackBounds = null, inset = 0) {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const fallback = fallbackBounds && Number.isFinite(fallbackBounds.left)
      ? fallbackBounds
      : {
          left: 0,
          top: 0,
          right: viewportWidth,
          bottom: viewportHeight
        };
    const hasRect = Boolean(
      rect &&
      Number.isFinite(rect.left) &&
      Number.isFinite(rect.top) &&
      Number.isFinite(rect.right) &&
      Number.isFinite(rect.bottom) &&
      rect.right > rect.left &&
      rect.bottom > rect.top
    );
    const source = hasRect
      ? {
          left: Math.max(fallback.left, rect.left),
          top: Math.max(fallback.top, rect.top),
          right: Math.min(fallback.right, rect.right),
          bottom: Math.min(fallback.bottom, rect.bottom)
        }
      : { ...fallback };
    const safeInset = Math.max(0, Math.floor(Number(inset) || 0));
    const left = Math.min(source.right, source.left + safeInset);
    const top = Math.min(source.bottom, source.top + safeInset);
    const right = Math.max(left, source.right - safeInset);
    const bottom = Math.max(top, source.bottom - safeInset);

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
  },

  getTutorialRectOverlapArea(rectA = null, rectB = null) {
    if (!rectA || !rectB) return 0;

    const left = Math.max(rectA.left, rectB.left);
    const right = Math.min(rectA.right, rectB.right);
    const top = Math.max(rectA.top, rectB.top);
    const bottom = Math.min(rectA.bottom, rectB.bottom);

    return Math.max(0, right - left) * Math.max(0, bottom - top);
  },

  applyTutorialCardPosition(card, {
    left = 0,
    top = 0,
    placement = "below-target",
    cardWidth = 0,
    cardHeight = 0,
    anchorRect = null,
    extraClasses = []
  } = {}) {
    if (!card) return;

    card.classList.add("tutorial-card--anchored", `tutorial-card--${placement}`, ...extraClasses);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    this.syncTutorialCardArrow(card, {
      left,
      top,
      placement,
      cardWidth,
      cardHeight,
      anchorRect
    });
  },

  syncTutorialCardArrow(card, {
    left = 0,
    top = 0,
    placement = "below-target",
    cardWidth = 0,
    cardHeight = 0,
    anchorRect = null
  } = {}) {
    if (!card || !anchorRect) return;

    const arrowInset = 18;
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const anchorCenterY = anchorRect.top + anchorRect.height / 2;

    if (placement === "above-target" || placement === "below-target") {
      const arrowLeft = this.clampTutorialValue(anchorCenterX - left, arrowInset, Math.max(arrowInset, cardWidth - arrowInset));
      card.style.setProperty("--tutorial-arrow-left", `${Math.round(arrowLeft)}px`);
      card.style.removeProperty("--tutorial-arrow-top");
      return;
    }

    const arrowTop = this.clampTutorialValue(anchorCenterY - top, arrowInset, Math.max(arrowInset, cardHeight - arrowInset));
    card.style.setProperty("--tutorial-arrow-top", `${Math.round(arrowTop)}px`);
    card.style.removeProperty("--tutorial-arrow-left");
  },

  positionTutorialCard() {
    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");
    const card = overlay?.querySelector(".tutorial-card");
    const step = this.getCurrentTutorialStep();

    if (!overlay || !card || !step) return;

    this.syncTutorialGameFrameBounds();

    card.classList.remove(
      "tutorial-card--top-left",
      "tutorial-card--top-right",
      "tutorial-card--bottom-left",
      "tutorial-card--bottom-right",
      "tutorial-card--center",
      "tutorial-card--anchored",
      "tutorial-card--above-target",
      "tutorial-card--below-target",
      "tutorial-card--left-of-target",
      "tutorial-card--right-of-target",
      "tutorial-card--order-quantity",
      "tutorial-card--delivery-box"
    );
    card.style.removeProperty("left");
    card.style.removeProperty("right");
    card.style.removeProperty("top");
    card.style.removeProperty("bottom");
    card.style.removeProperty("transform");
    card.style.removeProperty("--tutorial-arrow-left");
    card.style.removeProperty("--tutorial-arrow-top");
    card.style.removeProperty("--tutorial-card-safe-width");
    card.style.removeProperty("--tutorial-card-safe-height");

    const target = this.getTutorialAnchorTarget(step);

    if (!target || this.tutorialMode !== "interactive") {
      card.classList.add("tutorial-card--center");
      return;
    }

    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gameRoot = document.getElementById("game-root");
    const gameRect = gameRoot?.getBoundingClientRect?.();
    const hasGameBounds = Boolean(
      gameRect &&
      Number.isFinite(gameRect.left) &&
      Number.isFinite(gameRect.top) &&
      gameRect.width > 0 &&
      gameRect.height > 0
    );
    const bounds = hasGameBounds
      ? {
          left: Math.max(0, gameRect.left),
          top: Math.max(0, gameRect.top),
          right: Math.min(viewportWidth, gameRect.right),
          bottom: Math.min(viewportHeight, gameRect.bottom)
        }
      : {
          left: 0,
          top: 0,
          right: viewportWidth,
          bottom: viewportHeight
        };

    const storeAreaRect = document.getElementById("store-area")?.getBoundingClientRect?.();
    const isBottomDockStep = ["start-day", "open-store"].includes(step?.id);

    if (
      isBottomDockStep &&
      storeAreaRect &&
      Number.isFinite(storeAreaRect.top) &&
      Number.isFinite(storeAreaRect.bottom) &&
      storeAreaRect.height > 0
    ) {
      bounds.top = Math.max(bounds.top, Math.max(0, storeAreaRect.top));
      bounds.bottom = Math.min(bounds.bottom, Math.min(viewportHeight, storeAreaRect.bottom));
    }

    bounds.width = Math.max(0, bounds.right - bounds.left);
    bounds.height = Math.max(0, bounds.bottom - bounds.top);

    const isCompact = bounds.height <= 600 || viewportHeight <= 680 || viewportWidth <= 980;
    const isOrderQuantityStep = step?.id === "order-quantity";
    const isDeliveryBoxStep = step?.id === "delivery-box";
    card.classList.toggle("tutorial-card--compact", isCompact);
    card.classList.toggle("tutorial-card--order-quantity", isOrderQuantityStep);
    card.classList.toggle("tutorial-card--delivery-box", isDeliveryBoxStep);

    const margin = isCompact ? 10 : 14;
    const gap = isCompact ? 12 : 14;
    const measuredRect = card.getBoundingClientRect();
    const measuredWidth = measuredRect.width || card.offsetWidth || 250;
    const measuredHeight = measuredRect.height || card.offsetHeight || 150;
    const maxCardWidth = Math.max(220, bounds.width - margin * 2);
    const maxCardHeight = Math.max(108, bounds.height - margin * 2);
    const cardWidth = Math.min(measuredWidth, maxCardWidth);
    const cardHeight = Math.min(measuredHeight, maxCardHeight);
    const targetCenterX = rect.left + rect.width / 2;
    const targetCenterY = rect.top + rect.height / 2;
    let placement = "below-target";
    let left = Math.min(
      bounds.right - cardWidth - margin,
      Math.max(bounds.left + margin, targetCenterX - cardWidth / 2)
    );
    let top = rect.bottom + gap;

    if (step?.id === "briefing-confirm") {
      const modalContentRect = document
        .querySelector("#day-scenario-modal .day-scenario-modal-content")
        ?.getBoundingClientRect?.();
      const hasModalBounds = Boolean(
        modalContentRect &&
        Number.isFinite(modalContentRect.left) &&
        Number.isFinite(modalContentRect.top) &&
        modalContentRect.width > 0 &&
        modalContentRect.height > 0
      );
      const placementBounds = hasModalBounds
        ? {
            left: Math.max(bounds.left, modalContentRect.left),
            top: Math.max(bounds.top, modalContentRect.top),
            right: Math.min(bounds.right, modalContentRect.right),
            bottom: Math.min(bounds.bottom, modalContentRect.bottom)
          }
        : bounds;
      const briefingGap = isCompact ? 12 : 16;
      const canPlaceRight = rect.right + briefingGap + cardWidth <= placementBounds.right - margin;
      const canPlaceLeft = rect.left - briefingGap - cardWidth >= placementBounds.left + margin;
      const preferredTop = rect.top - cardHeight - briefingGap;
      const sideTop = Math.min(
        placementBounds.bottom - cardHeight - margin,
        Math.max(placementBounds.top + margin, rect.top + rect.height / 2 - cardHeight / 2)
      );

      // 브리핑 단계는 화면 크기와 관계없이 CTA 오른쪽 배치를 우선한다.
      // 작은 화면에서도 왼쪽 목표/본문 영역을 가리지 않도록 오른쪽 여백을 먼저 사용하고,
      // 오른쪽 공간이 정말 부족할 때만 왼쪽/상단으로 후퇴한다.
      if (canPlaceRight) {
        left = rect.right + briefingGap;
        top = sideTop;
        placement = "right-of-target";
      } else if (canPlaceLeft) {
        left = rect.left - cardWidth - briefingGap;
        top = sideTop;
        placement = "left-of-target";
      } else {
        left = Math.min(
          placementBounds.right - cardWidth - margin,
          Math.max(placementBounds.left + margin, rect.right - cardWidth)
        );
        top = preferredTop;
        placement = "above-target";
      }

      left = Math.min(
        placementBounds.right - cardWidth - margin,
        Math.max(placementBounds.left + margin, left)
      );
      top = Math.min(
        placementBounds.bottom - cardHeight - margin,
        Math.max(placementBounds.top + margin, top)
      );

      this.applyTutorialCardPosition(card, {
        left,
        top,
        placement,
        cardWidth,
        cardHeight,
        anchorRect: rect
      });
      return;
    }

    if (step?.id === "order-quantity") {
      const actionSelector = this.getTutorialActionSelector(step);
      const visibleActionTargets = [...document.querySelectorAll(actionSelector)]
        .filter((node) => {
          if (!(node instanceof HTMLElement) || node.classList.contains("hidden") || node.closest(".hidden")) {
            return false;
          }

          const nodeRect = node.getBoundingClientRect();
          return nodeRect.width > 0 && nodeRect.height > 0;
        });
      const visibleTargetCards = [...document.querySelectorAll('#order-modal .order-product-card[data-tutorial-order-target="true"]')]
        .filter((node) => {
          if (!(node instanceof HTMLElement) || node.classList.contains("hidden") || node.closest(".hidden")) {
            return false;
          }

          const nodeRect = node.getBoundingClientRect();
          return nodeRect.width > 0 && nodeRect.height > 0;
        });
      const protectedTargetRects = visibleTargetCards
        .flatMap((targetCard) => [
          ...targetCard.querySelectorAll(
            '.order-product-image-box, .order-quantity-controls, .order-qty-button[data-action="increase"]'
          )
        ])
        .map((node) => node?.getBoundingClientRect?.())
        .filter((protectedRect) => {
          return protectedRect &&
            Number.isFinite(protectedRect.left) &&
            Number.isFinite(protectedRect.top) &&
            protectedRect.right > protectedRect.left &&
            protectedRect.bottom > protectedRect.top;
        });
      const focusRect = this.getTutorialHighlightRectFromTargets(
        visibleActionTargets.length > 0 ? visibleActionTargets : visibleTargetCards
      ) ?? this.getTutorialHighlightRectFromTargets([target]);
      const modalRect = document.querySelector("#order-modal .order-modal-content")?.getBoundingClientRect?.();
      const sidebarRect = document.querySelector("#order-modal .order-draft-sidebar")?.getBoundingClientRect?.();
      const productPanelRect = document.querySelector("#order-modal .order-draft-card-panel, #order-modal .order-draft-list-panel")?.getBoundingClientRect?.();
      const listRect = document.querySelector("#order-modal .order-product-list")?.getBoundingClientRect?.();
      const confirmButtonRect = document.getElementById("order-confirm-button")?.getBoundingClientRect?.();
      const modalBounds = this.getTutorialSafeBounds(modalRect, bounds, margin);
      const productPanelBounds = this.getTutorialSafeBounds(productPanelRect, modalBounds, 0);
      const sidebarBounds = this.getTutorialSafeBounds(sidebarRect, modalBounds, 0);
      const canUseProductPanel = productPanelBounds.width >= 178 && productPanelBounds.height >= 112;
      const isMobileOrderPlacement = modalBounds.width <= 760 || viewportWidth <= 900 || viewportHeight <= 620;
      const maxOrderPopoverWidth = isMobileOrderPlacement ? 190 : 236;
      const maxOrderPopoverHeight = isMobileOrderPlacement ? 190 : 210;
      const orderSafeWidth = this.clampTutorialValue(
        modalBounds.width - margin * 2,
        Math.min(120, modalBounds.width),
        Math.min(maxOrderPopoverWidth, modalBounds.width)
      );
      const orderSafeHeight = this.clampTutorialValue(
        modalBounds.height - margin * 2,
        Math.min(112, modalBounds.height),
        Math.min(maxOrderPopoverHeight, modalBounds.height)
      );

      card.style.setProperty("--tutorial-card-safe-width", `${Math.round(orderSafeWidth)}px`);
      card.style.setProperty("--tutorial-card-safe-height", `${Math.round(orderSafeHeight)}px`);

      const orderMeasuredRect = card.getBoundingClientRect();
      const orderCardWidth = Math.min(orderMeasuredRect.width || cardWidth, orderSafeWidth);
      const orderCardHeight = Math.min(orderMeasuredRect.height || cardHeight, orderSafeHeight);
      const anchorRect = focusRect ?? rect;
      const targetCardsRect = this.getTutorialHighlightRectFromTargets(visibleTargetCards) ?? anchorRect;
      const productPlacementBounds = canUseProductPanel ? productPanelBounds : modalBounds;
      const sidebarMinimumWidth = isMobileOrderPlacement ? Math.min(orderCardWidth, 112) : orderCardWidth;
      const sidebarMinimumHeight = isMobileOrderPlacement ? Math.min(orderCardHeight, 112) : orderCardHeight;
      const sidebarPlacementBounds = sidebarBounds.width >= sidebarMinimumWidth && sidebarBounds.height >= sidebarMinimumHeight
        ? sidebarBounds
        : null;
      const avoidRects = [
        { rect: targetCardsRect, weight: 8 },
        { rect: confirmButtonRect, weight: 4 }
      ].filter(({ rect: avoidRect }) => {
        return avoidRect &&
          Number.isFinite(avoidRect.left) &&
          Number.isFinite(avoidRect.top) &&
          avoidRect.right > avoidRect.left &&
          avoidRect.bottom > avoidRect.top;
      });
      const centerInModal = modalBounds.left + modalBounds.width / 2 - orderCardWidth / 2;
      const anchorCenterX = anchorRect.left + anchorRect.width / 2 - orderCardWidth / 2;
      const anchorCenterY = anchorRect.top + anchorRect.height / 2 - orderCardHeight / 2;
      const listTop = Math.max(productPlacementBounds.top, listRect?.top ?? productPlacementBounds.top);
      const candidates = [
        ...(sidebarPlacementBounds ? [
          {
            placement: "right-of-target",
            bounds: sidebarPlacementBounds,
            left: sidebarPlacementBounds.left + sidebarPlacementBounds.width / 2 - orderCardWidth / 2,
            top: sidebarPlacementBounds.top + margin,
            priority: isMobileOrderPlacement ? 0 : 3,
            region: "sidebar"
          },
          {
            placement: "right-of-target",
            bounds: sidebarPlacementBounds,
            left: sidebarPlacementBounds.left + sidebarPlacementBounds.width / 2 - orderCardWidth / 2,
            top: sidebarPlacementBounds.top + sidebarPlacementBounds.height / 2 - orderCardHeight / 2,
            priority: isMobileOrderPlacement ? 1 : 4,
            region: "sidebar"
          }
        ] : []),
        {
          placement: "above-target",
          bounds: productPlacementBounds,
          left: productPlacementBounds.left + productPlacementBounds.width / 2 - orderCardWidth / 2,
          top: Math.min(listTop - gap - orderCardHeight, productPlacementBounds.top + margin),
          priority: isMobileOrderPlacement ? 2 : 6,
          region: "product-top"
        },
        {
          placement: "below-target",
          bounds: modalBounds,
          left: centerInModal,
          top: modalBounds.bottom - orderCardHeight - margin,
          priority: isMobileOrderPlacement ? 3 : 9,
          region: "modal-bottom"
        },
        {
          placement: "above-target",
          bounds: modalBounds,
          left: centerInModal,
          top: modalBounds.top + margin,
          priority: isMobileOrderPlacement ? 4 : 8,
          region: "modal-top"
        },
        {
          placement: "above-target",
          bounds: productPlacementBounds,
          left: anchorCenterX,
          top: targetCardsRect.top - gap - orderCardHeight,
          priority: isMobileOrderPlacement ? 9 : 4,
          region: "target-above"
        },
        {
          placement: "right-of-target",
          bounds: modalBounds,
          left: targetCardsRect.right + gap,
          top: anchorCenterY,
          priority: isMobileOrderPlacement ? 16 : 2,
          region: "target-side"
        },
        {
          placement: "left-of-target",
          bounds: modalBounds,
          left: targetCardsRect.left - gap - orderCardWidth,
          top: anchorCenterY,
          priority: isMobileOrderPlacement ? 18 : 5,
          region: "target-side"
        },
        {
          placement: "below-target",
          bounds: modalBounds,
          left: anchorCenterX,
          top: targetCardsRect.bottom + gap,
          priority: isMobileOrderPlacement ? 12 : 7,
          region: "target-below"
        }
      ];
      const scoredCandidates = candidates.map((candidate) => {
        const candidateBounds = candidate.bounds &&
          candidate.bounds.width >= orderCardWidth &&
          candidate.bounds.height >= orderCardHeight
          ? candidate.bounds
          : modalBounds;
        const candidateLeft = this.clampTutorialValue(
          candidate.left,
          candidateBounds.left,
          candidateBounds.right - orderCardWidth
        );
        const candidateTop = this.clampTutorialValue(
          candidate.top,
          candidateBounds.top,
          candidateBounds.bottom - orderCardHeight
        );
        const candidateRect = {
          left: candidateLeft,
          top: candidateTop,
          right: candidateLeft + orderCardWidth,
          bottom: candidateTop + orderCardHeight
        };
        const protectedOverlap = protectedTargetRects.reduce((score, protectedRect) => {
          return score + this.getTutorialRectOverlapArea(candidateRect, protectedRect);
        }, 0);
        const avoidOverlap = avoidRects.reduce((score, { rect: avoidRect, weight }) => {
          return score + this.getTutorialRectOverlapArea(candidateRect, avoidRect) * weight;
        }, 0);
        const protectedOverlapPenalty = protectedOverlap > 0
          ? 1000000 + protectedOverlap * 200
          : 0;
        const mobileTargetSidePenalty = isMobileOrderPlacement && candidate.region === "target-side" ? 5000 : 0;

        return {
          ...candidate,
          left: candidateLeft,
          top: candidateTop,
          score: protectedOverlapPenalty + avoidOverlap + mobileTargetSidePenalty + candidate.priority * 100
        };
      });
      const selectedCandidate = scoredCandidates.sort((a, b) => a.score - b.score)[0] ?? scoredCandidates[0];

      left = selectedCandidate?.left ?? modalBounds.left;
      top = selectedCandidate?.top ?? modalBounds.top;
      placement = selectedCandidate?.placement ?? "above-target";

      this.applyTutorialCardPosition(card, {
        left,
        top,
        placement,
        cardWidth: orderCardWidth,
        cardHeight: orderCardHeight,
        anchorRect,
        extraClasses: ["tutorial-card--order-quantity"]
      });
      return;
    }

    if (step?.id === "delivery-box") {
      const storeRect = document.getElementById("store-area")?.getBoundingClientRect?.();
      const hasStoreBounds = Boolean(
        storeRect &&
        Number.isFinite(storeRect.left) &&
        Number.isFinite(storeRect.top) &&
        storeRect.width > 0 &&
        storeRect.height > 0
      );
      const placementBounds = hasStoreBounds
        ? {
            left: Math.max(bounds.left, storeRect.left),
            top: Math.max(bounds.top, storeRect.top),
            right: Math.min(bounds.right, storeRect.right),
            bottom: Math.min(bounds.bottom, storeRect.bottom)
          }
        : bounds;
      placementBounds.width = Math.max(0, placementBounds.right - placementBounds.left);
      placementBounds.height = Math.max(0, placementBounds.bottom - placementBounds.top);

      const isSmallDeliveryPlacement = placementBounds.width <= 760 || viewportWidth <= 980 || viewportHeight <= 680;
      const deliverySafeWidth = this.clampTutorialValue(
        placementBounds.width - margin * 2,
        Math.min(170, placementBounds.width),
        Math.min(isSmallDeliveryPlacement ? 220 : 260, placementBounds.width)
      );
      const deliverySafeHeight = this.clampTutorialValue(
        placementBounds.height - margin * 2,
        Math.min(108, placementBounds.height),
        Math.min(isSmallDeliveryPlacement ? 180 : 210, placementBounds.height)
      );

      card.style.setProperty("--tutorial-card-safe-width", `${Math.round(deliverySafeWidth)}px`);
      card.style.setProperty("--tutorial-card-safe-height", `${Math.round(deliverySafeHeight)}px`);

      const deliveryMeasuredRect = card.getBoundingClientRect();
      const deliveryCardWidth = Math.min(deliveryMeasuredRect.width || cardWidth, deliverySafeWidth);
      const deliveryCardHeight = Math.min(deliveryMeasuredRect.height || cardHeight, deliverySafeHeight);
      const deliveryCenterX = rect.left + rect.width / 2 - deliveryCardWidth / 2;
      const deliveryCenterY = rect.top + rect.height / 2 - deliveryCardHeight / 2;
      const topCenterLeft = placementBounds.left + placementBounds.width / 2 - deliveryCardWidth / 2;
      const topRightLeft = placementBounds.right - deliveryCardWidth - margin;
      const topLeft = placementBounds.left + margin;
      const candidates = [
        {
          placement: "above-target",
          left: topCenterLeft,
          top: placementBounds.top + margin,
          priority: isSmallDeliveryPlacement ? 0 : 8
        },
        {
          placement: "above-target",
          left: topRightLeft,
          top: placementBounds.top + margin,
          priority: isSmallDeliveryPlacement ? 1 : 9
        },
        {
          placement: "above-target",
          left: topLeft,
          top: placementBounds.top + margin,
          priority: isSmallDeliveryPlacement ? 2 : 10
        },
        {
          placement: "above-target",
          left: deliveryCenterX,
          top: rect.top - gap - deliveryCardHeight,
          priority: isSmallDeliveryPlacement ? 5 : 0
        },
        {
          placement: "right-of-target",
          left: rect.right + gap,
          top: deliveryCenterY,
          priority: isSmallDeliveryPlacement ? 7 : 1
        },
        {
          placement: "left-of-target",
          left: rect.left - gap - deliveryCardWidth,
          top: deliveryCenterY,
          priority: isSmallDeliveryPlacement ? 8 : 2
        },
        {
          placement: "below-target",
          left: deliveryCenterX,
          top: rect.bottom + gap,
          priority: isSmallDeliveryPlacement ? 12 : 4
        }
      ];
      const scoredCandidates = candidates.map((candidate) => {
        const candidateLeft = this.clampTutorialValue(
          candidate.left,
          placementBounds.left,
          placementBounds.right - deliveryCardWidth
        );
        const candidateTop = this.clampTutorialValue(
          candidate.top,
          placementBounds.top,
          placementBounds.bottom - deliveryCardHeight
        );
        const candidateRect = {
          left: candidateLeft,
          top: candidateTop,
          right: candidateLeft + deliveryCardWidth,
          bottom: candidateTop + deliveryCardHeight
        };
        const boxOverlap = this.getTutorialRectOverlapArea(candidateRect, rect);
        const overlapPenalty = boxOverlap > 0 ? 1000000 + boxOverlap * 200 : 0;

        return {
          ...candidate,
          left: candidateLeft,
          top: candidateTop,
          score: overlapPenalty + candidate.priority * 100
        };
      });
      const selectedCandidate = scoredCandidates.sort((a, b) => a.score - b.score)[0] ?? scoredCandidates[0];

      this.applyTutorialCardPosition(card, {
        left: selectedCandidate?.left ?? placementBounds.left + margin,
        top: selectedCandidate?.top ?? placementBounds.top + margin,
        placement: selectedCandidate?.placement ?? "above-target",
        cardWidth: deliveryCardWidth,
        cardHeight: deliveryCardHeight,
        anchorRect: rect,
        extraClasses: ["tutorial-card--delivery-box"]
      });
      return;
    }

    const forceAbove = ["start-day", "open-store"].includes(step?.id);
    const preferAbove =
      step?.preferredPlacement === "above" ||
      forceAbove ||
      targetCenterY > bounds.top + bounds.height * 0.56;
    placement = preferAbove ? "above-target" : "below-target";
    left = Math.min(
      bounds.right - cardWidth - margin,
      Math.max(bounds.left + margin, targetCenterX - cardWidth / 2)
    );
    top = preferAbove ? rect.top - cardHeight - gap : rect.bottom + gap;

    if (!preferAbove && top + cardHeight > bounds.bottom - margin) {
      top = rect.top - cardHeight - gap;
      placement = "above-target";
    }

    // 하단 버튼 대상은 말풍선이 버튼을 덮으면 안 되므로, 위 배치를 우선 유지한다.
    if (preferAbove && top < bounds.top + margin && !forceAbove) {
      top = rect.bottom + gap;
      placement = "below-target";
    }

    if (forceAbove) {
      placement = "above-target";
      top = rect.top - cardHeight - gap;
      top = Math.min(top, bounds.bottom - cardHeight - margin);
      top = Math.max(bounds.top + margin, top);

      // 버튼을 눌러야 하는 단계에서는 말풍선이 대상 버튼 위를 침범하면 실패로 본다.
      // 공간이 부족하면 카드만 게임 프레임 상단으로 올리고, 버튼은 프록시로 독립 표시한다.
      if (top + cardHeight + gap > rect.top) {
        top = bounds.top + margin;
      }
    }

    if (top + cardHeight > bounds.bottom - margin) {
      top = bounds.bottom - cardHeight - margin;
    }

    if (top < bounds.top + margin) {
      const canPlaceRight = rect.right + gap + cardWidth <= bounds.right - margin;
      const canPlaceLeft = rect.left - gap - cardWidth >= bounds.left + margin;

      if (!forceAbove && (canPlaceRight || canPlaceLeft)) {
        left = canPlaceRight ? rect.right + gap : rect.left - cardWidth - gap;
        placement = canPlaceRight ? "right-of-target" : "left-of-target";
        top = Math.min(
          bounds.bottom - cardHeight - margin,
          Math.max(bounds.top + margin, rect.top + rect.height / 2 - cardHeight / 2)
        );
      } else {
        top = Math.max(bounds.top + margin, Math.min(rect.top - cardHeight - gap, bounds.bottom - cardHeight - margin));
        placement = "above-target";
      }
    }

    this.applyTutorialCardPosition(card, {
      left,
      top,
      placement,
      cardWidth,
      cardHeight,
      anchorRect: rect
    });
  },


  refreshTutorialAnchoredLayout() {
    if (!this.isTutorialVisible()) return;

    const step = this.getCurrentTutorialStep();

    this.syncTutorialTargetProxy(step);
    this.positionTutorialCard();
    this.updateTutorialHighlight();
  },

  shouldUseTutorialTargetProxy(step = this.getCurrentTutorialStep()) {
    return this.tutorialMode === "interactive" && step?.id === "start-day";
  },

  getTutorialProxyLayer() {
    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");
    let layer = overlay?.querySelector("#tutorial-target-proxy-layer");

    if (!overlay) return null;

    if (!layer) {
      layer = document.createElement("div");
      layer.id = "tutorial-target-proxy-layer";
      layer.className = "tutorial-target-proxy-layer";
      layer.setAttribute("aria-hidden", "true");
      overlay.insertBefore(layer, overlay.querySelector(".tutorial-card") ?? null);
    }

    return layer;
  },

  syncTutorialTargetProxy(step = this.getCurrentTutorialStep()) {
    if (!this.shouldUseTutorialTargetProxy(step)) {
      this.removeTutorialTargetProxy();
      return null;
    }

    const sourceSelector = step?.selector ?? step?.actionSelector ?? "";
    const source = this.findVisibleTutorialTarget(sourceSelector);
    const layer = this.getTutorialProxyLayer();

    if (!source || !layer) {
      this.removeTutorialTargetProxy();
      return null;
    }

    const rect = source.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      this.removeTutorialTargetProxy();
      return null;
    }

    if (this.tutorialTargetProxySource && this.tutorialTargetProxySource !== source) {
      this.tutorialTargetProxySource.classList.remove("tutorial-proxy-source-hidden");
    }

    let proxy = this.tutorialTargetProxy;
    const sourceClassName = Array.from(source.classList ?? [])
      .filter((className) => ![
        "tutorial-proxy-source-hidden",
        "tutorial-action-target",
        "tutorial-spotlight-target"
      ].includes(className))
      .join(" ");
    const expectedClass = `tutorial-target-proxy tutorial-target-proxy--${step.id} ${sourceClassName}`.trim();
    const proxyContent = this.getTutorialTargetProxyContent(step, source);

    if (!proxy || this.tutorialTargetProxySource !== source || proxy.dataset.tutorialProxyStepId !== step.id) {
      this.removeTutorialTargetProxy();

      proxy = document.createElement(source.tagName.toLowerCase() === "button" ? "button" : "div");
      proxy.type = source instanceof HTMLButtonElement ? "button" : undefined;
      proxy.dataset.tutorialTargetProxy = "true";
      proxy.dataset.tutorialProxyStepId = step.id;
      proxy.setAttribute("aria-hidden", "true");
      proxy.tabIndex = -1;
      proxy.textContent = proxyContent;
      proxy.className = expectedClass;

      const clickHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        if (!this.isInteractiveTutorialActive()) return;

        const currentStep = this.getCurrentTutorialStep();
        const currentSource = this.tutorialTargetProxySource
          ?? this.findVisibleTutorialTarget(currentStep?.selector ?? currentStep?.actionSelector ?? "");

        if (!this.shouldUseTutorialTargetProxy(currentStep) || !currentSource) return;

        this.activateTutorialTargetProxy(currentStep, currentSource, event);
      };

      proxy.addEventListener("click", clickHandler);
      this.tutorialTargetProxy = proxy;
      this.tutorialTargetProxySource = source;
      this.tutorialTargetProxyClickHandler = clickHandler;
      layer.appendChild(proxy);
    } else {
      proxy.className = expectedClass;
      proxy.textContent = proxyContent;
    }

    proxy.classList.remove("tutorial-proxy-source-hidden");
    proxy.style.left = `${rect.left}px`;
    proxy.style.top = `${rect.top}px`;
    proxy.style.width = `${rect.width}px`;
    proxy.style.height = `${rect.height}px`;

    source.classList.add("tutorial-proxy-source-hidden");

    return proxy;
  },


  getTutorialTargetProxyContent(step = this.getCurrentTutorialStep(), source = null) {
    if (step?.id === "start-day") return "발주";
    if (step?.id === "open-store") return "영업 시작";

    return String(source?.textContent || step?.targetLabel || "").trim();
  },

  getTutorialTargetProxyActionKey(step = this.getCurrentTutorialStep()) {
    if (step?.id === "start-day") return "day:start-order";
    if (step?.id === "open-store") return "store:open";

    return "";
  },

  activateTutorialTargetProxy(step = this.getCurrentTutorialStep(), source = null, event = null) {
    if (!this.isInteractiveTutorialActive() || !this.shouldUseTutorialTargetProxy(step)) {
      return false;
    }

    const actionKey = this.getTutorialTargetProxyActionKey(step);

    if (actionKey && !this.guardTutorialAction(actionKey, event)) {
      return false;
    }

    const activatedStepIndex = this.tutorialStepIndex;
    const shouldWaitForEvent = Boolean(step?.waitForEvent);
    const advanceAfterAction = () => {
      if (shouldWaitForEvent) return;

      const delayMs = Math.max(0, Math.floor(Number(step?.advanceAfterTargetClickMs) || 0));
      window.setTimeout(() => {
        if (
          this.isInteractiveTutorialActive() &&
          this.tutorialStepIndex === activatedStepIndex
        ) {
          this.moveTutorialStep(1, { fromAction: true });
        }
      }, delayMs);
    };

    source?.classList?.remove("tutorial-proxy-source-hidden");
    this.removeTutorialTargetProxy();

    if (shouldWaitForEvent) {
      this.tutorialPendingStepId = step.id;
      this.renderTutorialStep();
    }

    if (step?.id === "start-day") {
      EventBus.emit(EVENTS.DAY_START_REQUESTED);
      advanceAfterAction();
      return true;
    }

    if (step?.id === "open-store") {
      this.completeFirstRunTutorialAndStartRealGame();
      return true;
    }

    source?.click?.();
    advanceAfterAction();
    return true;
  },

  completeFirstRunTutorialAndStartRealGame() {
    if (!this.isInteractiveTutorialActive?.()) {
      return false;
    }

    const wasTutorialAlreadyCompleted = this.tutorialSessionStartedCompleted === true;

    this.completeTutorialAndCleanup({
      markCompleted: true,
      message: ""
    });

    if (wasTutorialAlreadyCompleted) {
      this.showMessage("튜토리얼 도움말 확인을 마쳤습니다.", {
        duration: 2600
      });
      return true;
    }

    this.resetTutorialOrderUiState();

    EventBus.emit(TUTORIAL_PRACTICE_RESET_REQUESTED, {
      day: GameState.day,
      source: "tutorial_open_store_button"
    });

    this.hideDayScenarioModal?.();
    this.closeTitleScreen?.();
    this.render();
    this.renderCustomers?.();

    window.setTimeout(() => {
      this.showMessage("본격 게임이 시작됩니다! 세계 1등 편의점이 되는 날까지 발주부터 시작해보세요~", {
        duration: 3600
      });
      this.focusElementSafely?.(document.getElementById("start-day-button"));
    }, 80);

    return true;
  },

  resetTutorialOrderUiState() {
    this.orderDraftQuantities = {};
    this.orderDeliveredData = null;
    this.orderModalMode = "closed";
    this.pendingOrderPhaseData = null;

    if (typeof this.hideOrderModal === "function") {
      this.hideOrderModal();
    }

    if (typeof this.clearDeliveryBox === "function") {
      this.clearDeliveryBox();
    }
  },

  removeTutorialTargetProxy() {
    const proxy = this.tutorialTargetProxy;
    const source = this.tutorialTargetProxySource;

    if (proxy && this.tutorialTargetProxyClickHandler) {
      proxy.removeEventListener("click", this.tutorialTargetProxyClickHandler);
    }

    source?.classList?.remove("tutorial-proxy-source-hidden");
    proxy?.remove?.();
    this.tutorialTargetProxy = null;
    this.tutorialTargetProxySource = null;
    this.tutorialTargetProxyClickHandler = null;
  },

  getTutorialAnchorTarget(step = this.getCurrentTutorialStep()) {
    if (this.shouldUseTutorialTargetProxy(step)) {
      const proxy = this.syncTutorialTargetProxy(step);

      if (proxy) return proxy;
    }

    return this.findVisibleTutorialTarget(this.getTutorialAnchorSelector(step));
  },

  bindTutorialActionTarget() {
    this.unbindTutorialActionTarget();

    if (this.tutorialMode !== "interactive") return;

    const step = this.getCurrentTutorialStep();

    const actionSelector = this.getTutorialActionSelector(step);

    if (!step?.requireTargetClick || !actionSelector) return;

    const target = this.shouldUseTutorialTargetProxy(step)
      ? this.syncTutorialTargetProxy(step)
      : this.findVisibleTutorialTarget(actionSelector);

    if (!target) return;

    const boundStepIndex = this.tutorialStepIndex;
    const handler = () => {
      if (
        !this.isInteractiveTutorialActive() ||
        this.tutorialStepIndex !== boundStepIndex
      ) {
        return;
      }

      if (step.waitForEvent) {
        this.tutorialPendingStepId = step.id;
        this.unbindTutorialActionTarget();
        this.renderTutorialStep();
        window.setTimeout(() => {
          this.positionTutorialCard();
          this.updateTutorialHighlight();
        }, 80);
        return;
      }

      const delayMs = Math.max(0, Math.floor(Number(step.advanceAfterTargetClickMs) || 0));
      window.setTimeout(() => {
        if (
          this.isInteractiveTutorialActive() &&
          this.tutorialStepIndex === boundStepIndex
        ) {
          this.moveTutorialStep(1, { fromAction: true });
        }
      }, delayMs);
    };

    target.addEventListener("click", handler);
    this.tutorialActionTarget = target;
    this.tutorialActionHandler = handler;
    target.classList.add("tutorial-action-target");
  },

  unbindTutorialActionTarget() {
    if (this.tutorialActionTarget && this.tutorialActionHandler) {
      this.tutorialActionTarget.removeEventListener("click", this.tutorialActionHandler);
      this.tutorialActionTarget.classList.remove("tutorial-action-target");
    }

    this.tutorialActionTarget = null;
    this.tutorialActionHandler = null;
  },

  updateTutorialHighlight() {
    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");
    const ring = document.getElementById("tutorial-highlight-ring");
    const step = this.getTutorialSteps()[this.tutorialStepIndex];
    const highlightSelector = this.getTutorialHighlightSelector(step);

    if (!overlay || overlay.classList.contains("hidden") || !ring || !highlightSelector) {
      this.hideTutorialHighlight();
      return;
    }

    const proxy = this.shouldUseTutorialTargetProxy(step) ? this.syncTutorialTargetProxy(step) : null;
    const highlightRect = proxy
      ? this.getTutorialHighlightRectFromTargets([proxy])
      : this.getTutorialHighlightRect(highlightSelector);

    if (!highlightRect) {
      this.hideTutorialHighlight();
      return;
    }

    this.clearTutorialHighlightedTargets();
    this.tutorialHighlightedTargets = [...(highlightRect.targets ?? [])];
    this.tutorialHighlightedTargets.forEach((target) => {
      target.classList.add("tutorial-highlight-target");
    });

    const padding = Math.max(6, Math.floor(Number(step?.highlightPadding) || 8));
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const left = Math.max(6, highlightRect.left - padding);
    const top = Math.max(6, highlightRect.top - padding);
    const right = Math.min(viewportWidth - 6, highlightRect.right + padding);
    const bottom = Math.min(viewportHeight - 6, highlightRect.bottom + padding);
    const width = Math.max(36, right - left);
    const height = Math.max(36, bottom - top);

    ring.classList.remove("hidden");
    ring.style.left = `${left}px`;
    ring.style.top = `${top}px`;
    ring.style.width = `${width}px`;
    ring.style.height = `${height}px`;

    // v7.13.3: no more cut-out dim panels.
    // A single full-screen dim layer keeps the darkness uniform and prevents
    // black bars / bright strips on small screens. The target itself is
    // emphasized with a ring and step-specific CSS.
    this.updateTutorialDimPanels({ viewportWidth, viewportHeight });
  },

  updateTutorialDimPanels(rect = null) {
    const overlay = this.tutorialOverlay ?? document.getElementById("tutorial-overlay");

    if (!overlay) return;

    const panels = [...overlay.querySelectorAll(".tutorial-dim")];
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    if (panels.length === 0) return;

    const [mainPanel, ...extraPanels] = panels;

    extraPanels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      panel.classList.add("hidden");
      panel.style.left = "0px";
      panel.style.top = "0px";
      panel.style.width = "0px";
      panel.style.height = "0px";
    });

    if (!(mainPanel instanceof HTMLElement) || !rect || viewportWidth <= 0 || viewportHeight <= 0) {
      if (mainPanel instanceof HTMLElement) {
        mainPanel.classList.add("hidden");
        mainPanel.style.left = "0px";
        mainPanel.style.top = "0px";
        mainPanel.style.width = "0px";
        mainPanel.style.height = "0px";
      }
      return;
    }

    mainPanel.classList.remove("hidden");
    mainPanel.style.left = "0px";
    mainPanel.style.top = "0px";
    mainPanel.style.width = `${Math.round(viewportWidth)}px`;
    mainPanel.style.height = `${Math.round(viewportHeight)}px`;
  },

  getTutorialHighlightSelector(step = this.getCurrentTutorialStep()) {
    return step?.spotlightSelector ?? step?.highlightSelector ?? step?.selector ?? "";
  },

  getTutorialContextSelector(step = this.getCurrentTutorialStep()) {
    return step?.contextSelector ?? "";
  },

  getTutorialActionSelector(step = this.getCurrentTutorialStep()) {
    return step?.actionSelector ?? step?.selector ?? "";
  },

  getTutorialAnchorSelector(step = this.getCurrentTutorialStep()) {
    return step?.anchorSelector ?? step?.actionSelector ?? step?.selector ?? "";
  },

  findVisibleTutorialTargets(selector = "") {
    const selectors = String(selector)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const candidateSelector of selectors) {
      const targets = [];
      const seen = new Set();

      document.querySelectorAll(candidateSelector).forEach((node) => {
        if (!(node instanceof HTMLElement) || seen.has(node)) {
          return;
        }

        if (node.classList.contains("hidden") || node.closest(".hidden")) {
          return;
        }

        const rect = node.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        seen.add(node);
        targets.push(node);
      });

      if (targets.length > 0) {
        return targets.slice(0, 1);
      }
    }

    return [];
  },

  findVisibleTutorialTarget(selector = "") {
    return this.findVisibleTutorialTargets(selector)[0] ?? null;
  },

  getTutorialHighlightRect(selector = "") {
    return this.getTutorialHighlightRectFromTargets(this.findVisibleTutorialTargets(selector));
  },

  getTutorialHighlightRectFromTargets(targets = []) {
    const visibleTargets = targets.filter((target) => target instanceof HTMLElement);

    if (visibleTargets.length === 0) return null;

    const unionRect = visibleTargets.reduce((rect, target) => {
      const targetRect = target.getBoundingClientRect();

      if (!rect) {
        return {
          left: targetRect.left,
          top: targetRect.top,
          right: targetRect.right,
          bottom: targetRect.bottom
        };
      }

      return {
        left: Math.min(rect.left, targetRect.left),
        top: Math.min(rect.top, targetRect.top),
        right: Math.max(rect.right, targetRect.right),
        bottom: Math.max(rect.bottom, targetRect.bottom)
      };
    }, null);

    if (!unionRect) return null;

    return {
      ...unionRect,
      width: unionRect.right - unionRect.left,
      height: unionRect.bottom - unionRect.top,
      targets: visibleTargets
    };
  },

  clearTutorialHighlightedTargets() {
    (this.tutorialHighlightedTargets ?? []).forEach((target) => {
      target.classList?.remove("tutorial-highlight-target");
    });

    this.tutorialHighlightedTargets = [];
  },

  hideTutorialHighlight() {
    const ring = document.getElementById("tutorial-highlight-ring");

    this.clearTutorialHighlightedTargets();

    if (!ring) return;

    ring.classList.add("hidden");
    ring.style.removeProperty("left");
    ring.style.removeProperty("top");
    ring.style.removeProperty("width");
    ring.style.removeProperty("height");

    this.updateTutorialDimPanels(null);
  },

  markTutorialCompleted() {
    try {
      window.localStorage?.setItem(this.tutorialCompletedKey, "true");
    } catch (error) {
      console.warn("튜토리얼 완료 상태를 저장하지 못했습니다.", error);
    }
  },

  isTutorialCompleted() {
    try {
      const storage = window.localStorage;

      if (!storage) return false;

      return [this.tutorialCompletedKey, ...(this.tutorialLegacyCompletedKeys ?? [])]
        .some((key) => storage.getItem(key) === "true");
    } catch (error) {
      return false;
    }
  },

  resetTutorialProgressForNewGame() {
    // 새 매장 시작은 매장 진행도 리셋일 뿐, 계정성 설정인
    // "튜토리얼 완료/건너뛰기" 선택은 유지한다.
    this.tutorialAutoShown = false;
    this.pendingFirstRunTutorialAfterDailyReward = false;

    try {
      const storage = window.localStorage;

      if (!storage) return;

      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);

        if (key?.startsWith(this.tutorialHintPrefix)) {
          storage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn("튜토리얼 힌트 초기화 상태를 저장하지 못했습니다.", error);
    }
  },

  showTutorialHintOnce(key, message, options = {}) {
    if (this.isTutorialCompleted() || this.isInteractiveTutorialActive()) {
      return;
    }

    const normalizedKey = String(key ?? "").trim();
    const normalizedMessage = String(message ?? "").trim();

    if (!normalizedKey || !normalizedMessage) {
      return;
    }

    try {
      const storageKey = `${this.tutorialHintPrefix}${normalizedKey}`;

      if (window.localStorage?.getItem(storageKey) === "true") {
        return;
      }

      window.localStorage?.setItem(storageKey, "true");
    } catch (error) {
      // 저장 실패 시에도 안내 메시지는 표시한다.
    }

    this.showMessage(normalizedMessage, {
      duration: options.duration ?? 3600
    });
  },

  createTitleScreen() {
    let titleScreen = document.getElementById("title-screen");

    if (!titleScreen) {
      titleScreen = document.createElement("section");
      titleScreen.id = "title-screen";
      titleScreen.className = "title-screen";
      titleScreen.setAttribute("aria-labelledby", "title-screen-logo");
      titleScreen.innerHTML = `
        <div class="title-screen-inner">
          <img
            id="title-screen-logo"
            class="title-logo"
            src="./assets/title/logo/game_logo_hq_safe.png"
            alt="오늘도 정상영업"
            draggable="false"
          />

          <div class="title-menu" aria-label="타이틀 메뉴">
            <button
              id="title-new-game-button"
              class="title-menu-button title-new-game-button"
              type="button"
              aria-label="새 매장 시작"
            >
              <span class="title-button-caption">새 매장 시작</span>
            </button>

            <button
              id="title-resume-button"
              class="title-menu-button title-resume-button"
              type="button"
              aria-label="이어하기"
              aria-describedby="title-resume-state"
            >
              <span class="title-button-caption">이어하기</span>
            </button>

            <button
              id="title-settings-button"
              class="title-menu-button title-settings-button"
              type="button"
              aria-label="설정"
            >
              <span class="title-button-caption">설정</span>
            </button>
          </div>

          <p id="title-resume-state" class="title-resume-state" aria-live="polite"></p>
        </div>
      `;

      const gameRoot = document.getElementById("game-root");

      if (gameRoot?.parentElement) {
        gameRoot.parentElement.insertBefore(titleScreen, gameRoot);
      } else {
        document.body.prepend(titleScreen);
      }
    }

    this.titleScreen = titleScreen;
    document.body.classList.toggle(
      "is-title-screen-active",
      !titleScreen.classList.contains("hidden")
    );
    this.bindTitleScreenButtons();
    this.renderTitleResumeButton();
  },

  bindTitleScreenButtons() {
    const newGameButton = document.getElementById("title-new-game-button");
    const resumeButton = document.getElementById("title-resume-button");
    const settingsButton = document.getElementById("title-settings-button");

    if (newGameButton) {
      newGameButton.onclick = () => {
        SaveSystem.resetNewGameState();
        this.resetTutorialProgressForNewGame();
        this.renderTitleResumeButton();
        this.enterGameFromTitle();
      };
    }

    if (resumeButton) {
      resumeButton.onclick = () => {
        if (!this.hasTitleResumeData()) {
          this.renderTitleResumeButton();
          return;
        }

        const loadResult = SaveSystem.loadGame();

        if (!loadResult.success) {
          this.showMessage(loadResult.message ?? "저장 데이터를 불러오지 못했습니다.");
          this.renderTitleResumeButton();
          return;
        }

        this.closeTitleScreen();
        this.render();
        this.renderCustomers();
        this.showMessage(loadResult.message ?? `Day ${GameState.day} 저장 데이터를 불러왔습니다.`);
        this.showDailyRewardIfAvailable();
      };
    }

    if (settingsButton) {
      settingsButton.onclick = () => {
        this.openSettingsModal("title");
      };
    }
  },

  hasTitleResumeData() {
    return SaveSystem.hasSaveData();
  },

  renderTitleResumeButton() {
    const resumeButton = document.getElementById("title-resume-button");
    const resumeState = document.getElementById("title-resume-state");
    const hasSaveData = this.hasTitleResumeData();

    if (resumeButton) {
      resumeButton.disabled = !hasSaveData;
      resumeButton.setAttribute("aria-disabled", hasSaveData ? "false" : "true");
      resumeButton.dataset.saveAvailable = hasSaveData ? "true" : "false";
      this.syncUiImageButtonState(resumeButton);
    }

    if (resumeState) {
      const saveSummary = SaveSystem.getSaveSummary();

      if (hasSaveData && saveSummary) {
        const modeText = saveSummary.isEndlessMode
          ? "무한 모드 재도전 가능"
          : "저장 데이터 있음";

        resumeState.textContent = `${modeText} · Day ${saveSummary.day} · ₩${saveSummary.money.toLocaleString("ko-KR")}`;
      } else {
        resumeState.textContent = "저장 데이터 없음";
      }
    }
  },

  enterGameFromTitle() {
    this.closeTitleScreen();
    this.showMessage("새 매장으로 다시 시작합니다. 출석 기록과 BM 지갑은 유지하고 Day 1 준비를 시작하세요.");

    this.pendingFirstRunTutorialAfterDailyReward = true;
    const rewardShown = this.showDailyRewardIfAvailable();

    if (!rewardShown) {
      this.pendingFirstRunTutorialAfterDailyReward = false;
      this.showFirstRunTutorialSoon();
    }
  },

  showTitleScreen(message = "타이틀 화면으로 돌아왔습니다.") {
    if (!this.titleScreen) {
      this.createTitleScreen();
    }

    this.setElementHiddenSafely(this.titleScreen, false);
    document.body.classList.add("is-title-screen-active");
    this.syncTutorialHelpButtonVisibility();
    this.renderTitleResumeButton();
    this.render();

    window.requestAnimationFrame(() => {
      this.focusElementSafely(document.getElementById("title-new-game-button"));
    });

    if (message) {
      this.showMessage(message);
    }
  },

  clearFocusInsideElement(element) {
    if (!element) return false;

    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement && element.contains(activeElement)) {
      activeElement.blur();
      return true;
    }

    return false;
  },

  setElementHiddenSafely(element, isHidden = true) {
    if (!element) return;

    if (isHidden) {
      this.clearFocusInsideElement(element);
      element.classList.add("hidden");
      element.setAttribute("aria-hidden", "true");
      return;
    }

    element.classList.remove("hidden");
    element.setAttribute("aria-hidden", "false");
  },

  focusElementSafely(element) {
    if (
      element instanceof HTMLElement &&
      !element.disabled &&
      !element.hidden &&
      !element.closest(".hidden") &&
      element.getAttribute("aria-hidden") !== "true"
    ) {
      element.focus?.({ preventScroll: true });
    }
  },

  closeTitleScreen() {
    if (!this.titleScreen) return;

    this.setElementHiddenSafely(this.titleScreen, true);
    document.body.classList.remove("is-title-screen-active");
    this.syncTutorialHelpButtonVisibility();
    this.focusElementSafely(document.getElementById("start-day-button"));
  },

  createSettingsModal() {
    let modal = document.getElementById("settings-modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "settings-modal";
      modal.className = "modal settings-modal hidden";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `
        <div
          class="modal-content settings-modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
        >
          <div class="settings-modal-header">
            <h2 id="settings-modal-title">설정</h2>
            <button id="settings-close-button" class="settings-close-button" type="button" aria-label="설정 닫기">
              닫기
            </button>
          </div>

          <div class="settings-option-list">
            <div class="settings-option-row settings-audio-row">
              <label class="settings-audio-toggle">
                <span>효과음</span>
                <input id="settings-sfx-enabled" type="checkbox" />
              </label>
              <label class="settings-volume-control">
                <span>효과음 볼륨 <output id="settings-sfx-volume-value">100%</output></span>
                <input id="settings-sfx-volume" type="range" min="0" max="100" step="5" />
              </label>
            </div>
            <div class="settings-option-row settings-audio-row">
              <label class="settings-audio-toggle">
                <span>배경음</span>
                <input id="settings-bgm-enabled" type="checkbox" />
              </label>
              <label class="settings-volume-control">
                <span>배경음 볼륨 <output id="settings-bgm-volume-value">100%</output></span>
                <input id="settings-bgm-volume" type="range" min="0" max="100" step="5" />
              </label>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    }

    this.settingsModal = modal;
    this.bindSettingsModalButtons();
    this.prepareUiImageButtons(modal);
  },

  bindSettingsModalButtons() {
    if (!this.settingsModal) return;

    const closeButton = document.getElementById("settings-close-button");
    const sfxEnabledInput = document.getElementById("settings-sfx-enabled");
    const bgmEnabledInput = document.getElementById("settings-bgm-enabled");
    const sfxVolumeInput = document.getElementById("settings-sfx-volume");
    const bgmVolumeInput = document.getElementById("settings-bgm-volume");

    if (closeButton) {
      closeButton.onclick = () => {
        this.hideSettingsModal();
      };
    }

    if (sfxEnabledInput) {
      sfxEnabledInput.onchange = () => {
        AudioSystem.setSfxEnabled(sfxEnabledInput.checked);
        this.syncSettingsAudioControls();
      };
    }

    if (bgmEnabledInput) {
      bgmEnabledInput.onchange = () => {
        AudioSystem.setBgmEnabled(bgmEnabledInput.checked);
        this.syncSettingsAudioControls();
      };
    }

    if (sfxVolumeInput) {
      sfxVolumeInput.oninput = () => {
        AudioSystem.setSfxVolume((Number(sfxVolumeInput.value) || 0) / 100);
        this.syncSettingsAudioControls();
      };
    }

    if (bgmVolumeInput) {
      bgmVolumeInput.oninput = () => {
        AudioSystem.setBgmVolume((Number(bgmVolumeInput.value) || 0) / 100);
        this.syncSettingsAudioControls();
      };
    }

    this.settingsModal.onclick = (event) => {
      if (event.target === this.settingsModal) {
        this.hideSettingsModal();
      }
    };

    if (!this.settingsEscapeKeyBound) {
      this.settingsEscapeKeyBound = true;
      document.addEventListener("keydown", (event) => {
        if (
          event.key === "Escape" &&
          this.settingsModal &&
          !this.settingsModal.classList.contains("hidden")
        ) {
          this.hideSettingsModal();
        }
      });
    }

    this.syncSettingsAudioControls();
  },

  syncSettingsAudioControls() {
    const settings = AudioSystem.getSettings();
    const sfxEnabledInput = document.getElementById("settings-sfx-enabled");
    const bgmEnabledInput = document.getElementById("settings-bgm-enabled");
    const sfxVolumeInput = document.getElementById("settings-sfx-volume");
    const bgmVolumeInput = document.getElementById("settings-bgm-volume");
    const sfxVolumeValue = document.getElementById("settings-sfx-volume-value");
    const bgmVolumeValue = document.getElementById("settings-bgm-volume-value");

    const sfxPercent = Math.round((Number(settings.sfxVolume) || 0) * 100);
    const bgmPercent = Math.round((Number(settings.bgmVolume) || 0) * 100);

    if (sfxEnabledInput) {
      sfxEnabledInput.checked = settings.sfxEnabled !== false;
    }

    if (bgmEnabledInput) {
      bgmEnabledInput.checked = settings.bgmEnabled !== false;
    }

    if (sfxVolumeInput) {
      sfxVolumeInput.value = String(sfxPercent);
      sfxVolumeInput.disabled = settings.sfxEnabled === false;
    }

    if (bgmVolumeInput) {
      bgmVolumeInput.value = String(bgmPercent);
      bgmVolumeInput.disabled = settings.bgmEnabled === false;
    }

    if (sfxVolumeValue) {
      sfxVolumeValue.value = `${sfxPercent}%`;
      sfxVolumeValue.textContent = `${sfxPercent}%`;
    }

    if (bgmVolumeValue) {
      bgmVolumeValue.value = `${bgmPercent}%`;
      bgmVolumeValue.textContent = `${bgmPercent}%`;
    }
  },

  openSettingsModal(source = "ingame") {
    if (!this.settingsModal) {
      this.createSettingsModal();
    }

    this.settingsModal.dataset.source = source;
    this.setElementHiddenSafely(this.settingsModal, false);
    this.syncSettingsAudioControls();
    this.prepareUiImageButtons(this.settingsModal);

    window.requestAnimationFrame(() => {
      document.getElementById("settings-close-button")?.focus();
    });
  },

  hideSettingsModal() {
    if (!this.settingsModal) return;

    const source = this.settingsModal.dataset.source;
    const returnFocusTarget = source === "title"
      ? document.getElementById("title-settings-button")
      : document.getElementById("ingame-settings-button");

    this.setElementHiddenSafely(this.settingsModal, true);
    this.focusElementSafely(returnFocusTarget);
  },

  createDailyRewardModal() {
    let modal = document.getElementById("daily-reward-modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "daily-reward-modal";
      modal.className = "modal daily-reward-modal hidden";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `
        <div
          class="daily-reward-frame"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-reward-title"
          aria-describedby="daily-reward-description"
        >
          <h2 id="daily-reward-title" class="sr-only">7일 출석 보상</h2>
          <p id="daily-reward-description" class="sr-only">오늘의 출석 보상이 자동 지급되었습니다. 확인 버튼을 눌러 보상을 받으세요.</p>
          <img
            id="daily-reward-image"
            class="daily-reward-image"
            src="./assets/ui/dailyreward/day1_basic.png"
            alt="7일 출석 보상"
            draggable="false"
          />
          <button
            id="daily-reward-confirm-area"
            class="daily-reward-confirm-area"
            type="button"
            aria-label="출석 보상 확인"
          >
            <span class="sr-only">확인</span>
          </button>
        </div>
      `;

      document.body.appendChild(modal);
    }

    this.dailyRewardModal = modal;
    this.bindDailyRewardModalButtons();
  },

  bindDailyRewardModalButtons() {
    const confirmButton = document.getElementById("daily-reward-confirm-area");

    if (!confirmButton) return;

    confirmButton.onclick = () => {
      const result = DailyRewardSystem.claimToday();

      if (result.success) {
        this.hideDailyRewardModal();
        this.render();
        this.showMessage(result.message ?? "출석 보상이 지급되었습니다.");
        return;
      }

      this.hideDailyRewardModal();
      this.showMessage(result.message ?? "오늘 출석 보상을 확인했습니다.");
    };
  },

  showDailyRewardIfAvailable() {
    if (!this.dailyRewardModal) {
      this.createDailyRewardModal();
    }

    const claimInfo = DailyRewardSystem.getTodayClaimInfo();

    if (!claimInfo.canClaim || !claimInfo.reward) {
      return false;
    }

    const rewardImage = document.getElementById("daily-reward-image");
    const confirmButton = document.getElementById("daily-reward-confirm-area");

    if (rewardImage) {
      rewardImage.src = claimInfo.reward.imagePath;
      rewardImage.alt = `7일 출석 보상 ${claimInfo.attendanceDay}일차 - ${claimInfo.reward.displayName}`;
    }

    this.setElementHiddenSafely(this.dailyRewardModal, false);

    window.requestAnimationFrame(() => {
      this.focusElementSafely(confirmButton);
    });

    return true;
  },

  hideDailyRewardModal() {
    if (!this.dailyRewardModal) return;

    this.setElementHiddenSafely(this.dailyRewardModal, true);
    this.focusElementSafely(document.getElementById("start-day-button"));

    if (this.pendingFirstRunTutorialAfterDailyReward) {
      this.pendingFirstRunTutorialAfterDailyReward = false;
      this.showFirstRunTutorialSoon();
    }
  },

  createDailyMissionModal() {
    let modal = document.getElementById("daily-mission-modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "daily-mission-modal";
      modal.className = "modal daily-mission-modal hidden";
      modal.innerHTML = `
        <div class="daily-mission-modal-content" role="dialog" aria-modal="true" aria-labelledby="daily-mission-modal-title">
          <header class="daily-mission-modal-header">
            <div>
              <span class="daily-mission-eyebrow">TODAY</span>
              <h2 id="daily-mission-modal-title">일일 미션</h2>
            </div>
            <button id="daily-mission-close-button" class="daily-mission-close-button" type="button" aria-label="일일 미션 닫기">×</button>
          </header>
          <div id="daily-mission-modal-body" class="daily-mission-modal-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    this.dailyMissionModal = modal;
    this.bindDailyMissionModalButtons();
    return modal;
  },

  bindDailyMissionModalButtons() {
    const modal = this.dailyMissionModal ?? document.getElementById("daily-mission-modal");
    if (!modal) return;

    const closeButton = document.getElementById("daily-mission-close-button");
    if (closeButton) {
      closeButton.onclick = () => this.hideDailyMissionModal();
    }

    modal.onclick = (event) => {
      if (event.target === modal) {
        this.hideDailyMissionModal();
      }
    };
  },

  showDailyMissionModal() {
    const modal = this.dailyMissionModal ?? this.createDailyMissionModal();
    if (!modal) return;

    this.renderDailyMissionModal();
    this.setElementHiddenSafely(modal, false);

    window.requestAnimationFrame(() => {
      this.focusElementSafely(document.getElementById("daily-mission-close-button"));
    });
  },

  hideDailyMissionModal() {
    const modal = this.dailyMissionModal ?? document.getElementById("daily-mission-modal");
    if (!modal) return;

    this.setElementHiddenSafely(modal, true);
    this.focusElementSafely(document.getElementById("daily-mission-shortcut-button"));
  },

  isDailyMissionModalVisible() {
    const modal = this.dailyMissionModal ?? document.getElementById("daily-mission-modal");
    return Boolean(modal && !modal.classList.contains("hidden"));
  },

  renderDailyMissionModal() {
    const modal = this.dailyMissionModal ?? document.getElementById("daily-mission-modal");
    if (!modal) return;

    const body = document.getElementById("daily-mission-modal-body");
    if (!body) return;

    body.innerHTML = this.createBMDailyMissionPanelMarkup(DailyMissionSystem.getState());
    this.bindBMDailyMissionButtons();
  },

  configureTopSettingsMenu() {
    const topIconMenu = document.getElementById("top-icon-menu");

    if (!topIconMenu) return;

    let settingsButton = document.getElementById("ingame-settings-button");
    const menuButtons = [...topIconMenu.querySelectorAll(".hud-icon-button")];

    if (!settingsButton) {
      settingsButton = menuButtons[2] ?? menuButtons[menuButtons.length - 1] ?? null;
    }

    if (!settingsButton) {
      settingsButton = document.createElement("button");
      settingsButton.className = "hud-icon-button";
      topIconMenu.appendChild(settingsButton);
    }

    settingsButton.id = "ingame-settings-button";
    settingsButton.type = "button";
    settingsButton.disabled = false;
    settingsButton.hidden = false;
    settingsButton.tabIndex = 0;
    settingsButton.textContent = "";
    settingsButton.title = "설정";
    settingsButton.setAttribute("aria-label", "설정");
    settingsButton.setAttribute("aria-disabled", "false");
    settingsButton.removeAttribute("aria-hidden");
    settingsButton.classList.add("ingame-settings-button");
    settingsButton.onclick = (event) => {
      if (!this.guardTutorialAction("settings:open", event)) return;
      this.openSettingsModal("ingame");
    };

    let dailyMissionButton = document.getElementById("daily-mission-shortcut-button");

    if (!dailyMissionButton) {
      dailyMissionButton = document.createElement("button");
      dailyMissionButton.id = "daily-mission-shortcut-button";
      dailyMissionButton.className = "hud-icon-button daily-mission-shortcut-button";
      topIconMenu.insertBefore(dailyMissionButton, settingsButton);
    }

    dailyMissionButton.type = "button";
    dailyMissionButton.disabled = false;
    dailyMissionButton.hidden = false;
    dailyMissionButton.tabIndex = 0;
    dailyMissionButton.title = "일일 미션";
    dailyMissionButton.setAttribute("aria-label", "일일 미션 확인");
    dailyMissionButton.setAttribute("aria-disabled", "false");
    dailyMissionButton.removeAttribute("aria-hidden");
    dailyMissionButton.innerHTML = `
      <img src="${BM_ASSETS.rewardIcons.reward}" alt="" draggable="false" />
      <span class="top-icon-button-label">일일 미션</span>
    `;
    dailyMissionButton.onclick = () => {
      this.showDailyMissionModal();
    };

    const rewardInboxButton = RewardInboxUI.ensureEntryButton(topIconMenu, settingsButton);
    const tutorialHelpButton = this.createTutorialHelpButton();

    if (tutorialHelpButton && settingsButton && tutorialHelpButton.parentElement === topIconMenu) {
      topIconMenu.insertBefore(tutorialHelpButton, settingsButton);
    }

    [...topIconMenu.querySelectorAll(".hud-icon-button")].forEach((button) => {
      const isSettingsButton = button === settingsButton;
      const isDailyMissionButton = button === dailyMissionButton;
      const isRewardInboxButton = button === rewardInboxButton;
      const isTutorialHelpButton = button === tutorialHelpButton;
      const shouldShow = isSettingsButton || isDailyMissionButton || isRewardInboxButton || isTutorialHelpButton;

      button.hidden = !shouldShow;
      button.classList.toggle("top-icon-secondary-hidden", !shouldShow);

      if (shouldShow) {
        button.removeAttribute("aria-hidden");
        button.tabIndex = 0;
        return;
      }

      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
    });
  },

  getPlayerNode() {
    const interactionLayer = this.getStoreInteractionLayer();
    const storeArea = document.getElementById("store-area");

    if (!interactionLayer && !storeArea) {
      return null;
    }

    let playerNode = document.getElementById("player-zone");

    if (!playerNode) {
      playerNode = document.createElement("div");
      playerNode.id = "player-zone";
      playerNode.className = "store-zone";
      playerNode.textContent = "플레이어";
    }

    playerNode.classList.add("player-character");
    playerNode.setAttribute("role", "img");
    playerNode.setAttribute("aria-label", "플레이어 캐릭터");

    [...playerNode.childNodes].forEach((childNode) => {
      if (childNode.nodeType === Node.TEXT_NODE) {
        childNode.remove();
      }
    });

    const targetParent = interactionLayer ?? storeArea;

    if (playerNode.parentElement !== targetParent) {
      targetParent.appendChild(playerNode);
    }

    return playerNode;
  },

  renderPlayer() {
    const playerNode = this.getPlayerNode();

    if (!playerNode || !GameState.player) {
      return;
    }

    const x = Number(GameState.player.x) || 0;
    const y = Number(GameState.player.y) || 0;
    const direction = GameState.player.direction || "down";

    playerNode.style.setProperty("left", `${x}px`, "important");
    playerNode.style.setProperty("top", `${y}px`, "important");
    playerNode.style.setProperty("--player-x", `${x}px`);
    playerNode.style.setProperty("--player-y", `${y}px`);

    this.renderPlayerCleaningTool(playerNode);
    playerNode.dataset.direction = direction;
    this.renderPlayerCarryingBox(playerNode, GameState.player.carryingBoxType ?? null);
  },

  renderPlayerCarryingBox(playerNode, carryingBoxType = null) {
    let carryingBox = playerNode.querySelector(".player-carrying-box");
    const imagePath = carryingBoxType ? getWarehouseBoxAsset(carryingBoxType) : null;

    playerNode.dataset.carryingBox = carryingBoxType ?? "";

    if (!imagePath) {
      carryingBox?.remove();
      return;
    }

    if (!carryingBox) {
      carryingBox = document.createElement("span");
      carryingBox.className = "player-carrying-box";
      carryingBox.setAttribute("aria-hidden", "true");
      playerNode.appendChild(carryingBox);
    }

    let imageNode = carryingBox.querySelector("img");

    if (!imageNode) {
      imageNode = document.createElement("img");
      imageNode.alt = "";
      imageNode.draggable = false;
      carryingBox.appendChild(imageNode);
    }

    if (imageNode.getAttribute("src") !== imagePath) {
      imageNode.src = imagePath;
    }
  },
  renderPlayerCleaningTool(playerNode) {
    if (!playerNode) {
      return;
    }

    const sanitation = GameState.sanitation ?? {};
    const shouldShowCleaningTool = (
      sanitation.isCleaning === true &&
      sanitation.currentCleaningActorType === "player"
    );

    playerNode.dataset.cleaningTool = shouldShowCleaningTool ? "true" : "false";

    let cleaningTool = playerNode.querySelector(".player-cleaning-tool");

    if (!shouldShowCleaningTool) {
      cleaningTool?.remove();
      return;
    }

    if (!cleaningTool) {
      cleaningTool = document.createElement("img");
      cleaningTool.className = "player-cleaning-tool";
      cleaningTool.alt = "";
      cleaningTool.draggable = false;
      cleaningTool.loading = "eager";
      cleaningTool.decoding = "async";
      cleaningTool.setAttribute("aria-hidden", "true");
      playerNode.appendChild(cleaningTool);
    }

    if (cleaningTool.getAttribute("src") !== SANITATION_ASSETS.tools) {
      cleaningTool.src = SANITATION_ASSETS.tools;
    }
  },



// 진열대 배치 좌표 확인용 코드 추후 주석처리 필요  
bindDebugCoordinateMode() {
  if (this.isDebugCoordinateModeBound) return;

  this.isDebugCoordinateModeBound = true;
  this.isDebugCoordinateModeVisible = false;

  document.addEventListener("keydown", (event) => {
    if (event.key !== "F8") return;

    event.preventDefault();
    this.isDebugCoordinateModeVisible = !this.isDebugCoordinateModeVisible;
    this.renderDebugCoordinatePanel();
    this.renderDebugCollisionBoxes();
  });

  document.addEventListener("mousemove", (event) => {
    if (!this.isDebugCoordinateModeVisible) return;

    this.updateDebugCoordinatePanel(event);
  });

  document.addEventListener("click", (event) => {
    if (!this.isDebugCoordinateModeVisible) return;

    const worldPoint = this.getDebugWorldPoint(event);

    console.log(
      `[좌표 복사용] x: ${worldPoint.x}, y: ${worldPoint.y}`
    );
  });
},

renderDebugCoordinatePanel() {
  let panel = document.getElementById("debug-coordinate-panel");

  if (!this.isDebugCoordinateModeVisible) {
    panel?.remove();
    return;
  }

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "debug-coordinate-panel";
    panel.style.position = "fixed";
    panel.style.left = "12px";
    panel.style.bottom = "12px";
    panel.style.zIndex = "99999";
    panel.style.padding = "10px 12px";
    panel.style.borderRadius = "8px";
    panel.style.background = "rgba(0, 0, 0, 0.78)";
    panel.style.color = "#fff";
    panel.style.fontSize = "12px";
    panel.style.lineHeight = "1.5";
    panel.style.fontFamily = "monospace";
    panel.style.pointerEvents = "none";
    panel.style.whiteSpace = "pre-line";
    document.body.appendChild(panel);
  }

  panel.textContent = "F8 좌표 모드 ON\n마우스를 움직여 좌표 확인\n클릭하면 콘솔에 좌표 출력";
},

updateDebugCoordinatePanel(event) {
  const panel = document.getElementById("debug-coordinate-panel");

  if (!panel) return;

  const worldPoint = this.getDebugWorldPoint(event);
  const player = GameState.player ?? {};
  const nearestShelf = this.getNearestDebugShelf(worldPoint);

  panel.textContent = [
    "F8 좌표 모드 ON",
    "",
    `Mouse World X: ${worldPoint.x}`,
    `Mouse World Y: ${worldPoint.y}`,
    "",
    `Player X: ${Math.round(Number(player.x) || 0)}`,
    `Player Y: ${Math.round(Number(player.y) || 0)}`,
    "",
    nearestShelf
      ? `Nearest Shelf: ${nearestShelf.label}`
      : "Nearest Shelf: 없음",
    nearestShelf
      ? `Shelf x/y: ${nearestShelf.x}, ${nearestShelf.y}`
      : "",
    nearestShelf
      ? `Interaction: ${nearestShelf.interactionX}, ${nearestShelf.interactionY}`
      : "",
    nearestShelf
      ? `Distance: ${nearestShelf.distance}`
      : "",
    "",
    "클릭하면 콘솔에 좌표 출력"
  ].filter(Boolean).join("\n");
},

getDebugWorldPoint(event) {
  const viewport = document.getElementById("store-area");
  const rect = viewport?.getBoundingClientRect();

  if (!viewport || !rect) {
    return {
      x: Math.round(event.clientX),
      y: Math.round(event.clientY)
    };
  }

  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const zoom = Number(this.worldCamera?.zoom) || 1;
  const cameraX = Number(this.worldCamera?.x) || 0;
  const cameraY = Number(this.worldCamera?.y) || 0;

  return {
    x: Math.round((localX - cameraX) / zoom),
    y: Math.round((localY - cameraY) / zoom)
  };
},

getNearestDebugShelf(point) {
  if (!point) return null;

  return SHELF_INSTANCES
    .map((shelf) => {
      const x = Number(shelf.interactionX ?? shelf.x) || 0;
      const y = Number(shelf.interactionY ?? shelf.y) || 0;
      const dx = point.x - x;
      const dy = point.y - y;

      return {
        ...shelf,
        distance: Math.round(Math.sqrt(dx * dx + dy * dy))
      };
    })
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
},

renderDebugCollisionBoxes() {
  const interactionLayer = this.getStoreInteractionLayer();

  if (!interactionLayer) return;

  interactionLayer
    .querySelectorAll(".debug-collision-box")
    .forEach((node) => node.remove());

  if (!this.isDebugCoordinateModeVisible) return;

  const collisionRects = getStoreObjectCollisionRects(
    GameState.expansion?.unlockedZoneIds
  ); 

  collisionRects.forEach((rect) => {
    const box = document.createElement("div");

    box.className = "debug-collision-box";
    box.style.position = "absolute";
    box.style.left = `${Number(rect.x) || 0}px`;
    box.style.top = `${Number(rect.y) || 0}px`;
    box.style.width = `${Number(rect.width) || 0}px`;
    box.style.height = `${Number(rect.height) || 0}px`;
    box.style.border = "2px solid rgba(255, 0, 0, 0.85)";
    box.style.background = "rgba(255, 0, 0, 0.12)";
    box.style.zIndex = "9999";
    box.style.pointerEvents = "none";
    box.textContent = rect.sourceId ?? rect.id;
    box.style.color = "#ff0000";
    box.style.fontSize = "10px";
    box.style.fontWeight = "900";

    interactionLayer.appendChild(box);
  });
},

  bindButtons() {
    const startDayButton = document.getElementById("start-day-button");
    const openStoreButton = document.getElementById("open-store-button");
    const endDayButton = document.getElementById("end-day-button");
    const shopShortcutButton = document.getElementById("shop-shortcut-button");

    startDayButton.addEventListener("click", (event) => {
      if (!this.guardTutorialAction("day:start-order", event)) return;

      if (this.isOrderDraftShortcutPhase()) {
        event.preventDefault();
        event.stopPropagation();
        this.openOrderDraftFromDock();
        return;
      }

      EventBus.emit(EVENTS.DAY_START_REQUESTED);
    });

    openStoreButton.addEventListener("click", (event) => {
      if (!this.guardTutorialAction("store:open", event)) return;

      if (this.isInteractiveTutorialActive?.() && this.getCurrentTutorialStep?.()?.id === "open-store") {
        this.completeFirstRunTutorialAndStartRealGame();
        return;
      }

      EventBus.emit(EVENTS.STORE_OPEN_REQUESTED);
    });

    endDayButton.addEventListener("click", (event) => {
      if (!this.guardTutorialAction("day:end", event)) return;
      EventBus.emit(EVENTS.STORE_CLOSE_REQUESTED);
    });

    if (shopShortcutButton) {
      shopShortcutButton.addEventListener("click", (event) => {
        if (!this.guardTutorialAction("shop:open", event)) return;
        if (shopShortcutButton.disabled) return;

        this.showBMContractShopModal();
      });
    }
  },

  isOrderDraftShortcutPhase() {
    return GameState.phase === GAME_PHASE.ORDER;
  },

  hasActiveOrderDelivery() {
    const deliveredItems = this.getDeliveredItems?.(this.orderDeliveredData) ?? [];
    const hasUnsortedDeliveredItems = Boolean(
      this.orderDeliveredData &&
      !this.orderDeliveredData.isCompleted &&
      deliveredItems.some((item) => !item.isSorted)
    );

    return (
      this.orderModalMode === "waiting" ||
      this.orderModalMode === "delivery" ||
      hasUnsortedDeliveredItems ||
      Boolean(document.getElementById("delivery-box-zone")) ||
      GameState.deliveryBoxState === "carrying" ||
      GameState.player?.carryingBoxType === "arrive"
    );
  },

  openOrderDraftFromDock() {
    if (this.isOrderModalVisible?.()) {
      return;
    }

    if (this.hasActiveOrderDelivery()) {
      this.showMessage("이미 접수된 발주가 있어요. 도착한 발주 박스를 정리한 뒤 다시 발주할 수 있습니다.", {
        duration: 2400
      });
      return;
    }

    this.showOrderModal({
      day: GameState.day,
      dailyGoal: GameState.dailyGoal,
      difficulty: GameState.difficulty,
      isEndlessMode: GameState.isEndlessMode,
      dayScenario: GameState.dayScenario,
      source: "dock_order_reopen"
    });
  },

  shouldDisableStartDayButton() {
    if (this.isOrderDraftShortcutPhase()) {
      return this.hasActiveOrderDelivery();
    }

    return [
      GAME_PHASE.DAY_START,
      GAME_PHASE.STORE_RUNNING,
      GAME_PHASE.DAY_END,
      GAME_PHASE.RESULT,
      GAME_PHASE.UPGRADE
    ].includes(GameState.phase);
  },

  bindGameEvents() {
    EventBus.on(EVENTS.GAME_STATE_CHANGED, () => {
      this.render();
      this.renderCustomers();
    });

    EventBus.on(PLAYER_POSITION_CHANGED, () => {
      this.renderPlayer();
      this.renderInteractionFeedback();
    });

    EventBus.on(PLAYER_DIALOGUE_REQUESTED, (data = {}) => {
      this.showPlayerDialogue(data.message, { duration: data.duration });
    });

    EventBus.on(EVENTS.CUSTOMER_LEFT, (data = {}) => {
      if (data.reason !== "wanted_product_out_of_stock") {
        return;
      }

      const message = data.wantedProductName
        ? `${data.wantedProductName}을 찾던 손님이 재고가 없어 돌아갔습니다.`
        : "원하던 상품이 없어 손님이 돌아갔습니다.";

      this.showMessage(message);
    });

    EventBus.on(EVENTS.CHECKOUT_COMPLETED, () => {
      this.showInteractionSparkle("counter-zone");
    });

    EventBus.on(SHELF_STOCK_CHANGED, () => {
      this.renderStoreObjectVisuals();
    });

    EventBus.on(EVENTS.RESTOCK_COMPLETED, (data = {}) => {
      const source = String(data.source ?? "");

      if (source.startsWith("delivery_box") || source.startsWith("order_delivery")) {
        return;
      }

      this.showInteractionSparkle("shelf-zone");
    });

    EventBus.on(EVENTS.ORDER_DELIVERED, (data = {}) => {
      if (data.status === "arrived") {
        this.showTutorialHintOnce(
          "delivery-arrived",
          "튜토리얼: 도착한 발주 박스를 누르면 발주 상품 정리가 시작됩니다."
        );
        this.maybeAdvanceInteractiveTutorial("order-delivered", { delayMs: 120 });
      }
    });

    EventBus.on(EVENTS.STOCK_ORGANIZED, () => {
      this.showTutorialHintOnce(
        "stock-organized",
        "튜토리얼: 발주 상품이 창고 재고로 정리되었습니다. 이제 영업 시작 버튼을 눌러 연습을 마무리합니다."
      );
      this.maybeAdvanceInteractiveTutorial("stock-organized", { delayMs: 180 });
    });

    EventBus.on(EVENTS.STORE_OPENED, () => {
      this.showTutorialHintOnce(
        "store-opened",
        "튜토리얼: 손님이 계산대에 오면 계산대 근처에서 계산대를 터치해 결제를 처리하세요."
      );
      this.maybeAdvanceInteractiveTutorial("store-opened", { delayMs: 220 });
    });
  },

  bindDayStartEvents() {
    EventBus.on(EVENTS.DAY_STARTED, (data) => {
      this.pendingOrderPhaseData = null;
      this.pendingStaffHireData = null;
      this.showDayScenarioModal(data.dayScenario);
    });

    EventBus.on(EVENTS.ORDER_PHASE_STARTED, (data) => {
      this.pendingOrderPhaseData = data;

      if (
        !this.isDayScenarioModalVisible() &&
        !this.isStaffHireModalVisible()
      ) {
        this.continueDayStartFlow();
      }
    });
  },

  bindStaffEvents() {
    EventBus.on(STAFF_SHIFT_ENTRY_REQUESTED, (data = {}) => {
      this.prepareStaffEntryVisualReset(data);
    });

    EventBus.on(STAFF_EVENTS.HIRE_OFFERED, (data = {}) => {
      this.pendingStaffHireData = data;

      if (
        !this.isDayScenarioModalVisible() &&
        !this.isStaffHireModalVisible()
      ) {
        this.continueDayStartFlow();
      }
    });

    EventBus.on(STAFF_EVENTS.STATE_CHANGED, (data = {}) => {
      this.renderStaffSummary(data.staff);
      this.renderStaffCharacter(data.staff);
    });

    EventBus.on(STAFF_ASSIST_EVENTS.STATE_CHANGED, (data = {}) => {
      const previousAssistState = this.staffAssistState;
      const nextAssistState = this.normalizeStaffAssistState(data.assistState);
      const shouldRenderSummary =
        this.getStaffAssistSummarySignature(previousAssistState) !==
        this.getStaffAssistSummarySignature(nextAssistState);

      this.staffAssistState = nextAssistState;

      if (nextAssistState.status === "entering") {
        this.staffEntryVisualLockDay = null;
      }

      if (shouldRenderSummary) {
        this.renderStaffSummary(data.staff ?? GameState.staff);
      }

      this.renderStaffCharacter(data.staff ?? GameState.staff);
    });

    EventBus.on(STAFF_ASSIST_EVENTS.MESSAGE_REQUESTED, (data = {}) => {
      this.showMessage(data.message, {
        duration: data.duration
      });
    });
  },

  bindOrderEvents() {
    EventBus.on(EVENTS.ORDER_DELIVERED, (data) => {
      this.handleOrderDelivered(data);
    });

    EventBus.on(ORDER_CONFIRMATION_FAILED, (data = {}) => {
      this.handleOrderConfirmationFailed(data);
    });

    EventBus.on(EVENTS.STOCK_ORGANIZED, (data) => {
      if (data.source !== "delivery_box_sorted" && data.source !== "empty_order") {
        return;
      }

      this.clearDeliveryBox();
      this.orderDeliveredData = null;
      this.orderModalMode = "closed";
      this.hideOrderModal();

      this.showMessage(
        data.message ?? "발주 상품이 창고에 정리되었습니다. 편의점 오픈 버튼을 눌러주세요."
      );
    });
  },

  bindInventoryEvents() {
    EventBus.on(EVENTS.INVENTORY_CHANGED, (data) => {
      const items = Array.isArray(data.items) ? data.items : [];

      this.inventoryByProductId = items.reduce((inventoryMap, item) => {
        inventoryMap[item.productId] = item;
        return inventoryMap;
      }, {});
      this.inventorySnapshot = data;

      this.renderInventorySummary();
      this.renderProductCards();
      this.renderStoreObjectVisuals();

      if (data.source === "products_unlocked" && Array.isArray(data.unlockedProductIds) && data.unlockedProductIds.length > 0) {
        this.playAssetEffectToast("unlock", `신규 상품 ${data.unlockedProductIds.length}종 해금!`);
      }
    });
  },

  bindExpansionEvents() {
    EventBus.on(EXPANSION_CONSTRUCTION_STARTED, (data) => {
      const message = data.message ?? "매장 공사를 시작합니다.";

      this.expansionState = data.expansionState ?? this.expansionState;
      this.showExpansionMessage(message);
      this.showMessage(message);
      this.renderExpansionZones(this.expansionState);
      this.playAssetEffectToast("loading", "공사 진행 중...");
    });

    EventBus.on(EVENTS.EXPANSION_COMPLETED, (data) => {
      const message = data.message ?? "매장 확장이 완료되었습니다.";

      this.expansionState = data.expansionState ?? this.expansionState;
      this.showExpansionMessage(message);
      this.showMessage(message);
      this.renderExpansionZones(this.expansionState);
      this.playAssetEffectToast("construction", "공사 완료!");
      this.playStoreExpansionUnlockEffect(data.animation?.zoneId ?? data.zoneId);
      this.renderStoreObjectVisuals();
      this.renderInteractionFeedback();
      this.renderFocusedZonePanel(data.zoneId);
    });

    EventBus.on(EVENTS.EXPANSION_FAILED, (data) => {
      const message = data.message ?? "확장 조건을 다시 확인해주세요.";

      this.expansionState = data.expansionState ?? this.expansionState;
      this.showExpansionMessage(message);
      this.showMessage(message);
      this.renderExpansionZones(this.expansionState);
    });
  },

  bindBMEvents() {
    EventBus.on(CURRENCY_EVENTS.CHANGED, () => {
      this.requestBMContractShopRender();
    });

    EventBus.on(BM_EVENTS.STATE_CHANGED, () => {
      this.requestBMContractShopRender();
    });

    EventBus.on(DAILY_MISSION_EVENTS.STATE_CHANGED, () => {
      if (this.isDailyMissionModalVisible()) {
        this.renderDailyMissionModal();
      }
    });

    EventBus.on(DAILY_MISSION_EVENTS.REWARD_CLAIMED, (data = {}) => {
      this.showMessage(data.message ?? "일일 미션 보상을 받았습니다.");
      if (this.isDailyMissionModalVisible()) {
        this.renderDailyMissionModal();
      }
      this.requestBMContractShopRender();
    });

    EventBus.on(DAILY_MISSION_EVENTS.REWARD_FAILED, (data = {}) => {
      this.showMessage(data.message ?? "일일 미션 보상 조건을 확인해주세요.");
    });

    EventBus.on(REWARD_CODE_EVENTS.REDEEM_SUCCEEDED, (data = {}) => {
      this.showMessage(data.message ?? "보상을 받았습니다.");
    });

    EventBus.on(REWARD_CODE_EVENTS.REDEEM_FAILED, (data = {}) => {
      this.showMessage(data.message ?? "쿠폰 코드를 확인해주세요.");
    });

    EventBus.on(BM_EVENTS.CONTRACT_SHOP_UNLOCKED, (data = {}) => {
      const count = Array.isArray(data.unlockedProductIds)
        ? data.unlockedProductIds.length
        : 0;

      if (count > 0) {
        this.showMessage(`판매권 ${count}종이 상점에 해금되었습니다.`);
      }

      this.requestBMContractShopRender();
    });

    EventBus.on(BM_EVENTS.CONTRACT_PURCHASED, (data = {}) => {
      this.showMessage(data.message ?? "판매권 구매 완료!");
      this.requestBMContractShopRender();
      this.renderProductCards();
    });

    EventBus.on(BM_EVENTS.CONTRACT_PURCHASE_FAILED, (data = {}) => {
      this.showMessage(data.message ?? "판매권 구매 조건을 확인해주세요.");
      this.requestBMContractShopRender();
    });

    EventBus.on(BM_EVENTS.PREMIUM_PRODUCT_PURCHASED, (data = {}) => {
      this.showMessage(data.message ?? "프리미엄 상품 구매 완료!");
      this.requestBMContractShopRender();
      this.renderProductCards();
    });

    EventBus.on(BM_EVENTS.PREMIUM_PRODUCT_PURCHASE_FAILED, (data = {}) => {
      this.showMessage(data.message ?? "프리미엄 상품 구매 조건을 확인해주세요.");
      this.requestBMContractShopRender();
    });

    EventBus.on(BM_EVENTS.CONTRACT_UNLOCK_SKIPPED, (data = {}) => {
      this.showMessage(data.message ?? "판매권 해금 대기일을 스킵했습니다.");
      this.requestBMContractShopRender();
      this.renderProductCards();
    });

    EventBus.on(BM_EVENTS.CONTRACT_UNLOCK_SKIP_FAILED, (data = {}) => {
      this.showMessage(data.message ?? "스킵권 사용 조건을 확인해주세요.");
      this.requestBMContractShopRender();
    });

    EventBus.on(BM_EVENTS.PEAK_COUPON_ACTIVATED, (data = {}) => {
      this.showMessage(data.message ?? "피크타임 쿠폰이 적용되었습니다.");
      this.requestBMContractShopRender();
    });

    EventBus.on(BM_EVENTS.PEAK_COUPON_FAILED, (data = {}) => {
      this.showMessage(data.message ?? "피크타임 쿠폰 사용 조건을 확인해주세요.");
      this.requestBMContractShopRender();
    });

    EventBus.on(BM_EVENTS.PEAK_COUPON_EXPIRED, (data = {}) => {
      this.showMessage(data.message ?? "피크타임 쿠폰 효과가 종료되었습니다.");
      this.requestBMContractShopRender();
    });

    [
      BM_EVENTS.DIAMOND_PRODUCT_PURCHASED,
      BM_EVENTS.GOLD_PRODUCT_PURCHASED,
      BM_EVENTS.AD_REWARD_CLAIMED,
      BM_EVENTS.PEAK_COUPON_PURCHASED,
      BM_EVENTS.WAREHOUSE_UPGRADED,
      BM_EVENTS.SHELF_UPGRADED,
      BM_EVENTS.PRODUCT_UPGRADED,
      BM_EVENTS.STAFF_ABILITY_UPGRADED
    ].forEach((eventName) => {
      EventBus.on(eventName, (data = {}) => {
        this.showMessage(data.message ?? "상점 구매가 완료되었습니다.");
        this.requestBMContractShopRender();
        this.renderProductCards();
        this.renderInventorySummary();
        this.renderStaffSummary();
      });
    });

    [BM_EVENTS.SHOP_PURCHASE_FAILED, BM_EVENTS.AD_REWARD_FAILED].forEach((eventName) => {
      EventBus.on(eventName, (data = {}) => {
        this.showMessage(data.message ?? "구매 조건을 확인해주세요.");
        this.requestBMContractShopRender();
      });
    });
  },

  bindSanitationEvents() {
    EventBus.on(SANITATION_EVENTS.CHANGED, (data = {}) => {
      this.sanitationState = this.normalizeSanitationState(data.state);
      this.renderSanitationHud();
      this.renderCleaningZone();
    });

    EventBus.on(SANITATION_EVENTS.MESSAGE_REQUESTED, (data = {}) => {
      const show = () => {
        this.showMessage(data.message ?? "위생 상태를 확인해주세요.", {
          duration: Number(data.duration) || 2600
        });
      };
      const delayMs = Math.max(0, Number(data.delayMs) || 0);

      if (delayMs > 0) {
        window.setTimeout(show, delayMs);
        return;
      }

      show();
    });

    EventBus.on(SANITATION_EVENTS.CLEANING_STARTED, (data = {}) => {
      this.sanitationState = this.normalizeSanitationState(data.state);
      this.renderSanitationHud();
      this.renderCleaningZone();
      this.playAssetEffectToast("loading", "청소 중...");
    });

    EventBus.on(SANITATION_EVENTS.CLEANING_COMPLETED, (data = {}) => {
      this.sanitationState = this.normalizeSanitationState(data.state);
      this.renderSanitationHud();
      this.renderCleaningZone();
      this.showInteractionSparkle("cleaning-zone");
    });

    EventBus.on(SANITATION_EVENTS.CLEANING_FAILED, (data = {}) => {
      this.showMessage(data.message ?? "지금은 청소할 수 없습니다.");
      this.renderSanitationHud();
      this.renderCleaningZone();
    });
  },

  bindEndingEvents() {
    EventBus.on(EVENTS.ENDING_ACHIEVED, (data) => {
      this.showEndingModal(data);
    });
  },

  getCustomerLayer() {
    const interactionLayer = this.getStoreInteractionLayer();
    const storeArea = document.getElementById("store-area");

    if (!interactionLayer && !storeArea) {
      return null;
    }

    let customerLayer = document.getElementById("customer-layer");

    if (!customerLayer) {
      customerLayer = document.createElement("div");
      customerLayer.id = "customer-layer";
    }

    const targetParent = interactionLayer ?? storeArea;

    if (customerLayer.parentElement !== targetParent) {
      targetParent.appendChild(customerLayer);
    }

    return customerLayer;
  },

  renderCustomers() {
    const customerLayer = this.getCustomerLayer();

    if (!customerLayer) {
      return;
    }

    const customers = CustomerSystem.getRenderableCustomers().filter((customer) => {
      return !(customer.status === "leaving" && customer.isSatisfied);
    });

    const visibleCustomerIds = new Set(
      customers.map((customer) => customer.customerId)
    );
    const existingNodes = new Map(
      [...customerLayer.querySelectorAll(".customer-npc")].map((node) => {
        return [node.dataset.customerId, node];
      })
    );

    existingNodes.forEach((node, customerId) => {
      if (!visibleCustomerIds.has(customerId)) {
        node.remove();
      }
    });

    const counterQueueIndexes = new Map();

    customers
      .map((customer, index) => {
        return { customer, index };
      })
      .filter(({ customer }) => {
        return customer.currentZone === "counter";
      })
      .sort((first, second) => {
        const firstQueueOrder = Number(first.customer.queueOrder);
        const secondQueueOrder = Number(second.customer.queueOrder);
        const firstSortOrder = Number.isFinite(firstQueueOrder)
          ? firstQueueOrder
          : Number.POSITIVE_INFINITY;
        const secondSortOrder = Number.isFinite(secondQueueOrder)
          ? secondQueueOrder
          : Number.POSITIVE_INFINITY;

        if (firstSortOrder !== secondSortOrder) {
          return firstSortOrder - secondSortOrder;
        }

        return first.index - second.index;
      })
      .forEach(({ customer }, queueIndex) => {
        counterQueueIndexes.set(customer.customerId, Math.min(queueIndex, 3));
      });

    customers.forEach((customer, index) => {
      let customerNode = existingNodes.get(customer.customerId);

      if (!customerNode) {
        customerNode = document.createElement("div");
        customerNode.className = "customer-npc";
        customerNode.dataset.customerId = customer.customerId;
        customerLayer.appendChild(customerNode);
      }

      const nextClassName = this.getCustomerClassName(customer);

      if (customerNode.className !== nextClassName) {
        customerNode.className = nextClassName;
      }

      customerNode.style.setProperty("--customer-offset", `${(index % 4) * 16}px`);
      this.applyCustomerTargetPosition(customerNode, customer, index);
      this.applyCustomerQueueOffset(customerNode, customer, counterQueueIndexes);
      this.renderCustomerNodeContent(customerNode, customer);
      customerNode.title = `${customer.typeName} / ${customer.wantedProductName}`;
    });
  },

  applyCustomerTargetPosition(customerNode, customer, index = 0) {
    const position = this.getCustomerTargetPosition(customer);

    if (!position) {
      customerNode.style.removeProperty("left");
      customerNode.style.removeProperty("top");
      return;
    }

    const offsetX = (index % 3) * 12;
    customerNode.style.setProperty("left", `${position.x + offsetX}px`, "important");
    customerNode.style.setProperty("top", `${position.y}px`, "important");
  },

  getCustomerTargetPosition(customer) {
    if (!this.isCustomerShelfZone(customer.currentZone)) {
      return null;
    }

    const targetX = Number(customer.targetX);
    const targetY = Number(customer.targetY);

    if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
      return {
        x: targetX,
        y: targetY
      };
    }

    const shelfInstance = SHELF_INSTANCES.find((shelf) => {
      return shelf.instanceId === customer.targetShelfInstanceId;
    });

    if (
      shelfInstance &&
      Number.isFinite(Number(shelfInstance.standX)) &&
      Number.isFinite(Number(shelfInstance.standY))
    ) {
      return {
        x: Number(shelfInstance.standX),
        y: Number(shelfInstance.standY)
      };
    }

    return null;
  },

  renderCustomerNodeContent(customerNode, customer) {
    const assetPath = getCustomerAssetPath(customer);
    const assetVariantId = getCustomerAssetVariantId(customer);
    const displayText = this.getCustomerDisplayText(customer);

    customerNode.dataset.customerAsset = assetVariantId;
    customerNode.dataset.nuisanceProfileId = customer.nuisanceProfileId ?? "";

    this.syncCustomerSprite(customerNode, customer, assetPath, displayText);
    this.syncCustomerLabel(customerNode, displayText, Boolean(assetPath));
    this.syncCustomerBubbleLayer(customerNode, customer);
  },

  syncCustomerSprite(customerNode, customer, assetPath, displayText) {
    let sprite = customerNode.querySelector(":scope > .customer-sprite");

    if (!assetPath) {
      sprite?.remove();
      customerNode.classList.add("customer-sprite-missing");
      return;
    }

    if (!sprite) {
      sprite = document.createElement("img");
      sprite.className = "customer-sprite";
      sprite.loading = "eager";
      sprite.decoding = "async";
      sprite.draggable = false;
      customerNode.insertBefore(sprite, customerNode.firstChild);
    }

    sprite.alt = customer.typeName ?? displayText;
    sprite.hidden = false;
    customerNode.classList.remove("customer-sprite-missing");

    if (sprite.getAttribute("src") !== assetPath) {
      sprite.src = assetPath;
    }

    sprite.onerror = () => {
      sprite.hidden = true;
      customerNode.classList.add("customer-sprite-missing");

      const fallbackLabel = customerNode.querySelector(":scope > .customer-label");

      if (fallbackLabel) {
        fallbackLabel.hidden = false;
      }
    };
  },

  syncCustomerLabel(customerNode, displayText, hasAsset) {
    let label = customerNode.querySelector(":scope > .customer-label");

    if (!label) {
      label = document.createElement("span");
      label.className = "customer-label";
      customerNode.appendChild(label);
    }

    if (label.textContent !== displayText) {
      label.textContent = displayText;
    }

    label.hidden = hasAsset && !customerNode.classList.contains("customer-sprite-missing");
  },

  syncCustomerBubbleLayer(customerNode, customer) {
    let bubbleLayer = customerNode.querySelector(":scope > .customer-bubble-layer");

    if (!bubbleLayer) {
      bubbleLayer = document.createElement("span");
      bubbleLayer.className = "customer-bubble-layer";
      customerNode.appendChild(bubbleLayer);
    }

    [...customerNode.children].forEach((child) => {
      if (
        child !== bubbleLayer &&
        child.classList.contains("customer-wanted-bubble")
      ) {
        child.remove();
      }
    });

    const bubbleSpec = this.getCustomerBubbleSpec(customer);
    const nextSignature = JSON.stringify(bubbleSpec ?? null);

    if (bubbleLayer.dataset.bubbleSignature === nextSignature) {
      return;
    }

    bubbleLayer.dataset.bubbleSignature = nextSignature;
    bubbleLayer.innerHTML = "";

    if (!bubbleSpec) {
      return;
    }

    bubbleLayer.appendChild(
      this.createCustomerDialogueBubble(
        customer,
        bubbleSpec.dialogueText,
        bubbleSpec.options
      )
    );
  },

  getCustomerBubbleSpec(customer) {
    if (customer.bubbleText) {
      return {
        dialogueText: customer.bubbleText,
        options: {
          productName: customer.carriedProductName ?? customer.wantedProductName,
          productImagePath: customer.carriedProductImagePath ?? null,
          context: "leaving"
        }
      };
    }

    if (customer.currentZone !== "counter" || !customer.wantedProductName) {
      return null;
    }

    const productName =
      customer.carriedProductName ?? customer.wantedProductName;
    const dialogueText = this.getCustomerDialogueText(customer, {
      productName,
      context: "checkout"
    });

    return {
      dialogueText,
      options: {
        productName,
        productImagePath: customer.carriedProductImagePath,
        context: "checkout"
      }
    };
  },

  createCustomerDialogueBubble(customer, dialogueText, options = {}) {
    const bubble = document.createElement("span");
    const textboxVariant = this.getCustomerTextboxVariant(customer);
    const productName = options.productName ?? customer.wantedProductName ?? "상품";

    bubble.className = [
      "customer-wanted-bubble",
      "customer-dialogue-box",
      `customer-dialogue-box--${textboxVariant}`,
      options.context ? `customer-dialogue-box--${options.context}` : ""
    ].filter(Boolean).join(" ");
    bubble.dataset.textboxVariant = textboxVariant;

    if (options.productImagePath) {
      const productImage = document.createElement("img");
      productImage.className = "customer-wanted-image";
      productImage.src = options.productImagePath;
      productImage.alt = productName;
      bubble.appendChild(productImage);
    }

    const wantedText = document.createElement("span");
    wantedText.className = "customer-wanted-text customer-dialogue-text";
    wantedText.textContent = String(dialogueText || "계산해주세요!").trim();
    bubble.appendChild(wantedText);

    return bubble;
  },

  getCustomerTextboxVariant(customer = {}) {
    const typeId = customer.typeId ?? customer.customerTypeId;
    const status = customer.status;
    const mood = customer.mood;

    if (
      typeId === "difficult" ||
      status === "angry" ||
      mood === "angry"
    ) {
      return "bad";
    }

    return "normal";
  },

  getCustomerDialogueText(customer = {}, options = {}) {
    if (customer.bubbleText) {
      return customer.bubbleText;
    }

    const typeId = customer.typeId ?? customer.customerTypeId ?? "normal";
    const context = options.context ?? "checkout";

    if (context === "leaving") {
      return "앗, 찾던 상품이 없네… 다음에 올게요.";
    }

    const checkoutDialogues = {
      difficult: [
        "빨리 계산 좀 해주세요.",
        "계산 아직이에요?",
        "저 기다리는 거 싫어하거든요."
      ],
      hurried: [
        "저 급해요, 계산해주세요!",
        "빨리 계산 부탁드려요!",
        "회사 가야 해서요, 계산해주세요!"
      ],
      office_worker: [
        "계산 부탁드립니다.",
        "이거 계산해주세요.",
        "영수증도 부탁드려요."
      ],
      student: [
        "이거 계산해주세요!",
        "간식 계산해주세요!",
        "빨리 먹고 싶어요!"
      ],
      normal: [
        "계산해주세요!",
        "이거 계산 부탁드려요.",
        "계산할게요."
      ]
    };
    const candidates = checkoutDialogues[typeId] ?? checkoutDialogues.normal;
    const seed = String(customer.customerId ?? customer.id ?? typeId).split("").reduce((sum, char) => {
      return sum + char.charCodeAt(0);
    }, 0);

    return candidates[seed % candidates.length];
  },

  applyCustomerQueueOffset(customerNode, customer, counterQueueIndexes) {
    const queueIndex = counterQueueIndexes.get(customer.customerId) ?? 0;
    const isCounterCustomer = customer.currentZone === "counter";
    const queueOffset = isCounterCustomer ? queueIndex * 18 : 0;

    customerNode.dataset.queueIndex = isCounterCustomer ? String(queueIndex) : "";
    customerNode.style.setProperty("--queue-x", `${queueOffset * -1}px`);
    customerNode.style.setProperty("--queue-y", `${queueOffset}px`);
    customerNode.style.zIndex = isCounterCustomer ? String(30 - queueIndex) : "";
  },

  getCustomerClassName(customer) {
    const shelfClassName = this.isCustomerShelfZone(customer.currentZone)
      ? "customer-zone-shelf"
      : null;

    return [
      "customer-npc",
      `customer-type-${customer.typeId}`,
      `customer-status-${customer.status}`,
      `customer-mood-${customer.mood}`,
      `customer-zone-${customer.currentZone}`,
      shelfClassName
    ].filter(Boolean).join(" ");
  },

  isCustomerShelfZone(zone) {
    return zone === "shelf" || Object.values(PRODUCT_SHELF_IDS).includes(zone);
  },

  getCustomerDisplayText(customer) {
    const typeLabels = {
      normal: "일반",
      student: "학생",
      office_worker: "회사",
      hurried: "급함",
      difficult: "진상"
    };

    return typeLabels[customer.typeId] ?? "손님";
  },

  createSanitationHud() {
    const statusPanel = document.getElementById("status-panel");

    if (!statusPanel) return;

    let sanitationNode = document.getElementById("sanitation-info");

    if (!sanitationNode) {
      sanitationNode = document.createElement("p");
      sanitationNode.id = "sanitation-info";
      sanitationNode.setAttribute("aria-live", "polite");

      const mentalNode = document.getElementById("mental-info");

      if (mentalNode?.parentElement === statusPanel) {
        mentalNode.insertAdjacentElement("afterend", sanitationNode);
      } else {
        statusPanel.appendChild(sanitationNode);
      }
    }

    sanitationNode.className = "";
  },

  normalizeSanitationState(state = null) {
    const source = state && typeof state === "object"
      ? state
      : GameState.sanitation ?? DEFAULT_SANITATION_STATE;
    const value = Math.max(0, Math.min(100, Math.floor(Number(source.value) || 0)));

    const sourcePoint = source.activeCleaningPoint;
    const activeCleaningPoint = (
      sourcePoint &&
      Number.isFinite(Number(sourcePoint.x)) &&
      Number.isFinite(Number(sourcePoint.y))
    )
      ? {
        ...DEFAULT_CLEANING_POINT,
        ...sourcePoint,
        x: Number(sourcePoint.x),
        y: Number(sourcePoint.y)
      }
      : getCleaningPointByZoneId(source.dirtyZoneId);

    return {
      ...DEFAULT_SANITATION_STATE,
      ...source,
      value,
      status: source.status ?? this.getSanitationStatus(value),
      isCleaningNeeded: source.isCleaningNeeded === true || value < 100,
      isCleaning: source.isCleaning === true,
      dirtyZoneId: activeCleaningPoint.zoneId,
      dirtySpotId: activeCleaningPoint.id,
      activeCleaningPoint,
      unlockedCleaningZoneCount: Math.max(1, Math.floor(Number(source.unlockedCleaningZoneCount) || 1)),
      sanitationPressureMultiplier: Number(source.sanitationPressureMultiplier) || 1,
      settlementPenalty: source.settlementPenalty ?? DEFAULT_SANITATION_STATE.settlementPenalty
    };
  },

  getSanitationStatus(value = 100) {
    const sanitation = Math.max(0, Math.min(100, Math.floor(Number(value) || 0)));

    if (sanitation === 0) return "critical";
    if (sanitation <= 50) return "warning";
    if (sanitation <= 79) return "normal";
    return "clean";
  },

  renderSanitationHud() {
    this.createSanitationHud();

    const sanitationNode = document.getElementById("sanitation-info");

    if (!sanitationNode) return;

    const state = this.normalizeSanitationState(this.sanitationState);

    this.sanitationState = state;
    sanitationNode.textContent = `위생 ${state.value}`;
    sanitationNode.dataset.sanitationStatus = state.status;
    sanitationNode.classList.toggle("is-warning", state.status === "warning" || state.status === "critical");
    sanitationNode.classList.toggle("is-cleaning", state.isCleaning === true);
  },

  renderCleaningZone() {
    const interactionLayer = this.getStoreInteractionLayer();

    if (!interactionLayer) return;

    let cleaningZone = document.getElementById("cleaning-zone");

    if (!cleaningZone) {
      cleaningZone = document.createElement("button");
      cleaningZone.id = "cleaning-zone";
      cleaningZone.className = "cleaning-zone";
      cleaningZone.type = "button";
      cleaningZone.dataset.playerAction = "cleaning";
      cleaningZone.setAttribute("aria-label", "청소 구역");
      interactionLayer.appendChild(cleaningZone);
    } else if (cleaningZone.parentElement !== interactionLayer) {
      interactionLayer.appendChild(cleaningZone);
    }

    const state = this.normalizeSanitationState(this.sanitationState);
    const activeCleaningPoint = state.activeCleaningPoint ?? DEFAULT_CLEANING_POINT;
    const showTrash = state.value <= 50;
    const showStain = state.isCleaningNeeded || state.value < 100;

    cleaningZone.style.setProperty("left", `${activeCleaningPoint.x}px`, "important");
    cleaningZone.style.setProperty("top", `${activeCleaningPoint.y}px`, "important");
    cleaningZone.dataset.sanitationStatus = state.status;
    cleaningZone.dataset.zoneId = activeCleaningPoint.zoneId;
    cleaningZone.dataset.cleaningSpotId = activeCleaningPoint.id;
    cleaningZone.setAttribute("aria-label", `${activeCleaningPoint.label} 청소`);
    cleaningZone.classList.toggle("is-cleaning-needed", showStain);
    cleaningZone.classList.toggle("is-cleaning", state.isCleaning === true);
    cleaningZone.classList.toggle("is-warning", state.status === "warning" || state.status === "critical");
    cleaningZone.disabled = state.isCleaning === true;
    this.ensureCleaningZoneVisuals(cleaningZone, {
      showStain,
      showTrash,
      label: activeCleaningPoint.label
    });
  },

  ensureCleaningZoneVisuals(cleaningZone, options = {}) {
    const ensureChild = (className, tagName = "span") => {
      let child = cleaningZone.querySelector(`.${className}`);

      if (!child) {
        child = document.createElement(tagName);
        child.className = className;
        cleaningZone.appendChild(child);
      }

      return child;
    };

    const setImage = (className, src, isVisible = true) => {
      const imageNode = ensureChild(className, "img");

      imageNode.alt = "";
      imageNode.draggable = false;
      imageNode.hidden = !isVisible;
      imageNode.style.setProperty("display", isVisible ? "block" : "none", "important");

      if (imageNode.getAttribute("src") !== src) {
        imageNode.src = src;
      }

      return imageNode;
    };

    const glowNode = ensureChild("cleaning-zone-glow");
    glowNode.setAttribute("aria-hidden", "true");

    setImage("cleaning-tools-image", SANITATION_ASSETS.tools, true);
    setImage("cleaning-stain-image", SANITATION_ASSETS.stain, options.showStain === true);
    setImage("cleaning-trash-image", SANITATION_ASSETS.trash, options.showTrash === true);
    setImage("cleaning-sparkle-image", SANITATION_ASSETS.sparkle, true);

    const labelNode = ensureChild("cleaning-zone-label");
    labelNode.textContent = options.label ? `${options.label} 청소` : "청소";
  },

  render() {
    this.renderInventorySummary();
    this.renderStaffSummary();
    this.renderStaffCharacter();
    this.renderProductCards();
    this.renderExpansionZones();
    this.renderControlButtons();
    this.renderPhaseChip();
    this.renderDailyGoalPanel();
    this.renderFocusedZonePanel();
    this.moveTopIconMenuToRoot();
    this.configureTopSettingsMenu();
    this.renderStoreObjectVisuals();
    this.renderWarehouseBox();
    this.renderCleaningZone();
    this.renderSanitationHud();
    this.renderPlayer();
    this.prepareUiImageButtons();
    this.renderDeliveryBox(this.orderDeliveredData);
    this.renderInteractionFeedback();
    document.getElementById("day-info").textContent = `Day ${GameState.day}`;
    document.getElementById("money-info").textContent = `₩${GameState.money.toLocaleString()}`;
    const diamondInfoNode = document.getElementById("diamond-info");

    if (diamondInfoNode) {
      const diamond = BMSystem.getBMState().diamond;

      diamondInfoNode.textContent = diamond.toLocaleString("ko-KR");
    }

    document.getElementById("satisfaction-info").textContent = `만족도 ${GameState.satisfaction}`;
    document.getElementById("mental-info").textContent = `멘탈 ${GameState.mental}`;
  },

  renderStoreObjectVisuals() {
    const interactionLayer = this.getStoreInteractionLayer();

    if (!interactionLayer) return;

    const objectConfigs = SHELF_INSTANCES.map((shelf) => {
      return {
        nodeId: shelf.nodeId,
        instanceId: shelf.instanceId,
        zoneId: shelf.zoneId,
        shelfId: shelf.shelfId,
        objectType: shelf.objectType,
        facing: shelf.facing,
        label: shelf.label,
        x: shelf.x,
        y: shelf.y,
        width: shelf.width,
        height: shelf.height,
        // rotation: Number(shelf.rotation) || 0,
        // skewX: Number(shelf.skewX) || 0,
        // skewY: Number(shelf.skewY) || 0,
        // scaleX: Number(shelf.scaleX) || 1,
        // scaleY: Number(shelf.scaleY) || 1,
        createIfMissing: true
      };
    });
  

    objectConfigs.forEach((config) => {
      const node = this.getStoreObjectNode(config, interactionLayer);

      if (!node) return;

      const isUnlocked = this.isShelfZoneUnlocked(config);

      node.style.setProperty("display", isUnlocked ? "" : "none", "important");
      node.hidden = !isUnlocked;
      node.setAttribute("aria-hidden", isUnlocked ? "false" : "true");
      node.tabIndex = isUnlocked ? 0 : -1;

      if (!isUnlocked) {
        return;
      }

      node.dataset.playerAction = "shelf_restock";
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.dataset.shelfInstanceId = config.instanceId;
      node.dataset.zoneId = config.zoneId;
      node.dataset.shelfId = config.shelfId;
      node.style.setProperty("left", `${config.x}px`, "important");
      node.style.setProperty("top", `${config.y}px`, "important");
//       node.style.setProperty(
//         "transform",
//         `rotate(${config.rotation}deg) skew(${config.skewX}deg, ${config.skewY}deg) scale(${config.scaleX}, ${config.scaleY})`,
//         "important"
// );

// node.style.setProperty("transform-origin", "center bottom", "important");
      if (config.width) {
        node.style.setProperty("width", `${config.width}px`, "important");
      }
      if (config.height) {
        node.style.setProperty("height", `${config.height}px`, "important");
      }

      const stockData = this.getStoreObjectStockData(
        config.objectType,
        config.shelfId,
        config.instanceId
      );
      const visualAsset = getObjectVisualAsset(
        config.objectType,
        stockData.stock,
        stockData.capacity,
        { facing: config.facing }
      );

      if (!visualAsset?.path) return;

      this.applyStoreObjectVisual(node, {
        ...config,
        ...stockData,
        visualAsset
      });
    });
    this.renderDebugCollisionBoxes();
  },

  renderWarehouseBox() {
    const interactionLayer = this.getStoreInteractionLayer();

    if (!interactionLayer) return;

    let warehouseBox = document.getElementById("warehouse-box-zone");

    if (!warehouseBox) {
      warehouseBox = document.createElement("div");
      warehouseBox.id = "warehouse-box-zone";
      warehouseBox.className = "warehouse-box-zone";
      warehouseBox.setAttribute("role", "img");
      warehouseBox.setAttribute("aria-label", "창고 박스");
      interactionLayer.appendChild(warehouseBox);
    } else if (warehouseBox.parentElement !== interactionLayer) {
      interactionLayer.appendChild(warehouseBox);
    }

    const position = GameState.warehouseBoxPosition ?? DEFAULT_WAREHOUSE_BOX_POSITION;
    const x = Number(position.x);
    const y = Number(position.y);
    const isOpen = GameState.warehouseBoxState === "open";
    const imagePath = getWarehouseBoxAsset(isOpen ? "basicOpen" : "basic");

    warehouseBox.style.setProperty(
      "left",
      `${Number.isFinite(x) ? x : DEFAULT_WAREHOUSE_BOX_POSITION.x}px`,
      "important"
    );
    warehouseBox.style.setProperty(
      "top",
      `${Number.isFinite(y) ? y : DEFAULT_WAREHOUSE_BOX_POSITION.y}px`,
      "important"
    );
    warehouseBox.dataset.boxState = isOpen ? "open" : "closed";
    this.ensureWarehouseBoxVisuals(warehouseBox, imagePath);
  },

  ensureWarehouseBoxVisuals(warehouseBox, imagePath) {
    let visualNode = warehouseBox.querySelector(".warehouse-box-visual");

    if (!visualNode) {
      visualNode = document.createElement("span");
      visualNode.className = "warehouse-box-visual";
      visualNode.setAttribute("aria-hidden", "true");
      warehouseBox.appendChild(visualNode);
    }

    let imageNode = visualNode.querySelector("img");

    if (!imageNode) {
      imageNode = document.createElement("img");
      imageNode.alt = "";
      imageNode.draggable = false;
      visualNode.appendChild(imageNode);
    }

    if (imageNode.getAttribute("src") !== imagePath) {
      imageNode.src = imagePath;
    }

    let hitboxNode = warehouseBox.querySelector(".warehouse-box-hitbox");

    if (!hitboxNode) {
      hitboxNode = document.createElement("span");
      hitboxNode.className = "warehouse-box-hitbox";
      hitboxNode.setAttribute("aria-hidden", "true");
      warehouseBox.appendChild(hitboxNode);
    }
  },

  getStoreObjectNode(config, interactionLayer) {
    let node = document.getElementById(config.nodeId);

    if (!node && config.createIfMissing) {
      node = document.createElement("div");
      node.id = config.nodeId;
      node.className = "store-zone";
      node.textContent = config.label;
    }

    if (!node) {
      return null;
    }

    if (node.parentElement !== interactionLayer) {
      interactionLayer.appendChild(node);
    }

    return node;
  },

  getStoreObjectStockData(objectType, shelfId = null, shelfInstanceId = null) {
  const shelfStock = shelfInstanceId
    ? GameState.shelfStocks?.[shelfInstanceId]
    : null;

  if (shelfStock?.products) {
    const productStocks = Object.entries(shelfStock.products);

    const stock = productStocks.reduce((total, [, productStock]) => {
      return total + Math.max(
        0,
        Math.floor(Number(productStock.currentStock) || 0)
      );
    }, 0);

    const capacity = productStocks.reduce((total, [, productStock]) => {
      return total + Math.max(
        1,
        Math.floor(Number(productStock.maxStock) || 8)
      );
    }, 0);

    return {
      stock,
      capacity: Math.max(1, capacity)
    };
  }

  return {
    stock: 0,
    capacity: 1
  };
},

getShelfWarningProducts(shelfInstanceId) {
    const shelfStock = shelfInstanceId
      ? GameState.shelfStocks?.[shelfInstanceId]
      : null;

    if (!shelfStock?.products) {
      return [];
    }

    return Object.entries(shelfStock.products)
      .map(([productId, productStock]) => {
        const currentStock = Math.max(
          0,
          Math.floor(Number(productStock?.currentStock) || 0)
        );
        const maxStock = Math.max(
          1,
          Math.floor(Number(productStock?.maxStock) || 8)
        );

        if (currentStock <= 0) {
          return {
            productId,
            state: "empty"
          };
        }

        if (currentStock <= Math.floor(maxStock / 2)) {
          return {
            productId,
            state: "warning"
          };
        }

        return null;
      })
      .filter(Boolean);
  },

  getInventoryItemsForObjectVisuals() {
    const snapshotItems = Array.isArray(this.inventorySnapshot?.items)
      ? this.inventorySnapshot.items
      : null;

    if (snapshotItems) {
      return snapshotItems;
    }

    return PRODUCTS.map((product) => {
      const inventoryItem = this.inventoryByProductId[product.id];

      return {
        productId: product.id,
        isUnlocked: product.unlockDay <= GameState.day,
        quantity: Number(inventoryItem?.quantity) || 0
      };
    });
  },

  getProductStockVisualObjectType(product) {
    if (this.isProductStoredInFoodWarmer(product)) {
      return STOCK_VISUAL_OBJECT_TYPES.FOOD_WARMER;
    }

    if (this.isProductStoredInFridge(product)) {
      return STOCK_VISUAL_OBJECT_TYPES.BEVERAGE_FRIDGE;
    }

    return STOCK_VISUAL_OBJECT_TYPES.DISPLAY_STAND;
  },

  isProductStoredInFoodWarmer(product) {
    return FOOD_WARMER_PRODUCT_IDS.has(product.id);
  },

  isProductStoredInFridge(product) {
    return product.category === "drink";
  },

  applyStoreObjectVisual(node, config) {
    const visualAsset = config.visualAsset;
    const originalLabel = node.dataset.objectLabel ||
      node.textContent.trim() ||
      config.label;

    [...node.childNodes].forEach((childNode) => {
      if (childNode.nodeType === Node.TEXT_NODE) {
        childNode.remove();
      }
   });

    node.dataset.objectLabel = originalLabel;
    node.dataset.objectType = visualAsset.objectType;
    node.dataset.objectFacing = visualAsset.facing;
    node.dataset.stockVisualState = visualAsset.state;
    node.dataset.stock = String(config.stock);
    node.dataset.capacity = String(config.capacity);
    node.style.setProperty("--asset-object-image", `url("${visualAsset.path}")`);
    node.classList.add(
      "store-object-zone",
      `store-object-${visualAsset.objectType}`
    );
    node.classList.remove(
      "is-stock-empty",
      "is-stock-half",
      "is-stock-full",
      "store-object-facing-left",
      "store-object-facing-right"
    );
    node.classList.add(
      `is-stock-${visualAsset.state}`,
      `store-object-facing-${visualAsset.facing}`
    );
    node.setAttribute(
      "aria-label",
      `${config.label} ${visualAsset.state} ${config.stock}/${config.capacity}`
    );

    const visualNode = this.ensureStoreObjectChild(
      node,
      "asset-object-visual",
      "span"
    );
    const imageNode = this.ensureStoreObjectImage(visualNode);

    visualNode.className = "asset-object-visual store-object-visual";
    visualNode.setAttribute("aria-hidden", "true");
    imageNode.src = visualAsset.path;
    imageNode.alt = "";
    imageNode.draggable = false;

    const hitboxNode = this.ensureStoreObjectChild(
      node,
      "asset-object-hitbox",
      "span"
    );

    hitboxNode.className = "asset-object-hitbox store-object-hitbox";
    hitboxNode.dataset.objectType = visualAsset.objectType;
    hitboxNode.dataset.stockVisualState = visualAsset.state;
    hitboxNode.setAttribute("aria-hidden", "true");

    // this.ensureInteractionFeedbackNodes(node);
    // this.bindInteractionFeedbackNode(node);

    const labelNode = node.querySelector(".store-object-label");

    if (labelNode) {
      labelNode.remove();
    } 

    this.renderShelfWarningIcons(node, config.instanceId);
  },

renderShelfWarningIcons(node, shelfInstanceId) {
    if (!node || !shelfInstanceId) {
      return;
    }

    const warningProducts = this.getShelfWarningProducts(shelfInstanceId);

    let iconLayer = node.querySelector(".shelf-warning-icons");

    const hasEmpty = warningProducts.some((item) => item.state === "empty");
    const hasWarning = warningProducts.some((item) => item.state === "warning");

    if (!hasEmpty && !hasWarning) {
      iconLayer?.remove();
      return;
    }

    if (!iconLayer) {
      iconLayer = document.createElement("span");
      iconLayer.className = "shelf-warning-icons";
      iconLayer.setAttribute("aria-hidden", "true");
      node.appendChild(iconLayer);
    }

    const iconSrc = hasEmpty
      ? ASSET_PATHS.ui.components.icons.shelfWarningRed
      : ASSET_PATHS.ui.components.icons.shelfWarningYellow;

    const iconClassName = hasEmpty
      ? "shelf-warning-icon is-empty"
      : "shelf-warning-icon is-warning";

    iconLayer.innerHTML = `
     <img
        class="${iconClassName}"
        src="${iconSrc}"
        alt=""
        draggable="false"
      />
    `;
  },

  ensureStoreObjectChild(parentNode, className, tagName) {
    const existingChild = [...parentNode.children].find((child) => {
      return child.classList.contains(className);
    });

    if (existingChild) {
      return existingChild;
    }

    const child = document.createElement(tagName);

    child.className = className;
    parentNode.appendChild(child);

    return child;
  },

  ensureStoreObjectImage(visualNode) {
    let imageNode = visualNode.querySelector("img");

    if (!imageNode) {
      imageNode = document.createElement("img");
      visualNode.appendChild(imageNode);
    }

    return imageNode;
  },

  renderInteractionFeedback() {
    const isDeliveryBoxSorting = this.isDeliveryBoxSortingInteractionSuppressed();

    if (isDeliveryBoxSorting) {
      this.clearAllInteractionFeedback();
      return;
    }

    this.clearInteractionFeedbackNode("delivery-box-zone");
    this.clearInteractionFeedbackNode("counter-zone");

    const playerCenter = this.getInteractionPlayerCenter();

    this.getInteractionFeedbackTargets().forEach((target) => {
      const node = document.getElementById(target.nodeId);

      if (!node || node.hidden) return;

      if (node.dataset.interactionFeedbackDisabled === "true") {
        this.clearInteractionFeedbackNode(target.nodeId);
        return;
      }

      this.ensureInteractionFeedbackNodes(node);
      this.bindInteractionFeedbackNode(node);

      const targetCenter = this.getInteractionTargetCenter(node, target.fallback);
      const distance = playerCenter && targetCenter
        ? this.getPointDistance(playerCenter, targetCenter)
        : null;
      const isReady = distance !== null &&
        distance <= (target.distance ?? INTERACTION_FEEDBACK_DISTANCE);

      node.classList.add("interaction-feedback-target");
      node.classList.toggle("is-interactable", Boolean(target.isInteractable));
      node.classList.toggle("is-interaction-ready", isReady);
    });
  },

  isDeliveryBoxSortingInteractionSuppressed() {
    return (
      GameState.deliveryBoxInteractionSuppressed === true ||
      GameState.deliveryBoxState === "carrying" ||
      GameState.player?.carryingBoxType === "arrive"
    );
  },

  clearShelfInteractionFeedback() {
    SHELF_INSTANCES.forEach((shelf) => {
      this.clearInteractionFeedbackNode(shelf.nodeId);
    });
  },

  clearAllInteractionFeedback() {
    const nodeIds = new Set([
      "counter-zone",
      "warehouse-box-zone",
      "delivery-box-zone",
      ...SHELF_INSTANCES.map((shelf) => shelf.nodeId).filter(Boolean)
    ]);

    nodeIds.forEach((nodeId) => {
      this.clearInteractionFeedbackNode(nodeId);
    });
  },

  clearInteractionFeedbackNode(nodeId) {
    const node = document.getElementById(nodeId);

    if (!node) return;

    node.classList.remove(
      "interaction-feedback-target",
      "is-interactable",
      "is-interaction-ready",
      "is-click-sparkling"
    );

    node.querySelectorAll(
      ":scope > .interaction-effect, :scope > .interaction-glow-ring, :scope > .interaction-finger-tap, :scope > .interaction-click-sparkle"
    ).forEach((effectNode) => effectNode.remove());
  },

  getInteractionFeedbackTargets(options = {}) {
  const shouldSuppressShelf = options.suppressShelf === true;
  const shelfTargets = shouldSuppressShelf
    ? []
    : SHELF_INSTANCES.map((shelf) => {
      return {
        nodeId: shelf.nodeId,
        shelfId: shelf.shelfId,
        shelfInstanceId: shelf.instanceId,
        isInteractable: true,
        fallback: { x: shelf.x, y: shelf.y }
      };
    });

  return [
    ...shelfTargets,
    {
      nodeId: "counter-zone",
      isInteractable: true
    }
  ];
},

  getInteractionPlayerCenter() {
    if (!GameState.player) {
      return null;
    }

    const playerNode = document.getElementById("player-zone");
    const playerWidth = Number(playerNode?.offsetWidth) || 58;
    const playerHeight = Number(playerNode?.offsetHeight) || 102;

    return {
      x: (Number(GameState.player.x) || 0) + playerWidth / 2,
      y: (Number(GameState.player.y) || 0) + playerHeight / 2
    };
  },

  getInteractionTargetCenter(node, fallback = null) {
    if (!node) {
      return fallback;
    }

    const width = Number(node.offsetWidth) || 0;
    const height = Number(node.offsetHeight) || 0;
    const x = (Number(node.offsetLeft) || 0) + width / 2;
    const y = (Number(node.offsetTop) || 0) + height / 2;

    return {
      x,
      y
    };
  },

  getPointDistance(firstPoint, secondPoint) {
    const dx = firstPoint.x - secondPoint.x;
    const dy = firstPoint.y - secondPoint.y;

    return Math.sqrt(dx * dx + dy * dy);
  },

  ensureInteractionFeedbackNodes(node) {
    const glowNode = this.ensureInteractionFeedbackChild(
      node,
      "interaction-glow-ring",
      "span",
      "asset-object-effect"
    );
    const tapNode = this.ensureInteractionFeedbackChild(
      node,
      "interaction-finger-tap",
      "span"
    );
    const sparkleNode = this.ensureInteractionFeedbackChild(
      node,
      "interaction-click-sparkle",
      "span"
    );

    node.classList.add("interaction-feedback-target");
    node.style.setProperty(
      "--interaction-glow-image",
      `url("${ASSET_PATHS.effects.interaction.glowRing}")`
    );
    node.style.setProperty(
      "--interaction-finger-image",
      `url("${ASSET_PATHS.effects.interaction.fingerTap}")`
    );
    node.style.setProperty(
      "--interaction-sparkle-image",
      `url("${ASSET_PATHS.effects.interaction.clickSparkle}")`
    );

    glowNode.className = "asset-object-effect interaction-effect interaction-glow-ring glow-ring";
    tapNode.className = "interaction-effect interaction-finger-tap finger-tap";
    sparkleNode.className = "interaction-effect interaction-click-sparkle click-sparkle";

    [glowNode, tapNode, sparkleNode].forEach((effectNode) => {
      effectNode.setAttribute("aria-hidden", "true");
    });
  },

  ensureInteractionFeedbackChild(parentNode, className, tagName, legacyClassName = null) {
    const existingChild = [...parentNode.children].find((child) => {
      return child.classList.contains(className) ||
        (legacyClassName && child.classList.contains(legacyClassName));
    });

    if (existingChild) {
      return existingChild;
    }

    const child = document.createElement(tagName);

    child.className = className;
    parentNode.appendChild(child);

    return child;
  },

  bindInteractionFeedbackNode(node) {
    if (
      !node ||
      node.id === "delivery-box-zone" ||
      node.dataset.interactionFeedbackDisabled === "true" ||
      node.dataset.interactionFeedbackBound === "true"
    ) {
      return;
    }

    node.dataset.interactionFeedbackBound = "true";
    node.addEventListener("click", () => {
      this.showInteractionSparkle(node.id);
    });
  },

  showInteractionSparkle(nodeId) {
    if (nodeId === "delivery-box-zone" || this.isDeliveryBoxSortingInteractionSuppressed()) {
      return;
    }

    const node = document.getElementById(nodeId);

    if (!node) return;

    if (node.dataset.interactionFeedbackDisabled === "true") {
      this.clearInteractionFeedbackNode(nodeId);
      return;
    }

    this.ensureInteractionFeedbackNodes(node);
    node.classList.remove("is-click-sparkling");
    void node.offsetWidth;
    node.classList.add("is-click-sparkling");

    window.clearTimeout(this.sparkleTimeoutIds[nodeId]);
    this.sparkleTimeoutIds[nodeId] = window.setTimeout(() => {
      node.classList.remove("is-click-sparkling");
    }, 520);
  },

  getAssetEffectToastConfig(effectType) {
    const effectConfigs = {
      unlock: {
        className: "asset-effect-toast--unlock",
        image: ASSET_PATHS.effects.unlock,
        defaultLabel: "해금 완료!",
        duration: 1100
      },
      upgrade: {
        className: "asset-effect-toast--upgrade",
        image: ASSET_PATHS.effects.upgrade,
        defaultLabel: "업그레이드 완료!",
        duration: 1050
      },
      construction: {
        className: "asset-effect-toast--construction",
        image: ASSET_PATHS.effects.constructionComplete,
        defaultLabel: "공사 완료!",
        duration: 1200
      },
      loading: {
        className: "asset-effect-toast--loading",
        image: ASSET_PATHS.effects.loading.dots,
        defaultLabel: "진행 중...",
        duration: 1300
      }
    };

    return effectConfigs[effectType] ?? effectConfigs.unlock;
  },

  playAssetEffectToast(effectType, labelText = "") {
    const gameScreen = document.getElementById("game-screen") ?? document.body;
    const config = this.getAssetEffectToastConfig(effectType);
    let toast = document.getElementById("asset-effect-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "asset-effect-toast";
      toast.setAttribute("aria-live", "polite");
      toast.innerHTML = `
        <span class="asset-effect-toast-image" aria-hidden="true"></span>
        <strong class="asset-effect-toast-label"></strong>
      `;
      gameScreen.appendChild(toast);
    }

    const imageNode = toast.querySelector(".asset-effect-toast-image");
    const labelNode = toast.querySelector(".asset-effect-toast-label");

    toast.className = `asset-effect-toast ${config.className}`;
    toast.style.setProperty("--asset-effect-toast-image", `url("${config.image}")`);

    if (imageNode) {
      imageNode.style.backgroundImage = `url("${config.image}")`;
    }

    if (labelNode) {
      labelNode.textContent = labelText || config.defaultLabel;
    }

    toast.classList.remove("is-visible");
    void toast.offsetWidth;
    toast.classList.add("is-visible");

    window.clearTimeout(this.assetEffectToastTimerId);
    this.assetEffectToastTimerId = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, config.duration);
  },

  renderPhaseChip() {
    const phaseChip = document.getElementById("phase-chip");

    if (!phaseChip) return;

    const phaseLabels = {
      [GAME_PHASE.READY]: "영업 준비",
      [GAME_PHASE.DAY_START]: "오픈 대기",
      [GAME_PHASE.ORDER]: "발주 중",
      [GAME_PHASE.STORE_OPEN]: "오픈",
      [GAME_PHASE.STORE_RUNNING]: "영업 중",
      [GAME_PHASE.DAY_END]: "마감 중",
      [GAME_PHASE.RESULT]: "정산",
      [GAME_PHASE.UPGRADE]: "업그레이드",
      [GAME_PHASE.NEXT_DAY]: "다음 Day",
      [GAME_PHASE.ENDLESS]: "무한모드"
    };

    phaseChip.textContent = phaseLabels[GameState.phase] ?? "영업 준비";
  },

  moveTopIconMenuToRoot() {
    const gameRoot = document.getElementById("game-root");
    const topIconMenu = document.getElementById("top-icon-menu");

    if (!gameRoot || !topIconMenu) return;

    if (topIconMenu.parentElement !== gameRoot) {
      gameRoot.appendChild(topIconMenu);
    }
  },

  prepareUiImageButtons(root = document) {
    const scopedRoot = root ?? document;

    this.applyUiImageButtonSet(scopedRoot, [
      {
        selector: "#title-new-game-button",
        variant: "titleStart",
        classNames: ["ui-title-button", "ui-title-start-button"]
      },
      {
        selector: "#title-resume-button",
        variant: "specialContinue",
        classNames: ["ui-title-button", "ui-special-button", "ui-special-continue-button"]
      },
      {
        selector: "#title-settings-button",
        variant: "specialSettings",
        classNames: ["ui-title-icon-button", "ui-special-button", "ui-special-settings-button"]
      },
      {
        selector: "#start-day-button, #end-day-button, #upgrade-shortcut-button, #shop-shortcut-button",
        variant: "commonSmall",
        classNames: ["ui-common-button", "ui-common-button-small"]
      },
      {
        selector: "#open-store-button",
        variant: "commonLarge",
        classNames: ["ui-common-button", "ui-common-button-large"]
      },
      {
        selector: "#result-confirm-button, #day-scenario-confirm-button, #order-confirm-button, .store-expansion-popover-action, .expansion-action-button, .customer-event-close-button, .staff-hire-skip-button, .bm-contract-purchase-button, .bm-premium-purchase-button, #bm-contract-skip-button",
        variant: "commonBase",
        classNames: ["ui-common-button", "ui-common-button-base"]
      },
      {
        selector: "#ending-continue-button",
        variant: "specialContinue",
        classNames: ["ui-special-button", "ui-special-continue-button"]
      },
      {
        selector: ".store-expansion-popover-close, #settings-close-button, #bm-contract-shop-close-button, #order-modal-close-button",
        variant: "iconClose",
        classNames: ["ui-icon-image-button", "ui-icon-button-close"]
      },
      {
        selector: "#expansion-carousel-prev",
        variant: "iconBack",
        classNames: ["ui-icon-image-button", "ui-icon-button-back"]
      }
    ]);

    const topIconButtons = [...document.querySelectorAll("#top-icon-menu .hud-icon-button")];
    const settingsButton = document.getElementById("ingame-settings-button") ??
      topIconButtons[2] ??
      null;

    if (settingsButton) {
      this.applyUiImageButton(settingsButton, "specialSettings", [
        "ui-icon-image-button",
        "ui-special-settings-button"
      ]);
    }
  },

  applyUiImageButtonSet(root, configs = []) {
    configs.forEach((config) => {
      root.querySelectorAll?.(config.selector).forEach((button) => {
        this.applyUiImageButton(button, config.variant, config.classNames);
      });
    });
  },

  applyUiImageButton(button, variant, classNames = []) {
    const assets = UI_IMAGE_BUTTON_VARIANTS[variant];

    if (!button || !assets) return;

    button.classList.add("ui-image-button", `ui-image-button-${variant}`, ...classNames);
    button.style.setProperty("--ui-button-image-normal", `url("${assets.normal}")`);
    button.style.setProperty("--ui-button-image-pressed", `url("${assets.pressed}")`);
    button.style.setProperty("--ui-button-image-disabled", `url("${assets.disabled}")`);

    if (button.dataset.uiImageButtonBound !== "true") {
      button.dataset.uiImageButtonBound = "true";
      button.addEventListener("pointerdown", () => {
        if (this.isUiImageButtonDisabled(button)) return;

        button.classList.remove("is-normal");
        button.classList.add("is-pressed");
      });

      ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((eventName) => {
        button.addEventListener(eventName, () => {
          button.classList.remove("is-pressed");
          this.syncUiImageButtonState(button);
        });
      });
    }

    this.syncUiImageButtonState(button);
  },

  isUiImageButtonDisabled(button) {
    return button.disabled ||
      button.getAttribute("aria-disabled") === "true";
  },

  syncUiImageButtonState(button) {
    const isDisabled = this.isUiImageButtonDisabled(button);
    const isPressed = !isDisabled && button.classList.contains("is-pressed");

    if (isDisabled) {
      button.classList.remove("is-pressed");
    }

    button.classList.toggle("is-disabled", isDisabled);
    button.classList.toggle("is-normal", !isDisabled && !isPressed);
  },

  queueInitialCameraFocus() {
    const focusBasic = () => {
      this.focusStoreSpace("zone_basic");
    };

    window.requestAnimationFrame(() => {
      focusBasic();
      window.setTimeout(focusBasic, 80);
      window.setTimeout(focusBasic, 260);
    });
  },

  createDailyGoalPanel() {
    const existingPanel = document.getElementById("daily-goal-panel");

    if (existingPanel) {
      return existingPanel;
    }

    const dayCard = document.getElementById("day-card");
    const topUi = document.getElementById("top-ui");

    if (!dayCard && !topUi) return null;

    const goalPanel = document.createElement("section");

    goalPanel.id = "daily-goal-panel";
    goalPanel.className = "daily-goal-panel";
    goalPanel.setAttribute("aria-label", "오늘의 목표");
    goalPanel.innerHTML = `
      <div class="daily-goal-panel-header">
        <strong>목표</strong>
        <span id="daily-goal-day-label">Day ${GameState.day}</span>
      </div>
      <div class="daily-goal-panel-body">
        <div class="daily-goal-main">
          <span>매출</span>
          <strong id="daily-goal-revenue-text">₩0 / ₩0</strong>
        </div>
        <div class="daily-goal-progress" aria-hidden="true">
          <span id="daily-goal-progress-bar"></span>
        </div>
        <div class="daily-goal-sub">
          <span id="daily-goal-satisfaction-text">만족도 0 / 0</span>
        </div>
      </div>
    `;

    (dayCard ?? topUi).appendChild(goalPanel);

    return goalPanel;
  },

  createFocusedZonePanel() {
    const existingPanel = document.getElementById("focused-zone-panel");

    if (existingPanel) {
      return existingPanel;
    }

    const dayCard = document.getElementById("day-card");
    const topUi = document.getElementById("top-ui");

    if (!dayCard && !topUi) return null;

    const panel = document.createElement("section");

    panel.id = "focused-zone-panel";
    panel.className = "focused-zone-panel hidden";
    panel.setAttribute("aria-label", "현재 구역");
    panel.innerHTML = `
      <div class="focused-zone-panel-header">
        <strong>구역</strong>
        <span id="focused-zone-status-label">확대 보기</span>
      </div>
      <div class="focused-zone-panel-body">
        <strong id="focused-zone-name">기본 매장</strong>
        <span id="focused-zone-hint">기본 플레이 구역</span>
      </div>
    `;

    const goalPanel = this.createDailyGoalPanel();
    const parent = dayCard ?? topUi;

    if (goalPanel?.parentElement === parent) {
      goalPanel.insertAdjacentElement("afterend", panel);
    } else {
      parent.appendChild(panel);
    }

    return panel;
  },

  renderFocusedZonePanel(zoneId = this.currentFocusedZoneId) {
    const panel = this.createFocusedZonePanel();
    const storeArea = document.getElementById("store-area");

    if (!panel) return;

    const zoneStates = this.getExpansionZoneViewModels(this.expansionState);
    const zone = zoneStates.find((candidate) => candidate.id === zoneId) ?? zoneStates[0];
    const nameNode = document.getElementById("focused-zone-name");
    const hintNode = document.getElementById("focused-zone-hint");
    const statusNode = document.getElementById("focused-zone-status-label");
    const isOverview = storeArea?.classList.contains("is-world-overview") ?? false;

    panel.classList.toggle("hidden", isOverview || !zone);

    if (!zone) return;

    if (nameNode) {
      nameNode.textContent = zone.level === 1 ? "기본 매장" : zone.name;
    }

    if (hintNode) {
      hintNode.textContent = zone.level === 1
        ? "기본 플레이 구역"
        : zone.isUnlocked
          ? "확장 완료"
          : zone.isConstructing
            ? "공사 중"
            : "눌러서 조건 확인";
    }

    if (statusNode) {
      statusNode.textContent = isOverview ? "전체 보기" : "확대 보기";
    }
  },

  renderDailyGoalPanel() {
    const goalPanel = this.createDailyGoalPanel();

    if (!goalPanel) return;

    const dayLabel = document.getElementById("daily-goal-day-label");
    const revenueText = document.getElementById("daily-goal-revenue-text");
    const progressBar = document.getElementById("daily-goal-progress-bar");
    const satisfactionText = document.getElementById("daily-goal-satisfaction-text");
    const targetRevenue = Number(GameState.dailyGoal?.targetRevenue) || 0;
    const currentRevenue = Number(GameState.todayStats?.revenue) || 0;
    const targetSatisfaction = Number(GameState.dailyGoal?.targetSatisfaction) || 0;
    const currentSatisfaction = Number(GameState.satisfaction) || 0;
    const revenueProgress = targetRevenue > 0
      ? Math.min(100, Math.max(0, (currentRevenue / targetRevenue) * 100))
      : 0;

    if (dayLabel) {
      dayLabel.textContent = `Day ${GameState.day}`;
    }

    if (revenueText) {
      revenueText.textContent = `₩${currentRevenue.toLocaleString()} / ₩${targetRevenue.toLocaleString()}`;
    }

    if (progressBar) {
      progressBar.style.width = `${revenueProgress}%`;
    }

    if (satisfactionText) {
      satisfactionText.textContent = `만족도 ${currentSatisfaction} / ${targetSatisfaction}`;
    }
  },

  createStaffSummary() {
    const existingSummary = document.getElementById("staff-summary");

    if (existingSummary) {
      this.staffSummary = existingSummary;
      return existingSummary;
    }

    const topUi = document.getElementById("top-ui");
    const inventorySummary = document.getElementById("inventory-summary");
    const statusPanel = document.getElementById("status-panel");

    if (!topUi || !statusPanel) {
      return null;
    }

    const staffSummary = document.createElement("section");
    staffSummary.id = "staff-summary";
    staffSummary.className = "staff-summary";
    staffSummary.hidden = true;
    staffSummary.setAttribute("aria-live", "polite");
    staffSummary.innerHTML = `
      <div class="staff-summary-header">
        <strong>알바 근무 현황</strong>
        <span id="staff-summary-status">미고용</span>
      </div>
      <div id="staff-summary-body" class="staff-summary-body"></div>
    `;

    if (inventorySummary) {
      inventorySummary.insertAdjacentElement("afterend", staffSummary);
    } else {
      statusPanel.insertAdjacentElement("afterend", staffSummary);
    }

    this.staffSummary = staffSummary;

    return staffSummary;
  },

  prepareStaffEntryVisualReset(data = {}) {
    const lockDay = Math.max(1, Math.floor(Number(data.day ?? GameState.day) || GameState.day || 1));
    const entryPosition = this.getStaffEntrySpawnPosition();

    this.staffEntryVisualLockDay = lockDay;
    this.staffAssistState = this.normalizeStaffAssistState({
      ...DEFAULT_STAFF_ASSIST_STATE,
      status: "off_duty",
      label: STAFF_ASSIST_STATUS_LABELS.off_duty,
      x: entryPosition.x,
      y: entryPosition.y,
      direction: "down_left",
      isMoving: false
    });
    this.snapStaffCharacterToEntry({ hide: true });
  },

  getStaffEntrySpawnPosition() {
    const entranceZone = document.getElementById("entrance-zone");

    if (!entranceZone) {
      return {
        x: DEFAULT_STAFF_ASSIST_STATE.x,
        y: DEFAULT_STAFF_ASSIST_STATE.y
      };
    }

    const computed = window.getComputedStyle(entranceZone);
    const x = Number.parseFloat(computed.left);
    const y = Number.parseFloat(computed.top);

    return {
      x: Number.isFinite(x) ? Math.round(x) : DEFAULT_STAFF_ASSIST_STATE.x,
      y: Number.isFinite(y)
        ? Math.round(y + STAFF_ENTRY_SPAWN_Y_OFFSET)
        : DEFAULT_STAFF_ASSIST_STATE.y
    };
  },

  snapStaffCharacterToEntry({ hide = true } = {}) {
    const staffCharacter = this.createStaffCharacter();

    if (!staffCharacter) {
      return;
    }

    const entryPosition = this.getStaffEntrySpawnPosition();

    staffCharacter.style.setProperty("left", `${entryPosition.x}px`, "important");
    staffCharacter.style.setProperty("top", `${entryPosition.y}px`, "important");
    staffCharacter.style.setProperty("right", "auto", "important");
    staffCharacter.style.setProperty("bottom", "auto", "important");
    staffCharacter.dataset.assistStatus = "off_duty";
    staffCharacter.dataset.staffMoving = "false";

    if (hide) {
      staffCharacter.hidden = true;
      staffCharacter.removeAttribute("aria-label");
    }
  },

  isStaffEntryVisualLocked(assistState = this.staffAssistState) {
    return (
      this.staffEntryVisualLockDay === GameState.day &&
      assistState.status !== "entering"
    );
  },

  normalizeStaffAssistState(state = GameState.staffAssist) {
    const source = state && typeof state === "object"
      ? state
      : DEFAULT_STAFF_ASSIST_STATE;
    const status = String(source.status ?? DEFAULT_STAFF_ASSIST_STATE.status);
    const label = String(
      source.label ?? STAFF_ASSIST_STATUS_LABELS[status] ?? DEFAULT_STAFF_ASSIST_STATE.label
    );
    const x = Number(source.x);
    const y = Number(source.y);
    const direction = String(source.direction ?? DEFAULT_STAFF_ASSIST_STATE.direction);

    return {
      ...DEFAULT_STAFF_ASSIST_STATE,
      ...source,
      status,
      label,
      x: Number.isFinite(x) ? Math.round(x) : DEFAULT_STAFF_ASSIST_STATE.x,
      y: Number.isFinite(y) ? Math.round(y) : DEFAULT_STAFF_ASSIST_STATE.y,
      direction,
      isMoving: source.isMoving === true
    };
  },

  getStaffAssistState() {
    const source = GameState.staffAssist ?? this.staffAssistState;

    this.staffAssistState = this.normalizeStaffAssistState(source);

    return this.staffAssistState;
  },

  getStaffAssistSummarySignature(state = this.staffAssistState) {
    const normalized = this.normalizeStaffAssistState(state);

    return [
      normalized.status,
      normalized.label,
      normalized.taskType ?? "",
      normalized.productId ?? "",
      normalized.targetShelfInstanceId ?? "",
      normalized.isWorking ? "working" : "idle"
    ].join("|");
  },

  getStaffAssistDirection(status = "idle") {
    const directionMap = {
      off_duty: "down_left",
      entering: "down_left",
      idle: "down",
      checking: "down",
      warehouse: "left",
      shelf: "right",
      cleaning: "down_right",
      returning: "down_left"
    };

    return directionMap[status] ?? "down";
  },

  renderStaffSummary(staffState = GameState.staff) {
    this.createStaffSummary();

    const summary = this.staffSummary;
    const status = document.getElementById("staff-summary-status");
    const body = document.getElementById("staff-summary-body");
    const hired = staffState?.hired ?? null;

    if (!summary || !status || !body) {
      return;
    }

    if (!hired) {
      summary.hidden = true;
      status.textContent = "미고용";
      body.innerHTML = "";
      return;
    }

    const expectedDailyWage = Number(hired.expectedDailyWage) ||
      (Number(hired.hourlyWage) || 0) * (Number(hired.shiftHours) || 3);
    const stats = hired.stats ?? {};
    const staffUpgrade = GameState.bm?.staffAbilityUpgrade?.abilities ?? {};
    const assistState = this.getStaffAssistState();

    if (assistState.status === "off_duty") {
      summary.hidden = true;
      status.textContent = "미고용";
      body.innerHTML = "";
      return;
    }

    const statText = [
      `창고 ${Math.min(5, (Number(stats.warehouse) || 0) + (Number(staffUpgrade.warehouse) || 0))}/5`,
      `진열대 ${Math.min(5, (Number(stats.shelf) || 0) + (Number(staffUpgrade.shelf) || 0))}/5`,
      `청소 ${Math.min(5, (Number(stats.cleaning) || 0) + (Number(staffUpgrade.cleaning) || 0))}/5`
    ].join(" · ");

    summary.hidden = false;
    status.textContent = `${hired.name} ${assistState.label}`;
    body.innerHTML = `
      <span>${hired.type}</span>
      <span>${assistState.label}</span>
      <span>${statText}</span>
      <span>시급 ₩${Number(hired.hourlyWage).toLocaleString("ko-KR")}</span>
      <span>예상 일급 ₩${expectedDailyWage.toLocaleString("ko-KR")}</span>
      <span>근태 ${hired.attendance}%</span>
      <span>${hired.ability}</span>
    `;
  },

  createStaffCharacter() {
    const interactionLayer = this.getStoreInteractionLayer();
    const storeArea = document.getElementById("store-area");

    if (!interactionLayer && !storeArea) {
      return null;
    }

    let staffCharacter = document.getElementById("staff-character");

    if (!staffCharacter) {
      staffCharacter = document.createElement("div");
      staffCharacter.id = "staff-character";
      staffCharacter.className = "staff-character";
      staffCharacter.hidden = true;
      staffCharacter.setAttribute("aria-live", "polite");
    }

    const targetParent = interactionLayer ?? storeArea;

    if (staffCharacter.parentElement !== targetParent) {
      targetParent.appendChild(staffCharacter);
    }

    this.staffCharacter = staffCharacter;

    return staffCharacter;
  },

  getStaffPortraitAssetPath(staff = {}) {
    return getStaffAssetPath(staff, "down");
  },

  getStaffStageAssetPath(staff = {}, direction = "down_left") {
    return getStaffAssetPath(staff, direction);
  },

  createStaffSpriteMarkup(staff = {}, className = "staff-sprite", alt = "") {
    const src = this.getStaffPortraitAssetPath(staff);

    if (!src) {
      return `<span class="${className} staff-sprite-fallback" aria-hidden="true">${this.getStaffCharacterMark(staff)}</span>`;
    }

    return `<img class="${className}" src="${src}" alt="${alt}" loading="eager" decoding="async" />`;
  },

  renderStaffCharacter(staffState = GameState.staff) {
    const staffCharacter = this.createStaffCharacter();
    const hired = staffState?.hired ?? null;

    if (!staffCharacter) {
      return;
    }

    if (!hired) {
      staffCharacter.hidden = true;
      staffCharacter.innerHTML = "";
      staffCharacter.removeAttribute("data-staff-type");
      staffCharacter.removeAttribute("data-assist-status");
      staffCharacter.removeAttribute("data-staff-moving");
      staffCharacter.removeAttribute("aria-label");
      return;
    }

    const staffName = String(hired.name ?? "알바").trim() || "알바";
    const staffType = String(hired.type ?? "근무").trim() || "근무";
    const baseStats = hired?.stats || { warehouse: 0, shelf: 0, cleaning: 0 };
    const ability = GameState.bm?.staffAbilityUpgrade?.abilities || {};
    const assistState = this.getStaffAssistState();
    const setStaffCharacterPosition = (state = assistState) => {
      const x = Number.isFinite(Number(state.x)) ? Math.round(Number(state.x)) : DEFAULT_STAFF_ASSIST_STATE.x;
      const y = Number.isFinite(Number(state.y)) ? Math.round(Number(state.y)) : DEFAULT_STAFF_ASSIST_STATE.y;

      staffCharacter.style.setProperty("left", `${x}px`, "important");
      staffCharacter.style.setProperty("top", `${y}px`, "important");
      staffCharacter.style.setProperty("right", "auto", "important");
      staffCharacter.style.setProperty("bottom", "auto", "important");
    };

    if (GameState.phase !== GAME_PHASE.STORE_RUNNING) {
      this.staffEntryVisualLockDay = null;
      setStaffCharacterPosition({
        ...DEFAULT_STAFF_ASSIST_STATE,
        direction: "down_left"
      });
      staffCharacter.hidden = true;
      staffCharacter.dataset.assistStatus = "off_duty";
      staffCharacter.dataset.staffMoving = "false";
      staffCharacter.removeAttribute("aria-label");
      return;
    }

    if (this.isStaffEntryVisualLocked(assistState)) {
      this.snapStaffCharacterToEntry({ hide: true });
      return;
    }

    if (assistState.status === "entering") {
      this.staffEntryVisualLockDay = null;
    }

    if (assistState.status === "off_duty") {
      setStaffCharacterPosition(assistState);
      staffCharacter.hidden = true;
      staffCharacter.dataset.assistStatus = assistState.status;
      staffCharacter.dataset.staffMoving = "false";
      staffCharacter.removeAttribute("aria-label");
      return;
    }

    const assistDirection = assistState.direction || this.getStaffAssistDirection(assistState.status);
    const warehouseStat = Math.min(5, Number(baseStats.warehouse || 0) + Number(ability.warehouse || 0));
    const shelfStat = Math.min(5, Number(baseStats.shelf || 0) + Number(ability.shelf || 0));
    const cleaningStat = Math.min(5, Number(baseStats.cleaning || 0) + Number(ability.cleaning || 0));
    const statSummary = `창고 ${warehouseStat}/5 · 진열대 ${shelfStat}/5 · 청소 ${cleaningStat}/5`;

    staffCharacter.dataset.staffType = String(hired.id ?? "staff");
    staffCharacter.dataset.assistStatus = assistState.status;
    staffCharacter.dataset.staffMoving = assistState.isMoving ? "true" : "false";
    staffCharacter.dataset.staffDirection = assistDirection;
    setStaffCharacterPosition(assistState);
    staffCharacter.setAttribute(
      "aria-label",
      `${staffName} ${staffType}, ${assistState.label}`
    );
    staffCharacter.hidden = false;

    let avatar = staffCharacter.querySelector(":scope > .staff-character-avatar");

    if (!avatar) {
      avatar = document.createElement("div");
      avatar.className = "staff-character-avatar";
      avatar.setAttribute("aria-hidden", "true");
      staffCharacter.appendChild(avatar);
    }

    let sprite = avatar.querySelector(":scope > .staff-character-sprite");

    if (!sprite) {
      sprite = document.createElement("img");
      sprite.className = "staff-character-sprite";
      sprite.alt = "";
      sprite.loading = "eager";
      sprite.decoding = "async";
      sprite.draggable = false;
      avatar.appendChild(sprite);
    }

    const nextSpriteSrc = this.getStaffStageAssetPath(hired, assistDirection);

    if (sprite.getAttribute("src") !== nextSpriteSrc) {
      sprite.src = nextSpriteSrc;
    }

    let cleaningTool = avatar.querySelector(":scope > .staff-cleaning-tool");

    if (!cleaningTool) {
      cleaningTool = document.createElement("img");
      cleaningTool.className = "staff-cleaning-tool";
      cleaningTool.alt = "";
      cleaningTool.loading = "eager";
      cleaningTool.decoding = "async";
      cleaningTool.draggable = false;
      cleaningTool.setAttribute("aria-hidden", "true");
      avatar.appendChild(cleaningTool);
    }

    if (cleaningTool.getAttribute("src") !== SANITATION_ASSETS.tools) {
      cleaningTool.src = SANITATION_ASSETS.tools;
    }

    const shouldShowCleaningTool = assistState.status === "cleaning";
    staffCharacter.dataset.cleaningTool = shouldShowCleaningTool ? "true" : "false";
    cleaningTool.hidden = !shouldShowCleaningTool;

    let label = staffCharacter.querySelector(":scope > .staff-character-label");

    if (!label) {
      label = document.createElement("div");
      label.className = "staff-character-label";
      label.innerHTML = `
        <strong></strong>
        <span></span>
        <em></em>
      `;
      staffCharacter.appendChild(label);
    }

    const nameNode = label.querySelector("strong");
    const statusNode = label.querySelector("span");
    const countNode = label.querySelector("em");

    if (nameNode && nameNode.textContent !== staffName) {
      nameNode.textContent = staffName;
    }

    if (statusNode && statusNode.textContent !== assistState.label) {
      statusNode.textContent = assistState.label;
    }

    const countText = statSummary;

    if (countNode && countNode.textContent !== countText) {
      countNode.textContent = countText;
    }
  },

  getStaffCharacterMark(staff = {}) {
    const marks = {
      kim_minji: "정",
      park_junho: "속",
      lee_bora: "친"
    };

    return marks[staff.id] ?? "알";
  },

  createInventorySummary() {
    const existingSummary = document.getElementById("inventory-summary");

    if (existingSummary) {
      this.inventorySummary = existingSummary;
      return existingSummary;
    }

    const topUi = document.getElementById("top-ui");
    const statusPanel = document.getElementById("status-panel");

    if (!topUi || !statusPanel) {
      return null;
    }

    const inventorySummary = document.createElement("section");
    inventorySummary.id = "inventory-summary";
    inventorySummary.setAttribute("aria-labelledby", "inventory-summary-title");
    inventorySummary.innerHTML = `
      <div class="inventory-summary-header">
        <strong id="inventory-summary-title">재고 현황</strong>
        <span id="inventory-summary-total">판매 가능 0개 / 전체 0개</span>
      </div>
      <div id="inventory-summary-list" class="inventory-summary-list"></div>
    `;

    statusPanel.insertAdjacentElement("afterend", inventorySummary);
    this.inventorySummary = inventorySummary;

    return inventorySummary;
  },

  renderInventorySummary() {
    this.createInventorySummary();

    const totalNode = document.getElementById("inventory-summary-total");
    const listNode = document.getElementById("inventory-summary-list");

    if (!totalNode || !listNode) {
      return;
    }

    const snapshot = this.inventorySnapshot ?? {};
    const items = Array.isArray(snapshot.items)
      ? snapshot.items
      : PRODUCTS.map((product) => {
          const displayName = BMSystem.getProductDisplayName(product);
          const inventoryItem = this.inventoryByProductId[product.id];

          return {
            productId: product.id,
            productName: displayName,
            unlockDay: product.unlockDay,
            isUnlocked: product.unlockDay <= GameState.day,
            quantity: Number(inventoryItem?.quantity) || 0
          };
        });
    const unlockedItems = items.filter((item) => {
      return item.isUnlocked || item.unlockDay <= GameState.day;
    });
    const totalQuantity = Number.isFinite(Number(snapshot.totalQuantity))
      ? Number(snapshot.totalQuantity)
      : unlockedItems.reduce((total, item) => {
          return total + (Number(item.quantity) || 0);
        }, 0);
    const sellableQuantity = Number.isFinite(
      Number(snapshot.sellableStockQuantityForCurrentDayRequests)
    )
      ? Number(snapshot.sellableStockQuantityForCurrentDayRequests)
      : totalQuantity;

    totalNode.textContent =
      `판매 가능 ${sellableQuantity.toLocaleString("ko-KR")}개 / 전체 ${totalQuantity.toLocaleString("ko-KR")}개`;

    this.renderStockInfo(totalQuantity);

    if (unlockedItems.length === 0) {
      listNode.innerHTML = `<span class="inventory-summary-empty">해금된 상품이 없습니다.</span>`;
      return;
    }

    listNode.innerHTML = unlockedItems.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const stockClass = quantity <= 0
        ? " is-out"
        : quantity <= 2
          ? " is-low"
          : "";

      return `
        <span class="inventory-stock-chip${stockClass}" title="${item.productName} 재고 ${quantity}개">
          <span class="inventory-stock-name">${item.productName}</span>
          <strong>${quantity}개</strong>
        </span>
      `;
    }).join("");
  },

  renderStockInfo(totalQuantity = null) {
    const stockInfo = document.getElementById("stock-info");

    if (!stockInfo) {
      return;
    }

    const resolvedTotalQuantity = Number.isFinite(Number(totalQuantity))
      ? Number(totalQuantity)
      : Object.values(this.inventoryByProductId).reduce((sum, item) => {
          return sum + (Number(item?.quantity) || 0);
        }, 0);
    const unlockedZoneCount = Array.isArray(GameState.expansion?.unlockedZoneIds)
      ? GameState.expansion.unlockedZoneIds.length
      : 1;
    const stockCapacity = 40 + Math.max(0, unlockedZoneCount - 1) * 20;

    stockInfo.textContent =
      `재고 ${resolvedTotalQuantity.toLocaleString("ko-KR")}/${stockCapacity.toLocaleString("ko-KR")}`;
  },

  renderControlButtons() {
    const startDayButton = document.getElementById("start-day-button");
    const openStoreButton = document.getElementById("open-store-button");
    const endDayButton = document.getElementById("end-day-button");
    const shopShortcutButton = document.getElementById("shop-shortcut-button");

    if (startDayButton) {
      startDayButton.disabled = this.shouldDisableStartDayButton();
    }

    if (openStoreButton) {
      openStoreButton.disabled = GameState.phase !== GAME_PHASE.DAY_START;
    }

    if (endDayButton) {
      endDayButton.disabled = GameState.phase !== GAME_PHASE.STORE_RUNNING;
    }

    if (shopShortcutButton) {
      shopShortcutButton.disabled = [
        GAME_PHASE.STORE_RUNNING,
        GAME_PHASE.DAY_END,
        GAME_PHASE.RESULT
      ].includes(GameState.phase);
    }
  },

  createExpansionPanel() {
    this.createExpansionEffectSummary();

    const existingPanel = document.getElementById("expansion-panel");

    if (existingPanel) {
      this.expansionPanel = existingPanel;
      return;
    }

    const gameScreen = document.getElementById("game-screen");
    const messagePanel = document.getElementById("message-panel");

    if (!gameScreen) return;

    const expansionPanel = document.createElement("section");

    expansionPanel.id = "expansion-panel";
    expansionPanel.setAttribute("aria-labelledby", "expansion-panel-title");
    expansionPanel.innerHTML = `
      <div class="expansion-panel-header">
        <h2 id="expansion-panel-title">매장 확장</h2>
        <span id="expansion-unlock-summary"></span>
      </div>
      <div class="expansion-carousel-controls">
        <button id="expansion-carousel-prev" class="expansion-carousel-button" type="button" aria-label="이전 확장 카드">←</button>
        <span id="expansion-carousel-position">1 / 1</span>
        <button id="expansion-carousel-next" class="expansion-carousel-button" type="button" aria-label="다음 확장 카드">→</button>
      </div>
      <div id="expansion-zone-grid" class="expansion-zone-grid"></div>
      <p id="expansion-message">먼지 낀 옆 구역을 눌러 확장 조건을 확인하세요.</p>
    `;

    if (messagePanel?.parentElement === gameScreen) {
      gameScreen.insertBefore(expansionPanel, messagePanel);
    } else {
      gameScreen.appendChild(expansionPanel);
    }

    this.expansionPanel = expansionPanel;
  },

  createExpansionEffectSummary() {
    const statusPanel = document.getElementById("status-panel");

    if (!statusPanel) return null;

    let effectSummary = document.getElementById("expansion-effect-summary");

    if (!effectSummary) {
      effectSummary = document.createElement("div");
      effectSummary.id = "expansion-effect-summary";
    }

    effectSummary.className = "expansion-effect-summary";
    const inventorySummary = document.getElementById("inventory-summary");

    if (inventorySummary) {
      inventorySummary.insertAdjacentElement("afterend", effectSummary);
    } else {
      statusPanel.insertAdjacentElement("afterend", effectSummary);
    }

    return effectSummary;
  },

  createStoreComposition() {
    const gameScreen = document.getElementById("game-screen");
    const storeArea = document.getElementById("store-area");

    if (!gameScreen || !storeArea) return null;

    let composition = document.getElementById("store-composition");

    if (!composition) {
      composition = document.createElement("section");
      composition.id = "store-composition";
      composition.classList.add("quarter-view-store-composition", "world-store-composition");
      composition.setAttribute("aria-labelledby", "store-composition-title");
      composition.innerHTML = `
        <div class="store-composition-header">
          <div>
            <h2 id="store-composition-title">오늘의 매장</h2>
            <p class="store-camera-help">드래그로 이동 · 휠/두 손가락으로 줌 · 공간 클릭으로 포커스</p>
          </div>
          <div id="store-camera-controls" class="store-camera-controls" aria-label="카메라 이동">
            <button class="store-camera-button" type="button" data-camera-focus="zone_basic">1번</button>
            <button class="store-camera-button" type="button" data-camera-focus="zone_extra_shelf">2번</button>
            <button class="store-camera-button" type="button" data-camera-focus="zone_cold_food">3번</button>
            <button class="store-camera-button" type="button" data-camera-focus="zone_premium_store">4번</button>
            <button id="store-camera-fit-button" class="store-camera-button store-camera-button-wide" type="button">전체보기</button>
          </div>
        </div>
        <div class="store-composition-layout">
          <div class="base-store-map"></div>
        </div>
      `;

      if (storeArea.parentElement === gameScreen) {
        gameScreen.insertBefore(composition, storeArea);
      } else {
        const messagePanel = document.getElementById("message-panel");

        if (messagePanel?.parentElement === gameScreen) {
          gameScreen.insertBefore(composition, messagePanel);
        } else {
          gameScreen.appendChild(composition);
        }
      }
    }

    composition.classList.add("quarter-view-store-composition", "world-store-composition");

    const baseStoreMap = composition.querySelector(".base-store-map");

    if (baseStoreMap && storeArea.parentElement !== baseStoreMap) {
      baseStoreMap.appendChild(storeArea);
    }

    storeArea.classList.add("quarter-view-map", "world-camera-viewport");
    storeArea.setAttribute("aria-label", "매장 월드맵");

    this.ensureStoreWorldMap(storeArea);
    this.moveGameplayNodesToInteractionLayer();
    this.bindWorldCameraEvents();

    if (!storeArea.dataset.cameraInitialized) {
      storeArea.dataset.cameraInitialized = "true";
      this.queueInitialCameraFocus();
    } else {
      this.updateWorldCameraTransform();
    }

    return composition;
  },

  ensureStoreMapArtLayer(storeArea) {
    return this.ensureStoreWorldMap(storeArea);
  },

  ensureQuarterViewScene(storeArea) {
    return this.ensureStoreWorldMap(storeArea);
  },

  ensureStoreExpansionLayer(storeArea) {
    return this.ensureStoreWorldMap(storeArea);
  },

  ensureStoreWorldMap(storeArea = document.getElementById("store-area")) {
    if (!storeArea) return null;

    let worldMap = document.getElementById("store-world-map");

    if (!worldMap) {
      worldMap = document.createElement("div");
      worldMap.id = "store-world-map";
      worldMap.className = "store-world-map is-unified-store-layout";
    }

    worldMap.classList.add("is-unified-store-layout");

    if (worldMap.parentElement !== storeArea) {
      storeArea.insertBefore(worldMap, storeArea.firstChild);
    }

    let background = document.getElementById("store-world-background");

    if (!background) {
      background = document.createElement("div");
      background.id = "store-world-background";
      background.className = "store-world-background";
      background.setAttribute("aria-hidden", "true");
      background.innerHTML = `
        <img
          src="./assets/images/world/map/background.png"
          alt=""
          draggable="false"
        />
      `;
      worldMap.appendChild(background);
    }

    let unifiedBase = document.getElementById("store-unified-base");

    if (!unifiedBase) {
      unifiedBase = document.createElement("div");
      unifiedBase.id = "store-unified-base";
      unifiedBase.className = "store-unified-base";
      unifiedBase.setAttribute("aria-hidden", "true");
      unifiedBase.innerHTML = `
        <img
          src="./assets/images/world/unified/unified_store_stage1.png"
          alt=""
          draggable="false"
        />
      `;
      worldMap.appendChild(unifiedBase);
    } else if (unifiedBase.parentElement !== worldMap) {
      worldMap.appendChild(unifiedBase);
    }

    let zoneArtLayer = document.getElementById("store-zone-art-layer");

    if (!zoneArtLayer) {
      zoneArtLayer = document.createElement("div");
      zoneArtLayer.id = "store-zone-art-layer";
      zoneArtLayer.className = "store-zone-art-layer";
      zoneArtLayer.setAttribute("aria-hidden", "true");
      zoneArtLayer.innerHTML = `
        <img class="store-zone-art-image zone-1" src="./assets/images/world/bright_empty_space/first_empty_space.png" alt="" draggable="false" />
        <img class="store-zone-art-image zone-2" src="./assets/images/world/bright_empty_space/second_empty_space.png" alt="" draggable="false" />
        <img class="store-zone-art-image zone-3" src="./assets/images/world/bright_empty_space/third_empty_space.png" alt="" draggable="false" />
        <img class="store-zone-art-image zone-4" src="./assets/images/world/bright_empty_space/fourth_empty_space.png" alt="" draggable="false" />
      `;
      worldMap.appendChild(zoneArtLayer);
    } else if (zoneArtLayer.parentElement !== worldMap) {
      worldMap.appendChild(zoneArtLayer);
    }

    let stageOverlay = document.getElementById("store-stage-overlay");

    if (!stageOverlay) {
      stageOverlay = document.createElement("div");
      stageOverlay.id = "store-stage-overlay";
      stageOverlay.className = "store-stage-overlay hidden";
      stageOverlay.setAttribute("aria-hidden", "true");
      stageOverlay.innerHTML = `
        <img src="" alt="" draggable="false" />
      `;
      worldMap.appendChild(stageOverlay);
    } else if (stageOverlay.parentElement !== worldMap) {
      worldMap.appendChild(stageOverlay);
    }

    let tilesNode = document.getElementById("store-expansion-tiles");

    if (!tilesNode) {
      tilesNode = document.createElement("div");
      tilesNode.id = "store-expansion-tiles";
      tilesNode.className = "store-expansion-tiles store-space-layer";
      tilesNode.setAttribute("aria-label", "매장 공간 배치");
      worldMap.appendChild(tilesNode);
    } else if (tilesNode.parentElement !== worldMap) {
      worldMap.appendChild(tilesNode);
    }

    let interactionLayer = document.getElementById("store-interaction-layer");

    if (!interactionLayer) {
      interactionLayer = document.createElement("div");
      interactionLayer.id = "store-interaction-layer";
      interactionLayer.className = "store-interaction-layer";
      worldMap.appendChild(interactionLayer);
    } else if (interactionLayer.parentElement !== worldMap) {
      worldMap.appendChild(interactionLayer);
    }

    let popover = document.getElementById("store-expansion-popover");

    if (!popover) {
      popover = document.createElement("aside");
      popover.id = "store-expansion-popover";
      popover.className = "store-expansion-popover expansion-condition-popover hidden";
      popover.setAttribute("aria-live", "polite");
    }

    if (popover.parentElement !== storeArea) {
      storeArea.appendChild(popover);
    }

    return worldMap;
  },

  isShelfZoneUnlocked(shelf) {
    const unlockedZoneIds = GameState.expansion?.unlockedZoneIds;

    if (!Array.isArray(unlockedZoneIds)) {
      return shelf?.zoneId === "zone_basic";
    }

    return unlockedZoneIds.includes(shelf?.zoneId);
  },

  getStoreInteractionLayer() {
    this.ensureStoreWorldMap();

    return document.getElementById("store-interaction-layer");
  },

  moveGameplayNodesToInteractionLayer() {
    const interactionLayer = document.getElementById("store-interaction-layer");

    if (!interactionLayer) return;

    [
      "entrance-zone",
      ...SHELF_INSTANCES.map((shelf) => shelf.nodeId),
      "counter-zone",
      "warehouse-box-zone",
      "player-zone",
      "customer-layer",
      "staff-character",
      "delivery-box-zone"
    ].forEach((nodeId) => {
      const node = document.getElementById(nodeId);

      if (node && node.parentElement !== interactionLayer) {
        interactionLayer.appendChild(node);
      }
    });
  },

  bindWorldCameraEvents() {
    if (this.isWorldCameraBound) return;

    const viewport = document.getElementById("store-area");

    if (!viewport) return;

    this.isWorldCameraBound = true;

    viewport.addEventListener("wheel", (event) => {
      this.handleStoreCameraWheel(event);
    }, { passive: false });

    viewport.addEventListener("pointerdown", (event) => {
      this.handleStoreCameraPointerDown(event);
    });

    window.addEventListener("pointermove", (event) => {
      this.handleStoreCameraPointerMove(event);
    });

    window.addEventListener("pointerup", () => {
      this.handleStoreCameraPointerUp();
    });

    window.addEventListener("pointercancel", () => {
      this.handleStoreCameraPointerUp();
    });

    viewport.addEventListener("click", (event) => {
      this.handleStoreCameraViewportClick(event);
    });

    viewport.addEventListener("touchstart", (event) => {
      this.handleStoreCameraTouchStart(event);
    }, { passive: false });

    viewport.addEventListener("touchmove", (event) => {
      this.handleStoreCameraTouchMove(event);
    }, { passive: false });

    viewport.addEventListener("touchend", () => {
      this.handleStoreCameraTouchEnd();
    });

    viewport.addEventListener("touchcancel", () => {
      this.handleStoreCameraTouchEnd();
    });

    window.addEventListener("resize", () => {
      window.clearTimeout(this.worldCamera.resizeTimerId);
      this.worldCamera.resizeTimerId = window.setTimeout(() => {
        const activeZoneId = this.selectedExpansionZoneId || "zone_basic";

        if (this.worldCamera.zoom <= this.getStoreCameraMinZoom() + 0.08) {
          this.fitStoreWorld();
          return;
        }

        this.focusStoreSpace(activeZoneId, { zoom: this.worldCamera.zoom });
      }, 120);
    });
  },

  handleStoreCameraWheel(event) {
    event.preventDefault();

    const zoomDelta = event.deltaY > 0 ? -0.08 : 0.08;
    const nextZoom = this.worldCamera.zoom + zoomDelta;

    this.zoomStoreCameraAt(event.clientX, event.clientY, nextZoom);
  },

  handleStoreCameraPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;

    const isBlockedTarget = event.target.closest?.(
      ".store-expansion-popover, .store-camera-controls, .store-zone, .delivery-box-zone, #delivery-box-zone, .expansion-space-hotspot, .dock-button, .primary-start-button, button[data-player-action]"
    );

    if (isBlockedTarget) return;

    this.worldCamera.isDragging = true;
    this.worldCamera.wasDragging = false;
    this.worldCamera.dragStartX = event.clientX;
    this.worldCamera.dragStartY = event.clientY;
    this.worldCamera.startX = this.worldCamera.x;
    this.worldCamera.startY = this.worldCamera.y;

    event.currentTarget?.setPointerCapture?.(event.pointerId);
  },

  handleStoreCameraPointerMove(event) {
    if (!this.worldCamera.isDragging) return;

    const dx = event.clientX - this.worldCamera.dragStartX;
    const dy = event.clientY - this.worldCamera.dragStartY;

    if (Math.abs(dx) + Math.abs(dy) > 4) {
      this.worldCamera.wasDragging = true;
    }

    this.worldCamera.x = this.worldCamera.startX + dx;
    this.worldCamera.y = this.worldCamera.startY + dy;
    this.updateWorldCameraTransform();
  },

  handleStoreCameraPointerUp() {
    if (!this.worldCamera.isDragging) return;

    this.worldCamera.isDragging = false;

    window.setTimeout(() => {
      this.worldCamera.wasDragging = false;
    }, 80);
  },

  handleStoreCameraViewportClick(event) {
    const isBlockedTarget = event.target.closest?.(
      ".store-expansion-popover, .store-space-popover-trigger, .store-camera-controls, .store-zone, .delivery-box-zone, #delivery-box-zone, .expansion-space-hotspot, .dock-button, .primary-start-button, #message-panel, #top-ui, #bottom-ui, button[data-player-action]"
    );

    if (isBlockedTarget || this.worldCamera.wasDragging) {
      return;
    }

    const hitZone = this.getStoreZoneAtViewportPoint(event.clientX, event.clientY);

    if (!hitZone) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.closeStoreExpansionPopover();
    this.focusStoreSpace(hitZone.id, { zoom: "auto" });

    if (hitZone.level === 1) {
      this.showMessage("기본 매장으로 이동했습니다. 진열대/계산대 오브젝트는 에셋 연결 후 이 위치에 교체됩니다.");
      return;
    }

    this.showMessage(
      hitZone.isUnlocked
        ? "확장 완료된 구역으로 이동했습니다."
        : "아직 확장되지 않은 구역입니다. 구역명 라벨을 누르면 조건을 확인할 수 있습니다."
    );
  },

  getStoreZoneAtViewportPoint(clientX, clientY) {
    const viewport = document.getElementById("store-area");

    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    if (
      localX < 0 ||
      localY < 0 ||
      localX > rect.width ||
      localY > rect.height
    ) {
      return null;
    }

    const worldX = (localX - this.worldCamera.x) / this.worldCamera.zoom;
    const worldY = (localY - this.worldCamera.y) / this.worldCamera.zoom;
    const zoneStates = this.getExpansionZoneViewModels(this.expansionState);

    return zoneStates
      .map((zone) => {
        return {
          zone,
          scene: this.getSpaceSceneViewModel(zone)
        };
      })
      .filter(({ scene }) => {
        return (
          worldX >= scene.x &&
          worldX <= scene.x + scene.width &&
          worldY >= scene.y &&
          worldY <= scene.y + scene.height
        );
      })
      .sort((first, second) => {
        return Number(second.scene.depth) - Number(first.scene.depth);
      })[0]?.zone ?? null;
  },

  handleStoreCameraTouchStart(event) {
    if (event.touches.length !== 2) return;

    event.preventDefault();
    this.worldCamera.isDragging = false;
    this.worldCamera.pinchStartDistance = this.getPinchDistance(event.touches);
    this.worldCamera.pinchStartZoom = this.worldCamera.zoom;
  },

  handleStoreCameraTouchMove(event) {
    if (event.touches.length !== 2 || this.worldCamera.pinchStartDistance <= 0) return;

    event.preventDefault();

    const distance = this.getPinchDistance(event.touches);
    const midpointX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    const midpointY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    const ratio = distance / this.worldCamera.pinchStartDistance;
    const nextZoom = this.worldCamera.pinchStartZoom * ratio;

    this.zoomStoreCameraAt(midpointX, midpointY, nextZoom);
  },

  handleStoreCameraTouchEnd() {
    this.worldCamera.pinchStartDistance = 0;
  },

  getPinchDistance(touches) {
    if (!touches || touches.length < 2) return 0;

    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;

    return Math.sqrt(dx * dx + dy * dy);
  },

  zoomStoreCameraAt(clientX, clientY, nextZoom) {
    const viewport = document.getElementById("store-area");

    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const oldZoom = this.worldCamera.zoom;
    const safeZoom = this.setStoreCameraZoom(nextZoom, false);
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - this.worldCamera.x) / oldZoom;
    const worldY = (localY - this.worldCamera.y) / oldZoom;

    this.worldCamera.x = localX - worldX * safeZoom;
    this.worldCamera.y = localY - worldY * safeZoom;
    this.updateWorldCameraTransform();
  },

  getWorldCoverZoom() {
    const viewport = document.getElementById("store-area");
    const worldMap = document.getElementById("store-world-map");

    if (!viewport || !worldMap) {
      return this.worldCamera.minZoom;
    }

    const viewportWidth = viewport.clientWidth || 960;
    const viewportHeight = viewport.clientHeight || 540;
    const worldWidth = worldMap.offsetWidth || 1672;
    const worldHeight = worldMap.offsetHeight || 941;

    return Math.max(
      viewportWidth / worldWidth,
      viewportHeight / worldHeight,
      this.worldCamera.minZoom
    );
  },

  getStoreCameraMinZoom() {
    return this.getWorldCoverZoom();
  },

  getStoreCameraSafeArea(viewportWidth = 960, viewportHeight = 540) {
    const left = Math.max(72, Math.min(170, viewportWidth * 0.16));
    const right = Math.max(56, Math.min(96, viewportWidth * 0.09));
    const top = Math.max(58, Math.min(96, viewportHeight * 0.12));
    const bottom = Math.max(84, Math.min(116, viewportHeight * 0.15));

    return {
      left,
      right,
      top,
      bottom,
      width: Math.max(240, viewportWidth - left - right),
      height: Math.max(180, viewportHeight - top - bottom)
    };
  },

  setStoreCameraZoom(nextZoom, shouldUpdate = true) {
    const minZoom = this.getStoreCameraMinZoom();
    const maxZoom = Math.max(this.worldCamera.maxZoom, minZoom);
    const requestedZoom = Number(nextZoom) || this.worldCamera.focusZoom;
    const zoom = Math.min(maxZoom, Math.max(minZoom, requestedZoom));

    this.worldCamera.zoom = zoom;

    if (shouldUpdate) {
      this.updateWorldCameraTransform();
    }

    return zoom;
  },

  focusStoreSpace(zoneId = "zone_basic", options = {}) {
    const zoneStates = this.getExpansionZoneViewModels(this.expansionState);
    const zone = zoneStates.find((candidate) => candidate.id === zoneId) ?? zoneStates[0];
    const scene = this.getSpaceSceneViewModel(zone);
    const viewport = document.getElementById("store-area");

    if (!scene || !viewport) return;

    this.currentFocusedZoneId = zone.id;

    const requestedZoom = options.zoom;
    const autoZoom = this.getStoreSpaceFocusZoom(scene);
    const zoom = this.setStoreCameraZoom(
      typeof requestedZoom === "number" ? requestedZoom : autoZoom,
      false
    );
    const viewportWidth = viewport.clientWidth || 960;
    const viewportHeight = viewport.clientHeight || 560;
    const safeArea = this.getStoreCameraSafeArea(viewportWidth, viewportHeight);
    const viewportCenterX = safeArea.left + safeArea.width / 2;
    const viewportCenterY = safeArea.top + safeArea.height / 2;
    const centerX = (Number(scene.focusX) || scene.x + scene.width / 2) + (Number(scene.focusOffsetX) || 0);
    const centerY = (Number(scene.focusY) || scene.y + scene.height / 2) + (Number(scene.focusOffsetY) || 0);

    this.worldCamera.x = Math.round(viewportCenterX - centerX * zoom);
    this.worldCamera.y = Math.round(viewportCenterY - centerY * zoom);
    this.setStoreViewMode("focus");
    this.updateWorldCameraTransform();
  },

  getStoreSpaceFocusZoom(scene = {}) {
    const viewport = document.getElementById("store-area");
    const viewportWidth = viewport?.clientWidth || 960;
    const viewportHeight = viewport?.clientHeight || 540;
    const safeArea = this.getStoreCameraSafeArea(viewportWidth, viewportHeight);
    const sceneWidth = Math.max(1, Number(scene.focusWidth) || Number(scene.width) || 560);
    const sceneHeight = Math.max(1, Number(scene.focusHeight) || Number(scene.height) || 360);
    const widthZoom = safeArea.width / (sceneWidth * 1.08);
    const heightZoom = safeArea.height / (sceneHeight * 1.18);
    const coverZoom = this.getWorldCoverZoom();
    const targetZoom = Math.min(widthZoom, heightZoom, this.worldCamera.maxZoom);

    return Math.max(
      coverZoom + 0.16,
      Math.min(this.worldCamera.maxZoom, targetZoom)
    );
  },

  setStoreViewMode(mode = "focus") {
    const storeArea = document.getElementById("store-area");

    if (!storeArea) return;

    const isOverview = mode === "overview";

    storeArea.classList.toggle("is-world-overview", isOverview);
    storeArea.classList.toggle("is-zone-focused", !isOverview);
    this.renderFocusedZonePanel(this.currentFocusedZoneId);
  },

  fitStoreWorld() {
    const viewport = document.getElementById("store-area");
    const worldMap = document.getElementById("store-world-map");

    if (!viewport || !worldMap) return;

    const viewportWidth = viewport.clientWidth || 960;
    const viewportHeight = viewport.clientHeight || 560;
    const coverZoom = this.getWorldCoverZoom();
    const unifiedStoreZoom = Math.max(
      coverZoom,
      Math.min(this.worldCamera.maxZoom, viewportWidth / 1260, viewportHeight / 760)
    );
    const zoom = this.setStoreCameraZoom(unifiedStoreZoom, false);
    const storeCenterX = 839;
    const storeCenterY = 463;

    this.worldCamera.x = Math.round(viewportWidth / 2 - storeCenterX * zoom);
    this.worldCamera.y = Math.round(viewportHeight / 2 - storeCenterY * zoom);
    this.setStoreViewMode("overview");
    this.updateWorldCameraTransform();
  },

  updateWorldCameraTransform() {
    const worldMap = document.getElementById("store-world-map");

    if (!worldMap) return;

    this.clampWorldCamera();

    const storeArea = document.getElementById("store-area");
    const overviewThreshold = this.getStoreCameraMinZoom() + 0.18;
    const shouldUseOverviewLabels = this.worldCamera.zoom <= overviewThreshold;

    if (storeArea) {
      storeArea.classList.toggle("is-world-overview", shouldUseOverviewLabels);
      storeArea.classList.toggle("is-zone-focused", !shouldUseOverviewLabels);
    }

    worldMap.style.transform = `translate(${this.worldCamera.x}px, ${this.worldCamera.y}px) scale(${this.worldCamera.zoom})`;
    this.positionStoreExpansionPopover(this.selectedExpansionZoneId);
    this.renderFocusedZonePanel(this.currentFocusedZoneId);
  },

  clampWorldCamera() {
    const viewport = document.getElementById("store-area");
    const worldMap = document.getElementById("store-world-map");

    if (!viewport || !worldMap) return;

    const minZoom = this.getStoreCameraMinZoom();

    if (this.worldCamera.zoom < minZoom) {
      this.worldCamera.zoom = minZoom;
    }

    const scaledWidth = worldMap.offsetWidth * this.worldCamera.zoom;
    const scaledHeight = worldMap.offsetHeight * this.worldCamera.zoom;
    const viewportWidth = viewport.clientWidth || 960;
    const viewportHeight = viewport.clientHeight || 560;
    const minX = Math.min(0, viewportWidth - scaledWidth);
    const minY = Math.min(0, viewportHeight - scaledHeight);

    if (scaledWidth <= viewportWidth) {
      this.worldCamera.x = Math.round((viewportWidth - scaledWidth) / 2);
    } else {
      this.worldCamera.x = Math.min(0, Math.max(minX, this.worldCamera.x));
    }

    if (scaledHeight <= viewportHeight) {
      this.worldCamera.y = Math.round((viewportHeight - scaledHeight) / 2);
    } else {
      this.worldCamera.y = Math.min(0, Math.max(minY, this.worldCamera.y));
    }
  },

  renderStoreCameraControls(zoneStates = []) {
    const controls = document.getElementById("store-camera-controls");

    if (!controls) return;

    const zonesById = zoneStates.reduce((zoneMap, zone) => {
      zoneMap[zone.id] = zone;
      return zoneMap;
    }, {});

    controls.querySelectorAll("[data-camera-focus]").forEach((button) => {
      const zone = zonesById[button.dataset.cameraFocus];
      const isUnlocked = zone?.isUnlocked || zone?.level === 1;

      button.classList.toggle("is-locked", Boolean(zone && !isUnlocked));
      button.onclick = () => {
        if (!zone) return;

        this.focusStoreSpace(zone.id, { zoom: "auto" });

        if (zone.level > 1 && !zone.isUnlocked) {
          this.selectedExpansionZoneId = zone.id;
          this.isStoreExpansionPopoverVisible = true;
          this.renderStoreExpansionPopover(zone);
        }
      };
    });

    const fitButton = document.getElementById("store-camera-fit-button");

    if (fitButton) {
      fitButton.onclick = () => {
        this.closeStoreExpansionPopover();
        this.fitStoreWorld();
      };
    }
  },

  renderExpansionZones(expansionState = this.expansionState) {
    this.createExpansionPanel();

    if (expansionState) {
      this.expansionState = expansionState;
    }

    const zoneGrid = document.getElementById("expansion-zone-grid");
    const unlockSummary = document.getElementById("expansion-unlock-summary");
    const zoneStates = this.getExpansionZoneViewModels(this.expansionState);

    this.renderStoreExpansionZones(zoneStates);

    if (!zoneGrid) return;

    const unlockedCount = zoneStates.filter((zone) => zone.isUnlocked).length;
    const carouselIndex = this.getSafeExpansionCarouselIndex(zoneStates);
    const visibleZone = zoneStates[carouselIndex];

    if (unlockSummary) {
      unlockSummary.textContent = `${unlockedCount} / ${zoneStates.length}`;
    }

    this.renderExpansionEffects(this.getExpansionEffectsViewModel(zoneStates));
    this.renderExpansionCarouselControls(zoneStates, carouselIndex);

    zoneGrid.innerHTML = (visibleZone ? [visibleZone] : []).map((zone) => {
      const statusLabel = this.getExpansionStatusLabel(zone.status);
      const costText = zone.unlockCost > 0
        ? `₩${zone.unlockCost.toLocaleString()}`
        : "기본 구역";
      const actionText = zone.isUnlocked
        ? "완료"
        : zone.isConstructing
          ? "공사 중"
          : zone.isAvailable
            ? "확장"
            : "조건 부족";

      return `
        <article
          class="expansion-zone-tile expansion-zone-${zone.status}"
          data-zone-id="${zone.id}"
          tabindex="${zone.isUnlocked ? "-1" : "0"}"
        >
          <div class="expansion-zone-fog" aria-hidden="true"></div>

          <div class="expansion-zone-content">
            <div class="expansion-zone-topline">
              <span class="expansion-zone-status">${statusLabel}</span>
              <span class="expansion-zone-cost">${costText}</span>
            </div>

            <h3>${zone.name}</h3>
            <p>${zone.description}</p>

            <dl class="expansion-zone-conditions">
              <div class="${zone.conditions.hasRequiredDay ? "is-met" : "is-missing"}">
                <dt>필요 Day</dt>
                <dd>${zone.requiredDay}</dd>
              </div>
              <div class="${zone.conditions.hasEnoughMoney ? "is-met" : "is-missing"}">
                <dt>확장 비용</dt>
                <dd>${costText}</dd>
              </div>
              <div class="${zone.conditions.previousUnlocked ? "is-met" : "is-missing"}">
                <dt>이전 구역</dt>
                <dd>${zone.previousZoneName}</dd>
              </div>
            </dl>

            <div class="expansion-action-row">
              <button
                class="expansion-action-button"
                type="button"
                data-zone-id="${zone.id}"
                ${zone.isAvailable ? "" : "disabled"}
              >
                ${actionText}
              </button>
              <button
                class="expansion-instant-action-button"
                type="button"
                data-zone-id="${zone.id}"
                ${(!zone.isUnlocked && (zone.isAvailable || zone.isConstructing)) ? "" : "disabled"}
              >
                즉시 완료 ${Number(zone.instantDiamondPrice || 0).toLocaleString("ko-KR")}다이아
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    this.bindExpansionZoneEvents(zoneStates);
    this.bindExpansionCarouselControls(zoneStates);
  },

  renderStoreExpansionZones(zoneStates = []) {
    this.createStoreComposition();

    const tilesNode = document.getElementById("store-expansion-tiles");

    if (!tilesNode) return;

    const visualZones = zoneStates.length > 0
      ? zoneStates
      : this.getExpansionZoneViewModels(this.expansionState);
    const zonesById = visualZones.reduce((zoneMap, zone) => {
      zoneMap[zone.id] = zone;
      return zoneMap;
    }, {});
    const selectedZoneExists = visualZones.some((zone) => {
      return zone.id === this.selectedExpansionZoneId;
    });

    if (!selectedZoneExists) {
      this.selectedExpansionZoneId = null;
    }

    this.updateStoreWorldArtLayers(visualZones);
    this.renderStoreCameraControls(visualZones);

    const tilesSignature = visualZones.map((zone) => {
      const scene = this.getSpaceSceneViewModel(zone);
      return [
        zone.id,
        zone.status,
        zone.isUnlocked ? "1" : "0",
        zone.isConstructing ? "1" : "0",
        zone.isAvailable ? "1" : "0",
        this.isStoreExpansionPopoverVisible && zone.id === this.selectedExpansionZoneId ? "selected" : "idle",
        this.getStoreSpaceImageSrc(zone),
        scene.cloudAsset ?? "",
        scene.lockAsset ?? ""
      ].join(":");
    }).join("|");

    if (this.lastStoreExpansionTilesSignature === tilesSignature && tilesNode.children.length > 0) {
      this.renderStoreInteractionHotspots(visualZones);
      this.renderStoreExpansionPopover(zonesById[this.selectedExpansionZoneId]);
      return;
    }

    this.lastStoreExpansionTilesSignature = tilesSignature;
    tilesNode.innerHTML = visualZones.map((zone) => {
      const scene = this.getSpaceSceneViewModel(zone);
      const imageSrc = this.getStoreSpaceImageSrc(zone);
      const statusText = this.getStoreExpansionStatusText(zone);
      const isCovered = zone.level > 1 && !zone.isUnlocked;
      const selectedClass =
        this.isStoreExpansionPopoverVisible && zone.id === this.selectedExpansionZoneId
          ? " is-selected"
          : "";
      const coveredClass = isCovered ? " is-covered" : "";
      const availableClass = zone.isAvailable ? " is-expandable" : "";
      const cloudHtml = isCovered && scene.cloudAsset
        ? `<img class="store-space-cloud" src="${scene.cloudAsset}" alt="" draggable="false" aria-hidden="true" />`
        : "";
      const lockHtml = isCovered && scene.lockAsset
        ? `<img class="store-space-lock" src="${scene.lockAsset}" alt="" draggable="false" aria-hidden="true" />`
        : "";
      const hintText = zone.level === 1
        ? "기본 플레이 구역"
        : zone.isUnlocked
          ? "확장 완료"
          : zone.isConstructing
            ? "공사 중"
            : zone.isAvailable
              ? "확장 가능"
              : "눌러서 조건 확인";

      return `
        <article
          class="store-space-tile store-expansion-${zone.status}${selectedClass}${coveredClass}${availableClass}"
          role="button"
          tabindex="0"
          data-zone-id="${zone.id}"
          data-zone-level="${zone.level}"
          style="--space-x: ${scene.x}px; --space-y: ${scene.y}px; --space-width: ${scene.width}px; --space-height: ${scene.height}px; --space-depth: ${scene.depth}; --space-label-left: ${scene.labelX}%; --space-label-top: ${scene.labelY}%;"
          aria-label="${scene.label} ${statusText}"
          aria-expanded="${this.isStoreExpansionPopoverVisible && zone.id === this.selectedExpansionZoneId ? "true" : "false"}"
        >
          <img class="store-space-image" src="${imageSrc}" alt="" draggable="false" />
          ${cloudHtml}
          ${lockHtml}
          <span class="store-space-focus-ring" aria-hidden="true"></span>
          <span
            class="store-space-label store-space-popover-trigger"
            role="button"
            tabindex="0"
            aria-label="${scene.label} 확장 조건 확인"
          >
            <strong>${scene.label}</strong>
            <em>${hintText}</em>
          </span>
        </article>
      `;
    }).join("");

    this.renderStoreInteractionHotspots(visualZones);

    tilesNode.querySelectorAll(".store-space-tile").forEach((zoneNode) => {
      const focusZone = (event = null) => {
        if (this.worldCamera.wasDragging) {
          return;
        }

        event?.preventDefault?.();
        event?.stopPropagation?.();

        const zone = zonesById[zoneNode.dataset.zoneId];

        if (!zone) return;

        this.closeStoreExpansionPopover();
        this.focusStoreSpace(zone.id, { zoom: "auto" });

        if (zone.level === 1) {
          this.showMessage("기본 매장으로 이동했습니다. 진열대/계산대 오브젝트는 에셋 연결 후 이 위치에 교체됩니다.");
          return;
        }

        this.showMessage(
          zone.isUnlocked
            ? "확장 완료된 구역으로 이동했습니다."
            : zone.isConstructing
              ? "현재 공사 중인 구역입니다."
              : "아직 확장되지 않은 구역입니다. 구역명 라벨을 누르면 조건을 확인할 수 있습니다."
        );
      };

      zoneNode.onclick = focusZone;
      zoneNode.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        focusZone(event);
      };
    });

    tilesNode.querySelectorAll(".store-space-popover-trigger").forEach((triggerNode) => {
      const zoneNode = triggerNode.closest(".store-space-tile");
      const openZonePopover = (event = null) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        const zone = zonesById[zoneNode?.dataset.zoneId];

        if (!zone) return;

        if (zone.level === 1) {
          this.closeStoreExpansionPopover();
          this.focusStoreSpace(zone.id, { zoom: "auto" });
          this.showMessage("기본 매장으로 이동했습니다. 진열대/계산대 오브젝트는 에셋 연결 후 이 위치에 교체됩니다.");
          return;
        }

        const isSameVisibleZone =
          this.isStoreExpansionPopoverVisible &&
          this.selectedExpansionZoneId === zone.id;

        if (isSameVisibleZone) {
          this.closeStoreExpansionPopover();
          return;
        }

        this.selectedExpansionZoneId = zone.id;
        this.isStoreExpansionPopoverVisible = true;
        this.focusStoreSpace(zone.id, { zoom: "auto" });
        this.showMessage(
          zone.isUnlocked
            ? "확장 완료된 구역입니다."
            : zone.isConstructing
              ? "현재 공사 중인 구역입니다."
              : "아직 확장되지 않은 구역입니다."
        );
        window.setTimeout(() => {
          this.renderStoreExpansionZones(this.getExpansionZoneViewModels(this.expansionState));
        }, 0);
      };

      triggerNode.onpointerdown = (event) => {
        event.stopPropagation();
        this.worldCamera.isDragging = false;
        this.worldCamera.wasDragging = false;
      };

      triggerNode.onclick = openZonePopover;
      triggerNode.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        openZonePopover(event);
      };
    });

    this.renderStoreExpansionPopover(zonesById[this.selectedExpansionZoneId]);
  },

  updateStoreWorldArtLayers(zoneStates = []) {
    const stageOverlay = document.getElementById("store-stage-overlay");
    const stageOverlayImage = stageOverlay?.querySelector("img");

    if (!stageOverlay || !stageOverlayImage) return;

    const overlaySrc = this.getStoreStageOverlaySrc(zoneStates);

    if (!overlaySrc) {
      stageOverlay.classList.add("hidden");
      if (stageOverlayImage.getAttribute("src") !== "") {
        stageOverlayImage.setAttribute("src", "");
      }
      return;
    }

    if (stageOverlayImage.getAttribute("src") !== overlaySrc) {
      stageOverlayImage.setAttribute("src", overlaySrc);
    }
    stageOverlay.classList.remove("hidden");
  },

  getStoreStageOverlaySrc(zoneStates = []) {
    const constructingZone = zoneStates.find((zone) => zone.isConstructing);

    if (constructingZone) {
      if (constructingZone.id === "zone_extra_shelf") {
        return "./assets/images/world/fixing/fixing_second_space.png";
      }

      if (constructingZone.id === "zone_cold_food") {
        return "./assets/images/world/fixing/fixing_third_space.png";
      }

      if (constructingZone.id === "zone_premium_store") {
        return "./assets/images/world/fixing/fixing_fourth_space.png";
      }
    }

    const unlockedLevels = zoneStates
      .filter((zone) => zone.isUnlocked)
      .map((zone) => Number(zone.level))
      .sort((a, b) => a - b);
    const highestUnlockedLevel = unlockedLevels[unlockedLevels.length - 1] ?? 1;

    if (highestUnlockedLevel <= 1) {
      return "./assets/images/world/state/all_dark_empty_space.png";
    }

    if (highestUnlockedLevel === 2) {
      return "./assets/images/world/state/two_dark_empty_space.png";
    }

    if (highestUnlockedLevel === 3) {
      return "./assets/images/world/state/one_dark_empty_space.png";
    }

    return "";
  },

  getSpaceSceneViewModel(zone = {}) {
    const scene = zone.scene ?? {};
    const fallbackByLevel = {
      1: { x: 335, y: 515, width: 560, height: 370 },
      2: { x: 330, y: 135, width: 565, height: 360 },
      3: { x: 890, y: 535, width: 585, height: 329 },
      4: { x: 895, y: 145, width: 575, height: 320 }
    };
    const fallback = fallbackByLevel[zone.level] ?? fallbackByLevel[1];

    const x = Number(scene.worldX) || fallback.x;
    const y = Number(scene.worldY) || fallback.y;
    const width = Number(scene.worldWidth) || fallback.width;
    const height = Number(scene.worldHeight) || fallback.height;

    return {
      x,
      y,
      width,
      height,
      focusX: Number(scene.focusWorldX) || x + width / 2,
      focusY: Number(scene.focusWorldY) || y + height / 2,
      focusWidth: Number(scene.focusWorldWidth) || width,
      focusHeight: Number(scene.focusWorldHeight) || height,
      focusOffsetX: Number(scene.focusOffsetX) || 0,
      focusOffsetY: Number(scene.focusOffsetY) || 0,
      labelX: Number(scene.labelX) || 50,
      labelY: Number(scene.labelY) || (Number(zone.level) === 1 ? 10 : 13),
      popoverAnchorX: Number(scene.popoverAnchorX) || null,
      popoverAnchorY: Number(scene.popoverAnchorY) || null,
      popoverOffsetX: Number(scene.popoverOffsetX) || 0,
      popoverOffsetY: Number(scene.popoverOffsetY) || 0,
      depth: Number(scene.depth) || Number(zone.level) || 1,
      label: scene.mapLabel ?? zone.name ?? "매장 구역",
      focusZoom: Number(scene.focusZoom) || this.worldCamera.focusZoom,
      brightAsset: scene.brightAsset ?? "./assets/images/world/bright_empty_space/first_empty_space.png",
      darkAsset: scene.darkAsset ?? scene.brightAsset ?? "./assets/images/world/bright_empty_space/first_empty_space.png",
      cloudAsset: scene.cloudAsset ?? "./assets/images/world/icon/cloud_icon2.png",
      lockAsset: scene.lockAsset ?? "./assets/images/world/icon/lock_icon.png"
    };
  },

  getStoreSpaceImageSrc(zone = {}) {
    const scene = this.getSpaceSceneViewModel(zone);

    if (zone.level === 1 || zone.isUnlocked) {
      return scene.brightAsset;
    }

    return scene.darkAsset;
  },

  renderStoreInteractionHotspots(zoneStates = []) {
    const interactionLayer = this.getStoreInteractionLayer();

    if (!interactionLayer) return;

    this.moveGameplayNodesToInteractionLayer();

    const counterZone = document.getElementById("counter-zone");

    if (counterZone) {
      counterZone.dataset.playerAction = "checkout";
      counterZone.dataset.counterAssetReady = "true";
      counterZone.dataset.interactionFeedbackDisabled = "true";
      this.clearInteractionFeedbackNode("counter-zone");
      counterZone.setAttribute("role", "button");
      counterZone.setAttribute("tabindex", "0");
    }

    const expansionHotspots = {
      zone_extra_shelf: {
        id: "extra-shelf-placeholder-zone",
        className: "extra-shelf-placeholder-zone",
        label: "추가 진열대",
        description: "오브젝트 에셋 연결 예정"
      },
      zone_cold_food: {
        id: "cold-food-placeholder-zone",
        className: "cold-food-placeholder-zone",
        label: "냉장·도시락",
        description: "오브젝트 에셋 연결 예정"
      },
      zone_premium_store: {
        id: "premium-placeholder-zone",
        className: "premium-placeholder-zone",
        label: "프리미엄 구역",
        description: "오브젝트 에셋 연결 예정"
      }
    };

    zoneStates
      .filter((zone) => zone.level > 1)
      .forEach((zone) => {
        const config = expansionHotspots[zone.id];

        if (!config) return;

        let hotspot = document.getElementById(config.id);

        if (!hotspot) {
          hotspot = document.createElement("button");
          hotspot.id = config.id;
          hotspot.className = `expansion-space-hotspot ${config.className}`;
          hotspot.type = "button";
          interactionLayer.appendChild(hotspot);
        } else if (hotspot.parentElement !== interactionLayer) {
          interactionLayer.appendChild(hotspot);
        }

        hotspot.dataset.zoneId = zone.id;
        hotspot.disabled = !zone.isUnlocked;
        hotspot.hidden = !zone.isUnlocked;
        hotspot.innerHTML = `
          <strong>${config.label}</strong>
          <span>${config.description}</span>
        `;
        hotspot.onclick = (event) => {
          event.stopPropagation();

          if (!zone.isUnlocked) return;

          this.showMessage(`${zone.name} 오브젝트 기능은 에셋 연결 후 활성화됩니다.`);
        };
      });
  },

  closeStoreExpansionPopover() {
    const popover = document.getElementById("store-expansion-popover");

    this.isStoreExpansionPopoverVisible = false;

    if (popover) {
      popover.classList.add("hidden");
      popover.classList.remove("is-visible");
      popover.removeAttribute("data-active-level");
      popover.removeAttribute("data-active-zone");
      popover.innerHTML = "";
    }

    document.querySelectorAll(".store-expansion-tile.is-selected, .store-space-tile.is-selected").forEach((tile) => {
      tile.classList.remove("is-selected");
    });
  },

  renderStoreExpansionPopover(zone) {
    const popover = document.getElementById("store-expansion-popover");

    if (!popover) return;

    if (!this.isStoreExpansionPopoverVisible || !zone) {
      popover.classList.add("hidden");
      popover.classList.remove("is-visible");
      popover.removeAttribute("data-active-level");
      popover.removeAttribute("data-active-zone");
      popover.innerHTML = "";
      return;
    }

    const costText = zone.unlockCost > 0
      ? `₩${zone.unlockCost.toLocaleString()}`
      : "기본 구역";
    const statusText = this.getStoreExpansionStatusText(zone);
    const actionText = zone.isUnlocked
      ? "확장 완료"
      : zone.isAvailable
        ? "확장하기"
        : "조건 부족";

    popover.classList.remove("hidden");
    popover.classList.add("is-visible");
    popover.dataset.activeLevel = String(zone.level);
    popover.dataset.activeZone = zone.id;
    popover.innerHTML = `
      <div class="store-expansion-popover-header">
        <div class="store-expansion-popover-title">
          <span>구역 정보</span>
          <strong>${zone.name}</strong>
        </div>
        <button
          class="store-expansion-popover-close"
          type="button"
          aria-label="확장 조건 닫기"
        >×</button>
      </div>
      <p class="store-expansion-popover-message">
        ${zone.isUnlocked ? "확장 완료된 구역입니다." : "아직 확장되지 않은 구역입니다."}
      </p>
      <dl class="store-expansion-condition-list">
        <div class="${zone.conditions.hasRequiredDay ? "is-met" : "is-missing"}">
          <dt>필요 Day</dt>
          <dd>${zone.requiredDay}</dd>
        </div>
        <div class="${zone.conditions.hasEnoughMoney ? "is-met" : "is-missing"}">
          <dt>확장 비용</dt>
          <dd>${costText}</dd>
        </div>
        <div class="${zone.conditions.previousUnlocked ? "is-met" : "is-missing"}">
          <dt>이전 구역</dt>
          <dd>${zone.previousZoneName}</dd>
        </div>
        <div>
          <dt>현재 상태</dt>
          <dd>${statusText}</dd>
        </div>
      </dl>
      <div class="store-expansion-popover-actions">
        <button
          class="store-expansion-popover-action"
          type="button"
          data-zone-id="${zone.id}"
          ${zone.isAvailable ? "" : "disabled"}
        >
          ${actionText}
        </button>
        <button
          class="store-expansion-popover-instant-action"
          type="button"
          data-zone-id="${zone.id}"
          ${(!zone.isUnlocked && (zone.isAvailable || zone.isConstructing)) ? "" : "disabled"}
        >
          즉시 완료 · ${Number(zone.instantDiamondPrice || 0).toLocaleString("ko-KR")}다이아
        </button>
      </div>
    `;

    const closeButton = popover.querySelector(".store-expansion-popover-close");
    const actionButton = popover.querySelector(".store-expansion-popover-action");
    const instantButton = popover.querySelector(".store-expansion-popover-instant-action");

    this.prepareUiImageButtons(popover);

    if (closeButton) {
      closeButton.onclick = (event) => {
        event.stopPropagation();
        this.closeStoreExpansionPopover();
      };
    }

    if (instantButton) {
      instantButton.onclick = (event) => {
        event.stopPropagation();
        if (instantButton.disabled) return;
        EventBus.emit(EVENTS.EXPANSION_REQUESTED, {
          day: GameState.day,
          zoneId: instantButton.dataset.zoneId,
          instantComplete: true
        });
      };
    }

    if (!actionButton) return;

    actionButton.onclick = (event) => {
      event.stopPropagation();

      if (actionButton.disabled) return;

      EventBus.emit(EVENTS.EXPANSION_REQUESTED, {
        day: GameState.day,
        zoneId: actionButton.dataset.zoneId
      });
    };

    this.positionStoreExpansionPopover(zone.id);
  },

  positionStoreExpansionPopover(zoneId) {
    const popover = document.getElementById("store-expansion-popover");
    const viewport = document.getElementById("store-area");
    const tile = document.querySelector(`.store-space-tile[data-zone-id="${zoneId}"]`);

    if (!popover || !viewport || !tile || popover.classList.contains("hidden")) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    const trigger = tile.querySelector('.store-space-popover-trigger');
    const triggerRect = trigger?.getBoundingClientRect();
    const viewportWidth = viewport.clientWidth || 960;
    const viewportHeight = viewport.clientHeight || 540;
    const isCompactLandscape = window.matchMedia("(max-height: 620px), (max-width: 980px) and (orientation: landscape)").matches;
    const topSafe = isCompactLandscape ? 86 : 108;
    const bottomSafe = isCompactLandscape ? 82 : 112;
    const sideSafe = isCompactLandscape ? 10 : 16;
    const popoverWidth = Math.min(isCompactLandscape ? 236 : 268, Math.max(220, viewportWidth - sideSafe * 2));
    const popoverHeight = popover.offsetHeight || 250;
    const zoneStates = this.getExpansionZoneViewModels(this.expansionState);
    const zone = zoneStates.find((candidate) => candidate.id === zoneId);
    const scene = this.getSpaceSceneViewModel(zone);
    const customAnchorX = scene?.popoverAnchorX;
    const customAnchorY = scene?.popoverAnchorY;
    const tileCenterX = typeof customAnchorX === 'number'
      ? tileRect.left - viewportRect.left + (tileRect.width * customAnchorX / 100)
      : (triggerRect
          ? triggerRect.left - viewportRect.left + triggerRect.width / 2
          : tileRect.left - viewportRect.left + tileRect.width / 2);
    const tileCenterY = typeof customAnchorY === 'number'
      ? tileRect.top - viewportRect.top + (tileRect.height * customAnchorY / 100)
      : (triggerRect
          ? triggerRect.top - viewportRect.top + triggerRect.height / 2
          : tileRect.top - viewportRect.top + tileRect.height / 2);
    const isUpperExpansionZone = zoneId === "zone_extra_shelf" || zoneId === "zone_premium_store";
    const popoverOffsetX = Number(scene?.popoverOffsetX) || 0;
    const popoverOffsetY = Number(scene?.popoverOffsetY) || 0;
    const preferredLeft = Math.round(tileCenterX - popoverWidth / 2 + popoverOffsetX);
    const preferredTop = Math.round(
      (isUpperExpansionZone
        ? tileCenterY + 22
        : tileCenterY - popoverHeight / 2) + popoverOffsetY
    );
    const minLeft = sideSafe;
    const maxLeft = Math.max(viewportWidth - popoverWidth - sideSafe, sideSafe);
    const minTop = topSafe;
    const maxTop = Math.max(viewportHeight - popoverHeight - bottomSafe, topSafe);
    const safeLeft = Math.min(Math.max(preferredLeft, minLeft), maxLeft);
    const safeTop = Math.min(Math.max(preferredTop, minTop), maxTop);
    const arrowLeft = Math.min(
      Math.max(Math.round(tileCenterX - safeLeft), 20),
      popoverWidth - 20
    );

    popover.style.left = `${safeLeft}px`;
    popover.style.right = "auto";
    popover.style.top = `${safeTop}px`;
    popover.style.width = `${popoverWidth}px`;
    popover.style.setProperty("--popover-arrow-left", `${arrowLeft}px`);
  },

  playStoreExpansionUnlockEffect(zoneId) {
    if (!zoneId) return;

    const tile = document.querySelector(`.store-space-tile[data-zone-id="${zoneId}"]`);

    if (!tile) return;

    tile.classList.remove("is-unlocking");
    void tile.offsetWidth;
    tile.classList.add("is-unlocking");

    const puff = document.createElement("span");
    puff.className = "store-expansion-puff";
    puff.setAttribute("aria-hidden", "true");
    tile.appendChild(puff);

    this.focusStoreSpace(zoneId, { zoom: "auto" });

    window.setTimeout(() => {
      tile.classList.remove("is-unlocking");
      puff.remove();
    }, 1200);
  },

  getStoreExpansionStatusText(zone) {
    if (zone.isUnlocked) {
      return "확장 완료";
    }

    if (zone.isConstructing) {
      return "공사 중";
    }

    if (zone.isAvailable) {
      return "미확장";
    }

    return "조건 부족";
  },

  getSafeExpansionCarouselIndex(zoneStates = []) {
    const lastIndex = Math.max(0, zoneStates.length - 1);

    this.expansionCarouselIndex = Math.min(
      Math.max(0, this.expansionCarouselIndex),
      lastIndex
    );

    return this.expansionCarouselIndex;
  },

  renderExpansionCarouselControls(zoneStates = [], carouselIndex = 0) {
    const prevButton = document.getElementById("expansion-carousel-prev");
    const nextButton = document.getElementById("expansion-carousel-next");
    const position = document.getElementById("expansion-carousel-position");
    const totalCount = zoneStates.length;

    if (position) {
      position.textContent = `${totalCount > 0 ? carouselIndex + 1 : 0} / ${totalCount}`;
    }

    if (prevButton) {
      prevButton.disabled = carouselIndex <= 0;
    }

    if (nextButton) {
      nextButton.disabled = totalCount === 0 || carouselIndex >= totalCount - 1;
    }
  },

  bindExpansionCarouselControls(zoneStates = []) {
    const prevButton = document.getElementById("expansion-carousel-prev");
    const nextButton = document.getElementById("expansion-carousel-next");
    const lastIndex = Math.max(0, zoneStates.length - 1);

    if (prevButton) {
      prevButton.onclick = () => {
        if (prevButton.disabled) return;

        this.expansionCarouselIndex = Math.max(0, this.expansionCarouselIndex - 1);
        this.renderExpansionZones(this.expansionState);
      };
    }

    if (nextButton) {
      nextButton.onclick = () => {
        if (nextButton.disabled) return;

        this.expansionCarouselIndex = Math.min(lastIndex, this.expansionCarouselIndex + 1);
        this.renderExpansionZones(this.expansionState);
      };
    }
  },

  getExpansionZoneViewModels(expansionState = null) {
    const stateUnlockedZoneIds = expansionState?.unlockedZoneIds;
    const constructionZoneId = expansionState?.constructionZoneId ?? null;
    const isAnyConstructionActive = Boolean(constructionZoneId);
    const unlockedZoneIds = new Set(
      Array.isArray(stateUnlockedZoneIds)
        ? stateUnlockedZoneIds
        : EXPANSION_ZONES
            .filter((zone) => zone.defaultUnlocked)
            .map((zone) => zone.id)
    );

    return EXPANSION_ZONES.map((zone) => {
      const previousZone = getPreviousExpansionZone(zone);
      const previousUnlocked =
        !previousZone || unlockedZoneIds.has(previousZone.id);
      const hasEnoughMoney = GameState.money >= zone.unlockCost;
      const hasRequiredDay = GameState.day >= zone.requiredDay;
      const isUnlocked = unlockedZoneIds.has(zone.id);
      const isConstructing = constructionZoneId === zone.id;
      const isAvailable =
        !isAnyConstructionActive &&
        !isUnlocked &&
        !isConstructing &&
        previousUnlocked &&
        hasEnoughMoney &&
        hasRequiredDay;
      const status = isUnlocked
        ? "unlocked"
        : isConstructing
          ? "constructing"
          : isAvailable
            ? "available"
            : "locked";

      return {
        ...zone,
        status,
        isUnlocked,
        isConstructing,
        isAvailable,
        previousZoneName: previousZone?.name ?? "없음",
        constructionCompleteDay: this.expansionState?.constructionCompleteDay ?? GameState.expansion?.constructionCompleteDay ?? null,
        instantDiamondPrice: Number(zone.instantDiamondPrice) || 0,
        missingRequirements: this.getExpansionMissingRequirements(zone, {
          previousZone,
          previousUnlocked,
          hasEnoughMoney,
          hasRequiredDay
        }),
        conditions: {
          previousUnlocked,
          hasEnoughMoney,
          hasRequiredDay
        }
      };
    });
  },

  getExpansionEffectsViewModel(zoneStates = []) {
    const stateEffects = this.expansionState?.effects;

    if (stateEffects) {
      return {
        customerSpawnRateBonus:
          Number(stateEffects.customerSpawnRateBonus) || 0,
        targetRevenueBonus:
          Number(stateEffects.targetRevenueBonus) || 0,
        storeSizeBonus:
          Number(stateEffects.storeSizeBonus) || 0
      };
    }

    return zoneStates
      .filter((zone) => zone.isUnlocked)
      .reduce((totalEffects, zone) => {
        const effects = zone.effects ?? {};

        return {
          customerSpawnRateBonus:
            totalEffects.customerSpawnRateBonus +
            (Number(effects.customerSpawnRateBonus) || 0),
          targetRevenueBonus:
            totalEffects.targetRevenueBonus +
            (Number(effects.targetRevenueBonus) || 0),
          storeSizeBonus:
            totalEffects.storeSizeBonus +
            (Number(effects.storeSizeBonus) || 0)
        };
      }, {
        customerSpawnRateBonus: 0,
        targetRevenueBonus: 0,
        storeSizeBonus: 0
      });
  },

  renderExpansionEffects(effects) {
    this.createExpansionEffectSummary();

    const effectSummary = document.getElementById("expansion-effect-summary");

    if (!effectSummary) return;

    const customerBonusPercent = Math.round(
      effects.customerSpawnRateBonus * 100
    );

    effectSummary.innerHTML = `
      <strong>현재 매장 효과</strong>
      <div class="expansion-effect-list">
        <span class="expansion-effect-item">
          손님 방문 +${customerBonusPercent}%
        </span>
        <span class="expansion-effect-item">
          목표 매출 +₩${effects.targetRevenueBonus.toLocaleString()}
        </span>
        <span class="expansion-effect-item">
          매장 규모 Lv.${effects.storeSizeBonus}
        </span>
      </div>
    `;
  },

  getExpansionMissingRequirements(zone, conditions) {
    const missingRequirements = [];

    if (!conditions.previousUnlocked && conditions.previousZone) {
      missingRequirements.push(`${conditions.previousZone.name} 확장 필요`);
    }

    if (!conditions.hasRequiredDay) {
      missingRequirements.push(`Day ${zone.requiredDay} 필요`);
    }

    if (!conditions.hasEnoughMoney) {
      missingRequirements.push(`₩${zone.unlockCost.toLocaleString()} 필요`);
    }

    return missingRequirements;
  },

  getExpansionStatusLabel(status) {
    const statusLabels = {
      unlocked: "확장 완료",
      available: "확장 가능",
      locked: "미확장",
      constructing: "공사 중"
    };

    return statusLabels[status] ?? "미확장";
  },

  bindExpansionZoneEvents(zoneStates = []) {
    const zonesById = zoneStates.reduce((zoneMap, zone) => {
      zoneMap[zone.id] = zone;
      return zoneMap;
    }, {});

    document.querySelectorAll(".expansion-zone-tile").forEach((tile) => {
      const showGuide = () => {
        const zone = zonesById[tile.dataset.zoneId];

        if (!zone) return;

        if (zone.status === "locked") {
          EventBus.emit(EVENTS.EXPANSION_REQUESTED, {
            day: GameState.day,
            zoneId: zone.id
          });
          return;
        }

        this.showExpansionMessage(this.getExpansionGuideMessage(zone));
      };

      tile.onclick = (event) => {
        if (event.target.closest?.(".expansion-action-button") || event.target.closest?.(".expansion-instant-action-button")) return;

        showGuide();
      };

      tile.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        showGuide();
      };
    });

    document.querySelectorAll(".expansion-instant-action-button").forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        if (button.disabled) return;
        EventBus.emit(EVENTS.EXPANSION_REQUESTED, {
          day: GameState.day,
          zoneId: button.dataset.zoneId,
          instantComplete: true
        });
      };
    });

    document.querySelectorAll(".expansion-action-button").forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();

        if (button.disabled) return;

        EventBus.emit(EVENTS.EXPANSION_REQUESTED, {
          day: GameState.day,
          zoneId: button.dataset.zoneId
        });
      };
    });
  },

  getExpansionGuideMessage(zone) {
    if (zone.isUnlocked) {
      return `${zone.name}은 이미 밝게 정리된 구역입니다.`;
    }

    if (zone.isConstructing) {
      return `${zone.name} 공사 진행 중입니다. Day ${zone.constructionCompleteDay ?? "다음"}에 완료되며, 즉시 완료권으로 대기 시간을 제거할 수 있습니다.`;
    }

    if (zone.isAvailable) {
      return `${zone.name} 확장 가능! 버튼을 누르면 ₩${zone.unlockCost.toLocaleString()}이 차감됩니다.`;
    }

    return `${zone.name} 확장 조건: ${zone.missingRequirements.join(" / ")}`;
  },

  showExpansionMessage(message) {
    this.createExpansionPanel();

    const messageNode = document.getElementById("expansion-message");

    if (!messageNode) return;

    messageNode.textContent = message;
  },

  createProductPanel() {
    const existingPanel = document.getElementById("product-panel");

    if (existingPanel) {
      this.productPanel = existingPanel;
      return;
    }

    const gameScreen = document.getElementById("game-screen");
    const messagePanel = document.getElementById("message-panel");

    if (!gameScreen) return;

    const productPanel = document.createElement("section");

    productPanel.id = "product-panel";
    productPanel.setAttribute("aria-labelledby", "product-panel-title");
    productPanel.innerHTML = `
      <div class="product-panel-header">
        <h2 id="product-panel-title">상품 진열대</h2>
        <span id="product-unlock-summary"></span>
      </div>
      <div id="product-card-grid" class="product-card-grid"></div>
    `;

    if (messagePanel) {
      gameScreen.insertBefore(productPanel, messagePanel);
    } else {
      gameScreen.appendChild(productPanel);
    }

    this.productPanel = productPanel;
  },

  renderProductCards() {
    const productGrid = document.getElementById("product-card-grid");
    const unlockSummary = document.getElementById("product-unlock-summary");

    if (!productGrid) return;

    const unlockedCount = PRODUCTS.filter((product) => {
      return this.isProductOrderable(product);
    }).length;

    if (unlockSummary) {
      unlockSummary.textContent = `${unlockedCount} / ${PRODUCTS.length}`;
    }

    const orderItems = PRODUCTS.map((product) => {
      return {
        productId: product.id,
        productName: BMSystem.getProductDisplayName(product),
        isUnlocked: this.isProductOrderable(product)
      };
    });
    const gridSignature = PRODUCTS.map((product) => `${product.id}:${product.imagePath}`).join("|");
    const existingCards = [...productGrid.querySelectorAll(".product-card")];
    const canReuseGrid =
      existingCards.length === PRODUCTS.length &&
      this.lastProductGridSignature === gridSignature &&
      existingCards.every((card, index) => card.dataset.productId === PRODUCTS[index].id);

    if (canReuseGrid) {
      this.syncProductCardGrid(orderItems);
      return;
    }

    this.lastProductGridSignature = gridSignature;
    productGrid.innerHTML = PRODUCTS.map((product) => {
      const displayName = BMSystem.getProductDisplayName(product);
      const inventoryItem = this.inventoryByProductId[product.id];
      const isLocked = !this.isProductOrderable(product);
      const lockReason = this.getOrderUnavailableReason(product);
      const quantity = inventoryItem?.quantity;
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
      const stockText = Number.isFinite(quantity) ? `${quantity}개` : "-";
      const nextExpireDay = inventoryItem?.nextExpireDay;
      const expireText = Number.isFinite(nextExpireDay)
        ? `Day ${nextExpireDay}`
        : "-";
      const stockStatusClass = !isLocked && safeQuantity <= 0
        ? " is-out-of-stock"
        : !isLocked && safeQuantity <= 2
          ? " is-low-stock"
          : "";
      const badgeText = isLocked
        ? lockReason
        : safeQuantity <= 0
          ? "재고 없음"
          : "";
      const badgeClass = isLocked
        ? "product-lock-badge"
        : safeQuantity <= 0
          ? "product-lock-badge product-stock-badge"
          : "product-lock-badge";

      return `
        <article
          class="product-card${isLocked ? " is-locked" : ""}${stockStatusClass}"
          data-product-id="${product.id}"
        >
          <div class="product-image-wrap">
            <img
              class="product-image"
              src="${product.imagePath}"
              alt="${displayName}"
              loading="eager"
              decoding="async"
            />
            <span class="${badgeClass}" ${badgeText ? "" : "hidden"}>${badgeText}</span>
          </div>

          <div class="product-card-content">
            <span class="product-category">
              ${this.getProductCategoryLabel(product.category)}
            </span>
            <h3 class="product-card-name">${displayName}</h3>

            <dl class="product-card-stats">
              <div>
                <dt>판매가</dt>
                <dd class="product-card-sale-price">₩${(BMSystem.getProductSalePrice(product.id) || product.salePrice).toLocaleString()}</dd>
              </div>
              <div>
                <dt>재고</dt>
                <dd class="product-card-stock">${stockText}</dd>
              </div>
              <div>
                <dt>다음 폐기</dt>
                <dd class="product-card-expire">${expireText}</dd>
              </div>
            </dl>

            <button
              class="product-order-button"
              type="button"
              data-product-id="${product.id}"
              ${isLocked ? "disabled" : ""}
            >
              발주
            </button>
          </div>
        </article>
      `;
    }).join("");

    this.bindProductOrderButtons(orderItems);
  },

  syncProductCardGrid(orderItems = []) {
    const setText = (root, selector, value) => {
      const node = root.querySelector(selector);
      if (node && node.textContent !== value) {
        node.textContent = value;
      }
    };

    PRODUCTS.forEach((product) => {
      const card = document.querySelector(`.product-card[data-product-id="${product.id}"]`);
      if (!card) return;

      const displayName = BMSystem.getProductDisplayName(product);
      const inventoryItem = this.inventoryByProductId[product.id];
      const isLocked = !this.isProductOrderable(product);
      const lockReason = this.getOrderUnavailableReason(product);
      const quantity = inventoryItem?.quantity;
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
      const stockText = Number.isFinite(quantity) ? `${quantity}개` : "-";
      const nextExpireDay = inventoryItem?.nextExpireDay;
      const expireText = Number.isFinite(nextExpireDay) ? `Day ${nextExpireDay}` : "-";
      const salePriceText = `₩${(BMSystem.getProductSalePrice(product.id) || product.salePrice).toLocaleString()}`;
      const stockStatusClass = !isLocked && safeQuantity <= 0
        ? "is-out-of-stock"
        : !isLocked && safeQuantity <= 2
          ? "is-low-stock"
          : "";

      card.classList.toggle("is-locked", isLocked);
      card.classList.toggle("is-out-of-stock", stockStatusClass === "is-out-of-stock");
      card.classList.toggle("is-low-stock", stockStatusClass === "is-low-stock");

      const imageNode = card.querySelector(".product-image");
      if (imageNode) {
        if (imageNode.getAttribute("src") !== product.imagePath) {
          imageNode.src = product.imagePath;
        }
        imageNode.alt = displayName;
      }

      const badge = card.querySelector(".product-lock-badge");
      if (badge) {
        const badgeText = isLocked ? lockReason : safeQuantity <= 0 ? "재고 없음" : "";
        badge.className = `product-lock-badge${!isLocked && safeQuantity <= 0 ? " product-stock-badge" : ""}`;
        badge.hidden = !badgeText;
        if (badge.textContent !== badgeText) {
          badge.textContent = badgeText;
        }
      }

      setText(card, ".product-category", this.getProductCategoryLabel(product.category));
      setText(card, ".product-card-name", displayName);
      setText(card, ".product-card-sale-price", salePriceText);
      setText(card, ".product-card-stock", stockText);
      setText(card, ".product-card-expire", expireText);

      const orderButton = card.querySelector(".product-order-button");
      if (orderButton) {
        orderButton.disabled = isLocked;
        orderButton.dataset.productId = product.id;
      }
    });

    this.bindProductOrderButtons(orderItems);
  },

  bindProductOrderButtons(items = []) {
    const productsById = items.reduce((productMap, product) => {
      productMap[product.productId] = product;
      return productMap;
    }, {});

    document.querySelectorAll(".product-order-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;

        const productId = button.dataset.productId;
        const product = productsById[productId];

        if (!product) return;

        this.emitOrderRequest(product);
      };
    });
  },

  emitOrderRequest(product, quantity = 1) {
    EventBus.emit(EVENTS.ORDER_BUTTON_CLICKED, {
      day: GameState.day,
      productId: product.productId,
      productName: product.productName
    });

    EventBus.emit(EVENTS.ORDER_REQUESTED, {
      day: GameState.day,
      productId: product.productId,
      productName: product.productName,
      quantity
    });
  },

  getProductCategoryLabel(category) {
    const categoryLabels = {
      snack: "과자",
      drink: "음료",
      ready_meal: "즉석식품",
      instant_food: "간편식",
      fresh_food: "신선식품"
    };

    return categoryLabels[category] ?? "상품";
  },

  isProductOrderable(product) {
    if (!product) return false;

    return BMSystem.canOrderProduct(product.id);
  },

  showMessage(message, options = {}) {
    const messagePanel = document.getElementById("message-panel");
    const messageNode = document.getElementById("system-message");

    if (!messagePanel || !messageNode) return;

    const normalizedMessage = String(message ?? "")
      .replace(/[\s\u00A0]*오늘의[\s\u00A0]*목표[\s\u00A0]*[·:|\-]?[\s\u00A0]*/gu, "")
      .replace(/^[\s\u00A0]*목표[\s\u00A0]*[·:|\-]?[\s\u00A0]*/u, "")
      .trim();

    window.clearTimeout(this.notificationTimerId);

    if (!normalizedMessage) {
      messagePanel.classList.remove("is-visible");
      messagePanel.classList.add("is-hidden");
      messageNode.textContent = "";
      if (options.speaker === "player") {
        this.hidePlayerDialogue();
      }
      return;
    }

    if (options.speaker === "player") {
      this.showPlayerDialogue(normalizedMessage, options);
      return;
    }

    messageNode.textContent = normalizedMessage;
    messagePanel.classList.remove("message-panel--player-textbox");
    messagePanel.classList.remove("is-hidden");
    messagePanel.classList.add("is-visible");

    const duration = Number(options.duration) || 2400;

    this.notificationTimerId = window.setTimeout(() => {
      messagePanel.classList.remove("is-visible");
      messagePanel.classList.add("is-hidden");
    }, duration);
  },

  getPlayerDialogueNode() {
    const playerNode = this.getPlayerNode();

    if (!playerNode) return null;

    let dialogueNode = playerNode.querySelector(".player-dialogue-bubble");

    if (!dialogueNode) {
      dialogueNode = document.createElement("div");
      dialogueNode.className = "player-dialogue-bubble is-hidden";
      dialogueNode.setAttribute("aria-live", "polite");
      dialogueNode.innerHTML = `<p class="player-dialogue-text"></p>`;
      playerNode.appendChild(dialogueNode);
    }

    return dialogueNode;
  },

  showPlayerDialogue(message, options = {}) {
    const normalizedMessage = String(message ?? "").trim();
    const dialogueNode = this.getPlayerDialogueNode();

    if (!dialogueNode) {
      if (normalizedMessage) {
        this.showMessage(normalizedMessage);
      }
      return;
    }

    window.clearTimeout(this.playerDialogueTimerId);

    if (!normalizedMessage) {
      this.hidePlayerDialogue();
      return;
    }

    const textNode = dialogueNode.querySelector(".player-dialogue-text");

    if (textNode) {
      textNode.textContent = normalizedMessage;
    }

    dialogueNode.classList.remove("is-hidden");
    dialogueNode.classList.add("is-visible");

    const duration = Number(options.duration) || 2400;

    this.playerDialogueTimerId = window.setTimeout(() => {
      this.hidePlayerDialogue();
    }, duration);
  },

  hidePlayerDialogue() {
    window.clearTimeout(this.playerDialogueTimerId);

    const dialogueNode = document.querySelector("#player-zone .player-dialogue-bubble");

    if (!dialogueNode) return;

    dialogueNode.classList.remove("is-visible");
    dialogueNode.classList.add("is-hidden");
  },

  showResult(resultData) {
    this.showMessage(
      `정산 완료 | ${resultData.resultSummaryText ?? "오늘 영업 결과를 확인하세요."}`
    );
  },

  showUpgradeOptions(upgrades) {
    // 업그레이드 UI는 현재 별도 렌더링 흐름에서 처리됩니다.
  },

  createDayScenarioModal() {
    if (document.getElementById("day-scenario-modal")) {
      this.dayScenarioModal = document.getElementById("day-scenario-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "day-scenario-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content day-scenario-modal-content">
        <p class="day-scenario-kicker">오늘의 영업 브리핑</p>
        <h2 id="day-scenario-title" class="day-scenario-title"></h2>
        <p id="day-scenario-subtitle" class="day-scenario-subtitle"></p>

        <div class="day-scenario-goal-box" aria-label="오늘의 목표">
          <div>
            <span>목표 매출</span>
            <strong id="day-scenario-target-revenue"></strong>
          </div>
          <div>
            <span>목표 만족도</span>
            <strong id="day-scenario-target-satisfaction"></strong>
          </div>
        </div>

        <section class="day-scenario-market-box" aria-label="오늘의 상권 정보">
          <div class="day-scenario-market-header">
            <span id="day-scenario-weather" class="day-scenario-weather"></span>
            <strong id="day-scenario-market-headline"></strong>
          </div>
          <p id="day-scenario-market-message"></p>
          <div class="day-scenario-recommend-box">
            <span>추천 발주 상품</span>
            <ul id="day-scenario-recommend-list"></ul>
          </div>
        </section>

        <p id="day-scenario-story" class="day-scenario-story"></p>
        <ul id="day-scenario-features" class="day-scenario-features"></ul>
        <p id="day-scenario-tip" class="day-scenario-tip"></p>
        <button id="day-scenario-confirm-button" class="day-scenario-confirm-button" type="button">
          발주하러 가기
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.dayScenarioModal = modal;
  },

  showDayScenarioModal(scenarioData = {}) {
    if (!this.dayScenarioModal) {
      this.createDayScenarioModal();
    }

    const title = document.getElementById("day-scenario-title");
    const subtitle = document.getElementById("day-scenario-subtitle");
    const targetRevenue = document.getElementById("day-scenario-target-revenue");
    const targetSatisfaction = document.getElementById("day-scenario-target-satisfaction");
    const weather = document.getElementById("day-scenario-weather");
    const marketHeadline = document.getElementById("day-scenario-market-headline");
    const marketMessage = document.getElementById("day-scenario-market-message");
    const recommendList = document.getElementById("day-scenario-recommend-list");
    const story = document.getElementById("day-scenario-story");
    const features = document.getElementById("day-scenario-features");
    const tip = document.getElementById("day-scenario-tip");
    const confirmButton = document.getElementById("day-scenario-confirm-button");
    const featureItems = Array.isArray(scenarioData.features)
      ? scenarioData.features
      : [];
    const marketInfo = scenarioData.marketInfo ?? {};
    const marketScenario = scenarioData.marketScenario ?? null;
    const marketProbability = Number(marketScenario?.probability);
    const marketProbabilityText = Number.isFinite(marketProbability)
      ? ` · ${(marketProbability * 100).toFixed(1)}%`
      : "";
    const marketLabel = marketScenario?.name
      ? `${marketInfo.weatherLabel ?? "상권 정보"} · ${marketScenario.name}${marketProbabilityText}`
      : marketInfo.weatherLabel ?? "상권 정보";
    const recommendedProducts = this.getRecommendedProducts(scenarioData);

    title.textContent = scenarioData.title ?? `Day ${GameState.day}. 영업 시작`;
    subtitle.textContent = scenarioData.subtitle ?? "오늘의 편의점 운영을 준비합니다.";
    targetRevenue.textContent = `₩${GameState.dailyGoal.targetRevenue.toLocaleString()}`;
    targetSatisfaction.textContent = `${GameState.dailyGoal.targetSatisfaction}%`;
    weather.textContent = marketLabel;
    marketHeadline.textContent = marketInfo.headline ?? "오늘의 수요 정보를 확인하세요.";
    marketMessage.textContent = marketInfo.message ?? "추천 상품을 참고해서 발주 수량을 정해보세요.";
    story.textContent = scenarioData.story ?? "발주와 재고 정리를 마친 뒤 편의점을 오픈하세요.";
    tip.textContent = scenarioData.tip ?? "보유금과 재고를 확인하고 발주 수량을 정하세요.";
    confirmButton.textContent = scenarioData.ctaText ?? "발주하러 가기";

    recommendList.innerHTML = recommendedProducts.length > 0
      ? recommendedProducts.map((product) => {
          const reason = this.getRecommendedProductReason(scenarioData, product.id);
          const displayName = BMSystem.getProductDisplayName(product);

          return `
            <li>
              <strong>${displayName}</strong>
              <span>${reason}</span>
            </li>
          `;
        }).join("")
      : `<li><strong>추천 상품 미정</strong><span>내일 회의 후 상품 데이터가 확정되면 자동으로 표시됩니다.</span></li>`;

    features.innerHTML = featureItems.map((feature) => {
      return `<li>${feature}</li>`;
    }).join("");

    const goToOrder = (event = null) => {
      event?.preventDefault?.();
      if (!this.guardTutorialAction("day:briefing-confirm", event)) return;
      // 튜토리얼 오버레이/딤 레이어와 함께 떠 있어도 브리핑 CTA는 항상 실제 발주창으로 이어져야 한다.
      this.hideDayScenarioModal();
      this.continueDayStartFlow();

      if (!this.isOrderModalVisible?.() && !this.pendingOrderPhaseData) {
        this.showOrderModal({
          day: GameState.day,
          dailyGoal: GameState.dailyGoal,
          difficulty: GameState.difficulty,
          isEndlessMode: GameState.isEndlessMode,
          dayScenario: GameState.dayScenario
        });
      }
    };

    confirmButton.onclick = goToOrder;
    confirmButton.style.pointerEvents = "auto";

    this.dayScenarioModal.style.pointerEvents = "auto";
    this.dayScenarioModal.classList.remove("hidden");
    this.refreshTutorialAfterUiChange(40);
  },

  hideDayScenarioModal() {
    if (!this.dayScenarioModal) return;

    this.dayScenarioModal.classList.add("hidden");
  },

  isDayScenarioModalVisible() {
    return (
      this.dayScenarioModal &&
      !this.dayScenarioModal.classList.contains("hidden")
    );
  },

  continueDayStartFlow() {
    if (this.shouldShowPendingStaffHireModal()) {
      this.showStaffHireModal(this.pendingStaffHireData);
      return;
    }

    if (this.pendingOrderPhaseData) {
      this.showOrderModal(this.pendingOrderPhaseData);
    }
  },

  shouldShowPendingStaffHireModal() {
    const staffData = this.pendingStaffHireData;

    return Boolean(
      staffData &&
      staffData.day === GameState.day &&
      !staffData.staff?.hired
    );
  },

  isStaffHireModalVisible() {
    return (
      this.staffHireModal &&
      !this.staffHireModal.classList.contains("hidden")
    );
  },

  getRecommendedProducts(scenarioData = this.pendingOrderPhaseData?.dayScenario ?? {}) {
    const recommendedIds = this.getRecommendedProductIdSet(scenarioData);

    return PRODUCTS.filter((product) => recommendedIds.has(product.id));
  },

  getRecommendedProductIdSet(scenarioData = this.pendingOrderPhaseData?.dayScenario ?? {}) {
    const recommendedProductIds = Array.isArray(scenarioData.recommendedProductIds)
      ? scenarioData.recommendedProductIds
      : [];
    const existingProductIds = new Set(PRODUCTS.map((product) => product.id));

    return new Set(
      recommendedProductIds.filter((productId) => {
        const product = PRODUCTS.find((item) => item.id === productId);

        return existingProductIds.has(productId) && this.isProductOrderable(product);
      })
    );
  },

  getRecommendedProductReason(scenarioData = {}, productId) {
    const reasons = scenarioData.recommendedProductReasons ?? {};

    return reasons[productId] ?? "오늘 상권에서 수요 증가 예상";
  },

  createStaffHireModal() {
    if (document.getElementById("staff-hire-modal")) {
      this.staffHireModal = document.getElementById("staff-hire-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "staff-hire-modal";
    modal.className = "modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "staff-hire-title");

    modal.innerHTML = `
      <div class="modal-content staff-hire-modal-content">
        <div class="staff-hire-header">
          <span class="staff-hire-kicker">Day 3 오픈</span>
          <h2 id="staff-hire-title">알바 고용 게시판</h2>
          <p>오늘부터 3시간 단기 알바를 고용할 수 있습니다. 알바는 창고에서 재고를 가져오고, 진열대 보충과 청소를 보조합니다.</p>
        </div>
        <div id="staff-hire-list" class="staff-hire-list"></div>
        <button id="staff-hire-skip-button" class="staff-hire-skip-button" type="button">
          오늘은 넘기기
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.staffHireModal = modal;
  },

  showStaffHireModal(staffData = {}) {
    if (!this.staffHireModal) {
      this.createStaffHireModal();
    }

    const list = document.getElementById("staff-hire-list");
    const skipButton = document.getElementById("staff-hire-skip-button");
    const candidates = Array.isArray(staffData.candidates)
      ? staffData.candidates
      : [];
    const shiftHours = Number(staffData.shiftHours) || 3;

    if (!list || !skipButton) {
      return;
    }

    list.innerHTML = candidates.map((candidate) => {
      const hourlyWage = Number(candidate.hourlyWage) || 0;
      const expectedDailyWage = Number(candidate.expectedDailyWage) ||
        hourlyWage * shiftHours;

      return `
        <article class="staff-candidate-card" data-staff-id="${candidate.id}">
          <div class="staff-candidate-visual" aria-hidden="true">
            <img class="staff-candidate-frame" src="${BM_ASSETS.staff.cardFrame}" alt="" loading="eager" decoding="async" />
            <img class="staff-candidate-sprite" src="${this.getStaffPortraitAssetPath(candidate)}" alt="" loading="eager" decoding="async" />
            <img class="staff-candidate-hire-icon" src="${BM_ASSETS.staff.hire}" alt="" loading="eager" decoding="async" />
          </div>
          <div class="staff-candidate-title">
            <strong>${candidate.name}</strong>
            <span>${candidate.type}</span>
          </div>
          <dl class="staff-candidate-stats">
            <div>
              <dt>시급</dt>
              <dd>₩${hourlyWage.toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt>예상 일급</dt>
              <dd>₩${expectedDailyWage.toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt>근태</dt>
              <dd>${candidate.attendance}%</dd>
            </div>
          </dl>
          <p class="staff-candidate-ability">${candidate.ability}</p>
          <button class="staff-hire-button" type="button" data-staff-id="${candidate.id}">
            고용하기
          </button>
        </article>
      `;
    }).join("");

    this.prepareUiImageButtons(this.staffHireModal);

    list.querySelectorAll(".staff-hire-button").forEach((button) => {
      button.onclick = () => {
        const candidateId = button.dataset.staffId;

        EventBus.emit(STAFF_EVENTS.HIRED, {
          day: GameState.day,
          candidateId
        });

        this.pendingStaffHireData = null;
        this.hideStaffHireModal();
        this.continueDayStartFlow();
      };
    });

    skipButton.onclick = () => {
      EventBus.emit(STAFF_EVENTS.HIRE_SKIPPED, {
        day: GameState.day
      });

      this.pendingStaffHireData = null;
      this.hideStaffHireModal();
      this.continueDayStartFlow();
    };

    this.staffHireModal.classList.remove("hidden");
  },

  hideStaffHireModal() {
    if (!this.staffHireModal) return;

    this.staffHireModal.classList.add("hidden");
  },

  createBMShopPurchaseConfirmModal() {
    if (document.getElementById("bm-purchase-confirm-modal")) {
      this.bmPurchaseConfirmModal = document.getElementById("bm-purchase-confirm-modal");
      return;
    }

    const modal = document.createElement("div");

    modal.id = "bm-purchase-confirm-modal";
    modal.className = "modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "bm-purchase-confirm-title");
    modal.innerHTML = `
      <div class="modal-content bm-purchase-confirm-content">
        <h2 id="bm-purchase-confirm-title">구매 확인</h2>
        <div id="bm-purchase-confirm-body" class="bm-purchase-confirm-body"></div>
        <div class="bm-purchase-confirm-actions">
          <button id="bm-purchase-confirm-yes" class="bm-purchase-confirm-yes" type="button">예</button>
          <button id="bm-purchase-confirm-no" class="bm-purchase-confirm-no" type="button">아니요</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.bmPurchaseConfirmModal = modal;
    this.prepareUiImageButtons(modal);
  },

  showBMShopPurchaseConfirm(options = {}, onConfirm = null) {
    if (!this.bmPurchaseConfirmModal) {
      this.createBMShopPurchaseConfirmModal();
    }

    const modal = this.bmPurchaseConfirmModal;
    const title = document.getElementById("bm-purchase-confirm-title");
    const body = document.getElementById("bm-purchase-confirm-body");
    const yesButton = document.getElementById("bm-purchase-confirm-yes");
    const noButton = document.getElementById("bm-purchase-confirm-no");
    const product = options.product ?? {
      id: options.id ?? "bm_shop_action",
      name: options.name ?? "상점 상품",
      imagePath: options.imagePath ?? BM_ASSETS.rewardIcons.reward
    };

    if (!modal || !body || !yesButton || !noButton) {
      this.showMessage("구매 확인창을 열 수 없습니다. 다시 시도해주세요.");
      return;
    }

    const priceText = options.priceText ?? "가격 확인 필요";
    const description = options.description ?? "구매 후 해당 상품을 운영에 사용할 수 있습니다.";
    const confirmMessage = options.confirmMessage ?? "해당 상품을 구매하시겠습니까?";
    const displayName = product.id && BMSystem.getProductDisplayName(product)
      ? BMSystem.getProductDisplayName(product)
      : product.name;
    const imagePath = product.imagePath || options.imagePath || BM_ASSETS.rewardIcons.reward;

    if (title) title.textContent = options.title ?? "구매 확인";

    body.innerHTML = `
      <article class="bm-purchase-confirm-card">
        <span class="bm-purchase-confirm-image-box">
          <img src="${imagePath}" alt="${displayName}" draggable="false" loading="eager" decoding="async" onerror="this.hidden=true;" />
        </span>
        <div class="bm-purchase-confirm-copy">
          <strong>${displayName}</strong>
          <span>${description}</span>
          <em>${priceText}</em>
          <p>${confirmMessage}</p>
        </div>
      </article>
    `;

    yesButton.onclick = () => {
      this.hideBMShopPurchaseConfirm();
      if (typeof onConfirm === "function") {
        onConfirm();
      }
    };

    noButton.onclick = () => {
      this.hideBMShopPurchaseConfirm();
    };

    modal.classList.remove("hidden");
    this.focusElementSafely(yesButton);
  },

  hideBMShopPurchaseConfirm() {
    if (!this.bmPurchaseConfirmModal) return;

    this.bmPurchaseConfirmModal.classList.add("hidden");
  },

  createBMContractShopModal() {
    if (document.getElementById("bm-contract-shop-modal")) {
      this.bmContractShopModal = document.getElementById("bm-contract-shop-modal");
      return;
    }

    const modal = document.createElement("div");

    modal.id = "bm-contract-shop-modal";
    modal.className = "modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "bm-contract-shop-title");
    modal.innerHTML = `
      <div class="modal-content bm-contract-shop-content bm-shop-tabbed-content bm-shop-modern-content">
        <div class="bm-shop-modern-topbar">
          <div class="bm-shop-modern-title-block">
            <p class="bm-contract-shop-kicker">STORE · BM SHOP</p>
            <h2 id="bm-contract-shop-title">오늘도 정상영업 상점</h2>
            <p id="bm-shop-tab-description">지금 필요한 무료 보상, 재화, 편의 아이템, 성장/계약을 한 곳에서 확인합니다.</p>
          </div>
          <button id="bm-contract-shop-close-button" class="bm-contract-shop-close bm-shop-close-image" type="button" aria-label="상점 닫기">
            <img src="${BM_ASSETS.buttons.close}" alt="" aria-hidden="true" />
            <span>닫기</span>
          </button>
        </div>

        <div class="bm-shop-modern-wallet" aria-label="보유 재화">
          <span id="bm-contract-shop-gold" class="bm-wallet-pill"></span>
          <span id="bm-contract-shop-diamond" class="bm-wallet-pill"></span>
          <span id="bm-contract-shop-adskip" class="bm-wallet-pill"></span>
          <span id="bm-contract-shop-peakcoupon" class="bm-wallet-pill"></span>
        </div>

        <div class="bm-shop-modern-layout">
          <nav class="bm-shop-tabs bm-shop-modern-tabs" role="tablist" aria-label="상점 탭">
            <button class="bm-shop-tab-button" type="button" data-tab="recommend">추천</button>
            <button class="bm-shop-tab-button" type="button" data-tab="free">무료충전</button>
            <button class="bm-shop-tab-button" type="button" data-tab="charge">재화충전</button>
            <button class="bm-shop-tab-button" type="button" data-tab="convenience">편의상품</button>
            <button class="bm-shop-tab-button" type="button" data-tab="growth">성장/계약</button>
          </nav>

          <div class="bm-shop-modern-body">
            <div id="bm-contract-shop-list" class="bm-contract-shop-list bm-shop-tab-panel"></div>
            <aside class="bm-shop-modern-guide" aria-label="상점 이용 안내">
              <strong id="bm-shop-guide-title">추천</strong>
              <span id="bm-shop-guide-copy">오늘 바로 받을 수 있는 보상과 막힌 진행을 풀어주는 항목을 먼저 보여줍니다.</span>
              <p id="bm-contract-shop-next" class="bm-contract-shop-next"></p>
            </aside>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.bmContractShopModal = modal;
    this.bindBMContractShopStaticButtons();
    this.prepareUiImageButtons(modal);
  },

  bindBMContractShopStaticButtons() {
    const closeButton = document.getElementById("bm-contract-shop-close-button");

    if (closeButton) {
      closeButton.onclick = () => {
        this.hideBMContractShopModal();
      };
    }
  },

  showBMContractShopModal() {
    if (!this.bmContractShopModal) {
      this.createBMContractShopModal();
    }

    this.renderBMContractShopModal();
    this.bmContractShopModal.classList.remove("hidden");
  },

  hideBMContractShopModal() {
    if (!this.bmContractShopModal) return;

    this.bmContractShopModal.classList.add("hidden");
  },

  requestBMContractShopRender() {
    if (!this.bmContractShopModal || this.bmContractShopModal.classList.contains("hidden")) return;

    const scheduleFrame = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    const cancelFrame = typeof cancelAnimationFrame === "function"
      ? cancelAnimationFrame
      : clearTimeout;

    if (this.bmShopRenderRafId) {
      cancelFrame(this.bmShopRenderRafId);
    }

    this.bmShopRenderRafId = scheduleFrame(() => {
      this.bmShopRenderRafId = null;
      this.renderBMContractShopModal();
    });
  },

  renderBMContractShopModal() {
    if (!this.bmContractShopModal) return;

    const goldNode = document.getElementById("bm-contract-shop-gold");
    const diamondNode = document.getElementById("bm-contract-shop-diamond");
    const adSkipNode = document.getElementById("bm-contract-shop-adskip");
    const peakCouponNode = document.getElementById("bm-contract-shop-peakcoupon");
    const listNode = document.getElementById("bm-contract-shop-list");
    const nextNode = document.getElementById("bm-contract-shop-next");
    const guideTitleNode = document.getElementById("bm-shop-guide-title");
    const guideCopyNode = document.getElementById("bm-shop-guide-copy");
    const tabDescriptionNode = document.getElementById("bm-shop-tab-description");

    if (!listNode) return;

    const bmState = BMSystem.getBMState();
    const nextProducts = BMSystem.getNextContractUnlockProducts();

    this.setElementInnerHTMLIfChanged(goldNode, this.createBMWalletPillMarkup(BM_ASSETS.currency.gold, "골드", GameState.money));
    this.setElementInnerHTMLIfChanged(diamondNode, this.createBMWalletPillMarkup(BM_ASSETS.currency.diamond, "다이아", bmState.diamond));
    this.setElementInnerHTMLIfChanged(adSkipNode, this.createBMWalletPillMarkup(BM_ASSETS.items.adSkipTicket, "광고 스킵권", bmState.adSkipTickets || 0));
    this.setElementInnerHTMLIfChanged(peakCouponNode, this.createBMWalletPillMarkup(BM_ASSETS.coupons.peakTime, "피크타임 쿠폰", bmState.peakTimeCoupons || 0));

    const validTabs = new Set(["recommend", "free", "charge", "convenience", "growth"]);
    if (!validTabs.has(this.bmShopActiveTab)) this.bmShopActiveTab = "recommend";

    document.querySelectorAll(".bm-shop-tab-button").forEach((button) => {
      const isActive = button.dataset.tab === this.bmShopActiveTab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.onclick = () => {
        this.bmShopActiveTab = button.dataset.tab || "recommend";
        this.renderBMContractShopModal();
      };
    });

    let shopListMarkup = "";
    if (this.bmShopActiveTab === "free") {
      shopListMarkup = this.createBMFreeChargeTabMarkup();
    } else if (this.bmShopActiveTab === "charge") {
      shopListMarkup = this.createBMCurrencyChargeTabMarkup();
    } else if (this.bmShopActiveTab === "convenience") {
      shopListMarkup = this.createBMConvenienceTabMarkup();
    } else if (this.bmShopActiveTab === "growth") {
      shopListMarkup = this.createBMGrowthContractTabMarkup();
    } else {
      this.bmShopActiveTab = "recommend";
      shopListMarkup = this.createBMRecommendTabMarkup();
    }
    this.setElementInnerHTMLIfChanged(listNode, shopListMarkup);

    if (guideTitleNode) guideTitleNode.textContent = this.getBMShopTabLabel(this.bmShopActiveTab);
    if (guideCopyNode) guideCopyNode.textContent = this.getBMShopTabDescription(this.bmShopActiveTab);
    if (tabDescriptionNode) tabDescriptionNode.textContent = this.getBMShopTabDescription(this.bmShopActiveTab);

    if (nextNode) {
      nextNode.textContent = nextProducts.length > 0
        ? `다음 해금 예정: ${nextProducts.map((product) => BMSystem.getProductDisplayName(product)).join(", ")}`
        : "모든 일반 상품 판매권이 상점에 해금되었습니다.";
    }

    this.bindBMShopDynamicButtons();
    this.prepareUiImageButtons(listNode);
  },

  createBMWalletPillMarkup(iconPath, label, value) {
    const amount = Number(value || 0).toLocaleString("ko-KR");
    return `
      <img class="bm-wallet-icon" src="${iconPath}" alt="" aria-hidden="true" loading="eager" decoding="async" />
      <span>${label}</span>
      <strong>${amount}</strong>
    `;
  },

  getBMShopTabLabel(tabId) {
    const labels = {
      recommend: "추천",
      free: "무료충전",
      charge: "재화충전",
      convenience: "편의상품",
      growth: "성장/계약"
    };
    return labels[tabId] ?? "추천";
  },

  getBMShopTabDescription(tabId) {
    const descriptions = {
      recommend: "무료 보상, 진행 보조 아이템, 다음 해금 상품을 한 번에 정리해 보여줍니다.",
      free: "무료로 받을 수 있는 광고 보상을 카드로 확인합니다.",
      charge: "다이아와 골드를 나눠서 충전합니다.",
      convenience: "스킵권, 쿠폰, 자동 사용 아이템을 기능별로 나눠 확인합니다.",
      growth: "상품 계약과 강화 항목을 세부 메뉴로 나눠 관리합니다."
    };
    return descriptions[tabId] ?? descriptions.recommend;
  },

  getBMShopActiveSubTab(tabId, fallback) {
    if (!this.bmShopActiveSubTabs) this.bmShopActiveSubTabs = {};
    if (!this.bmShopActiveSubTabs[tabId]) this.bmShopActiveSubTabs[tabId] = fallback;
    return this.bmShopActiveSubTabs[tabId];
  },

  setBMShopActiveSubTab(tabId, subTabId) {
    if (!this.bmShopActiveSubTabs) this.bmShopActiveSubTabs = {};
    this.bmShopActiveSubTabs[tabId] = subTabId;
  },

  createBMShopSubTabNavMarkup(tabId, items = [], activeSubTab) {
    if (!items.length) return "";

    return `
      <nav class="bm-shop-subtabs" aria-label="${this.getBMShopTabLabel(tabId)} 세부 분류">
        ${items.map((item) => `
          <button class="bm-shop-subtab-button ${item.id === activeSubTab ? "is-active" : ""}" type="button" data-main-tab="${tabId}" data-sub-tab="${item.id}" aria-selected="${item.id === activeSubTab ? "true" : "false"}">
            <span>${item.label}</span>
            ${Number.isFinite(item.count) ? `<strong>${item.count}</strong>` : ""}
          </button>
        `).join("")}
      </nav>
    `;
  },

  createBMShopSubTabIntroMarkup(title, description = "") {
    return `
      <div class="bm-shop-subtab-intro">
        <strong>${title}</strong>
        ${description ? `<span>${description}</span>` : ""}
      </div>
    `;
  },

  createBMShopEmptyCardMarkup(title, description = "") {
    return `
      <article class="bm-contract-shop-card bm-shop-info-card bm-shop-empty-card">
        <div class="bm-contract-product-copy">
          <strong>${title}</strong>
          ${description ? `<span>${description}</span>` : ""}
        </div>
      </article>
    `;
  },

  createBMAssetImageMarkup(src, alt = "", className = "bm-shop-card-icon") {
    if (!src) return "";
    return `<img class="${className}" src="${src}" alt="${alt}" loading="eager" decoding="async" />`;
  },

  setElementInnerHTMLIfChanged(node, html = "") {
    if (!node || node.innerHTML === html) return;
    node.innerHTML = html;
  },

  getBMAdRewardIconPath(reward = {}) {
    if (reward.rewardType === "diamond") return BM_ASSETS.freeCharge.diamondRewardIcon;
    if (reward.rewardType === "gold") return BM_ASSETS.freeCharge.goldRewardIcon;
    if (reward.rewardType === "peakCouponDiscount") return BM_ASSETS.freeCharge.peakCouponDiscountIcon;
    return BM_ASSETS.rewardIcons.adReward;
  },

  getBMDiamondProductImagePath(product = {}) {
    const productIds = BMSystem.getDiamondProducts().map((item) => item.id);
    const index = Math.max(0, productIds.indexOf(product.id));
    const paths = [
      BM_ASSETS.packs.diamond01,
      BM_ASSETS.packs.diamond02,
      BM_ASSETS.packs.diamond03,
      BM_ASSETS.packs.diamond04,
      BM_ASSETS.packs.diamond05
    ];
    return paths[index] ?? paths[0];
  },

  getBMGoldProductImagePath(product = {}) {
    const productIds = BMSystem.getGoldProducts().map((item) => item.id);
    const index = Math.max(0, productIds.indexOf(product.id));
    const paths = [
      BM_ASSETS.packs.goldSmall,
      BM_ASSETS.packs.goldMedium,
      BM_ASSETS.packs.goldLarge
    ];
    return paths[index] ?? paths[0];
  },

  getBMShelfUpgradeImagePath(group = {}) {
    const shelfImageMap = {
      basic_shelf: "./assets/objects/display_stand/display_stand_full_left.png",
      fresh_shelf: "./assets/objects/fresh_shelf/fresh_shelf_full_left.png",
      fridge: "./assets/objects/beverage_fridge/beverage_fridge_full_left.png",
      warmer: "./assets/objects/food_warmer/food_warmer_full_left.png"
    };
    return shelfImageMap[group.id] ?? BM_ASSETS.upgrades.shelf.capacity;
  },

  getBMDiscountLabelPath(rate = 0) {
    const discountMap = {
      5: BM_ASSETS.labels.discount05,
      10: BM_ASSETS.labels.discount10,
      15: BM_ASSETS.labels.discount15,
      50: BM_ASSETS.labels.discount50
    };
    return discountMap[Number(rate)] ?? null;
  },

  getMentalRecoveryAssetPath(upgrade = {}) {
    if (upgrade.id === "mental_breath" || upgrade.costType === "free") return BM_ASSETS.mental.freeRecovery;
    if (upgrade.id === "mental_coffee" || upgrade.costType === "gold") return BM_ASSETS.mental.goldRecovery;
    if (upgrade.id === "mental_special_rest" || upgrade.costType === "diamond") return BM_ASSETS.mental.diamondRecovery;
    return BM_ASSETS.mental.recovery;
  },

  createBMRecommendTabMarkup() {
    const adRewards = BMSystem.getAdRewards();
    const bmState = BMSystem.getBMState();
    const firstClaimableReward = adRewards.find((reward) => reward.canClaim) ?? adRewards[0];
    const nextProducts = BMSystem.getNextContractUnlockProducts();
    const contractPreview = nextProducts.slice(0, 2).map((product) => this.createBMContractPreviewMarkup(product)).join("");

    return `
      <section class="bm-shop-section bm-shop-recommend-landing bm-shop-dashboard-section">
        <div class="bm-shop-card-grid bm-shop-recommend-grid bm-shop-recommend-actions">
          <article class="bm-contract-shop-card bm-shop-action-card bm-free-recharge-card ${firstClaimableReward?.isClaimed ? "is-owned" : "is-purchasable"}">
            ${this.createBMAssetImageMarkup(this.getBMAdRewardIconPath(firstClaimableReward), firstClaimableReward?.name ?? "무료 보상")}
            <div class="bm-contract-product-copy">
              <strong>${firstClaimableReward?.name ?? "무료 보상"}</strong>
              <span>${firstClaimableReward?.label ?? "오늘 보상"}</span>
              <em>${firstClaimableReward?.isClaimed ? "오늘 수령 완료" : "무료충전에서 받기"}</em>
            </div>
            <button class="bm-ad-reward-button" type="button" data-reward-id="${firstClaimableReward?.id ?? ""}" ${firstClaimableReward?.canClaim ? "" : "disabled"}>${firstClaimableReward?.buttonText ?? "받기"}</button>
          </article>
          ${this.createBMContractSkipPanelMarkup(bmState.contractUnlockSkip)}
          ${this.createBMPeakCouponPanelMarkup(bmState.peakCoupon)}
        </div>

        <section class="bm-shop-section bm-shop-recommend-section bm-shop-next-contract-section">
          <div class="bm-shop-recommend-products">
            ${contractPreview || this.createBMShopEmptyCardMarkup("해금 대기 상품 없음", "현재 모든 판매권이 상점에 열려 있습니다.")}
          </div>
        </section>
      </section>
    `;
  },

  createBMFreeChargeTabMarkup() {
    const adRewards = BMSystem.getAdRewards();
    const activeSubTab = this.getBMShopActiveSubTab("free", "ad");
    const subtabs = [
      { id: "ad", label: "광고 보상", count: adRewards.length }
    ];

    return `
      <section class="bm-shop-section bm-free-charge-panel-section">
        ${this.createBMShopSubTabNavMarkup("free", subtabs, activeSubTab)}
        ${this.createBMShopSubTabIntroMarkup("광고 보상", "하루에 받을 수 있는 무료 보상만 모았습니다.")}
        <div class="bm-shop-card-grid bm-shop-free-grid">
          ${adRewards.map((reward) => `
            <article class="bm-contract-shop-card bm-shop-action-card bm-free-recharge-card ${reward.isClaimed ? "is-owned" : "is-purchasable"}">
              ${this.createBMAssetImageMarkup(this.getBMAdRewardIconPath(reward), reward.name)}
              <div class="bm-contract-product-copy">
                <strong>${reward.name}</strong>
                <span>${reward.label}</span>
                <em>${reward.isClaimed ? "오늘 수령 완료" : reward.usesSkipTicket ? "스킵권 사용 가능" : "보상 받기"}</em>
              </div>
              <button class="bm-ad-reward-button" type="button" data-reward-id="${reward.id}" ${reward.canClaim ? "" : "disabled"}>${reward.buttonText}</button>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  },

  createBMCurrencyChargeTabMarkup() {
    const diamondProducts = BMSystem.getDiamondProducts();
    const goldProducts = BMSystem.getGoldProducts();
    const activeSubTab = this.getBMShopActiveSubTab("charge", "diamond");
    const subtabs = [
      { id: "diamond", label: "다이아", count: diamondProducts.length },
      { id: "gold", label: "골드", count: goldProducts.length }
    ];

    const diamondMarkup = `
      ${this.createBMShopSubTabIntroMarkup("다이아 충전", "상품 구매와 빠른 진행에 쓰는 프리미엄 재화입니다.")}
      <div class="bm-shop-card-grid bm-currency-product-grid">
        ${diamondProducts.map((product) => {
          const discountLabel = this.getBMDiscountLabelPath(product.discountRate);
          return `
            <article class="bm-contract-shop-card bm-shop-action-card bm-currency-card is-purchasable">
              ${this.createBMAssetImageMarkup(this.getBMDiamondProductImagePath(product), product.name)}
              <div class="bm-contract-product-copy">
                <strong>${product.name}</strong>
                <span>${product.priceWon.toLocaleString("ko-KR")}원 테스트 구매</span>
                <em>${product.discountRate > 0 ? `${product.discountRate}% 할인` : "기본 상품"}</em>
              </div>
              ${discountLabel ? this.createBMAssetImageMarkup(discountLabel, `${product.discountRate}% 할인`, "bm-shop-card-label") : ""}
              <button class="bm-diamond-product-button" type="button" data-product-id="${product.id}">구매</button>
            </article>
          `;
        }).join("")}
      </div>
    `;

    const goldMarkup = `
      ${this.createBMShopSubTabIntroMarkup("골드 충전", "발주, 계약, 강화에 쓰는 기본 재화입니다.")}
      <div class="bm-shop-card-grid bm-currency-product-grid">
        ${goldProducts.map((product) => {
          const canBuy = BMSystem.getBMState().diamond >= product.diamondPrice;
          return `
            <article class="bm-contract-shop-card bm-shop-action-card bm-currency-card ${canBuy ? "is-purchasable" : "is-not-enough-diamond"}">
              ${this.createBMAssetImageMarkup(this.getBMGoldProductImagePath(product), product.name)}
              <div class="bm-contract-product-copy">
                <strong>${product.name}</strong>
                <span>${product.goldAmount.toLocaleString("ko-KR")}골드 지급</span>
                <em>${product.diamondPrice.toLocaleString("ko-KR")}다이아</em>
              </div>
              <button class="bm-gold-product-button" type="button" data-product-id="${product.id}" ${canBuy ? "" : "disabled"}>구매</button>
            </article>
          `;
        }).join("")}
      </div>
    `;

    return `
      <section class="bm-shop-section bm-currency-charge-section">
        ${this.createBMShopSubTabNavMarkup("charge", subtabs, activeSubTab)}
        ${activeSubTab === "gold" ? goldMarkup : diamondMarkup}
      </section>
    `;
  },

  createBMChargeTabMarkup() {
    return this.createBMCurrencyChargeTabMarkup();
  },

  createBMDailyMissionPanelMarkup(state = {}) {
    const missions = Array.isArray(state.missions) ? state.missions : [];
    const rewards = Array.isArray(state.rewards) ? state.rewards : [];

    return `
      <section class="bm-shop-section bm-daily-mission-panel">
        <h3>오늘의 일일 미션</h3>
        <p class="bm-shop-section-note">오늘의 미션을 완료하고 단계별 보상을 받을 수 있습니다.</p>
        <div class="bm-daily-mission-list">
          ${missions.map((mission) => `
            <article class="bm-daily-mission-card ${mission.isComplete ? "is-complete" : ""}">
              <strong>${mission.title}</strong>
              <span>${mission.description}</span>
              <em>${mission.progressText}</em>
            </article>
          `).join("")}
        </div>
        <div class="bm-daily-mission-rewards">
          ${rewards.map((reward) => `
            <button class="bm-daily-mission-reward-button" type="button" data-count="${reward.count}" ${reward.canClaim ? "" : "disabled"}>
              ${reward.count}개 완료 · ${reward.label}${reward.isClaimed ? " ✓" : ""}
            </button>
          `).join("")}
        </div>
      </section>
    `;
  },

  createBMConvenienceTabMarkup() {
    const bmState = BMSystem.getBMState();
    const activeSubTab = this.getBMShopActiveSubTab("convenience", "skip");
    const subtabs = [
      { id: "skip", label: "스킵권", count: 1 },
      { id: "coupon", label: "쿠폰", count: 1 },
      { id: "utility", label: "보유/기타", count: 2 }
    ];

    const skipMarkup = `
      ${this.createBMShopSubTabIntroMarkup("스킵권", "판매권 대기 시간을 줄여 진행 막힘을 풀어줍니다.")}
      <div class="bm-shop-card-grid bm-convenience-item-grid">
        ${this.createBMContractSkipPanelMarkup(bmState.contractUnlockSkip)}
      </div>
    `;

    const couponMarkup = `
      ${this.createBMShopSubTabIntroMarkup("쿠폰", "영업 중 매출을 높이는 일시 효과 아이템입니다.")}
      <div class="bm-shop-card-grid bm-convenience-item-grid">
        ${this.createBMPeakCouponPanelMarkup(bmState.peakCoupon)}
      </div>
    `;

    const utilityMarkup = `
      ${this.createBMShopSubTabIntroMarkup("보유/기타", "자동 사용되거나 다른 화면에서 쓰는 편의 아이템입니다.")}
      <div class="bm-shop-card-grid bm-convenience-item-grid">
        <article class="bm-contract-shop-card bm-tool-card bm-shop-inventory-card">
          ${this.createBMAssetImageMarkup(BM_ASSETS.items.adSkipTicket, "광고 스킵권")}
          <div class="bm-contract-product-copy">
            <strong>광고 스킵권</strong>
            <span>보유 ${Number(bmState.adSkipTickets || 0).toLocaleString("ko-KR")}장</span>
            <em>무료충전 보상 수령 시 자동 사용</em>
          </div>
        </article>
        <article class="bm-contract-shop-card bm-tool-card bm-shop-inventory-card">
          ${this.createBMAssetImageMarkup(BM_ASSETS.items.instantExpansion, "즉시 확장권")}
          <div class="bm-contract-product-copy">
            <strong>즉시 확장</strong>
            <span>매장 확장 대기 시간을 줄입니다.</span>
            <em>확장 구역 팝오버에서 사용</em>
          </div>
        </article>
      </div>
    `;

    return `
      <section class="bm-shop-section bm-convenience-tools-section">
        ${this.createBMShopSubTabNavMarkup("convenience", subtabs, activeSubTab)}
        ${activeSubTab === "coupon" ? couponMarkup : activeSubTab === "utility" ? utilityMarkup : skipMarkup}
      </section>
    `;
  },

  createBMGrowthContractTabMarkup() {
    const bmState = BMSystem.getBMState();
    const contractProducts = BMSystem.getContractUnlockQueue();
    const premiumProducts = BMSystem.getPremiumProducts();
    const warehouseState = BMSystem.getWarehouseUpgradeState();
    const shelfGroups = BMSystem.getShelfGroups();
    const productUpgradeProducts = PRODUCTS.filter((product) => BMSystem.canSellProduct(product.id));
    const activeSubTab = this.getBMShopActiveSubTab("growth", "overview");
    const subtabs = [
      { id: "overview", label: "운영 성장", count: 2 },
      { id: "contract", label: "상품 계약", count: contractProducts.length },
      { id: "premium", label: "프리미엄", count: premiumProducts.length },
      { id: "shelf", label: "진열대", count: shelfGroups.length },
      { id: "product", label: "상품 강화", count: productUpgradeProducts.length }
    ];

    const overviewMarkup = `
      ${this.createBMShopSubTabIntroMarkup("운영 성장", "창고와 알바처럼 전체 운영 효율을 올리는 항목입니다.")}
      <div class="bm-shop-card-grid bm-growth-overview-grid">
        ${this.createBMWarehouseUpgradeMarkup(warehouseState)}
        ${this.createBMStaffUpgradeMarkup(bmState.staffAbilityUpgrade)}
      </div>
    `;

    const contractMarkup = `
      ${this.createBMShopSubTabIntroMarkup("상품 계약", "판매권을 구매한 상품만 발주와 판매가 가능합니다.")}
      <div class="bm-shop-card-grid bm-contract-product-grid">
        ${contractProducts.map((product) => this.createBMContractProductCardMarkup(product)).join("") || this.createBMShopEmptyCardMarkup("계약 가능한 상품 없음", "현재 표시할 상품 판매권이 없습니다.")}
      </div>
    `;

    const premiumMarkup = `
      ${this.createBMShopSubTabIntroMarkup("프리미엄 상품", "다이아로 구매하는 특별 판매 상품입니다.")}
      <div class="bm-shop-card-grid bm-premium-product-grid">
        ${premiumProducts.map((product) => this.createBMPremiumProductCardMarkup(product)).join("") || this.createBMShopEmptyCardMarkup("프리미엄 상품 없음", "현재 표시할 프리미엄 상품이 없습니다.")}
      </div>
    `;

    const shelfMarkup = `
      ${this.createBMShopSubTabIntroMarkup("진열대 강화", "진열 가능한 수량을 늘려 보충 부담을 줄입니다.")}
      <div class="bm-shop-card-grid bm-shelf-upgrade-grid">
        ${shelfGroups.map((group) => `
          <article class="bm-contract-shop-card bm-shop-action-card bm-upgrade-card">
            ${this.createBMAssetImageMarkup(this.getBMShelfUpgradeImagePath(group), `${group.name}`)}
            <div class="bm-contract-product-copy">
              <strong>${group.name}</strong>
              <span>Lv.${group.current.level} · ${group.current.capacity}개 진열</span>
              <em>${group.next ? `다음 ${group.next.capacity}개 / ${group.next.costGold.toLocaleString("ko-KR")}골드` : "최대 강화"}</em>
            </div>
            <button class="bm-shelf-upgrade-button" type="button" data-shelf-group-id="${group.id}" data-shelf-id="${group.shelfId ?? ""}" ${group.next && group.canUpgrade ? "" : "disabled"}>강화</button>
          </article>
        `).join("")}
      </div>
    `;

    const productMarkup = `
      ${this.createBMShopSubTabIntroMarkup("상품별 강화", "판매 중인 상품의 판매가를 관리합니다.")}
      <div class="bm-shop-card-grid bm-product-upgrade-grid">
        ${productUpgradeProducts.map((product) => this.createBMProductUpgradeCardMarkup(product)).join("") || this.createBMShopEmptyCardMarkup("강화 가능한 상품 없음", "판매권을 보유한 상품이 생기면 여기에 표시됩니다.")}
      </div>
    `;

    const panels = {
      overview: overviewMarkup,
      contract: contractMarkup,
      premium: premiumMarkup,
      shelf: shelfMarkup,
      product: productMarkup
    };

    return `
      <section class="bm-shop-section bm-growth-contract-section">
        ${this.createBMShopSubTabNavMarkup("growth", subtabs, activeSubTab)}
        ${panels[activeSubTab] ?? overviewMarkup}
      </section>
    `;
  },

  createBMContractPreviewMarkup(product) {
    const displayName = BMSystem.getProductDisplayName(product);
    return `
      <article class="bm-contract-shop-card bm-shop-action-card bm-contract-preview-card">
        <span class="bm-contract-product-image-box">
          <img class="bm-contract-product-image" src="${BM_ASSETS.productLicense.wait}" alt="${displayName} 판매권 대기" loading="eager" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" />
          <span class="bm-contract-product-fallback" hidden>${this.getProductFallbackIcon(product)}</span>
        </span>
        <div class="bm-contract-product-copy">
          <strong>${displayName}</strong>
          <span>${this.getDisplayCategoryLabel(product.displayCategory)}</span>
          <em>Day ${product.unlockDay} 판매권 해금 예정</em>
        </div>
      </article>
    `;
  },

  createBMPremiumTabMarkup() {
    const premiumProducts = BMSystem.getPremiumProducts();

    return `
      <section class="bm-shop-section bm-premium-shop-section">
        <h3>프리미엄 상품</h3>
        <p class="bm-shop-section-note">프리미엄 BM 상품도 해당 구역이 열려 있어야 판매할 수 있습니다.</p>
        <div class="bm-shop-card-list">
          ${premiumProducts.map((product) => this.createBMPremiumProductCardMarkup(product)).join("")}
        </div>
      </section>
    `;
  },

  createBMContractSkipPanelMarkup(skipState = {}) {
    const nextNames = Array.isArray(skipState.nextProducts)
      ? skipState.nextProducts.map((product) => product?.productName).filter(Boolean)
      : [];
    const nextText = nextNames.length > 0 ? nextNames.join(", ") : "해금 대기 상품 없음";

    return `
      <article class="bm-contract-shop-card bm-tool-card bm-skip-ticket-card">
        ${this.createBMAssetImageMarkup(BM_ASSETS.items.skip3Day, "3일 해금 대기 스킵권")}
        <div class="bm-contract-product-copy">
          <strong>판매권 해금 대기일 스킵권</strong>
          <span>다음 판매권 2종을 상점에 즉시 해금합니다.</span>
          <em>다음 대상: ${nextText}</em>
          <small>${skipState.message ?? ""}</small>
        </div>
        <button id="bm-contract-skip-button" class="bm-contract-skip-button" type="button" ${skipState.canUse ? "" : "disabled"}>50다이아 사용</button>
      </article>
    `;
  },

  createBMPeakCouponPanelMarkup(peakState = {}) {
    const price = Number(peakState.purchasePriceDiamond ?? 20);
    const owned = Number(peakState.ownedCount ?? 0);
    const discountText = peakState.discountActive ? "광고 할인 적용 중: 10다이아" : "기본 가격 20다이아";

    return `
      <article class="bm-contract-shop-card bm-tool-card bm-peak-coupon-card">
        ${this.createBMAssetImageMarkup(BM_ASSETS.coupons.peakTime, "피크타임 쿠폰")}
        <div class="bm-contract-product-copy">
          <strong>피크타임 쿠폰</strong>
          <span>보유 ${owned}장 · 60초 동안 매출 1.5배 · 하루 1회</span>
          <em>${discountText}</em>
          <small>${peakState.message ?? ""}</small>
        </div>
        <div class="bm-tool-actions">
          <button id="bm-peak-coupon-purchase-button" class="bm-peak-coupon-button" type="button">${price}다이아 구매</button>
          <button id="bm-peak-coupon-use-button" class="bm-peak-coupon-button" type="button" ${peakState.canUse ? "" : "disabled"}>사용</button>
        </div>
      </article>
    `;
  },

  createBMWarehouseUpgradeMarkup(warehouseState = {}) {
    const current = warehouseState.current ?? { level: 0, capacity: 60 };
    const next = warehouseState.next ?? null;
    const pending = warehouseState.pending ?? null;
    const buttonDisabled = !next || pending || !warehouseState.canUpgrade;

    return `
      <article class="bm-contract-shop-card bm-tool-card bm-storage-upgrade-card">
        ${this.createBMAssetImageMarkup(BM_ASSETS.upgrades.storage.expansion, "창고 확장")}
        <div class="bm-contract-product-copy">
          <strong>창고 확장</strong>
          <span>Lv.${current.level} · 보관 가능 수량 ${current.capacity}개</span>
          <em>${pending ? `Lv.${pending.targetLevel} 확장 진행 중 · Day ${pending.completeDay} 완료` : next ? `다음 Lv.${next.level}: ${next.capacity}개 / ${next.costGold.toLocaleString("ko-KR")}골드` : "최대 확장"}</em>
        </div>
        <button id="bm-warehouse-upgrade-button" type="button" ${buttonDisabled ? "disabled" : ""}>확장</button>
      </article>
    `;
  },

  createBMStaffUpgradeMarkup(state = {}) {
    const abilities = state.abilities ?? {};
    const canUpgrade = state.canUpgrade === true;
    const labels = [
      ["warehouse", "창고"],
      ["shelf", "진열대"],
      ["cleaning", "청소"]
    ];

    return `
      <article class="bm-contract-shop-card bm-tool-card bm-staff-upgrade-card">
        ${this.createBMAssetImageMarkup(BM_ASSETS.staff.upgrade, "알바 강화")}
        <div class="bm-contract-product-copy">
          <strong>알바 강화권</strong>
          <span>80다이아 · 원하는 분야 1칸 강화 · 총 ${state.totalCount ?? 0}/${state.maxTotal ?? 5}</span>
          <small>강화한 분야의 창고/진열/청소 작업 시간이 짧아집니다.</small>
          <em>${canUpgrade ? "강화 가능" : GameState.staff?.hired ? `다음 가능 Day ${state.nextAvailableDay ?? "-"}` : "고용된 알바 필요"}</em>
        </div>
        <div class="bm-tool-actions bm-staff-upgrade-actions">
          ${labels.map(([key, label]) => `
            <button class="bm-staff-upgrade-button" type="button" data-ability-key="${key}" ${canUpgrade ? "" : "disabled"}>${label} +1 (${Number(abilities[key] || 0)})</button>
          `).join("")}
        </div>
      </article>
    `;
  },

  createBMContractProductCardMarkup(product) {
    const status = this.getBMContractShopItemStatus(product);
    const contractCost = Number(product.contractCost) || 0;
    const displayName = BMSystem.getProductDisplayName(product);

    return `
      <article class="bm-contract-shop-card ${status.className}" data-product-id="${product.id}">
        <div class="bm-contract-product-main">
          <span class="bm-contract-product-image-box bm-contract-product-license-box">
            <img class="bm-contract-product-image" src="${product.imagePath}" alt="${displayName}" loading="eager" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" />
            <img class="bm-contract-license-badge" src="${BM_ASSETS.productLicense.license}" alt="" aria-hidden="true" loading="eager" decoding="async" />
            <span class="bm-contract-product-fallback" hidden>${this.getProductFallbackIcon(product)}</span>
          </span>
          <div class="bm-contract-product-copy">
            <strong>${displayName}</strong>
            <em>${status.message}</em>
          </div>
        </div>
        <div class="bm-contract-product-meta">
          <span>${this.getDisplayCategoryLabel(product.displayCategory)}</span>
          <span>판매가 ${BMSystem.getProductSalePrice(product.id).toLocaleString("ko-KR")}골드</span>
          <span>판매권 ${contractCost.toLocaleString("ko-KR")}골드</span>
        </div>
        <button class="bm-contract-purchase-button" type="button" data-product-id="${product.id}" ${status.canPurchase ? "" : "disabled"}>${status.buttonText}</button>
      </article>
    `;
  },

  createBMProductUpgradeCardMarkup(product) {
    const state = BMSystem.getProductUpgradeState(product?.id);

    if (!state) {
      return this.createBMShopEmptyCardMarkup("강화 정보 없음", "상품 강화 정보를 불러올 수 없습니다.");
    }

    const displayName = state.displayName || BMSystem.getProductDisplayName(product);
    const currentLevel = Math.max(0, Math.floor(Number(state.level) || 0));
    const nextLevel = state.nextLevel ? Math.max(0, Math.floor(Number(state.nextLevel) || 0)) : null;
    const currentPrice = Math.max(0, Math.floor(Number(state.currentPrice) || 0));
    const nextPrice = Math.max(0, Math.floor(Number(state.nextPrice) || currentPrice));
    const nextCost = Math.max(0, Math.floor(Number(state.nextCost) || 0));
    const isMaxLevel = !nextLevel || currentLevel >= 5;
    const canUpgrade = state.canUpgrade === true && !isMaxLevel;
    const isSellable = BMSystem.canSellProduct(product.id);
    const statusMessage = isMaxLevel
      ? "최대 강화 완료"
      : !isSellable
        ? "판매권/구역 해금 필요"
        : canUpgrade
          ? `Lv.${nextLevel} 강화 가능`
          : `골드 부족 · 필요 ${nextCost.toLocaleString("ko-KR")}골드`;
    const buttonText = isMaxLevel
      ? "최대 강화"
      : canUpgrade
        ? `${nextCost.toLocaleString("ko-KR")}골드 강화`
        : "강화 불가";

    return `
      <article class="bm-contract-shop-card bm-product-upgrade-card ${canUpgrade ? "is-upgradable" : "is-disabled"}" data-product-id="${product.id}">
        <div class="bm-contract-product-main">
          <span class="bm-contract-product-image-box">
            <img class="bm-contract-product-image" src="${product.imagePath}" alt="${displayName}" loading="eager" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" />
            <span class="bm-contract-product-fallback" hidden>${this.getProductFallbackIcon(product)}</span>
          </span>
          <div class="bm-contract-product-copy">
            <strong>${displayName}</strong>
            <span>${state.typeLabel ?? "일반"} · Lv.${currentLevel}/5</span>
            <em>${statusMessage}</em>
          </div>
        </div>
        <div class="bm-contract-product-meta">
          <span>${this.getDisplayCategoryLabel(product.displayCategory)}</span>
          <span>현재 ${currentPrice.toLocaleString("ko-KR")}골드</span>
          <span>${isMaxLevel ? "강화 완료" : `다음 ${nextPrice.toLocaleString("ko-KR")}골드`}</span>
        </div>
        <button class="bm-product-upgrade-button" type="button" data-product-id="${product.id}" ${canUpgrade ? "" : "disabled"}>${buttonText}</button>
      </article>
    `;
  },

  createBMPremiumProductCardMarkup(product) {
    const status = this.getBMPremiumProductStatus(product);
    const diamondPrice = Number(product.diamondPrice) || 0;
    const displayName = BMSystem.getProductDisplayName(product);

    return `
      <article class="bm-contract-shop-card bm-premium-product-card ${status.className}" data-product-id="${product.id}">
        <div class="bm-contract-product-main">
          <span class="bm-contract-product-image-box">
            <img class="bm-contract-product-image" src="${product.imagePath}" alt="${displayName}" loading="eager" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;" />
            <span class="bm-contract-product-fallback" hidden>${this.getProductFallbackIcon(product)}</span>
          </span>
          <div class="bm-contract-product-copy">
            <strong>${displayName}</strong>
            <em>${status.message}</em>
          </div>
        </div>
        <div class="bm-contract-product-meta">
          <span>${this.getDisplayCategoryLabel(product.displayCategory)}</span>
          <span>판매가 ${BMSystem.getProductSalePrice(product.id).toLocaleString("ko-KR")}골드</span>
          <span>가격 ${diamondPrice.toLocaleString("ko-KR")}다이아</span>
        </div>
        <button class="bm-premium-purchase-button" type="button" data-product-id="${product.id}" ${status.canPurchase ? "" : "disabled"}>${status.buttonText}</button>
      </article>
    `;
  },

  bindBMShopSubTabButtons() {
    document.querySelectorAll(".bm-shop-subtab-button").forEach((button) => {
      button.onclick = () => {
        const mainTab = button.dataset.mainTab || this.bmShopActiveTab || "recommend";
        const subTab = button.dataset.subTab;
        if (!subTab) return;
        this.setBMShopActiveSubTab(mainTab, subTab);
        this.renderBMContractShopModal();
      };
    });
  },

  bindBMShopRouteButtons() {
    document.querySelectorAll(".bm-shop-route-button").forEach((button) => {
      button.onclick = () => {
        const targetTab = button.dataset.routeTab;
        if (!targetTab) return;
        this.bmShopActiveTab = targetTab;
        this.renderBMContractShopModal();
      };
    });
  },

  bindBMShopDynamicButtons() {
    this.bindBMShopSubTabButtons();
    this.bindBMShopRouteButtons();
    this.bindBMDailyMissionButtons();
    this.bindBMAdRewardButtons();
    this.bindBMCurrencyProductButtons();
    this.bindBMContractPurchaseButtons();
    this.bindBMPremiumPurchaseButtons();
    this.bindBMContractSkipButton();
    this.bindBMPeakCouponButtons();
    this.bindBMWarehouseUpgradeButton();
    this.bindBMShelfUpgradeButtons();
    this.bindBMProductUpgradeButtons();
    this.bindBMStaffUpgradeButtons();
  },

  bindBMDailyMissionButtons() {
    document.querySelectorAll(".bm-daily-mission-reward-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        DailyMissionSystem.claimReward(button.dataset.count);
      };
    });
  },

  bindBMAdRewardButtons() {
    document.querySelectorAll(".bm-ad-reward-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        EventBus.emit(BM_EVENTS.AD_REWARD_REQUESTED, { day: GameState.day, rewardId: button.dataset.rewardId });
      };
    });
  },

  bindBMCurrencyProductButtons() {
    document.querySelectorAll(".bm-diamond-product-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const product = BMSystem.getDiamondProducts().find((item) => item.id === button.dataset.productId);
        if (!product) {
          this.showMessage("존재하지 않는 다이아 상품입니다.");
          return;
        }

        this.showBMShopPurchaseConfirm({
          product: { ...product, imagePath: this.getBMDiamondProductImagePath(product) },
          priceText: `${product.priceWon.toLocaleString("ko-KR")}원 테스트 구매`,
          description: "실제 결제 SDK 없이 테스트로 다이아를 지급합니다.",
          confirmMessage: "해당 다이아 상품을 구매하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.DIAMOND_PRODUCT_PURCHASE_REQUESTED, { productId: button.dataset.productId });
        });
      };
    });

    document.querySelectorAll(".bm-gold-product-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const product = BMSystem.getGoldProducts().find((item) => item.id === button.dataset.productId);
        if (!product) {
          this.showMessage("존재하지 않는 골드 상품입니다.");
          return;
        }

        this.showBMShopPurchaseConfirm({
          product: { ...product, imagePath: this.getBMGoldProductImagePath(product) },
          priceText: `${product.diamondPrice.toLocaleString("ko-KR")}다이아`,
          description: `${product.goldAmount.toLocaleString("ko-KR")}골드를 충전합니다.`,
          confirmMessage: "해당 골드 상품을 구매하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.GOLD_PRODUCT_PURCHASE_REQUESTED, { productId: button.dataset.productId });
        });
      };
    });
  },

  getBMContractShopItemStatus(product) {
    const isShopUnlocked = BMSystem.isContractShopUnlocked(product.id);
    const isOwned = BMSystem.hasProductContract(product.id);
    const contractCost = Number(product.contractCost) || 0;
    const hasEnoughGold = GameState.money >= contractCost;

    if (isOwned) return { className: "is-owned", canPurchase: false, buttonText: "보유 중", message: "판매권 보유" };
    if (!isShopUnlocked) return { className: "is-locked", canPurchase: false, buttonText: "해금 대기", message: `Day ${product.unlockDay} 상점 해금 예정` };
    if (!hasEnoughGold) return { className: "is-not-enough-gold", canPurchase: false, buttonText: "골드 부족", message: `${contractCost.toLocaleString("ko-KR")}골드 필요` };
    return { className: "is-purchasable", canPurchase: true, buttonText: "구매", message: "판매권 구매 가능" };
  },

  bindBMContractPurchaseButtons() {
    document.querySelectorAll(".bm-contract-purchase-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const productId = button.dataset.productId;
        const product = BMSystem.getContractUnlockQueue().find((item) => item.id === productId);
        if (!product) {
          this.showMessage("존재하지 않는 판매권 상품입니다.");
          return;
        }

        this.showBMShopPurchaseConfirm({
          product: { ...product, imagePath: BM_ASSETS.productLicense.contract },
          priceText: `${(Number(product.contractCost) || 0).toLocaleString("ko-KR")}골드`,
          description: "판매권을 구매하면 해당 상품을 발주/판매할 수 있습니다. 구역 해금 조건은 별도로 필요합니다.",
          confirmMessage: "해당 상품 판매권을 구매하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.CONTRACT_PURCHASE_REQUESTED, { day: GameState.day, productId });
        });
      };
    });
  },

  getBMPremiumProductStatus(product) {
    const isPurchased = BMSystem.isPremiumProductPurchased(product.id);
    const isZoneUnlocked = BMSystem.isZoneUnlocked(product.requiredZoneId);
    const diamondPrice = Number(product.diamondPrice) || 0;
    const bmState = BMSystem.getBMState();
    const hasEnoughDiamond = bmState.diamond >= diamondPrice;

    if (isPurchased) return { className: "is-owned", canPurchase: false, buttonText: "보유 중", message: "프리미엄 상품 구매 완료" };
    if (!isZoneUnlocked) return { className: "is-locked", canPurchase: false, buttonText: "구역 필요", message: "상품이 배치된 구역 해금 필요" };
    if (!hasEnoughDiamond) return { className: "is-not-enough-diamond", canPurchase: false, buttonText: "다이아 부족", message: `${diamondPrice.toLocaleString("ko-KR")}다이아 필요` };
    return { className: "is-purchasable is-premium-purchasable", canPurchase: true, buttonText: "구매", message: "프리미엄 상품 구매 가능" };
  },

  bindBMPremiumPurchaseButtons() {
    document.querySelectorAll(".bm-premium-purchase-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const productId = button.dataset.productId;
        const product = BMSystem.getPremiumProducts().find((item) => item.id === productId);
        if (!product) {
          this.showMessage("존재하지 않는 프리미엄 상품입니다.");
          return;
        }

        this.showBMShopPurchaseConfirm({
          product,
          priceText: `${(Number(product.diamondPrice) || 0).toLocaleString("ko-KR")}다이아`,
          description: "프리미엄 상품을 구매하면 해당 상품의 판매 조건을 보유합니다.",
          confirmMessage: "해당 프리미엄 상품을 구매하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.PREMIUM_PRODUCT_PURCHASE_REQUESTED, { day: GameState.day, productId });
        });
      };
    });
  },

  bindBMContractSkipButton() {
    const button = document.getElementById("bm-contract-skip-button");
    if (!button) return;
    button.onclick = () => {
      if (button.disabled) return;
      const skipState = BMSystem.getBMState().contractUnlockSkip ?? {};
      const price = Number(skipState.priceDiamond ?? 50);
      this.showBMShopPurchaseConfirm({
        title: "스킵권 사용 확인",
        product: { id: "contract_unlock_skip", name: "판매권 해금 대기일 스킵권", imagePath: BM_ASSETS.items.skip3Day },
        priceText: `${price.toLocaleString("ko-KR")}다이아`,
        description: "다음 판매권 2종을 상점에 즉시 해금합니다.",
        confirmMessage: "판매권 해금 대기일 스킵권을 사용하시겠습니까?"
      }, () => {
        EventBus.emit(BM_EVENTS.CONTRACT_UNLOCK_SKIP_REQUESTED, { day: GameState.day });
      });
    };
  },

  bindBMPeakCouponButtons() {
    const purchaseButton = document.getElementById("bm-peak-coupon-purchase-button");
    const useButton = document.getElementById("bm-peak-coupon-use-button");
    if (purchaseButton) {
      purchaseButton.onclick = () => {
        if (purchaseButton.disabled) return;
        const peakState = BMSystem.getBMState().peakCoupon ?? {};
        const price = Number(peakState.purchasePriceDiamond ?? 20);
        this.showBMShopPurchaseConfirm({
          title: "쿠폰 구매 확인",
          product: { id: "peak_time_coupon", name: "피크타임 쿠폰", imagePath: BM_ASSETS.coupons.peakTime },
          priceText: `${price.toLocaleString("ko-KR")}다이아`,
          description: "구매하면 피크타임 쿠폰 1장을 보유합니다.",
          confirmMessage: "피크타임 쿠폰을 구매하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.PEAK_COUPON_PURCHASE_REQUESTED, { day: GameState.day });
        });
      };
    }
    if (useButton) {
      useButton.onclick = () => {
        if (useButton.disabled) return;
        this.showBMShopPurchaseConfirm({
          title: "쿠폰 사용 확인",
          product: { id: "peak_time_coupon_use", name: "피크타임 쿠폰 사용", imagePath: BM_ASSETS.coupons.peakTime },
          priceText: "보유 쿠폰 1장 사용",
          description: "60초 동안 매출 1.5배 효과가 적용됩니다.",
          confirmMessage: "피크타임 쿠폰을 사용하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.PEAK_COUPON_USE_REQUESTED, { day: GameState.day });
        });
      };
    }
  },

  bindBMWarehouseUpgradeButton() {
    const button = document.getElementById("bm-warehouse-upgrade-button");
    if (!button) return;
    button.onclick = () => {
      if (button.disabled) return;
      const warehouseState = BMSystem.getWarehouseUpgradeState();
      const next = warehouseState.next ?? null;
      this.showBMShopPurchaseConfirm({
        title: "창고 확장 확인",
        product: { id: "warehouse_upgrade", name: "창고 확장", imagePath: BM_ASSETS.upgrades.storage.expansion },
        priceText: next ? `${next.costGold.toLocaleString("ko-KR")}골드` : "최대 확장",
        description: next ? `창고 용량을 ${next.capacity}개까지 확장합니다.` : "창고가 이미 최대 레벨입니다.",
        confirmMessage: "창고를 확장하시겠습니까?"
      }, () => {
        EventBus.emit(BM_EVENTS.WAREHOUSE_UPGRADE_REQUESTED, { day: GameState.day });
      });
    };
  },

  bindBMShelfUpgradeButtons() {
    document.querySelectorAll(".bm-shelf-upgrade-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const shelfGroupId = button.dataset.shelfGroupId;
        const shelfId = button.dataset.shelfId;
        const group = BMSystem.getShelfGroups().find((item) => item.id === shelfGroupId || item.shelfId === shelfId);
        const next = group?.next ?? null;
        this.showBMShopPurchaseConfirm({
          title: "진열대 강화 확인",
          product: { id: `shelf_upgrade_${shelfGroupId ?? shelfId ?? "unknown"}`, name: `${group?.name ?? "진열대"} 강화`, imagePath: BM_ASSETS.upgrades.shelf.upgrade },
          priceText: next ? `${next.costGold.toLocaleString("ko-KR")}골드` : "최대 강화",
          description: next ? `상품별 진열 가능 수량을 ${next.capacity}개로 늘립니다.` : "이미 최대 강화 상태입니다.",
          confirmMessage: "진열대를 강화하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.SHELF_UPGRADE_REQUESTED, { day: GameState.day, shelfGroupId, shelfId });
        });
      };
    });
  },

  bindBMProductUpgradeButtons() {
    document.querySelectorAll(".bm-product-upgrade-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const productId = button.dataset.productId;
        const product = PRODUCTS.find((item) => item.id === productId);
        const state = BMSystem.getProductUpgradeState(productId);
        if (!product || !state) {
          this.showMessage("존재하지 않는 상품 강화 항목입니다.");
          return;
        }

        this.showBMShopPurchaseConfirm({
          title: "상품 강화 확인",
          product,
          priceText: `${state.nextCost.toLocaleString("ko-KR")}골드`,
          description: `${state.displayName} 판매가를 ${state.currentPrice.toLocaleString("ko-KR")}골드에서 ${state.nextPrice.toLocaleString("ko-KR")}골드로 올립니다.`,
          confirmMessage: "해당 상품을 강화하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.PRODUCT_UPGRADE_REQUESTED, { day: GameState.day, productId });
        });
      };
    });
  },

  bindBMStaffUpgradeButtons() {
    document.querySelectorAll(".bm-staff-upgrade-button").forEach((button) => {
      button.onclick = () => {
        if (button.disabled) return;
        const abilityKey = button.dataset.abilityKey;
        const state = BMSystem.getStaffAbilityUpgradeState();
        const label = BMSystem.getStaffAbilityLabel(abilityKey);
        this.showBMShopPurchaseConfirm({
          title: "알바 강화 확인",
          product: { id: `staff_upgrade_${abilityKey}`, name: `알바 ${label} 강화`, imagePath: BM_ASSETS.staff.upgrade },
          priceText: `${Number(state.priceDiamond ?? 80).toLocaleString("ko-KR")}다이아`,
          description: `알바 ${label} 능력을 1칸 강화합니다.`,
          confirmMessage: "알바 능력을 강화하시겠습니까?"
        }, () => {
          EventBus.emit(BM_EVENTS.STAFF_ABILITY_UPGRADE_REQUESTED, { day: GameState.day, abilityKey });
        });
      };
    });
  },

  getDisplayCategoryLabel(displayCategory) {
    const categoryLabels = {
      basic_shelf: "기본 매대",
      fresh_shelf: "신선 매대",
      fridge: "냉장고",
      warmer: "온장고"
    };

    return categoryLabels[displayCategory] ?? "매대";
  },

  getOrderCategoryLabel(categoryId) {
    const categoryLabels = {
      all: "전체",
      basic_shelf: "기본 진열",
      fresh_shelf: "신선식품",
      fridge: "냉장식품",
      warmer: "온장/즉석"
    };

    return categoryLabels[categoryId] ?? this.getDisplayCategoryLabel(categoryId);
  },

  getOrderCategoryTabs(products = PRODUCTS) {
    const categoryOrder = ["basic_shelf", "fresh_shelf", "fridge", "warmer"];
    const counts = products.reduce((result, product) => {
      const category = product.displayCategory ?? "basic_shelf";
      result[category] = (result[category] ?? 0) + 1;
      return result;
    }, {});

    return [
      {
        id: "all",
        label: this.getOrderCategoryLabel("all"),
        count: products.length
      },
      ...categoryOrder
        .filter((categoryId) => counts[categoryId] > 0)
        .map((categoryId) => {
          return {
            id: categoryId,
            label: this.getOrderCategoryLabel(categoryId),
            count: counts[categoryId] ?? 0
          };
        })
    ];
  },

  getOrderVisibleProducts(products = PRODUCTS) {
    const activeCategory = this.orderActiveCategory ?? "all";

    if (activeCategory === "all") {
      return products;
    }

    return products.filter((product) => {
      return (product.displayCategory ?? "basic_shelf") === activeCategory;
    });
  },

  renderOrderCategoryTabs(tabs = []) {
    const activeCategory = this.orderActiveCategory ?? "all";

    return `
      <div class="order-category-tabs" role="tablist" aria-label="발주 상품 카테고리">
        ${tabs.map((tab) => {
          const isActive = tab.id === activeCategory;

          return `
            <button
              class="order-category-tab${isActive ? " is-active" : ""}"
              type="button"
              role="tab"
              aria-selected="${isActive ? "true" : "false"}"
              data-order-category="${tab.id}"
            >
              <span>${tab.label}</span>
              <strong>${tab.count}</strong>
            </button>
          `;
        }).join("")}
      </div>
    `;
  },

  bindOrderCategoryTabs() {
    document.querySelectorAll(".order-category-tab").forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.guardTutorialAction("order:category", event)) return;

        const nextCategory = button.dataset.orderCategory || "all";

        if (nextCategory === this.orderActiveCategory) return;

        this.orderActiveCategory = nextCategory;
        this.orderListScrollTop = 0;
        this.renderOrderDraft();
      };
    });
  },

  createOrderModal() {
    if (document.getElementById("order-modal")) {
      this.orderModal = document.getElementById("order-modal");
      this.bindOrderModalCloseButton();
      return;
    }

    const modal = document.createElement("div");
    modal.id = "order-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content order-modal-content">
        <div class="order-computer-frame">
          <div class="order-computer-topbar">
            <span>STORE-ORDER</span>
            <div class="order-computer-topbar-actions">
              <span id="order-modal-day-label">Day ${GameState.day}</span>
              <button id="order-modal-close-button" class="order-modal-close-button" type="button" aria-label="발주창 닫기">×</button>
            </div>
          </div>
          <div id="order-modal-body"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    this.orderModal = modal;
    this.bindOrderModalCloseButton();
    this.prepareUiImageButtons(modal);
  },

  bindOrderModalCloseButton() {
    const closeButton = document.getElementById("order-modal-close-button");

    if (!closeButton || closeButton.dataset.orderModalCloseBound === "true") {
      return;
    }

    closeButton.dataset.orderModalCloseBound = "true";
    closeButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.guardTutorialAction("order:close", event)) return;

      const wasDraftMode = this.orderModalMode === "draft";
      this.hideOrderModal();

      if (wasDraftMode && this.isOrderDraftShortcutPhase()) {
        this.showMessage("발주가 아직 확정되지 않았어요. 아래 [발주] 버튼을 눌러 다시 발주창을 열 수 있습니다.", {
          duration: 2400
        });
      }
    };
  },

  showOrderModal(orderData = {}) {
    if (!this.orderModal) {
      this.createOrderModal();
    }

    this.pendingOrderPhaseData = orderData;
    this.orderDeliveredData = null;
    this.orderModalMode = "draft";
    this.orderActiveCategory = "all";
    this.clearDeliveryBox();
    this.orderDraftQuantities = this.getOrderableProducts().reduce(
      (quantityMap, product) => {
        quantityMap[product.id] = 0;
        return quantityMap;
      },
      {}
    );

    const dayLabel = document.getElementById("order-modal-day-label");

    if (dayLabel) {
      dayLabel.textContent = `Day ${GameState.day}`;
    }

    this.renderOrderDraft();
    this.orderModal.classList.remove("hidden");
    this.ensureTutorialOrderTargetVisible(30);
    this.refreshTutorialAfterUiChange();

    EventBus.emit(EVENTS.ORDER_MODAL_OPENED, {
      day: GameState.day,
      productCount: this.getOrderableProducts().length
    });
  },

  getProductFallbackIcon(product = {}) {
    const id = product.id ?? "";
    const category = product.category ?? "";

    if (id.includes("milk") || id.includes("water") || id.includes("cola") || id.includes("juice") || id.includes("coffee") || id.includes("drink")) {
      return "🥤";
    }

    if (id.includes("ramen") || id.includes("udon")) {
      return "🍜";
    }

    if (id.includes("kimbap") || id.includes("rice") || id.includes("lunchbox")) {
      return "🍱";
    }

    if (id.includes("sandwich")) {
      return "🥪";
    }

    if (id.includes("bar") || id.includes("snack") || id.includes("chips") || category === "snack") {
      return "🍪";
    }

    return "📦";
  },

  renderOrderDraft(options = {}) {
    const body = document.getElementById("order-modal-body");
    const isTutorialOrderQuantityStep = this.isInteractiveTutorialActive?.() &&
      this.getCurrentTutorialStep?.()?.id === "order-quantity";

    if (body) {
      body.classList.add("order-modal-body--card-draft");
      body.classList.remove("order-modal-body--waiting", "order-modal-body--delivery");
    }

    const previousList = document.querySelector(".order-product-list");
    const previousScrollTop = options.preserveScroll && !isTutorialOrderQuantityStep
      ? previousList?.scrollTop ?? this.orderListScrollTop
      : 0;

    if (!body) return;

    const products = PRODUCTS;
    const orderableProducts = this.getOrderableProducts();
    const orderableProductIds = new Set(
      orderableProducts.map((product) => product.id)
    );
    const categoryTabs = this.getOrderCategoryTabs(products);
    const activeCategoryExists = categoryTabs.some((tab) => tab.id === this.orderActiveCategory);

    if (!activeCategoryExists) {
      this.orderActiveCategory = "all";
    }

    if (isTutorialOrderQuantityStep) {
      this.orderActiveCategory = "all";
      this.orderListScrollTop = 0;
    }

    let visibleProducts = this.getOrderVisibleProducts(products);
    const totalCost = this.getOrderTotalCost(orderableProducts);
    const totalQuantity = orderableProducts.reduce((quantityTotal, product) => {
      return quantityTotal + (Number(this.orderDraftQuantities[product.id]) || 0);
    }, 0);
    const activeCategoryQuantity = visibleProducts.reduce((quantityTotal, product) => {
      return quantityTotal + (Number(this.orderDraftQuantities[product.id]) || 0);
    }, 0);
    const spendableMoney = this.getOrderSpendableMoney();
    const isOverBudget = totalCost > spendableMoney;
    const warehouseCapacity = BMSystem.getWarehouseCapacity();
    const currentWarehouseStock = Math.max(0, Math.floor(Number(this.inventorySnapshot?.totalQuantity) || 0));
    const isOverWarehouseCapacity = currentWarehouseStock + totalQuantity > warehouseCapacity;
    const isZeroOrderBlocked = totalQuantity <= 0;
    const dayScenario = this.pendingOrderPhaseData?.dayScenario ?? {};
    const recommendedProductIds = this.getRecommendedProductIdSet(dayScenario);
    const tutorialOrderTargetProductIds = new Set(
      this.getTutorialOrderTargetProductIds(orderableProducts, recommendedProductIds)
    );
    const tutorialOrderSortIndex = new Map(
      [...tutorialOrderTargetProductIds].map((productId, index) => [productId, index])
    );

    if (isTutorialOrderQuantityStep && tutorialOrderSortIndex.size > 0) {
      visibleProducts = [...visibleProducts].sort((a, b) => {
        const aIndex = tutorialOrderSortIndex.has(a.id) ? tutorialOrderSortIndex.get(a.id) : 1000;
        const bIndex = tutorialOrderSortIndex.has(b.id) ? tutorialOrderSortIndex.get(b.id) : 1000;

        if (aIndex !== bIndex) return aIndex - bIndex;

        return products.indexOf(a) - products.indexOf(b);
      });
    }

    const activeCategoryLabel = this.getOrderCategoryLabel(this.orderActiveCategory ?? "all");

    body.innerHTML = `
      <div class="order-draft-layout order-draft-layout--card">
        <section class="order-draft-sidebar" aria-label="발주 요약">
          <div class="order-modal-header">
            <h2>컴퓨터 발주</h2>
            <p>카테고리별로 상품을 확인하고 오늘 판매할 수량을 정하세요.</p>
            <p class="order-market-note">[오늘 추천] 상품은 이미지 왼쪽 위 배지로 표시됩니다.</p>
          </div>

          <div class="order-total-box">
            <div>
              <span>예상 발주 비용</span>
              <strong id="order-total-cost-value">₩${totalCost.toLocaleString()}</strong>
            </div>
            <div>
              <span>발주 가능 금액</span>
              <strong id="order-player-money-value">₩${spendableMoney.toLocaleString()}</strong>
            </div>
            <div>
              <span>발주 수량</span>
              <strong id="order-total-quantity-value">${totalQuantity}개</strong>
            </div>
          </div>

          <p id="order-budget-message" class="order-budget-message${isOverBudget || isZeroOrderBlocked || isOverWarehouseCapacity ? " is-warning" : ""}">
            ${this.getOrderBudgetMessage({
              isOverBudget,
              isOverWarehouseCapacity,
              isZeroOrderBlocked,
              currentWarehouseStock,
              totalQuantity,
              warehouseCapacity
            })}
          </p>

          <button id="order-confirm-button" class="order-confirm-button" type="button" ${isOverBudget || isZeroOrderBlocked || isOverWarehouseCapacity ? "disabled" : ""}>
            발주 확정
          </button>
        </section>

        <section class="order-draft-list-panel order-draft-card-panel" aria-label="발주 상품 목록">
          <div class="order-list-toolbar">
            ${this.renderOrderCategoryTabs(categoryTabs)}
            <p class="order-category-summary">
              <strong id="order-active-category-label">${activeCategoryLabel}</strong>
              <span id="order-active-category-stats">${visibleProducts.length}개 상품 · 선택 ${activeCategoryQuantity}개</span>
            </p>
          </div>

          <div class="order-product-list order-product-card-grid" data-active-category="${this.orderActiveCategory ?? "all"}">
            ${visibleProducts.map((product) => {
              const displayName = BMSystem.getProductDisplayName(product);
              const inventoryItem = this.inventoryByProductId[product.id];
              const isOrderable = orderableProductIds.has(product.id);
              const quantity = isOrderable
                ? this.orderDraftQuantities[product.id] ?? 0
                : 0;
              const stockQuantity = Number.isFinite(inventoryItem?.quantity)
                ? inventoryItem.quantity
                : 0;
              const orderStatusText = isOrderable
                ? "발주 가능"
                : this.getOrderUnavailableReason(product);
              const isRecommended = recommendedProductIds.has(product.id);
              const salePrice = BMSystem.getProductSalePrice(product.id) || product.salePrice;
              const isTutorialOrderTarget = tutorialOrderTargetProductIds.has(product.id);

              return `
                <article class="order-product-card order-product-row${isOrderable ? "" : " is-order-unavailable"}${isRecommended ? " is-recommended" : ""}${isTutorialOrderTarget ? " is-tutorial-order-target" : ""}" data-product-id="${product.id}" data-tutorial-order-target="${isTutorialOrderTarget ? "true" : "false"}">
                  <span class="order-product-image-box">
                    ${isRecommended ? `<span class="order-recommend-badge">오늘의 추천</span>` : ""}
                    <img
                      class="order-product-thumb"
                      src="${product.imagePath}"
                      alt="${displayName}"
                      loading="eager"
                      decoding="async"
                      onerror="this.hidden=true;this.nextElementSibling.hidden=false;"
                    />
                    <span class="order-product-fallback" hidden>${this.getProductFallbackIcon(product)}</span>
                  </span>

                  <strong class="order-product-title">${displayName}</strong>
                  <span class="order-product-stock">재고 ${stockQuantity}개</span>
                  <em class="order-product-status">${orderStatusText}</em>

                  <div class="order-product-prices">
                    <span><b>매입가</b><strong>₩${product.purchasePrice.toLocaleString()}</strong></span>
                    <span><b>판매가</b><strong>₩${salePrice.toLocaleString()}</strong></span>
                  </div>

                  <div class="order-quantity-panel" aria-label="${displayName} 발주 수량">
                    <div class="order-quantity-controls">
                      <button class="order-qty-button" type="button" data-action="decrease" data-product-id="${product.id}" ${isOrderable && quantity > 0 ? "" : "disabled"}>-</button>
                      <strong class="order-quantity-value" data-product-id="${product.id}">${quantity}</strong>
                      <button class="order-qty-button${isTutorialOrderTarget ? " tutorial-active-target" : ""}" type="button" data-action="increase" data-product-id="${product.id}" ${isOrderable && this.canIncreaseOrderQuantity(product.id, orderableProducts).isAvailable ? "" : "disabled"}>+</button>
                    </div>
                  </div>
                </article>
              `;
            }).join("")}
          </div>
        </section>
      </div>
    `;

    this.prepareUiImageButtons(body);
    this.bindOrderCategoryTabs();
    this.bindOrderDraftControls(orderableProducts);
    this.ensureTutorialOrderTargetVisible(20);

    if (options.preserveScroll || isTutorialOrderQuantityStep) {
      const nextList = document.querySelector(".order-product-list");

      if (nextList) {
        nextList.scrollTop = isTutorialOrderQuantityStep ? 0 : previousScrollTop;
      }
    }
  },

  getTutorialOrderTargetProductId(orderableProducts = this.getOrderableProducts(), recommendedProductIds = new Set()) {
    return this.getTutorialOrderTargetProductIds(orderableProducts, recommendedProductIds)[0] ?? "";
  },

  getTutorialOrderTargetProductIds(orderableProducts = this.getOrderableProducts(), recommendedProductIds = new Set()) {
    const orderable = Array.isArray(orderableProducts) ? orderableProducts : [];
    const orderableById = new Map(orderable.map((product) => [product.id, product]));
    const targetIds = TUTORIAL_ORDER_TARGET_PRODUCT_IDS.filter((productId) => {
      return orderableById.has(productId);
    });

    if (targetIds.length > 0) {
      return targetIds;
    }

    const recommendedSet = recommendedProductIds instanceof Set
      ? recommendedProductIds
      : new Set(Array.isArray(recommendedProductIds) ? recommendedProductIds : []);
    const recommendedIds = orderable
      .filter((product) => recommendedSet.has(product.id))
      .map((product) => product.id);

    return recommendedIds.length > 0
      ? recommendedIds.slice(0, 2)
      : orderable.slice(0, 2).map((product) => product.id);
  },

  getOrderSpendableMoney() {
    const money = Math.max(0, Math.floor(Number(GameState.money) || 0));
    const recordedCost = Math.max(0, Math.floor(Number(GameState.todayStats?.cost) || 0));

    return Math.max(0, money - recordedCost);
  },

  getOrderDraftTotalQuantity() {
    return Object.values(this.orderDraftQuantities ?? {}).reduce((total, quantity) => {
      return total + Math.max(0, Math.floor(Number(quantity) || 0));
    }, 0);
  },

  canIncreaseOrderQuantity(productId, products = this.getOrderableProducts()) {
    const product = products.find((candidate) => candidate.id === productId);

    if (!product || !this.isProductOrderable(product)) {
      return {
        isAvailable: false,
        reason: ORDER_VALIDATION_MESSAGES.lockedProduct
      };
    }

    const spendableMoney = this.getOrderSpendableMoney();
    const currentTotalCost = this.getOrderTotalCost(products);
    const nextTotalCost = currentTotalCost + product.purchasePrice;

    if (nextTotalCost > spendableMoney) {
      return {
        isAvailable: false,
        reason: ORDER_VALIDATION_MESSAGES.notEnoughGold
      };
    }

    const warehouseCapacity = BMSystem.getWarehouseCapacity();
    const currentWarehouseStock = Math.max(0, Math.floor(Number(this.inventorySnapshot?.totalQuantity) || 0));
    const currentOrderQuantity = this.getOrderDraftTotalQuantity();

    if (currentWarehouseStock + currentOrderQuantity + 1 > warehouseCapacity) {
      return {
        isAvailable: false,
        reason: ORDER_VALIDATION_MESSAGES.quantityExceeded
      };
    }

    return {
      isAvailable: true,
      reason: "발주 수량을 늘릴 수 있습니다."
    };
  },

  getOrderBudgetMessage({
    isOverBudget = false,
    isOverWarehouseCapacity = false,
    isZeroOrderBlocked = false,
    currentWarehouseStock = 0,
    totalQuantity = 0,
    warehouseCapacity = 0
  } = {}) {
    if (isOverBudget) {
      return ORDER_VALIDATION_MESSAGES.notEnoughGold;
    }

    if (isOverWarehouseCapacity) {
      return ORDER_VALIDATION_MESSAGES.quantityExceeded;
    }

    if (isZeroOrderBlocked) {
      return ORDER_VALIDATION_MESSAGES.emptyOrder;
    }

    return `창고 ${currentWarehouseStock + totalQuantity}/${warehouseCapacity}개`;
  },

  refreshOrderDraftDynamicState() {
    const orderableProducts = this.getOrderableProducts();
    const visibleProducts = this.getOrderVisibleProducts(PRODUCTS);
    const totalCost = this.getOrderTotalCost(orderableProducts);
    const totalQuantity = orderableProducts.reduce((quantityTotal, product) => {
      return quantityTotal + (Number(this.orderDraftQuantities[product.id]) || 0);
    }, 0);
    const activeCategoryQuantity = visibleProducts.reduce((quantityTotal, product) => {
      return quantityTotal + (Number(this.orderDraftQuantities[product.id]) || 0);
    }, 0);
    const warehouseCapacity = BMSystem.getWarehouseCapacity();
    const currentWarehouseStock = Math.max(0, Math.floor(Number(this.inventorySnapshot?.totalQuantity) || 0));
    const spendableMoney = this.getOrderSpendableMoney();
    const isOverBudget = totalCost > spendableMoney;
    const isOverWarehouseCapacity = currentWarehouseStock + totalQuantity > warehouseCapacity;
    const isZeroOrderBlocked = totalQuantity <= 0;
    const shouldDisableConfirm = isOverBudget || isZeroOrderBlocked || isOverWarehouseCapacity;

    const setText = (selector, value) => {
      const node = document.querySelector(selector);
      if (node && node.textContent !== value) {
        node.textContent = value;
      }
    };

    setText("#order-total-cost-value", `₩${totalCost.toLocaleString()}`);
    setText("#order-player-money-value", `₩${spendableMoney.toLocaleString()}`);
    setText("#order-total-quantity-value", `${totalQuantity}개`);
    setText("#order-active-category-stats", `${visibleProducts.length}개 상품 · 선택 ${activeCategoryQuantity}개`);

    Object.entries(this.orderDraftQuantities).forEach(([productId, quantity]) => {
      setText(`.order-quantity-value[data-product-id="${productId}"]`, `${Number(quantity) || 0}`);
    });

    document.querySelectorAll(".order-qty-button").forEach((button) => {
      const productId = button.dataset.productId;
      const product = orderableProducts.find((candidate) => candidate.id === productId);
      const quantity = Math.max(0, Math.floor(Number(this.orderDraftQuantities[productId]) || 0));
      let shouldDisable = !product;

      if (button.dataset.action === "decrease") {
        shouldDisable = shouldDisable || quantity <= 0;
      } else if (button.dataset.action === "increase") {
        shouldDisable = shouldDisable || !this.canIncreaseOrderQuantity(productId, orderableProducts).isAvailable;
      }

      button.disabled = shouldDisable;
      if (shouldDisable) {
        button.setAttribute("aria-disabled", "true");
      } else {
        button.removeAttribute("disabled");
        button.removeAttribute("aria-disabled");
      }
      this.syncUiImageButtonState(button);
    });

    const budgetMessage = document.getElementById("order-budget-message");
    const budgetText = this.getOrderBudgetMessage({
      isOverBudget,
      isOverWarehouseCapacity,
      isZeroOrderBlocked,
      currentWarehouseStock,
      totalQuantity,
      warehouseCapacity
    });

    if (budgetMessage) {
      budgetMessage.classList.toggle("is-warning", shouldDisableConfirm);
      if (budgetMessage.textContent.trim() !== budgetText) {
        budgetMessage.textContent = budgetText;
      }
    }

    const confirmButton = document.getElementById("order-confirm-button");
    if (confirmButton) {
      confirmButton.disabled = shouldDisableConfirm;
      if (shouldDisableConfirm) {
        confirmButton.setAttribute("aria-disabled", "true");
      } else {
        confirmButton.removeAttribute("disabled");
        confirmButton.removeAttribute("aria-disabled");
      }
      this.syncUiImageButtonState(confirmButton);
    }
  },

  bindOrderDraftControls(products = []) {
    document.querySelectorAll(".order-qty-button").forEach((button) => {
      button.onclick = (event) => {
        if (!this.guardTutorialAction("order:quantity", event)) return;
        if (!this.isTutorialOrderQuantityControlAllowed(button)) {
          this.blockTutorialInputEvent(event, "click");
          return;
        }
        if (button.disabled) return;

        const productId = button.dataset.productId;

        if (!(productId in this.orderDraftQuantities)) return;

        const currentQuantity = this.orderDraftQuantities[productId] ?? 0;
        let nextQuantity = currentQuantity;

        if (button.dataset.action === "increase") {
          const increaseAvailability = this.canIncreaseOrderQuantity(productId, products);

          if (!increaseAvailability.isAvailable) {
            this.showMessage(increaseAvailability.reason);
            this.refreshOrderDraftDynamicState();
            return;
          }

          nextQuantity = currentQuantity + 1;
        } else {
          nextQuantity = Math.max(0, currentQuantity - 1);
        }

        const orderList = document.querySelector(".order-product-list");
        const isTutorialQuantityStep = this.isInteractiveTutorialActive?.() &&
          this.getCurrentTutorialStep?.()?.id === "order-quantity";

        this.orderListScrollTop = isTutorialQuantityStep
          ? 0
          : orderList?.scrollTop ?? this.orderListScrollTop;
        if (isTutorialQuantityStep && orderList) {
          orderList.scrollTop = 0;
        }
        this.orderDraftQuantities[productId] = nextQuantity;
        this.refreshOrderDraftDynamicState();
        this.refreshTutorialAfterUiChange(20);
      };
    });

    const confirmButton = document.getElementById("order-confirm-button");

    if (!confirmButton) return;

    confirmButton.onclick = (event) => {
      this.refreshOrderDraftDynamicState();

      if (!this.guardTutorialAction("order:confirm", event)) {
        if (this.isInteractiveTutorialActive?.() && this.getCurrentTutorialStep?.()?.id === "order-quantity") {
          this.showMessage("아직 수량 선택 단계예요. 표시된 상품의 [+] 버튼을 누른 뒤 [다음]을 눌러주세요.", { duration: 2200 });
          this.refreshTutorialAfterUiChange(20);
        }
        return;
      }

      const items = products
        .map((product) => {
          return {
            productId: product.id,
            productName: BMSystem.getProductDisplayName(product),
            shelfId: product.shelfId,
            quantity: this.orderDraftQuantities[product.id] ?? 0,
            purchasePrice: product.purchasePrice,
            salePrice: BMSystem.getProductSalePrice(product.id) || product.salePrice,
            imagePath: product.imagePath
          };
        })
        .filter((item) => item.quantity > 0);
      const validation = this.validateOrderDraftBeforeConfirm(products, items);

      if (!validation.isAvailable) {
        this.showMessage(validation.message);
        this.refreshOrderDraftDynamicState();
        return;
      }

      if (confirmButton.disabled) return;

      this.showOrderWaiting();

      EventBus.emit(EVENTS.ORDER_CONFIRMED, {
        day: GameState.day,
        items,
        totalCost: this.getOrderTotalCost(products)
      });

      window.setTimeout(() => {
        if (this.orderModalMode === "waiting") {
          this.hideOrderModal();
        }
      }, 260);
    };
  },

  validateOrderDraftBeforeConfirm(products = [], items = []) {
    const totalCost = this.getOrderTotalCost(products);
    const totalQuantity = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    const spendableMoney = this.getOrderSpendableMoney();
    const warehouseCapacity = BMSystem.getWarehouseCapacity();
    const currentWarehouseStock = Math.max(0, Math.floor(Number(this.inventorySnapshot?.totalQuantity) || 0));
    const isOrderPhase =
      GameState.phase === GAME_PHASE.DAY_START ||
      GameState.phase === GAME_PHASE.ORDER;

    if (!isOrderPhase) {
      return {
        isAvailable: false,
        message: "발주는 Day 시작 후 영업 시작 전까지만 가능합니다."
      };
    }

    if (totalQuantity <= 0) {
      return {
        isAvailable: false,
        message: ORDER_VALIDATION_MESSAGES.emptyOrder
      };
    }

    const hasLockedItem = items.some((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return !product || !this.isProductOrderable(product);
    });

    if (hasLockedItem) {
      return {
        isAvailable: false,
        message: ORDER_VALIDATION_MESSAGES.lockedProduct
      };
    }

    if (totalCost > spendableMoney) {
      return {
        isAvailable: false,
        message: ORDER_VALIDATION_MESSAGES.notEnoughGold
      };
    }

    if (currentWarehouseStock + totalQuantity > warehouseCapacity) {
      return {
        isAvailable: false,
        message: ORDER_VALIDATION_MESSAGES.quantityExceeded
      };
    }

    return {
      isAvailable: true,
      message: "발주 가능합니다."
    };
  },

  handleOrderConfirmationFailed(data = {}) {
    if (this.orderModalMode === "waiting") {
      this.orderModalMode = "draft";
      this.renderOrderDraft({ preserveScroll: true });
      this.orderModal?.classList.remove("hidden");
    }

    this.showMessage(data.message ?? data.reason ?? "발주를 진행할 수 없습니다.");
    this.refreshOrderDraftDynamicState();
  },

  showOrderWaiting() {
    const body = document.getElementById("order-modal-body");

    if (!body) return;

    body.classList.remove("order-modal-body--card-draft", "order-modal-body--delivery");
    body.classList.add("order-modal-body--waiting");

    this.orderModalMode = "waiting";

    body.innerHTML = `
      <div class="order-waiting-state">
        <div class="order-waiting-card">
          <span class="order-waiting-icon">📦</span>
          <h2>발주 접수 중</h2>
          <p>발주가 접수되었습니다. 잠시 후 발주 박스가 매장 앞에 도착합니다.</p>
        </div>
      </div>
    `;
  },

  handleOrderDelivered(orderData = {}) {
    const deliveredItems = this.getDeliveredItems(orderData);

    this.orderDeliveredData = orderData;

    if (orderData.isCompleted || deliveredItems.length === 0) {
      this.clearDeliveryBox();
      this.hideOrderModal();
      return;
    }

    this.renderDeliveryBox(orderData);
    this.syncOrderDeliveryTutorialArrival();

    if (this.orderModalMode === "delivery") {
      this.showOrderDelivered(orderData);
      return;
    }

    this.hideOrderModal();
    this.showMessage("주문한 상품이 도착했어요. 도착한 발주 박스를 눌러 창고에 정리해볼게요.");
    this.refreshTutorialAfterUiChange();
  },

  renderDeliveryBox(orderData = this.orderDeliveredData) {
    const storeArea = this.getStoreInteractionLayer() ?? document.getElementById("store-area");

    if (!storeArea) return;

    const deliveredItems = this.getDeliveredItems(orderData);
    const hasOpenDelivery = Boolean(orderData && deliveredItems.length > 0 && !orderData.isCompleted);
    const isCarryingDeliveryBox =
      GameState.deliveryBoxState === "carrying" ||
      GameState.player?.carryingBoxType === "arrive";
    let deliveryBox = document.getElementById("delivery-box-zone");

    if (!hasOpenDelivery || isCarryingDeliveryBox) {
      this.clearDeliveryBox();
      return;
    }

    const remainingCount = deliveredItems.filter((item) => !item.isSorted).length;

    if (!deliveryBox) {
      deliveryBox = document.createElement("button");
      deliveryBox.id = "delivery-box-zone";
      deliveryBox.className = "delivery-box-zone";
      deliveryBox.type = "button";
      deliveryBox.setAttribute("aria-label", "도착한 발주 박스 정리하기");
      storeArea.appendChild(deliveryBox);
    }

    deliveryBox.classList.remove("interaction-feedback-target", "is-interactable", "is-interaction-ready", "is-click-sparkling");
    deliveryBox.dataset.interactionFeedbackDisabled = "true";
    this.clearInteractionFeedbackNode("delivery-box-zone");
    this.ensureDeliveryBoxVisuals(deliveryBox, remainingCount);
    this.syncOrderDeliveryTutorialArrival();

    deliveryBox.onpointerdown = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    deliveryBox.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.guardTutorialAction("delivery:open", event)) return;

      EventBus.emit(EVENTS.PLAYER_ACTION_RECORDED, {
        day: orderData.day ?? GameState.day,
        actionType: "open_delivery_box",
        orderId: orderData.orderId ?? null,
        source: "delivery_box_zone"
      });
    };
  },

  ensureDeliveryBoxVisuals(deliveryBox, remainingCount) {
    let visualNode = deliveryBox.querySelector(".delivery-box-visual");

    if (!visualNode) {
      visualNode = document.createElement("span");
      visualNode.className = "delivery-box-visual";
      visualNode.setAttribute("aria-hidden", "true");
      deliveryBox.appendChild(visualNode);
    }

    let imageNode = visualNode.querySelector("img");

    if (!imageNode) {
      imageNode = document.createElement("img");
      imageNode.alt = "";
      imageNode.draggable = false;
      visualNode.appendChild(imageNode);
    }

    const imagePath = getWarehouseBoxAsset("arrive");

    if (imageNode.getAttribute("src") !== imagePath) {
      imageNode.src = imagePath;
    }

    let hitboxNode = deliveryBox.querySelector(".delivery-box-hitbox");

    if (!hitboxNode) {
      hitboxNode = document.createElement("span");
      hitboxNode.className = "delivery-box-hitbox";
      hitboxNode.setAttribute("aria-hidden", "true");
      deliveryBox.appendChild(hitboxNode);
    }

    let countNode = deliveryBox.querySelector(".delivery-box-count");

    if (!countNode) {
      countNode = document.createElement("strong");
      countNode.className = "delivery-box-count";
      deliveryBox.appendChild(countNode);
    }

    countNode.textContent = `${remainingCount}종`;
  },

  clearDeliveryBox() {
    const deliveryBox = document.getElementById("delivery-box-zone");

    if (deliveryBox) {
      deliveryBox.remove();
    }
  },

  showOrderDelivered(orderData = {}) {
    // Deprecated flow: the game no longer asks players to click individual
    // delivered products inside the order modal. Delivery is handled only by
    // clicking the arrival box once, then automatic order item organization.
    this.orderDeliveredData = orderData;
    this.orderModalMode = "closed";
    this.hideOrderModal();
    this.renderDeliveryBox(orderData);
    this.refreshTutorialAfterUiChange();
  },

  syncOrderDeliveredState(orderData = {}) {
    const deliveredItems = this.getDeliveredItems(orderData);
    const remainingCount = deliveredItems.filter((item) => !item.isSorted).length;
    const remainingCountNode = document.getElementById("order-delivery-remaining-count");

    if (remainingCountNode && remainingCountNode.textContent !== String(remainingCount)) {
      remainingCountNode.textContent = String(remainingCount);
    }

    deliveredItems.forEach((item) => {
      const button = document.querySelector(`.delivered-product-button[data-product-id="${item.productId}"]`);
      if (!button) return;

      const isSorted = Boolean(item.isSorted);
      const product = PRODUCTS.find((candidate) => candidate.id === item.productId) ?? {
        id: item.productId,
        name: item.productName,
        imagePath: item.imagePath
      };
      const imagePath = item.imagePath ?? product.imagePath ?? "";

      button.classList.toggle("is-sorted", isSorted);
      button.disabled = isSorted;

      const imageNode = button.querySelector(".delivered-product-image");
      if (imageNode) {
        if (imageNode.getAttribute("src") !== imagePath) {
          imageNode.src = imagePath;
        }
        imageNode.alt = item.productName;
      }

      const setText = (selector, value) => {
        const node = button.querySelector(selector);
        if (node && node.textContent !== value) {
          node.textContent = value;
        }
      };

      setText(".delivered-product-name", item.productName);
      setText(".delivered-product-quantity", `${item.quantity}개`);
      setText(".delivered-product-status", isSorted ? "정리 완료" : "정리 대기");
    });
  },

  bindDeliveredProductButtons() {
    // Deprecated safety no-op.
    // Delivery sorting is now handled only through the arrival box: one click -> automatic organization.
    document.querySelectorAll(".delivered-product-button").forEach((button) => {
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.showMessage("도착한 발주 박스를 눌러 발주 상품을 한 번에 정리해주세요.", { duration: 2200 });
      };
    });
  },

  getDeliveredItems(orderData = {}) {
    return Array.isArray(orderData?.items)
      ? orderData.items.filter((item) => item.quantity > 0)
      : [];
  },

  hideOrderModal() {
    if (!this.orderModal) return;

    this.orderModal.classList.add("hidden");

    if (this.orderModalMode !== "delivery") {
      this.orderModalMode = "closed";
    }
  },

  getOrderableProducts() {
    return PRODUCTS.filter((product) => {
      return this.isProductOrderable(product);
    });
  },

  getOrderUnavailableReason(product) {
    return BMSystem.getProductLockReason(product.id).message;
  },

  getOrderTotalCost(products = this.getOrderableProducts()) {
    return products.reduce((totalCost, product) => {
      const quantity = this.orderDraftQuantities[product.id] ?? 0;

      return totalCost + product.purchasePrice * quantity;
    }, 0);
  },

  createResultModal() {
    if (document.getElementById("result-modal")) {
      this.resultModal = document.getElementById("result-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "result-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content result-modal-content">
        <h2 id="result-modal-title">정산 결과</h2>

        <div id="result-modal-body"></div>

        <div class="result-modal-actions">
          <button id="result-confirm-button" type="button">
            확인
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    this.resultModal = modal;
    this.prepareUiImageButtons(modal);
  },

  showResultModal(resultData, onConfirm, options = {}) {
    if (this.isTutorialVisible?.()) {
      this.completeTutorialAndCleanup({ markCompleted: this.isTutorialCompleted?.() === true, message: "" });
    }

    if (!this.resultModal) {
      this.createResultModal();
    }


    const title = document.getElementById("result-modal-title");
    const body = document.getElementById("result-modal-body");
    const confirmButton = document.getElementById("result-confirm-button");

    const isInfiniteGameOver = resultData.infiniteGameOver?.isGameOver === true;

    if (isInfiniteGameOver) {
      SaveSystem.clearSaveData();
    }

    const resultText = isInfiniteGameOver
      ? "무한 모드 종료"
      : resultData.success ? "오늘 영업 성공" : "오늘 영업 실패";
    const resultChecks = Array.isArray(resultData.resultChecks)
      ? resultData.resultChecks
      : [];
    const nextStepText = resultData.nextStepText ??
      "정산 확인 후 업그레이드를 선택하고 다음 Day로 진행합니다.";
    const mvpText = resultData.mvpTestDataApplied
      ? `<p class="modal-note">※ 개발 점검용 정산 데이터가 적용되었습니다.</p>`
      : "";
    const staffResult = resultData.staff ?? {};
    const infiniteGameOverNotice = this.createInfiniteGameOverResultNotice(
      resultData.infiniteGameOver
    );
    const staffResultRows = staffResult.hired
      ? `
        <div class="result-row result-row-staff">
          <span>알바 보조</span>
          <strong>${staffResult.name} 창고/진열/청소</strong>
        </div>
        <div class="result-row result-row-staff">
          <span>알바 인건비</span>
          <strong>-₩${Number(staffResult.wageCost || 0).toLocaleString("ko-KR")}</strong>
        </div>
      `
      : "";
    const sanitation = resultData.sanitation ?? resultData.sanitationPenalty?.sanitation ?? null;
    const sanitationPenaltyText = resultData.sanitationPenalty?.applies
      ? ` / 만족도 ${resultData.sanitationPenalty.satisfactionPenalty}`
      : "";
    const sanitationResultRow = sanitation
      ? `
        <div class="result-row result-row-sanitation ${resultData.sanitationPenalty?.applies ? "is-warning" : ""}">
          <span>매장 위생</span>
          <strong>위생 ${Number(sanitation.value ?? 100)} / 100${sanitationPenaltyText}</strong>
        </div>
      `
      : "";

    title.textContent = `Day ${resultData.day} 정산 결과`;

    body.innerHTML = `
      <div class="result-landscape-layout">
        <section class="result-left-panel" aria-label="영업 기록">
          <div class="result-summary ${isInfiniteGameOver ? "fail is-game-over" : resultData.success ? "success" : "fail"}">
            <strong>${resultText}</strong>
            <span>${resultData.resultSummaryText ?? ""}</span>
          </div>

          ${infiniteGameOverNotice}

          <p class="result-section-title">영업 기록</p>

          <div class="result-row">
            <span>매출 / 목표</span>
            <strong>₩${resultData.revenue.toLocaleString()} / ₩${resultData.targetRevenue.toLocaleString()}</strong>
          </div>

          <div class="result-row">
            <span>순이익</span>
            <strong id="result-profit-value">₩${resultData.profit.toLocaleString()}</strong>
          </div>

          <div class="result-row">
            <span>병맛 점수</span>
            <strong id="result-bm-score-value">${(resultData.bmScore ?? resultData.bmBonus ?? 0).toLocaleString()}</strong>
          </div>

          <div class="result-row">
            <span>만족도</span>
            <strong>${resultData.satisfaction} / ${resultData.targetSatisfaction}</strong>
          </div>

          <div class="result-row">
            <span>멘탈</span>
            <strong id="result-mental-value">${resultData.mental} / 100</strong>
          </div>

          ${sanitationResultRow}

          <div class="result-row">
            <span>손님 수</span>
            <strong>${resultData.totalCustomers}</strong>
          </div>

          <div class="result-row">
            <span>계산 성공</span>
            <strong>${resultData.checkoutSuccessCount}</strong>
          </div>

          ${staffResultRows}
        </section>

        <section class="result-right-panel" aria-label="목표 체크">
          <div class="result-check-list">
            ${resultChecks.map((check) => {
              return `
                <div class="result-check ${check.success ? "success" : "fail"}">
                  <div class="result-check-main">
                    <span>${check.label}</span>
                    <strong>${check.statusText}</strong>
                  </div>
                  <div class="result-check-value">${check.valueText}</div>
                  <p>${check.detailText}</p>
                </div>
              `;
            }).join("")}
          </div>
        </section>

        <p class="result-next-step">${nextStepText}</p>

        ${mvpText}
      </div>
    `;

    confirmButton.onclick = () => {
      this.hideResultModal();

      if (typeof onConfirm === "function") {
        onConfirm();
      }
    };

    this.resultModal.classList.remove("hidden");
  },

  hideResultModal() {
    if (!this.resultModal) return;

    this.resultModal.classList.add("hidden");
  },

  createInfiniteGameOverResultNotice(infiniteGameOver = {}) {
    if (!infiniteGameOver?.isGameOver) {
      return "";
    }

    const reasons = Array.isArray(infiniteGameOver.reasons)
      ? infiniteGameOver.reasons
      : [];
    const reasonItems = reasons.length > 0
      ? reasons.map((reason) => {
          return `<li><strong>${reason.label}</strong><span>${reason.detailText}</span></li>`;
        }).join("")
      : "<li><strong>운영 한계</strong><span>무한 모드 종료 조건이 발생했습니다.</span></li>";

    return `
      <section class="infinite-game-over-result-note" aria-label="무한 모드 종료 사유">
        <strong>무한 모드 게임 오버</strong>
        <p>이번 정산 확인 후 무한 모드 진행만 Day 6 초기 상태로 리셋됩니다. 타이틀의 이어하기로 다시 도전할 수 있습니다.</p>
        <ul>${reasonItems}</ul>
      </section>
    `;
  },

  createInfiniteGameOverModal() {
    if (document.getElementById("infinite-game-over-modal")) {
      this.infiniteGameOverModal = document.getElementById("infinite-game-over-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "infinite-game-over-modal";
    modal.className = "modal infinite-game-over-modal hidden";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div
        class="modal-content infinite-game-over-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="infinite-game-over-title"
      >
        <p class="infinite-game-over-kicker">무한 모드 종료</p>
        <h2 id="infinite-game-over-title">오늘도 정상영업 실패...</h2>
        <p id="infinite-game-over-description" class="infinite-game-over-description"></p>
        <ul id="infinite-game-over-reasons" class="infinite-game-over-reasons"></ul>
        <div class="infinite-game-over-reset-box">
          <strong>리셋 안내</strong>
          <p>Day 5 클리어 기록은 유지하고, 무한 모드 진행만 Day 6 초기 상태로 리셋됩니다. 타이틀의 이어하기 버튼으로 Day 6 무한 모드부터 다시 시작할 수 있습니다.</p>
          <p class="infinite-game-over-reset-help">새 매장 시작을 누르면 매장 진행도만 Day 1부터 다시 시작합니다. 출석 보상 기록과 BM 지갑은 계정성 데이터로 유지됩니다.</p>
        </div>
        <button id="infinite-game-over-reset-button" type="button" class="infinite-game-over-reset-button">
          타이틀로 돌아가기
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    this.infiniteGameOverModal = modal;
    this.prepareUiImageButtons(modal);
  },

  showInfiniteGameOverModal(infiniteGameOver = {}) {
    if (!this.infiniteGameOverModal) {
      this.createInfiniteGameOverModal();
    }

    const description = document.getElementById("infinite-game-over-description");
    const reasonList = document.getElementById("infinite-game-over-reasons");
    const resetButton = document.getElementById("infinite-game-over-reset-button");
    const reasons = Array.isArray(infiniteGameOver.reasons)
      ? infiniteGameOver.reasons
      : [];

    if (description) {
      description.textContent = `Day ${infiniteGameOver.day ?? GameState.day} 무한 모드에서 운영 한계에 도달했습니다. 타이틀로 돌아가면 이어하기로 Day 6 초기 무한 모드부터 재도전할 수 있습니다.`;
    }

    if (reasonList) {
      reasonList.innerHTML = reasons.length > 0
        ? reasons.map((reason) => {
            return `
              <li>
                <strong>${reason.label}</strong>
                <span>${reason.detailText}</span>
              </li>
            `;
          }).join("")
        : "<li><strong>운영 한계</strong><span>무한 모드 종료 조건이 발생했습니다.</span></li>";
    }

    if (resetButton) {
      resetButton.onclick = () => {
        this.hideInfiniteGameOverModal();
        const resetStatus = SaveSystem.resetInfiniteModeRun();
        this.renderCustomers();
        this.renderTitleResumeButton();

        const message = resetStatus?.success === false
          ? "무한 모드 초기화 저장에 실패했습니다. 새 매장 시작을 이용해주세요."
          : "무한 모드 진행이 Day 6 초기 상태로 리셋되었습니다. 이어하기로 무한 모드부터 재도전하거나, 새 매장 시작으로 매장 진행도만 Day 1부터 다시 시작할 수 있습니다.";

        this.showTitleScreen(message);
      };
    }

    this.setElementHiddenSafely(this.infiniteGameOverModal, false);
    window.requestAnimationFrame(() => {
      this.focusElementSafely(resetButton);
    });
  },

  hideInfiniteGameOverModal() {
    if (!this.infiniteGameOverModal) return;

    this.setElementHiddenSafely(this.infiniteGameOverModal, true);
  },

  createEndingModal() {
    if (document.getElementById("ending-modal")) {
      this.endingModal = document.getElementById("ending-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "ending-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content ending-modal-content">
        <p class="ending-kicker">최종 목표 달성</p>
        <h2 id="ending-modal-title" class="ending-title">세계 1등 편의점 달성!</h2>

        <p id="ending-modal-description" class="ending-description">
          Day 5까지 버틴 편의점은 이제 Day 6부터 무한모드 영업에 도전합니다.
        </p>

        <div id="ending-modal-reward" class="ending-reward-box"></div>

        <button id="ending-continue-button" class="ending-continue-button" type="button">
          Day 6 무한모드로 계속하기
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.endingModal = modal;
  },

  showEndingModal(endingData = {}) {
    if (!this.endingModal) {
      this.createEndingModal();
    }

    const title = document.getElementById("ending-modal-title");
    const description = document.getElementById("ending-modal-description");
    const rewardBox = document.getElementById("ending-modal-reward");
    const continueButton = document.getElementById("ending-continue-button");
    const effects = endingData.effects ?? {};
    const customerBonusPercent = Math.round(
      (Number(effects.customerSpawnRateBonus) || 0) * 100
    );
    const targetRevenueBonus = Number(effects.targetRevenueBonus) || 0;
    const storeSizeBonus = Number(effects.storeSizeBonus) || 0;

    title.textContent = endingData.endingTitle ?? "세계 1등 편의점 달성!";
    description.textContent = endingData.endingDescription ??
      "Day 5까지 버틴 편의점은 이제 Day 6부터 무한모드 영업에 도전합니다.";

    rewardBox.innerHTML = `
      <div class="ending-reward-row">
        <span>달성 Day</span>
        <strong>Day ${endingData.day ?? GameState.day}</strong>
      </div>
      <div class="ending-reward-row">
        <span>최종 구역</span>
        <strong>${endingData.zoneName ?? "프리미엄 매장 구역"}</strong>
      </div>
      <div class="ending-reward-row">
        <span>손님 방문</span>
        <strong>+${customerBonusPercent}%</strong>
      </div>
      <div class="ending-reward-row">
        <span>목표 매출</span>
        <strong>+₩${targetRevenueBonus.toLocaleString()}</strong>
      </div>
      <div class="ending-reward-row">
        <span>매장 규모</span>
        <strong>Lv.${storeSizeBonus}</strong>
      </div>
    `;

    continueButton.onclick = () => {
      this.hideEndingModal();

      EventBus.emit(EVENTS.ENDING_MODAL_CLOSED, {
        day: GameState.day,
        zoneId: endingData.zoneId ?? null,
        zoneName: endingData.zoneName ?? ""
      });
    };

    this.endingModal.classList.remove("hidden");
  },

  hideEndingModal() {
    if (!this.endingModal) return;

    this.endingModal.classList.add("hidden");
  },

  createUpgradeModal() {
    if (document.getElementById("upgrade-modal")) {
      this.upgradeModal = document.getElementById("upgrade-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "upgrade-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-content upgrade-modal-content">
        <h2 id="upgrade-modal-title">업그레이드 선택</h2>

        <p id="upgrade-modal-description" class="upgrade-modal-description">
          오늘의 보상으로 업그레이드 1개를 선택하세요.
        </p>

        <div id="upgrade-modal-list"></div>
      </div>
    `;

    document.body.appendChild(modal);

    this.upgradeModal = modal;
  },

  showUpgradeModal(upgrades, onSelect, resultData = null) {
    if (!this.upgradeModal) {
      this.createUpgradeModal();
    }

    const title = document.getElementById("upgrade-modal-title");
    const description = document.getElementById("upgrade-modal-description");
    const list = document.getElementById("upgrade-modal-list");

    const resultText = resultData && resultData.success
      ? "목표 달성 후"
      : "다음 영업 전";

    title.textContent = "멘탈 회복 선택";
    description.textContent = `${resultText} 멘탈 회복 1개를 선택하세요. 무료 1개, 골드 1개, 다이아 1개 중 선택할 수 있습니다.`;

    list.innerHTML = "";

    let alreadySelected = false;

    upgrades.forEach((upgrade) => {
      const canSelect = upgrade.canSelect !== false;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "upgrade-card mental-recovery-card";
      button.dataset.upgradeId = upgrade.id;
      button.disabled = !canSelect;
      button.setAttribute("aria-disabled", String(!canSelect));
      button.classList.toggle("is-unavailable", !canSelect);

      const recoveryAssetPath = this.getMentalRecoveryAssetPath(upgrade);
      button.innerHTML = `
        <img class="mental-recovery-icon" src="${recoveryAssetPath}" alt="" aria-hidden="true" loading="eager" decoding="async" />
        <strong>${upgrade.name}</strong>
        <span>${upgrade.description}</span>
        <em class="upgrade-price">${upgrade.priceText ?? "무료"}</em>
        ${upgrade.disabledReason ? `<small class="upgrade-disabled-reason">${upgrade.disabledReason}</small>` : ""}
      `;

      button.onclick = () => {
        if (alreadySelected || button.disabled) return;

        alreadySelected = true;

        button.classList.add("is-upgrade-selected");

        const upgradeButtons = list.querySelectorAll(".upgrade-card");
        upgradeButtons.forEach((upgradeButton) => {
          upgradeButton.disabled = true;
        });

        this.playAssetEffectToast("upgrade", `${upgrade.name} 선택 완료!`);
        window.setTimeout(() => {
          this.hideUpgradeModal();
        }, 280);

        if (typeof onSelect === "function") {
          onSelect(upgrade.id);
        }
      };

      list.appendChild(button);
    });

    this.upgradeModal.classList.remove("hidden");
  },

  createCustomerEventModal() {
    if (document.getElementById("customer-event-modal")) {
      this.eventModal = document.getElementById("customer-event-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "customer-event-modal";
    modal.className = "modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "customer-event-modal-title");

    modal.innerHTML = `
      <div class="modal-content customer-event-modal-content">
        <h2 id="customer-event-modal-title">고객 이벤트</h2>
        <p id="customer-event-modal-meta" class="customer-event-modal-meta"></p>
        <p id="customer-event-modal-dialogue" class="customer-event-modal-dialogue"></p>
        <p id="customer-event-modal-summary" class="customer-event-modal-summary"></p>
        <div id="customer-event-choice-list" class="customer-event-choice-list"></div>
        <div id="customer-event-result-text" class="customer-event-result-text" hidden></div>
        <button id="customer-event-close-button" class="customer-event-close-button" type="button" hidden>
          확인
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    this.eventModal = modal;
  },


  formatCustomerEventSignedNumber(value) {
    const safeValue = Number(value) || 0;
    const sign = safeValue > 0 ? "+" : "";

    return `${sign}${safeValue.toLocaleString("ko-KR")}`;
  },

  createCustomerEventResultLine(label, value) {
    const item = document.createElement("li");
    item.textContent = `${label} ${value}`;
    return item;
  },

  formatCustomerEventInventoryChanges(inventoryChanges = []) {
    const changes = Array.isArray(inventoryChanges) ? inventoryChanges : [];
    const visibleChanges = changes.filter((change) => {
      return Number(change.quantity) !== 0;
    });

    if (visibleChanges.length === 0) {
      return "재고 변화 없음";
    }

    return visibleChanges.map((change) => {
      const label = change.label ?? change.productId ?? change.itemKey ?? "재고";
      const quantity = Number(change.quantity) || 0;
      const sign = quantity > 0 ? "+" : "";

      return `${label} ${sign}${quantity}`;
    }).join(", ");
  },

  formatCustomerEventApplicationResult(result = null) {
    if (!result) {
      return "실제 반영: 만족도/멘탈";
    }

    if (result.reason === "duplicate_choice_effect") {
      return "실제 반영: 이미 처리된 선택";
    }

    const appliedParts = [];

    if (Number(result.appliedRevenue) > 0) {
      appliedParts.push(`매출 +${Number(result.appliedRevenue).toLocaleString("ko-KR")}원`);
    }

    if (Number(result.appliedPenalty) > 0) {
      appliedParts.push(`손실/비용 -${Number(result.appliedPenalty).toLocaleString("ko-KR")}원`);
    }

    if (result.inventoryResult?.success === true) {
      const appliedChanges = Array.isArray(result.inventoryResult.appliedChanges)
        ? result.inventoryResult.appliedChanges
        : [];

      if (appliedChanges.length > 0) {
        appliedParts.push(`재고 ${this.formatCustomerEventInventoryChanges(appliedChanges)}`);
      }
    }

    if (result.inventoryResult?.success === false) {
      appliedParts.push("재고 부족으로 매출/재고 반영 차단");
    }

    if (appliedParts.length === 0) {
      appliedParts.push("만족도/멘탈");
    }

    return `실제 반영: ${appliedParts.join(" / ")}`;
  },

  createCustomerEventResultNode(choice = {}) {
    const wrapper = document.createElement("div");
    const title = document.createElement("strong");
    const customerReaction = document.createElement("p");
    const playerThought = document.createElement("p");
    const changesList = document.createElement("ul");
    const specialEffect = document.createElement("p");
    const applicationResult = document.createElement("p");
    const effects = choice.effects ?? {};
    const revenue = Number(effects.revenue) || 0;
    const cost = Number(effects.cost) || 0;
    const satisfaction = Number(effects.satisfaction) || 0;
    const mental = Number(effects.mental) || 0;
    const inventoryChanges =
      Array.isArray(choice.inventoryChanges) && choice.inventoryChanges.length > 0
        ? choice.inventoryChanges
        : effects.inventoryChanges;

    wrapper.className = "customer-event-result-card";
    title.className = "customer-event-result-title";
    title.textContent = choice.resultTitle || "선택 결과";

    customerReaction.className = "customer-event-result-reaction";
    customerReaction.textContent = choice.customerReaction
      ? `손님 반응: “${choice.customerReaction}”`
      : (choice.resultText || "선택했습니다.");

    playerThought.className = "customer-event-result-thought";
    playerThought.textContent = choice.playerThought
      ? `종업원 속마음: “${choice.playerThought}”`
      : "";

    changesList.className = "customer-event-result-changes";
    changesList.appendChild(
      this.createCustomerEventResultLine(
        "매출",
        `${this.formatCustomerEventSignedNumber(revenue)}원`
      )
    );

    if (cost !== 0) {
      changesList.appendChild(
        this.createCustomerEventResultLine(
          "비용",
          `-${Math.abs(cost).toLocaleString("ko-KR")}원`
        )
      );
    }

    changesList.appendChild(
      this.createCustomerEventResultLine(
        "만족도",
        this.formatCustomerEventSignedNumber(satisfaction)
      )
    );
    changesList.appendChild(
      this.createCustomerEventResultLine(
        "멘탈",
        this.formatCustomerEventSignedNumber(mental)
      )
    );
    changesList.appendChild(
      this.createCustomerEventResultLine(
        "재고",
        this.formatCustomerEventInventoryChanges(inventoryChanges)
      )
    );

    specialEffect.className = "customer-event-result-special";
    specialEffect.textContent = `특수 효과: ${choice.specialEffect || "없음"}`;

    applicationResult.className = "customer-event-result-application";
    applicationResult.textContent = this.formatCustomerEventApplicationResult(
      choice.effectApplicationResult
    );

    wrapper.appendChild(title);
    wrapper.appendChild(customerReaction);

    if (choice.playerThought) {
      wrapper.appendChild(playerThought);
    }

    wrapper.appendChild(changesList);
    wrapper.appendChild(specialEffect);
    wrapper.appendChild(applicationResult);

    return wrapper;
  },

  showCustomerEventModal(payload = {}, onClose = null, onChoiceSelected = null, onResponseTimeout = null) {
    if (!this.eventModal) {
      this.createCustomerEventModal();
    }

    if (!this.eventModal || !payload) {
      return;
    }

    const title = document.getElementById("customer-event-modal-title");
    const meta = document.getElementById("customer-event-modal-meta");
    const dialogue = document.getElementById("customer-event-modal-dialogue");
    const summary = document.getElementById("customer-event-modal-summary");
    const choiceList = document.getElementById("customer-event-choice-list");
    const resultText = document.getElementById("customer-event-result-text");
    const closeButton = document.getElementById("customer-event-close-button");

    if (!title || !meta || !dialogue || !summary || !choiceList || !resultText || !closeButton) {
      return;
    }

    if (this.eventModalCloseTimerId) {
      clearTimeout(this.eventModalCloseTimerId);
      this.eventModalCloseTimerId = null;
    }

    if (this.customerEventResponseTimerId) {
      clearTimeout(this.customerEventResponseTimerId);
      this.customerEventResponseTimerId = null;
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const metaParts = [
      payload.customerTypeName,
      payload.wantedProductName,
      payload.day ? `Day ${payload.day}` : ""
    ].filter(Boolean);
    const choiceSelectedCallback =
      typeof onChoiceSelected === "function" ? onChoiceSelected : null;
    const responseTimeoutCallback =
      typeof onResponseTimeout === "function" ? onResponseTimeout : null;

    this.eventModalOnClose = typeof onClose === "function" ? onClose : null;
    this.isEventModalClosing = false;
    this.customerEventResponseTimedOut = false;
    title.textContent = payload.eventTitle || "고객 이벤트";
    meta.textContent = metaParts.join(" / ");
    dialogue.textContent = payload.dialogue || "손님이 말을 걸었습니다.";
    dialogue.className = [
      "customer-event-modal-dialogue",
      payload.customerTypeId === "difficult"
        ? "customer-event-modal-dialogue--bad"
        : "customer-event-modal-dialogue--normal"
    ].join(" ");
    summary.textContent = payload.eventSummary || "";
    choiceList.innerHTML = "";
    choiceList.hidden = false;
    resultText.innerHTML = "";
    resultText.hidden = true;
    closeButton.hidden = true;

    choices.forEach((choice) => {
      const button = document.createElement("button");
      const label = document.createElement("strong");
      const description = document.createElement("span");
      const disabledReason = document.createElement("span");

      button.type = "button";
      button.className = "customer-event-choice-button";
      button.dataset.choiceId = choice.choiceId ?? "";
      button.disabled = choice.disabled === true;

      if (choice.disabled) {
        button.classList.add("is-disabled");
      }

      label.textContent = choice.label || "선택지";
      description.textContent = choice.description || "";

      button.appendChild(label);
      button.appendChild(description);

      if (choice.disabled && choice.disabledReason) {
        disabledReason.className = "customer-event-choice-disabled-reason";
        disabledReason.textContent = choice.disabledReason;
        button.appendChild(disabledReason);
      }

      button.onclick = () => {
        if (this.isEventModalClosing || choice.disabled) {
          return;
        }

        this.isEventModalClosing = true;
        if (this.customerEventResponseTimerId) {
          clearTimeout(this.customerEventResponseTimerId);
          this.customerEventResponseTimerId = null;
        }
        choiceList.querySelectorAll("button").forEach((choiceButton) => {
          choiceButton.disabled = true;
        });

        const effectApplicationResult = choiceSelectedCallback
          ? choiceSelectedCallback(choice, payload)
          : null;
        const resultChoice = {
          ...choice,
          effectApplicationResult
        };

        choiceList.hidden = true;
        resultText.innerHTML = "";
        resultText.appendChild(this.createCustomerEventResultNode(resultChoice));
        resultText.hidden = false;
        closeButton.hidden = false;
        closeButton.focus?.();
      };

      choiceList.appendChild(button);
    });

    if (choices.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "customer-event-empty";
      emptyMessage.textContent = "선택지가 없습니다.";
      choiceList.appendChild(emptyMessage);
      closeButton.hidden = false;
    }

    closeButton.onclick = () => {
      this.hideCustomerEventModal();
    };

    this.eventModal.classList.remove("hidden");

    const responseTimeoutMs = Number(payload.nuisanceTimeoutMs) || 0;

    if (payload.isNuisance === true && responseTimeoutMs > 0 && responseTimeoutCallback) {
      this.customerEventResponseTimerId = window.setTimeout(() => {
        this.customerEventResponseTimerId = null;

        if (
          this.eventModal?.classList.contains("hidden") ||
          this.isEventModalClosing ||
          this.customerEventResponseTimedOut === true
        ) {
          return;
        }

        this.customerEventResponseTimedOut = true;
        responseTimeoutCallback(payload);
      }, responseTimeoutMs);
    }
  },

  hideCustomerEventModal() {
    if (!this.eventModal) return;

    if (this.eventModalCloseTimerId) {
      clearTimeout(this.eventModalCloseTimerId);
      this.eventModalCloseTimerId = null;
    }

    if (this.customerEventResponseTimerId) {
      clearTimeout(this.customerEventResponseTimerId);
      this.customerEventResponseTimerId = null;
    }

    this.eventModal.classList.add("hidden");

    const onClose = this.eventModalOnClose;
    this.eventModalOnClose = null;
    this.isEventModalClosing = false;

    if (typeof onClose === "function") {
      onClose();
    }
  },

  hideUpgradeModal() {
    if (!this.upgradeModal) return;

    this.upgradeModal.classList.add("hidden");
  }
};
