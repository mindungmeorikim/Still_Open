/*
  DailyRewardData.js

  역할:
  - 7일 출석 보상 데이터
  - 실제 표시 이미지는 assets/ui/dailyreward/dayN_basic.png 사용
  - UI 이미지에 적힌 수량과 지급 수량이 어긋나지 않도록 한 곳에서 관리
*/

export const DAILY_REWARD_CYCLE_DAYS = 7;

export const DAILY_REWARDS = Object.freeze([
  Object.freeze({
    day: 1,
    id: "daily_gold_1000",
    type: "gold",
    amount: 1000,
    displayName: "골드 1,000",
    imagePath: "./assets/ui/dailyreward/day1_basic.png"
  }),
  Object.freeze({
    day: 2,
    id: "daily_diamond_50",
    type: "diamond",
    amount: 50,
    displayName: "다이아 50개",
    imagePath: "./assets/ui/dailyreward/day2_basic.png"
  }),
  Object.freeze({
    day: 3,
    id: "daily_gold_2000",
    type: "gold",
    amount: 2000,
    displayName: "골드 2,000",
    imagePath: "./assets/ui/dailyreward/day3_basic.png"
  }),
  Object.freeze({
    day: 4,
    id: "daily_coffee_ticket_1",
    type: "coffeeTicket",
    amount: 1,
    displayName: "커피 교환권 1장",
    imagePath: "./assets/ui/dailyreward/day4_basic.png"
  }),
  Object.freeze({
    day: 5,
    id: "daily_diamond_100",
    type: "diamond",
    amount: 100,
    displayName: "다이아 100개",
    imagePath: "./assets/ui/dailyreward/day5_basic.png"
  }),
  Object.freeze({
    day: 6,
    id: "daily_ad_skip_ticket_1",
    type: "adSkipTicket",
    amount: 1,
    displayName: "광고 스킵권 1장",
    imagePath: "./assets/ui/dailyreward/day6_basic.png"
  }),
  Object.freeze({
    day: 7,
    id: "daily_peak_time_coupon_1",
    type: "peakTimeCoupon",
    amount: 1,
    displayName: "피크타임 쿠폰 1장",
    imagePath: "./assets/ui/dailyreward/day7_basic.png"
  })
]);

export function getDailyRewardByDay(day) {
  const normalizedDay = Math.min(
    DAILY_REWARD_CYCLE_DAYS,
    Math.max(1, Math.floor(Number(day) || 1))
  );

  return DAILY_REWARDS.find((reward) => reward.day === normalizedDay) ?? DAILY_REWARDS[0];
}
