# v8.10.8 루트 중복 파일 정리 안내

아래 파일들은 프로젝트 루트에 잘못 남아 있는 중복 파일입니다.
실제 게임은 `ui/`, `systems/`, `data/` 폴더 안 파일을 import하므로 루트 파일은 삭제해야 합니다.

삭제 대상:
- `UIManager.js`
- `PlayerActionSystem.js`
- `StaffAssistSystem.js`
- `CleaningPointData.js`
- `WalkableAreaData.js`

주의:
- `ui/UIManager.js`는 삭제하지 마세요.
- `systems/PlayerActionSystem.js`는 삭제하지 마세요.
- `systems/StaffAssistSystem.js`는 삭제하지 마세요.
- `data/CleaningPointData.js`는 삭제하지 마세요.
- `data/WalkableAreaData.js`는 삭제하지 마세요.

changed-files-only ZIP은 덮어쓰기 방식이라 기존 파일 삭제까지 자동 처리할 수 없습니다.
위 루트 중복 파일은 VSCode 파일 탐색기에서 직접 삭제해 주세요.
