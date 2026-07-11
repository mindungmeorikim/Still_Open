/*
  analytics.config.js
  GameAnalytics DEV 연결 설정
  - GameAnalytics 화면의 Game key / Secret key를 로컬에서 직접 붙여넣으세요.
  - 채팅, 이슈, 공개 문서에는 키를 다시 적지 마세요.
*/

export const ANALYTICS_CONFIG = Object.freeze({
  environment: "DEV",
  gameKey: "f9ac3872a7e33b2326e2d7dfd9c1cef0",
  secretKey: "f7b1514fa87c1704715a49fcda816209766c5623",
  build: "web 1.0.0",
  sdkUrl: "https://unpkg.com/gameanalytics@5.0.0/dist/GameAnalytics.js",
  debug: true,
  resourceCurrencies: Object.freeze(["Gold", "Diamond"]),
  resourceItemTypes: Object.freeze([
    "Gameplay",
    "Order",
    "Upgrade",
    "Expansion",
    "Staff",
    "Shop",
    "Mission",
    "DailyReward",
    "AdReward",
    "IAP",
    "Coupon",
    "CommunityEvent",
    "Contract",
    "Wage",
    "Compensation"
  ])
});

function isPlaceholder(value) {
  return !value || /PASTE_|YOUR_|REPLACE_/i.test(String(value));
}

export function hasValidAnalyticsKeys() {
  const gameKey = String(ANALYTICS_CONFIG.gameKey ?? "").trim();
  const secretKey = String(ANALYTICS_CONFIG.secretKey ?? "").trim();

  return (
    !isPlaceholder(gameKey) &&
    !isPlaceholder(secretKey) &&
    gameKey.length >= 20 &&
    secretKey.length >= 20
  );
}
