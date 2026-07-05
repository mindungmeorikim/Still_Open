/*
  RewardInboxData.js

  Development-only mock reward inbox data.
  Production community, launch, maintenance, and operator grants must be served
  by a backend, not shipped as client-side JavaScript data.
*/

export const REWARD_INBOX_MOCKS = Object.freeze([
  Object.freeze({
    id: "launch_reward_dia_100",
    title: "출시 기념 보상",
    message: "오늘의 정상영업 출시를 기념해 다이아를 드립니다.",
    rewards: Object.freeze([
      Object.freeze({ type: "diamond", amount: 100 })
    ]),
    source: "launch_reward",
    createdAt: "2026-07-06T00:00:00+09:00",
    expiresAt: null,
    claimed: false,
    claimedAt: null
  }),
  Object.freeze({
    id: "community_event_dia_300",
    title: "커뮤니티 이벤트 보상",
    message: "커뮤니티 이벤트 참여 보상입니다.",
    rewards: Object.freeze([
      Object.freeze({ type: "diamond", amount: 300 })
    ]),
    source: "community_event",
    createdAt: "2026-07-06T00:00:00+09:00",
    expiresAt: null,
    claimed: false,
    claimedAt: null
  }),
  Object.freeze({
    id: "maintenance_reward_gold_5000_dia_50",
    title: "점검 보상",
    message: "점검에 기다려주셔서 감사합니다.",
    rewards: Object.freeze([
      Object.freeze({ type: "gold", amount: 5000 }),
      Object.freeze({ type: "diamond", amount: 50 })
    ]),
    source: "maintenance",
    createdAt: "2026-07-06T00:00:00+09:00",
    expiresAt: null,
    claimed: false,
    claimedAt: null
  })
]);

export function cloneRewardInboxMockRewards() {
  return REWARD_INBOX_MOCKS.map((reward) => ({
    ...reward,
    rewards: reward.rewards.map((entry) => ({ ...entry }))
  }));
}
