/*
  main.js
  공통 파일 - 임의 수정 금지
  역할: 게임 최초 실행 및 시스템 초기화
*/

import { EventBus } from "./core/EventBus.js";
import { EVENTS } from "./core/Constants.js";

import { UIManager } from "./ui/UIManager.js";
import { GameFlowSystem } from "./systems/GameFlowSystem.js";
import { ResultSystem } from "./systems/ResultSystem.js";
import { UpgradeSystem } from "./systems/UpgradeSystem.js";
import { CustomerSystem } from "./systems/CustomerSystem.js";
import { ExpirationSystem } from "./systems/ExpirationSystem.js";
import { InventorySystem } from "./systems/InventorySystem.js";
import { OrderSystem } from "./systems/OrderSystem.js";
import { ExpansionSystem } from "./systems/ExpansionSystem.js"
import { PlayerMovementSystem } from "./systems/PlayerMovementSystem.js";

function initGame() {
  UIManager.init();
  GameFlowSystem.init();
  ResultSystem.init();
  UpgradeSystem.init();
  CustomerSystem.init();
  ExpirationSystem.init();
  InventorySystem.init();
  OrderSystem.init();
  ExpansionSystem.init();
  PlayerMovementSystem.init();
  EventBus.emit(EVENTS.GAME_INIT);
  requestAnimationFrame(gameloop);

  console.log("오늘도 정상영업 v2.3 상품 재고 및 유통기한 시스템 초기화 완료");
}

function gameloop() {
  PlayerMovementSystem.update();
  requestAnimationFrame(gameloop);
}
initGame();
