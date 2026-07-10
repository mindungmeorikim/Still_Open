# GameAnalytics DEV 키 입력

1. `config/analytics.config.js`를 엽니다.
2. 아래 두 값만 GameAnalytics의 DEV 키로 교체합니다.

```js
gameKey: "PASTE_DEV_GAME_KEY_HERE",
secretKey: "PASTE_DEV_SECRET_KEY_HERE",
```

3. 키 앞뒤의 따옴표는 유지합니다.
4. GitHub에 푸시합니다.
5. 게임을 새로 열고 분석 수집에 `동의`합니다.
6. GameAnalytics의 `Realtime` 화면에서 `game:start` 이벤트를 확인합니다.

주의: 키를 채팅이나 공개 문서에 다시 붙여넣지 마세요. JavaScript 게임의 SDK 키는 최종 배포 코드에서 확인 가능하지만, 결제 서버 비밀키나 광고 계정 비밀키를 이 파일에 함께 넣으면 안 됩니다.
