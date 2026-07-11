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
