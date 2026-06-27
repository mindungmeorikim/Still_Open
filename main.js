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

function initGame() {
  UIManager.init();
  GameFlowSystem.init();
  ResultSystem.init();

  EventBus.emit(EVENTS.GAME_INIT);

  console.log("오늘도 정상영업 v1.4 ResultSystem 초기화 완료");
}

initGame();