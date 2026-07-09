/*
  RewardCodeData.js

  개발용 mock 보상 코드 데이터입니다.
  실제 출시/운영 보상 코드는 클라이언트 JS에 넣으면 안 됩니다.
  운영 단계에서는 서버 API에서 코드 검증과 지급 가능 여부를 판단해야 합니다.
*/

// 배포본에서는 클라이언트에 테스트/이벤트 보상 코드를 하드코딩하지 않습니다.
export const REWARD_CODE_MOCKS = Object.freeze([]);

export function normalizeRewardCode(code) {
  return String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function findMockRewardCode(code) {
  const normalizedCode = normalizeRewardCode(code);

  return REWARD_CODE_MOCKS.find((item) => {
    return normalizeRewardCode(item.code) === normalizedCode;
  }) ?? null;
}
