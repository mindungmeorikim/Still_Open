/*
  DailyMissionData.js
  BM 최종본 기준 일일 미션 후보 7종.
  매일 3개가 Day 기준 고정 랜덤으로 선정된다.
*/

export const DAILY_MISSION_REWARDS = Object.freeze([
  Object.freeze({ count: 1, type: "gold", amount: 750, label: "750골드" }),
  Object.freeze({ count: 2, type: "gold", amount: 1500, label: "1,500골드" }),
  Object.freeze({ count: 3, type: "diamond", amount: 10, label: "다이아 10개" })
]);

export const DAILY_MISSIONS = Object.freeze([
  Object.freeze({
    id: "checkout_10",
    title: "운영 미션",
    description: "계산 10회 성공하기",
    target: 10,
    progressKey: "checkoutSuccessCount"
  }),
  Object.freeze({
    id: "restock_3",
    title: "재고 미션",
    description: "진열대 3회 보충하기",
    target: 3,
    progressKey: "restockCount"
  }),
  Object.freeze({
    id: "nuisance_safe",
    title: "진상 대응 미션",
    description: "화난 손님 없이 영업 종료하기",
    target: 1,
    progressKey: "nuisanceSafe"
  }),
  Object.freeze({
    id: "recommended_5",
    title: "상품 미션",
    description: "오늘 추천 상품 5개 판매하기",
    target: 5,
    progressKey: "recommendedProductSaleCount"
  }),
  Object.freeze({
    id: "mental_30",
    title: "멘탈 미션",
    description: "멘탈 30 이상으로 영업 종료하기",
    target: 30,
    progressKey: "mentalAtClose"
  }),
  Object.freeze({
    id: "revenue_120",
    title: "매출 미션",
    description: "목표 매출 120% 달성하기",
    target: 120,
    progressKey: "revenuePercent"
  }),
  Object.freeze({
    id: "cleaning_1",
    title: "청소 미션",
    description: "매장 청소 1회 완료하기",
    target: 1,
    progressKey: "cleaningCount"
  })
]);
