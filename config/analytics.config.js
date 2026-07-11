/*
  analytics.config.js
  GameAnalytics PROD 연결 설정
  - GameAnalytics 화면의 Game key / Secret key를 로컬에서 직접 붙여넣으세요.
  - 채팅, 이슈, 공개 문서에는 키를 다시 적지 마세요.
*/

export const ANALYTICS_CONFIG = Object.freeze({
  environment: "PROD",
  gameKey: "fdc00e8aa32fa8964ffed6aca81bdfce",
  secretKey: "4bf13de7abb5e7d052afe80db9a4a5b8354b7f92",
  build: "web 1.0.1",
  sdkUrl: "https://unpkg.com/gameanalytics@5.0.0/dist/GameAnalytics.min.js",
  debug: false,
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
