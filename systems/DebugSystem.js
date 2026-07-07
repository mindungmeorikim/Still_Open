/*
  DebugSystem.js

  역할:
  - QA / 밸런스 테스트용 마스터모드
  - 콘솔에서 window.QA 명령어로 게임 상태를 빠르게 조작한다.

  주의:
  - 배포 전 DEBUG_ENABLED를 false로 변경
  - 공통 핵심 파일 직접 수정 최소화
*/

import { GameState } from "../core/GameState.js";
import { EventBus } from "../core/EventBus.js";
import { EVENTS, GAME_PHASE } from "../core/Constants.js";

import {
  PRODUCTS,
  PRODUCT_ZONE_IDS
} from "../data/ProductData.js";

import { SHELF_INSTANCES } from "../data/ShelfPlacementData.js";

const DEBUG_ENABLED = true; // 배포 전 false로 변경

function toSafeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function emitGameStateChanged(reason = "debug") {
  EventBus.emit(EVENTS.GAME_STATE_CHANGED, {
    ...GameState,
    debugReason: reason
  });
}

export const DebugSystem = {
  isInitialized: false,

  init() {
    if (this.isInitialized || !DEBUG_ENABLED) {
      return;
    }

    this.isInitialized = true;
    this.bindConsoleCommands();
    this.bindHotkeys();
  },

  bindConsoleCommands() {
    window.QA = {
      help: () => this.help(),

      rich: () => this.rich(),
      addGold: (amount = 100000) => this.addGold(amount),
      addDiamond: (amount = 1000) => this.addDiamond(amount),

      setDay: (day = 40) => this.setDay(day),
      day1: () => this.setDay(1),
      day10: () => this.setDay(10),
      day40: () => this.setDay(40),

      unlockAllZones: () => this.unlockAllZones(),
      unlockAllProducts: () => this.unlockAllProducts(),
      unlockAll: () => this.unlockAll(),

      addAllStock: (quantity = 99) => this.addAllProductStock(quantity),
      stockAll: (quantity = 99) => this.addAllProductStock(quantity),

      fillShelves: () => this.fillAllShelves(),
      emptyShelves: () => this.emptyAllShelves(),

      startStore: () => this.startStore(),
      closeStore: () => this.closeStore(),
      nextDay: () => this.nextDay(),

      master: () => this.master()
    };
  },

  bindHotkeys() {
    window.addEventListener("keydown", (event) => {
      if (!DEBUG_ENABLED) {
        return;
      }

      const target = event.target;
      const tag = target?.tagName?.toLowerCase?.();

    // 입력창에서는 동작하지 않음
      if (
        target?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select"
      ) {
        return;
      }

      switch (event.code) {
        case "F5":
          event.preventDefault();
          QA.nextDay();
          break;

        case "F6":
          event.preventDefault();
          QA.rich();
          break;

        case "F7":
          event.preventDefault();
          QA.unlockAll();
          break;

        case "F11":
          event.preventDefault();
          QA.stockAll(99);
          break;

        case "F9":
          event.preventDefault();
          QA.fillShelves();
          break;

        case "F10":
          event.preventDefault();
          QA.master();
          break;

        default:
          break;
      }
    });
  },

  help() {
    console.table({
      "QA.rich()": "골드/다이아 대량 지급",
      "QA.setDay(40)": "Day 변경",
      "QA.unlockAllZones()": "모든 구역 해금",
      "QA.unlockAllProducts()": "모든 상품 판매권 보유 처리",
      "QA.unlockAll()": "구역 + 상품 전체 해금",
      "QA.stockAll(99) / F11": "모든 상품 창고 재고 추가",
      "QA.fillShelves()": "모든 진열대 재고 채우기",
      "QA.emptyShelves()": "모든 진열대 비우기",
      "QA.startStore()": "영업 중 상태로 변경",
      "QA.closeStore()": "영업 종료 상태로 변경",
      "QA.master()": "돈/Day/구역/상품/재고/진열대 전체 세팅"
    });

    return "QA 명령어 목록을 출력했습니다.";
  },

  rich() {
    this.addGold(9999999);
    this.addDiamond(9999);

    return "QA: 골드/다이아 지급 완료";
  },

  addGold(amount = 100000) {
    const value = Math.max(0, Math.floor(toSafeNumber(amount, 0)));

    GameState.gold = Math.max(0, Math.floor(toSafeNumber(GameState.gold, 0))) + value;

    emitGameStateChanged("debug_add_gold");

    return `QA: 골드 +${value}`;
  },

  addDiamond(amount = 1000) {
    const value = Math.max(0, Math.floor(toSafeNumber(amount, 0)));

    GameState.diamond =
      Math.max(0, Math.floor(toSafeNumber(GameState.diamond, 0))) + value;

    emitGameStateChanged("debug_add_diamond");

    return `QA: 다이아 +${value}`;
  },

  setDay(day = 1) {
    const safeDay = Math.max(1, Math.floor(toSafeNumber(day, 1)));

    GameState.day = safeDay;

    emitGameStateChanged("debug_set_day");

    return `QA: Day ${safeDay}로 변경`;
  },

  unlockAllZones() {
    if (!GameState.expansion) {
      GameState.expansion = {};
    }

    GameState.expansion.unlockedZoneIds = Object.values(PRODUCT_ZONE_IDS);
    GameState.expansion.customerAccessibleZones = [
      "door",
      "shelf",
      "counter",
      "exit",
      ...Object.values(PRODUCT_ZONE_IDS)
    ];

    emitGameStateChanged("debug_unlock_all_zones");

    return "QA: 모든 구역 해금 완료";
  },

  unlockAllProducts() {
    if (!GameState.bm) {
      GameState.bm = {};
    }

    if (!GameState.bm.ownedProductLicenses) {
      GameState.bm.ownedProductLicenses = {};
    }

    if (!GameState.bm.purchasedPremiumProducts) {
      GameState.bm.purchasedPremiumProducts = {};
    }

    PRODUCTS.forEach((product) => {
      if (product.isPremiumBM) {
        GameState.bm.purchasedPremiumProducts[product.id] = true;
        return;
      }

      GameState.bm.ownedProductLicenses[product.id] = true;
    });

    emitGameStateChanged("debug_unlock_all_products");

    return "QA: 모든 상품 판매권/프리미엄 상품 보유 처리 완료";
  },

  unlockAll() {
    this.unlockAllZones();
    this.unlockAllProducts();

    return "QA: 구역 + 상품 전체 해금 완료";
  },

  addAllProductStock(quantity = 99) {
    const amount = Math.max(1, Math.floor(toSafeNumber(quantity, 99)));

    if (!GameState.inventory) {
      GameState.inventory = {};
    }

    if (!Array.isArray(GameState.inventory.items)) {
      GameState.inventory.items = [];
    }

    PRODUCTS.forEach((product) => {
      const existingItem = GameState.inventory.items.find((item) => {
        return item.productId === product.id;
      });

      if (existingItem) {
        existingItem.quantity =
          Math.max(0, Math.floor(toSafeNumber(existingItem.quantity, 0))) + amount;
        existingItem.nextExpireDay =
          existingItem.nextExpireDay ?? GameState.day + product.shelfLifeDays;
        return;
      }

      GameState.inventory.items.push({
        productId: product.id,
        quantity: amount,
        nextExpireDay: GameState.day + product.shelfLifeDays,
        source: "debug"
      });
    });

    EventBus.emit(EVENTS.INVENTORY_CHANGED, {
      day: GameState.day,
      items: GameState.inventory.items,
      source: "debug_add_all_stock"
    });

    emitGameStateChanged("debug_add_all_stock");

    return `QA: 모든 상품 창고 재고 +${amount}`;
  },

  fillAllShelves() {
    if (!GameState.shelfStocks) {
      GameState.shelfStocks = {};
    }

    SHELF_INSTANCES.forEach((shelf) => {
      const product = PRODUCTS.find((item) => {
        return item.targetShelfInstanceId === shelf.instanceId;
      });

      const fallbackProduct = PRODUCTS.find((item) => {
        return item.shelfId === shelf.shelfId;
      });

      const targetProduct = product ?? fallbackProduct;

      if (!targetProduct) {
        return;
      }

      GameState.shelfStocks[shelf.instanceId] = {
        productId: targetProduct.id,
        currentStock: 3,
        maxStock: 3,
        shelfId: shelf.shelfId,
        reason: "debug_fill_all_shelves"
      };
    });

    emitGameStateChanged("debug_fill_all_shelves");

    return "QA: 모든 진열대 3/3 채움 완료";
  },

  emptyAllShelves() {
    if (!GameState.shelfStocks) {
      GameState.shelfStocks = {};
    }

    SHELF_INSTANCES.forEach((shelf) => {
      const currentStock = GameState.shelfStocks[shelf.instanceId];

      GameState.shelfStocks[shelf.instanceId] = {
        productId: currentStock?.productId ?? null,
        currentStock: 0,
        maxStock: currentStock?.maxStock ?? 3,
        shelfId: shelf.shelfId,
        reason: "debug_empty_all_shelves"
      };
    });

    emitGameStateChanged("debug_empty_all_shelves");

    return "QA: 모든 진열대 비우기 완료";
  },

  startStore() {
    GameState.phase = GAME_PHASE.STORE_RUNNING;

    EventBus.emit(EVENTS.STORE_OPENED, {
      day: GameState.day,
      source: "debug_start_store"
    });

    emitGameStateChanged("debug_start_store");

    return "QA: 영업 시작 상태로 변경";
  },

  closeStore() {
    GameState.phase = GAME_PHASE.STORE_CLOSED;

    EventBus.emit(EVENTS.STORE_CLOSED, {
      day: GameState.day,
      source: "debug_close_store"
    });

    emitGameStateChanged("debug_close_store");

    return "QA: 영업 종료 상태로 변경";
  },

  nextDay() {
    GameState.day = Math.max(1, Number(GameState.day || 1)) + 1;

    GameState.phase = GAME_PHASE.STORE_RUNNING;

    EventBus.emit(EVENTS.GAME_STATE_CHANGED, GameState);

    EventBus.emit(EVENTS.STORE_OPENED, {
      day: GameState.day,
      source: "debug_next_day"
    });

    return `QA: Day ${GameState.day} 영업 시작`;
  },

  master() {
    this.rich();
    this.setDay(40);
    this.unlockAll();
    this.addAllProductStock(99);
    this.fillAllShelves();

    emitGameStateChanged("debug_master");

    return "QA MASTER MODE 완료: 돈/Day/구역/상품/재고/진열대 세팅 완료";
  }
};