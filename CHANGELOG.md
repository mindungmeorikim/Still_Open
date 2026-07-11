# 새로 하기 다이아·신규 점주 지원금 수정

## 최종 규칙

- `새로 하기`는 Day, 골드, 재고, 발주, 확장, 알바 등 매장 진행도만 초기화합니다.
- 보유 다이아는 초기화하지 않습니다.
- 신규 점주 지원금 다이아 30개는 사용자/설치 ID당 최초 1회만 수령할 수 있습니다.
- 수령 완료한 지원금은 `새로 하기` 후 보상함에 다시 생성되지 않습니다.
- 아직 수령하지 않은 지원금은 보상함에 한 개만 유지됩니다.

## 수정 파일

- `systems/EconomySystem.js`
- `systems/SaveSystem.js`
- `systems/DailyRewardSystem.js`
- `systems/UserIdentitySystem.js`
- `sw.js`

- 정산 하이라이트를 우측 체크 박스와 동일한 초록 카드로 복구
- 하이라이트가 비어도 Day 요약 3줄이 항상 표시되도록 보강
- 긴 하이라이트 문구 자동 축소 및 넘침 방지
- SHA256SUMS.txt 최신 상태로 재생성
- PWA 캐시를 v17-result-highlight-card로 갱신
