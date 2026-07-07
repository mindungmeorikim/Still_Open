/*
  RewardInboxData.js

  Reward inbox ships with no default grants.
  Real community, launch, maintenance, and operator rewards should be added
  only through explicit grant logic/backend data, not bundled as client-side defaults.
*/

export const REWARD_INBOX_MOCKS = Object.freeze([]);

export function cloneRewardInboxMockRewards() {
  return REWARD_INBOX_MOCKS.map((reward) => ({
    ...reward,
    rewards: reward.rewards.map((entry) => ({ ...entry }))
  }));
}
