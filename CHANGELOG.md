[v7.13.98]
Removed
- 확장 구역에 표시되던 개발용 안내 핫스팟/말풍선 제거.
- "추가 진열대 / 냉장·도시락 / 프리미엄 구역 / 오브젝트 에셋 연결 예정" 문구가 플레이 화면에 노출되지 않도록 정리.

Changed
- 확장 구역 바닥, 오브젝트 차단 범위, 이동 가능 영역은 변경하지 않음.

[v7.13.97]
Fixed
- 멀티 포인트 이동 판정이 입구/창고 앞 보라색 통로에서 너무 강하게 적용되어 플레이어가 시작 위치에서 움직이지 못하던 문제 수정.
- entry_sidewalk_corridor는 발 중앙점 기준으로 통과시키고, 매장 내부 밝은 바닥/외곽 벽 쪽은 기존 멀티 포인트 판정을 유지하도록 분리.
- 플레이어 기본 시작 Y좌표를 통로 안쪽으로 소폭 보정하고, 이전 시작 좌표(610,650) 저장값은 새 시작 좌표로 자동 보정.
- 아르바이트생도 같은 통로 완화 판정을 공유하여 입구/창고 앞 연결부 이동이 끊기지 않도록 조정.

[v7.13.96]
Changed
- 플레이어 이동 가능 영역 판정을 발 중앙점 1개 기준에서 발 주변 다중 프로브 기준으로 변경.
- 아르바이트생 이동 가능 영역도 같은 다중 프로브 방식으로 변경해 외곽 벽을 타는 느낌을 완화.
- 구역 해금 후 연결부가 끊기지 않도록 몸통 전체가 아닌 발판 중심선 기준으로만 보정.
- 기존 오브젝트 차단 범위와 해금 구역 데이터는 변경하지 않음.

[v7.13.95]
Changed
- 전체 매장 외곽 벽 쪽 이동 가능 영역 보정값을 20px에서 30px로 추가 축소.
- 해금 구역끼리 이어지는 내부 경계와 기존 오브젝트 차단 범위는 변경하지 않음.

[v7.13.94]
Changed
- 벽 타는 느낌을 줄이기 위해 전체 매장 외곽 벽 방향 이동 가능 영역 보정값을 10px에서 20px으로 조정.
- 해금 구역끼리 이어지는 내부 연결 경계와 기존 오브젝트 차단 범위는 변경하지 않음.

[v7.13.93]
Changed
- 이동 가능 영역 보정 방식을 구역 전체 좌우 축소에서 전체 매장 외곽 벽면 방향만 안쪽으로 컷하는 방식으로 변경.
- zone_basic ↔ zone_extra_shelf/zone_cold_food 등 해금 구역 연결부는 줄이지 않아 구역 해금 후 이동 동선이 끊기지 않도록 조정.
- 기존 오브젝트 차단 범위는 변경하지 않음.

[v7.13.92]
Changed
- 이동 가능 영역이 벽/외곽선에 너무 붙어 캐릭터가 벽을 타는 것처럼 보이던 부분을 완화.
- bright_empty_space 기반 이동 밴드의 좌우 가장자리를 소폭 안쪽으로 보정.
- 창고박스 앞~입구 앞 통로의 외곽 꼭짓점을 소폭 안쪽으로 조정.
- 기존 오브젝트 차단 범위/빨간 충돌 박스는 변경하지 않음.

[v7.13.91]
Fixed
- Day 1 기본 구역에서 청소 도구 오른쪽 검은 미해금 구역 일부가 이동 가능으로 열리던 문제 수정.
- 원인인 zone_basic_counter_cleaning_buffer 보조 이동 영역을 제거하고 bright_empty_space 기반 기본 밝은 바닥 밴드만 사용하도록 정리.
- 기존 오브젝트 차단 범위와 창고/청소/계산대 충돌 범위는 변경하지 않음.

[v7.13.90]
Fixed
- 창고박스 왼쪽/뒤쪽 도로로 플레이어가 들어갔다가 끼는 문제를 방지하기 위해 입구/창고 앞 이동 가능 통로를 창고박스 이미지 앞 동선부터만 허용하도록 축소.
- 기존 오브젝트 차단 범위와 창고박스 충돌 범위는 변경하지 않음.

[v7.13.89]
Changed
- 플레이어/아르바이트생 이동 가능 영역을 bright_empty_space 에셋의 실제 밝은 바닥 기준 밴드로 재정의.
- 기존 ExpansionData movementBounds의 대략 사각형 이동 허용값을 WalkableAreaData에서 사용하지 않도록 분리.
- 해금되지 않은 2~4구역은 이동 가능 영역에 포함되지 않도록 유지.
- 보라색으로 표시한 창고박스 앞~입구 앞 통로만 기본 이동 가능 영역으로 유지하되, 도로 아래쪽으로 과하게 넓어지지 않도록 조정.
- 플레이어 이동 가능 판정을 캐릭터 좌상단이 아니라 발 위치 기준으로 변경해 화면상 바닥/벽 판정이 더 자연스럽게 맞도록 수정.
- 아르바이트생 이동 가능 판정도 발 위치 기준으로 변경하고, 출근 시작 좌표를 통로 안쪽으로 보정.

[v7.13.88]
Added
- 오브젝트 차단 범위와 분리된 `data/WalkableAreaData.js` 이동 가능 영역 데이터를 추가.
- 매장 1~4구역 이동 영역과 창고박스~입구 앞 보라색 통로 이동 영역을 별도 관리하도록 구성.

Changed
- 플레이어 이동 시 기존 오브젝트 충돌 검사에 더해 이동 가능 영역 밖으로 나가지 못하도록 제한.
- 아르바이트생 자동 이동에도 플레이어와 같은 이동 가능 영역 체크를 적용.

Fixed
- 플레이어/아르바이트생이 매장 벽면, 도로 쪽, 미해금 구역 바깥으로 빠져나갈 수 있는 문제를 이동 가능 영역 기준으로 차단.
- 기존 계산대/진열대/냉장고/창고박스/청소도구 오브젝트 차단 범위는 변경하지 않음.

[v7.13.87]
Changed
- 청소 라벨 문구를 `주변 청소`만 표시되도록 고정하고, CleaningPointData의 구역명 라벨도 `주변`으로 단순화.
- 이전 숨김 CSS 영향이 남아도 청소 라벨이 보이도록 최종 표시 override 추가.
- 플레이어 시작 좌표는 X축 610을 유지하고 Y축만 입구 좌표 근처인 650으로 조정.
- 기존 저장 데이터의 예전 시작 좌표 `(600,705)`, `(610,548)`는 로드/초기화 시 새 시작 좌표 `(610,650)`으로 보정.
- 오브젝트 차단 범위와 이동 가능 범위는 변경하지 않음.

[v7.13.86]
Changed
- 청소 구역 라벨을 숨김 상태에서 다시 표시하도록 복구.
- 라벨 문구를 구역명 없이 "주변 청소"로 고정.
- 청소 좌표, 상호작용, 충돌 범위는 변경하지 않음.

[v7.13.85]
Changed
- 청소 도구 앞에 표시되던 구역명/청소 텍스트 라벨을 숨겨 청소 비주얼만 보이도록 조정.
- 청소 좌표, 상호작용, 충돌 범위는 변경하지 않음.

[v7.13.84]
Changed
- 플레이어 기본 시작 좌표를 입구 오른쪽 위치로 변경했습니다. (x 610, y 548)
- 새 매장 시작/무한 모드 초기화 기본 스냅샷의 플레이어 좌표도 같은 입구 오른쪽 좌표로 맞췄습니다.
- 기존 저장 데이터에 남아 있는 예전 시작 좌표(x 600, y 705)는 로드 시 새 입구 오른쪽 좌표로 한 번 보정되도록 처리했습니다.
- 이동 가능 영역과 오브젝트 차단 범위는 수정하지 않았습니다.


[v7.13.83]
Fixed
- 손님이 기존 door CSS 좌표에 먼저 소환된 뒤 아래로 내려갔다가 입구로 다시 올라오는 입장 연출 문제 수정.
- 손님 door 상태 초기 좌표를 입구 이미지 좌표와 동일한 x 537 / y 650으로 고정.
- 손님 입장 루트의 첫 웨이포인트는 인덱스별 lane offset을 적용하지 않도록 변경해 항상 입구 좌표에서 시작하게 수정.
- 계산대 대기 좌표, 쇼핑 좌표, 오브젝트 차단 범위는 변경하지 않음.


[v7.13.82]
Changed
- 손님 입장 연출의 첫 진입 웨이포인트를 입구 표시 좌표와 같은 기준으로 정렬 (x 537, y 650).
- 왼쪽/오른쪽 쇼핑 루트 모두 동일한 입구 시작점을 거치도록 정리.
- 계산대 대기 좌표, 쇼핑 목표 좌표, 기존 오브젝트 차단 범위는 수정하지 않음.


[v7.13.81]
Changed
- 입구 표시 이미지 X 좌표를 유지된 Y값 기준으로 왼쪽 40px 이동 (left 577px → 537px).
- 알바 입구 기준 좌표를 X축만 왼쪽 40px 이동 (x 577 → 537, y 유지).
- 발주 박스 좌표를 Y축 그대로 두고 X축만 왼쪽 40px 이동 (x 518 → 478, standX 510 → 470).
- 발주 박스 CSS 최종 오버라이드를 갱신해 화면 표시 위치와 상호작용 좌표가 일치하도록 정리.

## [v7.13.79] Staff Carrying Stock Box Scale Fix

### Fixed
- 알바가 진열대 보충 재고를 들고 이동할 때 창고 박스 원본 에셋 크기가 그대로 커지던 문제를 수정했습니다.
- 알바가 들고 오는 재고 박스를 캐릭터 손 주변의 작은 소품 크기(`27px × 23px`)로 고정했습니다.
- 이동 방향에 따라 박스가 손 쪽에 붙어 보이도록 좌/우/정면 위치 보정을 추가했습니다.

### Maintained
- 알바 이동 경로, 진열대 보충 로직, 창고 재고 차감 로직, 손님 NPC 충돌 무시 설정은 변경하지 않았습니다.

## [v7.13.78] Interaction Range Priority Tuning
- Changed: 계산대 키보드/터치 상호작용 범위를 75px로 별도 축소해 진열대 근처에서 계산이 먼저 실행되는 상황을 줄였습니다.
- Changed: 진열대 상호작용 범위를 기본/신선/온장고 105px, 냉장고 115px로 축소했습니다.
- Changed: 청소 포인트 상호작용 범위를 100px 기준으로 정리했습니다.
- Changed: 상호작용키 우선순위를 빈 진열대/보충 가능 진열대 → 청소 → 계산대 → 일반 진열대 순서로 조정했습니다.
- Fixed: 계산대 클릭/터치에도 거리 제한을 적용해 멀리서 계산대가 눌리는 상황을 막았습니다.
- Changed: 상호작용 안내 효과 거리도 실제 판정 거리와 맞춰 체감 범위가 어긋나지 않도록 조정했습니다.

## [v7.13.77] Nuisance Event Modal Flow Merge
- Added: 진상 손님 입장 시 고유 입장 대사 말풍선이 표시되도록 고객 데이터와 렌더 payload를 연결했습니다.
- Changed: 진상 손님 멘탈 감소는 입장 시점이 아니라 계산대 이벤트 모달이 실제로 열릴 때 1회만 적용되도록 조정했습니다.
- Changed: 진상 손님이 계산대에 도착하면 사용 가능한 진상 이벤트를 우선 생성해 선택지 모달이 확정적으로 뜨도록 병합했습니다.
- Fixed: 고객 이벤트 모달 표시 중 영업 시간, 손님 대기/이동 흐름, 플레이어 이동/상호작용이 같이 정지되도록 잠금 클래스를 연결했습니다.
- Preserved: 직전 재고/계산 안정화 수정과 손님 입장 경로 우회 수정은 유지했습니다.

## [v7.13.76] Stock Checkout Reservation Guard
- Fixed: 창고 수용량 표시가 실제 BM 창고 용량과 다르게 계산되어 `41/40`처럼 보일 수 있던 문제를 수정했습니다.
- Fixed: 같은 틱에서 여러 손님이 같은 상품을 동시에 선택할 때 예약 수량을 반영해 초과 판매 가능성을 줄였습니다.
- Fixed: 계산 payload 생성 전과 계산 완료 직전에 실제 재고를 재검증해 재고 부족 상태의 판매 완료를 차단했습니다.

## [v7.13.75] Customer Entry Route Counter Avoidance
- Added: 손님이 입구에서 진열대로 이동할 때 계산대 PNG를 직선으로 관통하지 않도록 입구 전용 우회 경유점을 추가했습니다.
- Changed: 진열대 목표 좌표가 계산대 왼쪽/오른쪽 어느 방향인지에 따라 하단 통로를 먼저 탄 뒤 진열대로 이동하도록 손님 입장 애니메이션을 분기했습니다.
- Preserved: 계산대 대기열 좌표, 계산대 상호작용 오브젝트, 손님 계산 대기/계산 완료 로직은 변경하지 않았습니다.

## [v7.13.74] Staff Restock Route Counter Queue Avoidance
- Changed: 알바생이 진열대 보충을 위해 창고를 왕복할 때 계산대 대기 손님이 있으면 하단 우회 경유점을 추가로 타도록 보완했습니다.
- Fixed: 계산대에서 손님이 대기 중일 때 알바가 손님 줄을 관통하는 것처럼 보일 수 있는 상황을 막기 위해 손님 대기열을 동적 충돌 대상으로 포함했습니다.
- Preserved: 플레이어 발주 박스 정리 동선, 창고 박스 열림/닫힘, 진열대 보충 처리, 알바 재고 박스 표시 기능은 유지했습니다.

## [v7.13.73] Staff Restock Route Rebuild
- Changed: 알바생 진열대 보충 시 청소 대기 위치에서 바로 창고로 꺾지 않고, 입구로 나간 뒤 플레이어 발주 박스 정리 동선과 같은 물류 통로를 타도록 경로를 재정리했습니다.
- Changed: 창고에서 재고를 든 뒤에는 창고→발주 박스/입구 동선을 반대로 따라 매장으로 들어오고, 이후 목표 진열대로 이동하도록 분리했습니다.
- Fixed: 알바 이동 경유지에 하단 통로/구역별 접근 경로를 추가해 계산대와 진열대 충돌 영역을 통과하는 것처럼 보이는 상황을 줄였습니다.
- Added: 알바가 재고를 들고 이동하는 동안 작은 박스 시각 요소가 보이도록 상태/표시를 연결했습니다.

## [v7.13.72] Delivery Box X Position + Counter Feedback Guard
- Changed: 발주 도착 박스의 Y좌표는 `615px`로 고정하고 X좌표만 `568px`에서 `518px`로 왼쪽 50px 이동했습니다.
- Changed: 발주 박스 자동 이동 기준 좌표도 같은 방향으로 50px 이동해 클릭 후 플레이어 이동 위치가 박스와 어긋나지 않도록 맞췄습니다.
- Fixed: 계산대에 다시 생기던 투명 사각 잔상은 계산대용 상호작용 피드백 레이어가 재생성되면서 생길 수 있어, 계산대에 한해 해당 보조 레이어 생성을 차단하고 기존 잔상 노드를 즉시 제거하도록 수정했습니다.
- Preserved: 발주 박스 Y좌표, 계산대 클릭/상호작용 기능, 발주/창고 정리 흐름은 변경하지 않았습니다.

## [v7.13.69] Checkout Customer Queue X Position Third Fine Tune
- Changed: 계산대 대기 손님 줄의 Y축은 유지하고 X축만 20px 오른쪽으로 조정했습니다.
- Preserved: 계산대 상호작용키, 충돌 영역, 플레이어/알바 이동 좌표는 변경하지 않았습니다.

## [v7.13.66] Checkout Customer Queue X Position Second Fine Tune

### Changed
- 손님 계산대 대기열의 기준 X좌표를 이전 조정 폭만큼 한 번 더 왼쪽으로 이동했습니다.
- Y좌표는 그대로 유지해 대기열 높이는 바꾸지 않았습니다.

### Maintained
- 계산대 상호작용키, 계산대 충돌 영역, 플레이어/알바 이동 좌표는 변경하지 않았습니다.

## [v7.13.65] Checkout Customer Queue X Position Fine Tune

### Changed
- 손님 계산대 대기열의 기준 X좌표를 왼쪽으로 조정해 계산대 이미지보다 왼쪽 앞쪽에 줄 서도록 수정했습니다.

### Maintained
- 계산대 상호작용키, 계산대 충돌 영역, 플레이어/알바 이동 좌표는 변경하지 않았습니다.

## [v7.13.64] Checkout Customer Queue Position Fine Tune

### Changed
- 손님 계산대 대기열 기준 좌표를 입구 쪽에서 계산대 앞쪽 통로로 다시 이동했습니다.
- 대기열은 기존처럼 뒤 손님이 왼쪽 아래로 이어지는 `--queue-x/--queue-y` 오프셋 구조를 유지합니다.

### Maintained
- 계산대 상호작용키/클릭 가능 영역은 변경하지 않았습니다.
- 계산대 충돌 영역, 플레이어 이동 좌표, 알바 이동 좌표는 변경하지 않았습니다.

## [v7.13.63] Checkout Counter NPC Collision Guard

### Fixed
- 손님 계산대 대기 위치를 계산대 이미지 위가 아니라 계산대 앞쪽 통로로 내려, 손님이 계산대 위에 서 있는 것처럼 보이는 현상을 수정했습니다.
- 계산대 충돌 영역을 실제 계산대 PNG 표시 크기에 맞춰 확장해, 캐릭터 발 위치가 계산대 이미지를 통과하지 않도록 보정했습니다.
- 알바 이동 중 발 위치 기준 충돌 검사를 추가해 계산대 영역을 통과하지 않도록 보호했습니다.

### Maintained
- 계산대 상호작용 오브젝트와 상호작용키 동작은 유지했습니다.
- 계산대 클릭/키 입력 가능 영역은 제거하지 않았습니다.
- 플레이어/상품/청소/창고 좌표는 변경하지 않았습니다.

## [v7.13.62] Checkout Counter Interaction Effect Cleanup

### Fixed
- 계산대 주변에 남아 보이던 연한 사각 배경을 제거했습니다.
- PNG 투명 여백이 아니라 `interaction-effect` 보조 레이어에서 보이던 잔상이므로, 계산대에 한해 해당 레이어를 완전히 숨겼습니다.

### Unchanged
- 계산대 상호작용 좌표와 클릭 가능 영역은 변경하지 않았습니다.
- 플레이어/손님/알바 이동 좌표는 변경하지 않았습니다.


## [v7.13.61] Checkout Counter Transparent Canvas Cleanup
- Changed: `assets/objects/checkout_counter/checkout_counter.png`의 외곽 투명 캔버스를 잘라내 계산대 이미지만 표시되도록 정리했습니다.
- Changed: `style.css` 최종 override에 계산대 배경/테두리/의사요소/상호작용 이펙트 잔상을 차단하는 규칙을 추가했습니다.
- Maintained: 계산대 상호작용 좌표와 클릭 가능 영역, 플레이어/손님/알바 이동 좌표는 변경하지 않았습니다.

## [v7.13.60] Staff Entry Spawn Lower Adjustment
- Changed: 알바 출근 소환 위치를 입구 이미지보다 아래쪽으로 내려, 매장 밖에서 안으로 들어오는 느낌이 나도록 조정했습니다.
- Changed: UIManager의 실제 입구 에셋 좌표 참조값에도 Y축 추가 오프셋을 적용해, DOM 스냅 위치와 StaffAssistSystem 출근 시작 좌표가 어긋나지 않도록 맞췄습니다.
- Maintained: 알바 청소 대기 위치, 창고/진열대/청소 작업 좌표, 플레이어/손님 좌표는 변경하지 않았습니다.

## [v7.13.59] Staff Entry Spawn Align With Entrance Marker
- Changed: 알바 출근 시작 좌표를 입구 이미지 에셋 좌표와 일치하도록 조정했습니다.
- Changed: UIManager의 알바 기본/스냅 좌표가 하드코딩된 이전 입구 좌표 대신 실제 #entrance-zone 좌표를 우선 참조하도록 보강했습니다.
- Fixed: 영업 시작 순간 알바가 매장 안 위치에 먼저 보였다가 입구로 튀어 보이는 현상을 줄이기 위해 기본 소환 기준을 입구 에셋 위치로 통일했습니다.

## [v7.13.56] Staff Entry Visual Reset

## [v7.13.58] Staff Entry Spawn Guard + Favicon
- Fixed: 영업 시작 시 알바 캐릭터가 이전 매장 대기 위치에 잠깐 보였다가 입구로 튀는 것처럼 보이는 현상을 막기 위해 `STAFF_SHIFT_ENTRY_REQUESTED` 순간에 알바 DOM을 먼저 입구 좌표로 숨김 스냅 처리했습니다.
- Fixed: 영업 중이 아닌 단계에서는 알바 캐릭터가 화면에 남아 보이지 않도록 렌더 가드를 추가했습니다.
- Fixed: 알바 정보 갱신 이벤트가 영업 중에 다시 들어와도 이미 출근/근무 중이면 입구부터 재입장하지 않도록 보호했습니다.
- Added: 개발 콘솔의 `/favicon.ico 404` 경고를 없애기 위한 기본 favicon 파일을 추가했습니다.


## [v7.13.57] Staff Entry Transition Guard

### Fixed
- 영업 시작 시 알바 캐릭터가 기존 매장 안 대기 위치에서 입구로 되감기 이동하는 것처럼 보이던 CSS 좌표 transition 문제를 차단했습니다.
- 알바 이동은 기존 StaffAssistSystem의 requestAnimationFrame 좌표 갱신만 사용하도록 유지했습니다.

### Unchanged
- 알바 출근 경로, 청소 대기 위치, 창고/진열대/청소 작업 좌표는 변경하지 않았습니다.


### Fixed
- 영업 시작 시 알바 캐릭터가 이전 매장 내부 위치에 잠깐 보였다가 입구로 되돌아가는 것처럼 보일 수 있는 렌더 순서를 보정했습니다.
- 알바가 `off_duty`로 숨겨질 때도 DOM 좌표를 입구/현재 상태 좌표로 먼저 맞춰, 다음 출근 렌더에서 이전 대기 위치가 노출되지 않도록 수정했습니다.

### Maintained
- 알바 출근 경로, 청소 대기 위치, 창고/진열대/청소 작업 좌표, 플레이어/손님 좌표는 변경하지 않았습니다.

## [v7.13.55] Staff Cleaning Idle Position Fine Tune

### Changed
- 청소 도구함 기준 알바 대기 위치를 이전 조정폭만큼 한 번 더 아래로 내려, 청소 에셋 옆에 더 자연스럽게 서도록 수정했습니다.

### Maintained
- 청소 상호작용 좌표, 청소 에셋 위치, 실제 청소 작업 위치(`staffX/staffY`), 창고/진열대/플레이어 이동 좌표는 변경하지 않았습니다.

## [v7.13.54] Staff Cleaning Idle Position Adjustment

### Changed
- 청소 도구함 기준 알바 대기 위치 오프셋을 조정해 알바가 청소 에셋 옆에 자연스럽게 서도록 수정했습니다.

### Maintained
- 청소 상호작용 좌표, 청소 에셋 위치, 실제 청소 작업 위치(`staffX/staffY`), 창고/진열대/플레이어 이동 좌표는 변경하지 않았습니다.

## [v7.13.53] BM SDK Guard Merge

### Added
- `BMSystem.js`에 결제 SDK/광고 SDK 연결 상태 상수와 상태 조회 함수를 추가했습니다.
- BM 상태 payload에 `sdk.paymentReady`, `sdk.adReady` 값을 포함했습니다.

### Changed
- 유료 다이아 구매는 결제 SDK가 연결되지 않았을 때 실제 지급/구매 처리로 넘어가지 않고 안내 메시지를 반환하도록 차단했습니다.
- 광고 보상은 광고 SDK가 연결되지 않았을 때 기본 광고 시청 수령을 차단하되, 보유한 광고 스킵권 사용 수령은 유지했습니다.
- 광고 보상 버튼 문구가 SDK 상태에 따라 `SDK 미연결`, `광고 보기`, `스킵권으로 받기`, `수령 완료`로 구분되도록 정리했습니다.

### Maintained
- 기존 골드 상품 구매, 피크타임 쿠폰, 판매권/상품 강화, 창고/진열대/알바 강화 로직은 변경하지 않았습니다.
- 이전 오디오 설정 병합 파일과 최신 UI/튜토리얼/진열대 수정사항은 유지했습니다.

## [v7.13.52] Audio Settings Controls Merge

### Added
- 설정 팝업에 효과음/배경음 on/off 체크박스와 0~100% 볼륨 슬라이더를 추가했습니다.
- `AudioSystem`에 저장형 오디오 설정(`localStorage`), BGM/SFX 볼륨 배율 적용, 설정 변경 즉시 반영 로직을 추가했습니다.

### Maintained
- 최신본의 디버그 충돌박스, 진열대 재고 경고 아이콘, UI 핫픽스, 기존 오디오 이벤트 연결은 덮어쓰지 않았습니다.

## [v7.13.51] Audio System Merge

### Added
- 오디오 작업본의 `AudioSystem.js`와 BGM/SFX mp3 파일 15종을 최신 작업본에 병합했습니다.
- 타이틀/영업/정산 BGM 전환과 클릭, 발주 확정, 진열 보충, 계산 완료, 재화 획득, 이벤트 성공/실패 효과음 연결을 추가했습니다.

### Changed
- `main.js`에서 `AudioSystem` import와 초기화만 추가했습니다.

### Maintained
- 최신 작업본의 신선매대 에셋, 보상함 기본 보상 제거, CSS 최종 override 구역, 튜토리얼/상점/알바/정산 UI 수정사항은 덮어쓰지 않았습니다.

## [v7.13.50] Reward Inbox Default Grant Removal

### Fixed
- 보상함에 기본으로 들어가 있던 테스트/임시 보상 3개를 제거했습니다.
- 기존 저장 데이터에 남아 있을 수 있는 임시 보상 ID도 보상함 상태 정규화 단계에서 자동으로 제외되도록 정리했습니다.

### Maintained
- 쿠폰 코드 입력, 실제 보상 추가, 개별 수령/모두 받기, 재화 지급 로직은 유지했습니다.

## [v7.13.49] Fresh Shelf Shop Direction Fix

### Fixed
- BM 상점 UI의 `진열대 강화` 카드에서 신선매대 이미지를 다른 진열대 강화 카드들과 동일하게 왼쪽 방향 에셋(`fresh_shelf_full_left.png`)으로 맞췄습니다.

### Maintained
- 기본 매대, 냉장고, 온장고 에셋 경로와 상점 UI 레이아웃/비율/버튼 동작은 변경하지 않았습니다.

## [v7.13.48] Fresh Shelf Shop Asset Swap

### Changed
- BM 상점 UI의 `진열대 강화` 카드에서 신선 매대 이미지를 임시 대체용 기본 매대 오른쪽 에셋에서 실제 신선 매대 에셋(`fresh_shelf_full_right.png`)으로 교체했습니다.

### Maintained
- 기본 매대, 냉장고, 온장고 에셋 경로와 상점 UI 레이아웃/비율/버튼 동작은 변경하지 않았습니다.

## [v7.13.47] CSS Final Override and Console Cleanup

### Added
- `style.css` 맨 아래에 `[FINAL OVERRIDE ZONE]` 기준 구역을 추가해 이후 작은 화면/16:9/팝업 위치 보정을 한 곳에 누적할 수 있도록 정리했습니다.
- `PROMPT_RULE.md`에 CSS 최종 오버라이드 작성 규칙과 콘솔 로그 사용 규칙을 추가했습니다.

### Changed
- 일반 플레이 중 자동으로 반복 출력되던 손님 흐름/Day Timer/업그레이드 확인용 `console.log`를 제거했습니다.
- QA 단축키는 기능은 유지하되, 단축키 실행 시 콘솔에 결과 문자열을 자동 출력하지 않도록 정리했습니다.

### Note
- `main.js`는 이번 요청 범위에서 제외해 수정하지 않았습니다.

## [v7.13.46] Small Screen Full View Button Fix

### Fixed
- 작은 화면에서 우측 상단 설정/도움말 아이콘이 `전체보기` 버튼을 가려 보이지 않던 문제를 수정했습니다.
- `전체보기` 버튼을 우측 아이콘 줄 아래로 충분히 내려, 작은 화면에서도 독립적으로 보이도록 보정했습니다.

## [v7.13.45] Tutorial In-Game Ready Return Flow

### Changed
- 튜토리얼 마지막 `[영업 시작]` 클릭 시 타이틀 화면이 아니라 인게임 Day 1 `영업 준비` 화면으로 복귀하도록 변경했습니다.
- 튜토리얼 완료 직후 Day 1 브리핑 팝업이 바로 뜨지 않고, 유저가 직접 하단 `[발주]` 버튼부터 다시 시작하도록 정리했습니다.
- 튜토리얼 마지막 안내 문구를 `본격 게임이 시작됩니다! 세계 1등 편의점이 되는 날까지 발주부터 시작해보세요~`로 유지했습니다.

### Fixed
- 튜토리얼 연습 중 발생한 발주 수량, 배송/도착 박스, 창고/진열대 재고, `todayStats.cost` 포함 당일 정산 수치를 초기화한 뒤 인게임 준비 화면으로 이동하도록 유지했습니다.

## [v7.13.44] Tutorial Real Game Start Reset Flow

### Changed
- 튜토리얼 마지막 `[영업 시작]` 클릭 시 실제 영업을 바로 시작하지 않고, 튜토리얼 연습 데이터를 초기화한 뒤 진짜 Day 1 발주 단계부터 다시 시작하도록 변경했습니다.
- 본게임 시작 안내 문구를 `본격 게임이 시작됩니다! 세계 1등 편의점이 되는 날까지 발주부터 시작해보세요~`로 분리했습니다.

### Fixed
- 튜토리얼에서 선택한 발주 수량, 배송/도착 박스 상태, 창고 재고, 진열대 재고가 실제 Day 1 영업에 이어지지 않도록 초기화했습니다.
- 튜토리얼 발주 때 누적된 `todayStats.cost`를 포함해 당일 정산 수치가 본게임 시작 전에 0으로 초기화되도록 확인했습니다.

## [v7.13.43] Entrance Marker Hard Reset

### Fixed
- 입구 마커에 남아 있던 반투명 사각 배경/잔여 스타일을 제거하기 위해 `#entrance-zone`에 `all: unset` 기반 강제 초기화를 적용했습니다.
- 입구 마커는 이제 화살표 이미지 한 장만 보이도록 정리했습니다.
- 입구 위치는 기존 조정값(`top: 650px`)을 유지했습니다.

## [v7.13.42] Entrance Marker Image Restore and Transparent BG Fix

### Fixed
- 이전 수정에서 `background: none`이 입구 화살표 이미지까지 지워버린 문제를 수정했습니다.
- 입구 마커 배경은 투명으로 유지하면서 `icon_entrance_arrow.png` 이미지만 다시 보이도록 복구했습니다.
- 입구 좌표를 기존보다 조금 더 위로 올렸습니다. (`top: 658px → 650px`)

## [v7.13.41] Entrance Marker Raise and Clean Background

### Changed
- 입구 좌표를 기존보다 조금 더 위로 조정했습니다. (`top: 672px → 658px`)
- 입구 마커 뒤에 다시 보이던 반투명/회색 배경 느낌을 제거하기 위해 입구 전용 상호작용 이펙트(`interaction-glow-ring`, `interaction-finger-tap`, `interaction-click-sparkle`)를 숨겼습니다.
- 입구 아이콘 자체는 그대로 유지하고, 입구 표시 영역만 더 깔끔하게 정리했습니다.

## [v7.13.40] Entrance Marker Coordinate Lowered

### Changed
- 입구 아이콘만 이동시키는 방식이 아니라 `#entrance-zone` 자체 좌표를 아래로 내려, 입구 표시 기준점이 매장 바닥 위가 아니라 하단 입구선 쪽에 오도록 조정했습니다.
- 입구 표시 크기와 텍스트 제거 상태는 유지했습니다.

## [v7.13.39] Entrance Marker Tiny Clean Override

### Fixed
- 입구 표시 아이콘을 34×34px로 축소해 메인 화면에서 과하게 커 보이지 않도록 조정했습니다.
- 입구/진열대/계산대 기존 라벨·배경·테두리·그림자·가상요소를 강제로 제거해 아이콘 주변 사각 배경이 보이지 않도록 정리했습니다.
- 진열대 메인 표시는 계속 숨기고, 계산대는 추후 에셋 연결용 CSS 변수 구조만 유지했습니다.

## [v7.13.38] Sanitation Duplicate Header Fix

### Fixed
- `SanitationSystem.js`의 `reset()` 선언부가 `reset() {  reset() {` 형태로 중복되어 발생한 `SyntaxError: Unexpected token '{'` 오류를 수정했습니다.
- 같은 방식으로 중복되어 있던 `getSettlementPenalty()` 선언부도 함께 정리했습니다.
- `SanitationSystem.js`, `UIManager.js`, `PlayerActionSystem.js`, `StaffAssistSystem.js` 문법 검사를 다시 통과했습니다.

## [v7.13.37] Sanitation Syntax Fix

### Fixed
- `SanitationSystem.js`의 `getStatus()` 선언부가 병합 과정에서 중복되어 발생한 `SyntaxError: Unexpected token '('` 오류를 수정했습니다.
- 수정 후 주요 JS 파일 `node --check` 문법 검사를 통과했습니다.

## [v7.13.36] Main Interaction Icon Cleanup

### Changed
- 메인 화면의 `입구/진열대/계산대` 텍스트 라벨을 전부 제거해 더 깔끔하게 보이도록 정리했습니다.
- `입구`는 기존 원형 버튼형 아이콘 대신 전달받은 화살표 이미지로 바로 교체했습니다.
- `진열대` 메인 아이콘은 완전히 숨겨, 실제 진열대 오브젝트만 보이도록 정리했습니다.
- `계산대`는 나중에 에셋만 연결하면 바로 보이도록 `--counter-zone-asset` CSS 변수 기반 연결 구조를 남기고, 현재는 시각적으로 숨겼습니다.

### Added
- `assets/ui/icons/icon_entrance_arrow.png`

## [v7.13.35] Player Cleaning Tool Visual

### Added
- 플레이어가 청소 중일 때 캐릭터 옆/손 근처에 기존 청소도구 이미지를 작게 표시하도록 추가했습니다.
- 플레이어 청소 중에는 청소도구가 작은 흔들림 애니메이션으로 보이도록 처리했습니다.

### Changed
- 위생 시스템 상태에 `currentCleaningActorType`를 저장해, 플레이어 청소와 알바생 청소를 UI에서 구분해 표시할 수 있도록 정리했습니다.

## [v7.13.34] Staff Cleaning Tool Visual

### Added
- 알바생 상태가 `cleaning`일 때 캐릭터 손/옆에 기존 청소도구 이미지를 작게 표시하도록 추가했습니다.
- 청소 포인트로 이동 중에는 청소도구가 같이 따라다니고, 청소 중에는 작은 흔들림 애니메이션으로 청소 중임을 알 수 있게 했습니다.

### Changed
- 알바생이 청소 완료 후 `returning`/`idle` 상태로 바뀌면 청소도구 표시가 자동으로 사라지도록 처리했습니다.

## [v7.13.33] Zone Cleaning Points + Sanitation Pressure

### Added
- 해금된 구역 기준으로 청소 포인트를 선택하는 `data/CleaningPointData.js`를 추가했습니다.
- 전체 위생 수치는 유지하되, 현재 청소 필요 구역(`dirtyZoneId`)과 청소 위치(`activeCleaningPoint`)를 `GameState.sanitation`에 저장하도록 추가했습니다.
- 2~4구역이 해금되면 해당 구역 청소 포인트가 후보에 포함되도록 했습니다.

### Changed
- 플레이어 청소 상호작용 위치가 고정 청소 구역 1곳이 아니라 현재 더러워진 구역의 청소 포인트로 이동하도록 변경했습니다.
- 알바생 청소도 현재 더러워진 구역의 청소 포인트로 이동해서 처리하도록 변경했습니다.
- 해금 구역 수가 많아질수록 위생 감소 압박이 커지도록 진상/부정 이벤트 위생 감소량에 구역 배율을 적용했습니다. 배율은 1구역 1.0배, 2구역 1.25배, 3구역 1.5배, 4구역 1.75배입니다.

### Kept
- 위생 수치는 기존처럼 전체 매장 기준 1개만 유지합니다.
- 청소 완료 회복량, 청소 완료 이벤트, 일일 미션/정산 연결은 기존 구조를 유지했습니다.

## [v7.13.32] Cleaning Pointer Distance Guard

### Fixed
- `data-player-action="cleaning"` 직접 클릭/터치 경로에도 `requireNear: true`를 적용해, 플레이어가 청소 도구 근처에 있을 때만 청소가 시작되도록 수정했습니다.
- 키보드 상호작용 청소와 직접 클릭/터치 청소의 거리 조건을 동일하게 맞췄습니다.

## [v7.13.31] Git Pull Conflict Resolve

### Fixed
- `style.css` 병합 충돌을 해결하고 튜토리얼/발주창 작은 화면 보정/하단 버튼 backplate 제거 스타일을 유지했습니다.
- `systems/DebugSystem.js` 병합 충돌을 해결하고 F8 좌표 출력 모드와 겹치지 않도록 재고 채우기 단축키를 F11로 유지했습니다.

### Kept
- 자동 병합된 `ui/UIManager.js`의 팀원 진열대/재고 부족 표시 관련 변경을 유지했습니다.

## [v7.13.30] Tutorial + Shelf Merge Fix

### Added
- 팀원 작업본의 구역별 진열대 배치, 품목 연결, 재고 부족 표시, F8 좌표 모드, DebugSystem 초기화를 병합했습니다.
- F8 좌표 모드와 DebugSystem F8 재고 단축키가 겹쳐, 좌표 모드는 F8로 유지하고 재고 채우기 단축키만 F11로 변경했습니다.

### Fixed
- 기존 튜토리얼 UI/입력 차단/발주창 작은 화면 보정/하단 버튼 backplate 제거 작업이 팀 작업본 병합 과정에서 사라지지 않도록 복구했습니다.
- 진열대 재고 표시가 새 `GameState.shelfStocks[instanceId].products` 구조를 읽도록 UIManager를 보정했습니다.

### Kept
- 알바생 지각/보조 동작, 2번 담당자 진열대 재고 수 체크 수정, 구역별 진열대 배치, 좌표 출력 모드, 마스터모드 관련 파일을 유지했습니다.

## [v7.13.15] Tutorial Briefing Card Right Placement Fix

### Fixed
- 브리핑 단계에서 작은 화면이어도 튜토리얼 안내 카드가 [발주하러 가기] 버튼 오른쪽/오른쪽 옆에 우선 배치되도록 수정했습니다.
- 기존 작은 화면 fallback이 안내 카드를 왼쪽 목표/본문 영역으로 보내 브리핑 내용을 가리던 문제를 수정했습니다.
- 오른쪽 공간이 부족할 때만 왼쪽 또는 버튼 위쪽으로 후퇴하도록 배치 우선순위를 정리했습니다.

## [v7.13.14] Tutorial Briefing Frame Clamp Fix

### Fixed
- 브리핑 단계 모달을 브라우저 viewport가 아니라 16:9 게임 프레임 내부 기준으로 배치하도록 보정했습니다.
- 작은 화면에서 브리핑 모달 하단이 게임 프레임 밖 검은 여백으로 튀어나와 보이는 문제를 수정했습니다.
- 튜토리얼 위치 계산용 게임 프레임 CSS 변수를 `UIManager.js`에서 동기화하고, 튜토리얼 종료 시 정리하도록 추가했습니다.

## [v7.13.13] Tutorial Briefing Compact Layout Fix

### Fixed
- 작은 16:9 가로 화면에서 영업 브리핑 모달이 화면을 과하게 차지해 튀어나와 보이는 문제를 줄이기 위해 브리핑 단계 전용 compact 폭/여백/글자 크기를 추가했습니다.
- 브리핑 단계 튜토리얼 카드가 작은 화면에서 상권/추천 정보 영역을 덮지 않도록 버튼 왼쪽 위의 빈 영역으로 우선 배치되게 수정했습니다.
- 브리핑 모달은 밝게 유지하고, 배경/기타 버튼 클릭 차단은 기존 튜토리얼 입력 가드로 유지했습니다.

## [v7.13.12] Tutorial Briefing Position Runtime Fix
- Fixed `ReferenceError: Cannot access 'left' before initialization` in `positionTutorialCard()` during the briefing tutorial step.
- Reworked briefing card placement so the guide card is positioned to the right/right-above of the [발주하러 가기] button when space allows, instead of falling back to the center.
- Ensured the briefing step can continue updating the target highlight after card positioning, preventing stale highlight boxes from previous tutorial steps.

## [v7.13.11] Tutorial Briefing Modal Focus Fix
- Fixed the briefing tutorial step so the tutorial dim layer no longer darkens the briefing modal itself.
- Repositioned the tutorial card for the briefing step to the side of the [발주하러 가기] button instead of the center.
- Kept compact positioning for small screens so the card avoids blocking the briefing contents and CTA.

## [v7.13.10] Tutorial Proxy Step Advance Fix
- Fixed: [발주] tutorial proxy now advances the tutorial from step 1 to the briefing-confirm step after dispatching DAY_START_REQUESTED, so the first guide card/proxy no longer remains over the Day briefing modal.
- Changed: proxy actions with waitForEvent, including the later [영업 시작] proxy, enter the pending tutorial state before dispatching their EventBus action so event-based tutorial advancement stays reliable.
- Kept the proxy behavior tutorial-only and preserved the original source button cleanup before action dispatch.

## [v7.13.9] Tutorial Proxy Click Hitbox Fix
- Fixed tutorial proxy buttons not responding when the global tutorial capture guard or dim layer receives the event before the proxy click handler.
- Added coordinate-based proxy activation for `pointerdown`/`click`, so `[발주]` and later `[영업 시작]` trigger their allowed tutorial actions even when the original source button is hidden.
- Kept proxy-only behavior scoped to interactive tutorial steps.

## [v7.13.8] Tutorial Proxy Action Dispatch Fix
- Fixed tutorial proxy button clicks not advancing when the original source button is hidden during the proxy overlay.
- Changed the tutorial proxy activation for [발주] and [영업 시작] to dispatch the allowed tutorial action directly through EventBus instead of relying on sourceButton.click().
- Kept the original button unhidden/cleaned up before dispatch so the tutorial can continue without leaving a hidden target behind.

## [v7.13.7] Tutorial Proxy Content Hotfix
- Fixed tutorial target proxy class cloning so the hidden-source class is never copied to the visible proxy button.
- Fixed the start-day proxy button rendering as an empty highlighted box after the original button was hidden.
- Added a CSS fail-safe to keep tutorial proxy content visible even if a hidden class is accidentally present.

# CHANGELOG

## [v7.13.6] Tutorial Proxy Source Hide Fix
- Fixed: 작은 화면에서 튜토리얼 프록시 [발주] 버튼과 실제 원본 [발주] 버튼이 살짝 어긋나 이중으로 보이던 문제를 수정했습니다.
- Changed: 프록시 버튼 표시 중에는 원본 타깃 버튼을 `visibility: hidden`으로 숨기고, 프록시 제거/클릭 시 원본 숨김을 즉시 해제합니다.
- Fixed: 프록시 버튼 위치/크기는 원본 `getBoundingClientRect()` 값을 그대로 사용하고 `box-sizing: border-box`를 적용해 작은 화면에서도 버튼 크기와 위치가 안정적으로 맞도록 했습니다.
- Changed: 발주 버튼 강조 테두리/그림자를 한 겹 위주로 정리해 버튼 내부 아이콘과 글자가 더 또렷하게 보이도록 조정했습니다.

## [v7.13.5] Tutorial Target Proxy + Frame-bound Tooltip
- Fixed the first tutorial target button clarity by rendering a tutorial-only proxy button above the dim layer, so the [발주] icon/text/background no longer inherit parent opacity/filter.
- Kept the real button as the actual action source while the proxy forwards the click, preserving tutorial input gating.
- Rebounded the first-step tutorial card to the game/store frame so it does not drop into the black letterbox area on small preview windows.
- Maintained the previous small-screen compact card and movement-lock behavior.

## [v7.13.4] Tutorial First-Step Small Screen Fix
- Fixed: 작은 화면에서 16:9 게임 프레임이 세로 중앙에 떠 위쪽에 큰 검은 빈 공간이 생기던 문제를 `#game-root` 상단 정렬/auto margin 제거로 보정했습니다.
- Fixed: 튜토리얼 말풍선 위치를 브라우저 전체가 아니라 `#game-root` 게임 화면 영역 기준으로 계산해, 작은 화면에서 [발주] 버튼을 덮지 않게 수정했습니다.
- Fixed: 작은 화면용 튜토리얼 카드 compact 스타일을 추가해 카드 높이/여백/글자 크기를 줄였습니다.
- Fixed: 튜토리얼 1단계 [발주] 버튼이 부모 하단바의 흐림/반투명 효과를 같이 먹어 뿌옇게 보이던 문제를 수정하고, [발주] 버튼만 선명하게 고정했습니다.
- Maintained: 설정 아이콘 정상 표시와 튜토리얼 중 플레이어 이동 차단은 기존 v7.13.3 동작을 유지했습니다.

## [v7.13.3] Tutorial First-Step Visual Lock Hotfix
- Fixed: 튜토리얼 1단계에서 화면을 4분할 딤 패널로 뚫던 방식을 단일 전체 딤 레이어로 바꿔 상단 검은 줄, 하단 밝은 띠, 작은 화면의 비정상 하이라이트 영역이 생기지 않도록 수정했습니다.
- Fixed: 하단 [발주] 단계에서는 [발주] 버튼만 선명하게 보이고 다른 하단 버튼은 흐리게 보이도록 z-index/필터 기준을 재정리했습니다.
- Fixed: 작은 화면에서 발주 버튼 말풍선이 아래 레터박스/초록 빈 영역으로 내려가지 않도록 하단 대상 단계는 기본적으로 대상 위쪽에 배치되도록 보정했습니다.
- Fixed: 인게임 설정 버튼에 텍스트만 보이던 문제를 수정하고 설정 아이콘 버튼 에셋이 보이도록 정리했습니다.
- Fixed: 튜토리얼 활성 중에는 수동 플레이어 이동 키 입력을 무시하고, 튜토리얼 완료/스킵 후에만 다시 이동 가능하도록 제한했습니다.

## [v7.13.2] Tutorial User Completion Key

### Changed
- 튜토리얼 완료 저장 키를 출시/유저용 고정 키 `stillOpen.tutorial.completed`로 변경했습니다.
- 완료/건너뛰기 후에는 재접속해도 튜토리얼이 다시 뜨지 않으며, 개발 검수 시에는 콘솔에서 해당 키를 삭제해 다시 확인할 수 있습니다.

## [v7.13.1] Tutorial Auto-Show Hotfix

### Fixed
- 튜토리얼 입력잠금 수정본 적용 후에도 기존 브라우저 저장값 때문에 튜토리얼이 자동 표시되지 않던 문제를 방지했습니다.
- 튜토리얼 완료 저장 키를 `stillOpen.tutorial.v13.completed`로 갱신해, 이전 깨진 튜토리얼을 완료/스킵한 기록이 새 튜토리얼 표시를 막지 않도록 했습니다.

## [v7.13.0] Tutorial Input Lock Final Pass
- Added: 인터랙티브 튜토리얼 전용 중앙 입력 가드를 추가해 현재 단계에서 허용된 버튼/오브젝트 외 클릭을 차단합니다. 튜토리얼 완료/건너뛰기 후에는 즉시 해제됩니다.
- Fixed: 발주 단계에서 상점/영업 시작/종료/상단 메뉴 등 다른 버튼이 눌릴 수 있던 문제를 차단했습니다.
- Fixed: 발주창 수량 선택 단계에서 튜토리얼 대상 상품의 수량 버튼만 사용할 수 있도록 제한하고, 카테고리/닫기/발주 확정/다른 상품 클릭을 막았습니다.
- Fixed: 발주 수량 대상 상품을 `data-tutorial-order-target`으로 고정하고, 수량 버튼이 스크롤 아래에 숨지 않도록 자동 노출 보정을 추가했습니다.
- Changed: 수량 선택 단계에서 발주 확정 버튼을 누르면 단계 이동하지 않고, 표시된 수량 버튼을 먼저 누르도록 안내합니다.
- Fixed: 도착한 발주 박스 이미지를 `arrive_box.png` 기준으로 복구했습니다.
- Changed: 도착 박스/정리 안내 문구를 “창고 재고로 정리” 기준으로 수정해 첫 진열 자동 보충처럼 보이지 않게 정리했습니다.
- Changed: 튜토리얼 중 비대상 버튼/카드가 시각적으로 흐리게 보이도록 최종 CSS 오버라이드를 추가했습니다.

## [v7.12.7] Tutorial Layout Safety Hotfix
- Fixed: 튜토리얼 강조 대상에 남아 있던 `position`, `z-index`, `filter`, `transform` 강제 스타일을 제거해 계산대/진열대/청소 도구/도착박스 레이아웃이 튜토리얼 중 변형되지 않도록 수정.
- Fixed: 10단계 영업 시작 타겟을 disabled 여부와 무관하게 버튼 자체로 잡아 하이라이트가 사라지거나 비활성처럼 보이는 문제를 줄임.
- Fixed: 구버전 상품 개별 정리 버튼 바인딩을 no-op 처리해 발주 박스 1회 클릭 자동 정리 흐름만 유지.
- Changed: 오픈 준비 안내 문구에서 택배 표현을 제거하고 “도착한 발주 박스/발주 상품 정리” 기준으로 통일.

## [v7.12.6] Tutorial Full Cleanup
- Fixed: 튜토리얼 완료 후 10/10 카드가 영업 중, 손님 등장 중, 정산 화면까지 남던 cleanup 문제를 수정했습니다.
- Fixed: `.tutorial-overlay.hidden`이 후순위 interactive CSS에 덮여 다시 보이던 문제를 최종 오버라이드했습니다.
- Changed: 튜토리얼 강조 로직을 `contextSelector`와 `spotlightSelector` 기준으로 분리해, 읽어야 하는 모달 영역과 실제 눌러야 하는 버튼을 따로 처리합니다.
- Fixed: 발주 버튼/영업 시작 버튼 단계에서 현재 대상만 선명하고 나머지 하단 UI는 어둡게 보이도록 단계별 body class를 적용했습니다.
- Fixed: 발주 확정 후 빈 발주창이 남지 않도록 발주 대기 모달을 자동으로 닫고 메인 화면 도착박스 흐름으로 전환합니다.
- Changed: 도착박스는 상품 개별 클릭 정리 UI를 사용하지 않고, 박스 한 번 클릭 후 자동 발주 상품 정리 및 첫 진열 자동 보충으로 통일했습니다.
- Changed: 도착박스/정리 관련 문구를 “발주 상품 정리” 기준으로 통일했습니다.
- Removed: 도착박스의 과한 반짝임/광원/발광 효과가 튜토리얼 화면에 보이지 않도록 제거했습니다.
- Fixed: 첫 진열 자동 보충/진열대 보충 단계가 실제 `1구역 기본 매대 1`을 강조하도록 수정했습니다.
- Fixed: 청소 단계가 계산대까지 감싸지 않고 청소 도구만 강조하도록 수정했습니다.
- Fixed: 계산대 단계에서 튜토리얼 하이라이트 때문에 계산대 UI가 늘어나지 않도록 하이라이트 CSS를 정리했습니다.
- Fixed: 인터랙티브 튜토리얼 중 중복 시스템 힌트가 뜨지 않도록 차단했습니다.
- Changed: PC 키보드 안내 문구를 제거하고 터치 중심 문구로 정리했습니다.

## [v7.12.5] 체험형 튜토리얼 10단계 구조 재반영
- Changed: 튜토리얼을 최종 10단계 구조로 재정리했습니다. 발주 버튼 → 브리핑 → 수량 자유 선택 → 발주 확정 → 도착 박스 → 첫 진열 자동 보충 → 계산대/진열대/청소 요약 → 영업 시작 순서입니다.
- Changed: 발주창 수량 선택 단계에서 상품 `+` 한 번 클릭만으로 다음 단계로 넘어가지 않도록 수정했습니다. 사용자가 원하는 상품을 원하는 만큼 선택한 뒤 다음 안내로 넘어갑니다.
- Fixed: 보유 골드/창고 재고 한도를 넘는 발주 수량 증가가 불가능하도록 기존 제한 로직을 튜토리얼 흐름에서도 유지했습니다.
- Changed: 도착 박스 단계는 “창고 정리 화면”이 아니라 “도착한 발주 박스를 누르면 창고 정리가 시작됩니다” 문구로 수정했습니다.
- Removed: 박스 안 상품을 별도로 다시 클릭하라는 튜토리얼 단계를 제거했습니다. 도착 박스 클릭 후 창고 정리 완료 이벤트를 기다린 뒤 첫 진열 자동 보충 안내로 넘어갑니다.
- Changed: 계산대/진열대/청소 단계는 실제 상호작용 강제가 아니라 포커스 요약 설명으로 변경했습니다.
- Fixed: 튜토리얼 딤 레이어를 네 방향 패널 방식으로 재정리해 강조 대상만 비우고 대상 외 영역 클릭은 차단하도록 수정했습니다.
- Removed: 과한 노란 발광, 밝기 보정, 검은 세로 막대 원인이 되는 화면 처리 규칙을 최종 오버라이드했습니다.
- Maintained: 튜토리얼 완료/건너뛰기 후 자동 표시 비활성화, 오른쪽 위 도움말에서 다시 보기, BM 지갑/출석 보상 기록 유지 규칙은 그대로 유지했습니다.


## [v7.12.2] 튜토리얼 닫기/건너뛰기 UX 정리
- Changed: 체험형 튜토리얼의 X 닫기 버튼을 제거하고, 명확한 `튜토리얼 건너뛰기` 버튼으로 대체.
- Changed: 건너뛰기 선택 시 확인창을 띄운 뒤 튜토리얼을 즉시 종료하고 자동 표시를 비활성화.
- Changed: 튜토리얼 완료/건너뛰기 후에도 오른쪽 위 도움말 버튼에서는 다시 볼 수 있는 구조 유지.
- Fixed: 대상 클릭 단계에서도 건너뛰기 버튼은 클릭 가능하고, 다음 버튼은 노출되지 않도록 CSS 우선순위 정리.


## [v7.11.9] 튜토리얼 말풍선 UI 최종 정리
- Fixed: 도움말로 다시 열 때 큰 팝업형 튜토리얼이 노출되던 문제를 수정했습니다.
- Changed: 튜토리얼 기본 모드를 작은 말풍선형 체험 모드로 고정했습니다.
- Changed: 튜토리얼 문구를 한 단계 한 행동 기준의 짧은 문장으로 축소했습니다.
- Fixed: 강조 대상이 어둡게 보이지 않도록 딤 패널과 하이라이트/대상 밝기 처리를 재조정했습니다.
- Fixed: 대상 버튼이 없는 상황에서는 큰 전체 딤이 깔리지 않고 다음 단계로 넘길 수 있게 했습니다.

## [v7.11.7] 튜토리얼 다시 보지 않기 유지 보정

## [v7.11.8] 튜토리얼 도움말 버튼 위치 조정

### Changed
- 도움말 버튼을 하단 플로팅 위치에서 우측 상단 빠른 메뉴 영역으로 이동했습니다.
- 도움말 버튼을 설정 버튼 바로 왼쪽에 배치해 플레이 화면과 하단 행동 버튼을 가리지 않도록 조정했습니다.
- 튜토리얼 완료/다시 보지 않기 안내 문구의 “하단 도움말” 표현을 “오른쪽 위 도움말”로 수정했습니다.

### Fixed
- 도움말 버튼이 하단 발주/상점/영업 버튼 영역과 시각적으로 겹칠 수 있던 문제를 줄였습니다.


### Fixed
- `다시 보지 않기`를 누른 뒤 `새 매장 시작`을 해도 첫 실행 튜토리얼이 다시 자동 표시되지 않도록 수정했습니다.
- 새 매장 시작 시 튜토리얼 1회성 힌트 기록만 초기화하고, 계정성 설정인 튜토리얼 완료/다시 보지 않기 기록은 유지하도록 변경했습니다.
- `다시 보지 않기` 선택 시 자동 표시가 꺼졌다는 안내 메시지를 추가했습니다.

### Maintained
- 하단 `도움말` 버튼을 직접 누르면 사용자가 원할 때 튜토리얼을 다시 볼 수 있습니다.
- 10단계 체험형 튜토리얼, 영업 전 루프, BM 지갑/출석 보상 기록 유지 규칙은 그대로 유지했습니다.
- `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v7.11.4] Ten-step anchored tutorial and pre-open loop lock

### Changed
- 첫 실행 튜토리얼을 10단계 미션형 구조로 재정리했습니다.
  - 오늘 목표 확인 → 발주창 이동 → 상품 수량 선택 → 발주 확정 → 택배 열기 → 입고 상품 정리 → 영업 시작 → 계산대 안내 → 영업 중 진열대 보충 안내 → 청소 안내
- 튜토리얼 문구를 긴 설명/체크리스트 중심에서 “지금 눌러야 할 행동 하나” 중심의 짧은 말풍선형 문구로 변경했습니다.
- 튜토리얼 카드를 화면 모서리 고정이 아니라 강조 대상 근처에 자동 배치되도록 수정했습니다.
- 튜토리얼 배경 딤을 더 옅게 조정해 게임 화면을 선명하게 볼 수 있게 했습니다.
- 새 10단계 튜토리얼이 기존 v2 튜토리얼 완료 기록에 막히지 않도록 튜토리얼 완료 키를 v3로 갱신했습니다.

### Fixed
- 영업 전 루프 기준을 다시 고정했습니다. 매 Day 영업 전에는 `발주 → 발주 확정 → 택배 도착 → 택배 창고 정리 → 첫 진열 자동 보충 → 영업 시작` 흐름을 사용합니다.
- 튜토리얼에서 영업 전 수동 진열대 보충을 유도하지 않도록 제거했습니다.

### Maintained
- 진열대 수동 보충은 영업 중 재고가 비었을 때만 가능합니다.
- 출석 보상 기록과 BM 지갑 유지 규칙은 그대로 유지했습니다.
- `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v7.11.3] Pre-open loop correction and tutorial readability

### Fixed
- 영업 시작 전 루프를 `발주 → 택배 도착 → 택배 창고 정리 → 첫 진열 자동 보충 → 영업 시작` 순서로 다시 정리했습니다.
- 영업 시작 전에는 플레이어가 진열대 상호작용으로 `창고 이동 → 물품 가져오기 → 진열대 보충` 루트를 실행하지 못하도록 차단했습니다.
- 입고 정리 완료 시 발주 상품을 매핑된 진열대에 자동으로 채워, 첫 영업 시작 전에 수동 보충을 요구하지 않게 했습니다.

### Changed
- 튜토리얼 문구에서 영업 전 수동 진열 보충으로 오해될 수 있는 표현을 제거하고, `첫 진열은 자동 / 영업 중 재고가 비면 수동 보충` 구조로 수정했습니다.
- 튜토리얼 오버레이의 배경 블러를 제거하고 어두운 딤 처리만 남겨 게임 화면을 더 선명하게 보이도록 조정했습니다.
- 튜토리얼 카드 크기를 줄여 실제 클릭 대상이 더 잘 보이게 했습니다.

### Maintained
- 출석 보상 기록과 BM 지갑 유지 규칙은 그대로 유지했습니다.
- `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v7.11.2] Interactive tutorial syntax hotfix

### Fixed
- `ui/UIManager.js`의 `getTutorialSteps()` 메서드 뒤 누락된 쉼표를 추가해 `showFirstRunTutorialSoon` 구문 오류를 수정했습니다.
- 튜토리얼/출석 유지 로직은 그대로 두고, 브라우저 콘솔의 `Uncaught SyntaxError: Unexpected identifier 'showFirstRunTutorialSoon'` 발생 원인만 핫픽스했습니다.

### Maintained
- 새 매장 시작 시 출석 보상 기록과 BM 지갑을 유지하는 v7.11.1 규칙은 유지했습니다.
- `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v7.11.1] New-game account data preservation

### Changed
- `새로 시작`을 새 계정 초기화가 아닌 새 매장/진행도 초기화로 정리했습니다.
- 새로 시작 시 출석 보상 수령 기록을 초기화하지 않고 유지하도록 되돌렸습니다.
- 새로 시작/무한 모드 리셋 시 현재 보유 BM 지갑 잔액도 유지되도록 보존 스냅샷을 추가했습니다.
- 타이틀 버튼 문구를 `새 매장 시작`으로 변경해 새 계정 초기화처럼 보이지 않게 했습니다.
- 새로 시작/무한 모드 안내 문구에서 “새 유저처럼 초기화” 표현을 제거하고, 출석 보상 기록과 BM 지갑이 유지된다는 점을 명확히 했습니다.

### Maintained
- 새로 시작 시 Day 진행도, 매장 진행도, 재고, 구역 해금 상태, 튜토리얼 진행 상태는 초기화됩니다.
- `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v7.11.0] Interactive tutorial and new-game attendance reset

### Added
- 첫 실행 튜토리얼을 단순 설명형 팝업에서 실제 플레이 화면 타깃 클릭형 튜토리얼로 변경했습니다.
- 출석 보상 확인 후 튜토리얼이 시작되도록 대기 플래그를 추가했습니다.
- 발주 버튼 → 브리핑 확인 → 상품 + 버튼 → 발주 확정 → 택배 박스 → 입고 상품 정리 → 영업 시작 순서로 노란 하이라이트와 안내 카드를 표시합니다.
- 튜토리얼 카드가 강조 대상과 겹치지 않도록 대상 위치에 따라 화면 모서리로 자동 배치되게 했습니다.

### Changed
- 튜토리얼 오버레이가 게임 화면 클릭을 막지 않도록 조정하고, 강조 대상은 실제로 클릭할 수 있게 변경했습니다.
- 새로 시작 시 튜토리얼 완료/힌트 기록을 초기화하여 새 게임에서는 튜토리얼이 다시 뜨게 했습니다.
- 새로 시작 시 출석 보상 진행도를 1일차부터 다시 받을 수 있도록 초기화했습니다. 단, 유료성 BM 지갑 carryover는 기존 보호 규칙을 유지합니다.

### Fixed
- 출석 보상 이미지 위에 튜토리얼이 먼저 떠서 가려지던 문제를 수정했습니다.

### Maintained
- `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js` 미수정

## [v7.10.0] First-run tutorial and help guide

### Added
- 첫 실행 시 자동으로 표시되는 8단계 튜토리얼 오버레이를 추가했습니다.
- 하단 도움말 플로팅 버튼으로 언제든 튜토리얼을 다시 볼 수 있게 했습니다.
- 발주/브리핑/물류 정리/영업 시작/플레이어 조작/계산·보충·청소/정산·성장 루프를 순서대로 안내합니다.
- 물류 도착, 입고 정리 완료, 영업 시작 시 1회성 상황 안내 메시지를 추가했습니다.

### Maintained
- `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.
- 기존 발주, 입고, 계산, 보충, 청소, BM 로직은 변경하지 않았습니다.


## [v23.20.1] 진열 표시/손님 타이머 안정화

### Fixed
- 진열대 오브젝트 이미지 상태가 전체 재고가 아니라 `GameState.shelfStocks`의 실제 진열 재고 기준으로 표시되도록 수정.
- 영업 종료/하루 종료 시 첫 손님 지연 타이머도 함께 정리해, 영업 종료 후 손님이 뒤늦게 생성될 수 있는 엣지 케이스 방지.
- 상품-진열대 매핑을 현재 존재하는 진열대 타입 기준으로 자동 보완해, 기본/냉장 상품이 명시 매핑 4종에만 묶이지 않도록 개선.

### Kept
- 구역 확장 후 구역별 이동 동선은 이번 수정 범위에서 제외.
- 알바는 발주 박스/도착 물류 박스/계산대/손님 응대를 처리하지 않음.

## [vStaff-flow-stock-stabilize] 알바/청소/진열대 판매 루프 안정화

### Fixed
- 알바가 입구에서 매장 안쪽 대기 위치로 들어오는 중에는 `STORE_OPENED`의 조기 자동보조 체크를 예약하지 않도록 수정했습니다.
- 알바 입장 완료 콜백에서만 다음 자동보조 체크를 예약해, 입장 중 순간 이동 또는 조기 업무 시작 가능성을 막았습니다.
- 알바가 청소 보조 중일 때 플레이어가 청소를 중복 시작하지 못하도록 막았습니다.
- 손님이 상품을 집을 때 진열대 재고가 실제로 1개 감소하도록 `SHELF_STOCK_CONSUMED` 흐름을 추가했습니다.
- 손님 상품 선택 기준에 실제 창고/재고뿐 아니라 진열대 재고를 함께 반영했습니다.

### Changed
- `PlayerActionSystem`의 진열대 재고를 `GameState.shelfStocks`에 동기화해 손님 시스템이 진열 상태를 안전하게 읽을 수 있도록 했습니다.
- 플레이어/알바 진열 보충 완료 후 진열대 재고 동기화가 즉시 반영되도록 정리했습니다.
- 창고 재고 계산 시 이미 손님이 들고 계산대로 가는 상품 수량을 제외해, 진열대 재고가 실제 재고보다 커지는 상황을 방지했습니다.

### Guardrails
- 확장 구역별 이동 동선은 수정하지 않았습니다.
- 발주 박스/도착 물류 박스 조작, 알바 계산, BM, 상품 해금, 정산 로직은 수정하지 않았습니다.


## [vStaff-entry-stabilize-2] 알바 출근 검증 순서 안정화

### Fixed
- 영업 시작 버튼 클릭 시 알바 출근 이벤트가 영업 시작 검증보다 먼저 발생하던 흐름을 수정했습니다.
- 이제 `STORE_OPEN_REQUESTED` 검증을 통과해 실제 영업이 시작된 뒤에만 알바 출근 연출이 시작됩니다.
- 발주/재고 정리가 끝나지 않은 상태에서 영업 시작이 거절될 경우 알바가 화면에 나타나지 않도록 안정화했습니다.

### Changed
- 알바 정상 출근 시 첫 손님 등장 지연을 1400ms에서 2000ms로 늘려, 알바가 입구에서 들어와 매장 안쪽 대기 위치에 도착한 뒤 손님이 등장하도록 조정했습니다.
- 알바 출근 이벤트 발생 위치를 `UIManager` 버튼 클릭 직후가 아니라 `GameFlowSystem.openStore()` 검증 통과 후로 이동했습니다.

### Guardrails
- 진열대 재고/판매 재고 연결 작업은 보류 상태로 유지했습니다.
- 발주 박스/도착 물류 박스/계산/BM/상품 해금/정산 로직은 수정하지 않았습니다.


## [vStaffEntry-Visibility] - 2026-07-06

### Changed
- 영업 시작 버튼 클릭 전에는 알바 캐릭터/알바 근무 요약이 화면에 보이지 않도록 숨김 처리.
- 영업 시작 버튼 클릭 즉시 `STAFF_SHIFT_ENTRY_REQUESTED` 이벤트를 먼저 발생시켜 알바가 입구에서 매장으로 들어오는 연출을 시작하도록 변경.
- 알바 고용 상태일 때 첫 손님 생성을 짧게 지연해 알바 출근 연출이 손님 등장보다 먼저 보이도록 조정.

### Guarded
- 알바 자동보조는 기존과 동일하게 발주 박스/도착 물류 박스/계산대/BM/정산 로직을 조작하지 않음.

## [v8.0.9] 최종 강화명 유저 노출 제거

### Changed
- 상품 강화 탭 안내 문구에서 `최종 강화명` 표현을 제거했습니다.
- 상품 계약/프리미엄 상품 카드에서 `최종 강화명: ...` 문구가 유저에게 노출되지 않도록 제거했습니다.

### Maintained
- 상품 강화 데이터와 최종 강화명 내부 로직은 유지했습니다.
- 상품 강화 단계, 판매가 계산, 구매/강화 로직은 변경하지 않았습니다.

## [v8.0.8] 추천 탭 상단 카드 정렬 보정

### Fixed
- 추천 탭 상단의 광고 보상 / 판매권 해금 대기일 스킵권 / 피크타임 쿠폰 카드 3종의 폭과 높이를 균일하게 맞췄습니다.
- 첫 번째 카드만 작게 보이거나, 세 카드의 시작 위치와 버튼 위치가 어긋나 보이던 문제를 보정했습니다.
- 추천 탭 상단 카드 내부 아이콘/문구/버튼 정렬을 왼쪽 기준 + 하단 버튼 기준으로 통일했습니다.

### Maintained
- BM 데이터, 보상 수치, 쿠폰/스킵권 로직은 수정하지 않았습니다.

## [v8.0.7] 프리미엄 상품 카드 재배열 및 추천 탭 마감 정리

### Changed
- 프리미엄 상품 탭 전용 카드 레이아웃을 다시 보정해 카드 폭, 줄바꿈, 텍스트 높이를 정리했습니다.
- 프리미엄 상품명 / 최종 강화명 / 상태 문구가 카드 안에서 겹치지 않도록 줄 수와 간격을 재조정했습니다.
- 프리미엄 상품 카드의 정보 배지와 구매 버튼 크기를 다시 맞춰 카드 배열이 균일하게 보이도록 정리했습니다.
- 추천 탭의 상단 카드 3종과 하단 해금 예정 상품 카드의 간격/높이/정렬을 다시 보정해 전체 화면이 더 깔끔하게 보이도록 마감 정리했습니다.

### Fixed
- 프리미엄 상품 카드에서 글씨가 겹쳐 보이던 문제를 완화했습니다.
- 추천 탭에서 카드 크기와 배치가 어수선해 보이던 부분을 재정리했습니다.

## [v8.0.6] 성장/계약 세부 탭 고정 및 상품 카드 설명 정렬 통일

### Changed
- 성장/계약 내부 세부 탭(`운영 성장 / 상품 계약 / 프리미엄 / 진열대 / 상품 강화`)이 스크롤 시에도 상단에 고정되도록 조정했습니다.
- 상품 계약/프리미엄 상품 카드의 텍스트 정렬을 왼쪽 기준으로 통일했습니다.
- 상품 계약/프리미엄 상품 카드의 정보 배지를 가로 나열 대신 세로 한 줄씩 표시하도록 바꿨습니다.
- `구역 필요` 상태를 포함해 상품 계약/프리미엄 카드의 버튼/설명 영역 크기가 더 일정하게 보이도록 카드 최소 높이와 내부 정렬을 보정했습니다.

### Fixed
- 일부 냉장고/온장고 계열 카드에서 정보가 가로로 눕거나 카드 높이가 들쭉날쭉해 보이던 문제를 완화했습니다.

## [v8.0.5] 추천 탭 왼쪽 정렬 통일 및 빠른 이동 제거

### Changed
- BM 상점 추천 탭의 텍스트/카드 정렬을 왼쪽 정렬 기준으로 통일했습니다.
- 추천 탭 카드 내부 아이콘, 제목, 설명, 보조 문구, 오른쪽 안내 패널 문구도 왼쪽 정렬로 맞췄습니다.
- 추천 탭에서 `빠른 이동` 섹션을 제거했습니다.

### Fixed
- 추천 탭에서 일부 요소만 가운데 정렬처럼 보이던 불균형을 정리했습니다.

## [v8.0.4] 추천 탭 상단 박스 제거 및 진열대 오브젝트 에셋 적용

### Changed
- 추천 탭에서 상단의 `오늘 추천` / `오늘 바로 받기` 박스 영역을 제거하고, 카드 목록이 바로 시작되도록 재구성했습니다.
- 제거된 상단 공간을 활용해 아래 카드들이 위로 올라오도록 추천 탭 레이아웃을 정리했습니다.
- 진열대 강화 카드 이미지를 `assets/objects` 내부 오브젝트 에셋으로 교체했습니다.
  - 기본 매대: `display_stand_full_left.png`
  - 냉장고: `beverage_fridge_full_left.png`
  - 신선 매대: `display_stand_full_right.png` (대체 사용)
  - 온장고: `food_warmer_full_left.png`

### Fixed
- 추천 탭에서 해금 예정 상품 카드가 위 카드와 겹쳐 보이던 현상을 줄이기 위해 카드 높이/정렬/간격을 다시 보정했습니다.

### Maintained
- 진열대 강화 확인 팝업 이미지는 기존 에셋을 그대로 유지했습니다.

## [v8.0.3] 진열대 강화 카드 전용 에셋 적용

### Changed
- 성장/계약 > 진열대 강화 목록에서 `기본 매대 / 냉장고 / 신선 매대 / 온장고` 카드가 각각 다른 전용 에셋 이미지를 사용하도록 변경했습니다.
- 카드 목록에는 상품 분류 탭 전용 에셋을 재사용해 구분이 더 잘 되도록 정리했습니다.

### Maintained
- `강화` 버튼을 눌렀을 때 열리는 진열대 강화 확인 팝업 이미지는 기존 에셋을 그대로 유지했습니다.

## [v8.0.2] BM 추천 탭 문구 정리 및 겹침 보정

### Changed
- 추천 탭 상단 `오늘 추천` 설명 문구를 제거했습니다.
- `오늘 바로 받기` 섹션의 보조 설명 문구를 제거해 제목만 보이도록 정리했습니다.
- `다음 해금 예정 상품`, `빠른 이동` 섹션 헤더도 간결한 제목형으로 통일했습니다.

### Fixed
- 추천 탭에서 다음 해금 예정 상품 카드가 위 카드 영역과 겹쳐 보이던 문제를 줄이기 위해 전용 2열 미니 카드 레이아웃으로 분리했습니다.
- 추천 카드 섹션 간 간격과 카드 최소 높이를 조정해 대형 화면에서 레이아웃이 더 안정적으로 보이도록 보정했습니다.

## [v8.0.1] BM 상점 추천 탭 대형 화면 정리

### Changed
- 추천 탭을 `오늘 바로 받기 / 다음 해금 예정 상품 / 빠른 이동` 3개 섹션으로 재구성했습니다.
- 대형 화면에서 추천 카드가 한 그리드에 섞여 보이던 구조를 정리하고, 카드 종류별 배치를 분리했습니다.
- `성장/계약` 항목을 상품 카드형이 아니라 바로가기 배너형으로 바꾸고, 성장 탭으로 이동하는 버튼을 추가했습니다.
- 추천 탭 안내 문구를 무료 보상 / 진행 보조 아이템 / 다음 해금 상품 중심으로 정리했습니다.

### Fixed
- 큰 화면에서 추천 탭 하단의 해금 예정 상품 카드가 붕 떠 보이던 정렬 문제를 완화했습니다.
- 추천 탭에서 카드 높이와 간격이 들쭉날쭉해 보이던 부분을 보정했습니다.

### Maintained
- 무료충전 / 재화충전 / 편의상품 / 성장·계약 탭 구조와 BM 데이터 로직은 유지했습니다.


## [v7.9.7] Staff checkout role removal follow-up

### Fixed
- 알바 자동 계산 구버전 이벤트 바인딩을 제거했습니다.
- 외부에서 STAFF_AUTO_CHECKOUT_REQUESTED 이벤트가 들어와도 계산을 수행하지 않도록 no-op 처리했습니다.

### Maintained
- 알바 역할은 창고/진열대/청소 보조만 유지합니다.
- 플레이어 직접 계산 3초 대기 기능은 유지합니다.

## [v7.9.5] 보상함 UI 1차 정리
- Added: 메인 상단 버튼 영역을 `[일일 미션] [보상함] [설정]` 순서로 정리하고, 보상함 버튼에 수령 가능 보상 배지를 표시하도록 구성.
- Changed: 보상함 팝업 닫기 버튼을 일일 미션 팝업과 같은 오른쪽 위 작은 원형 X 버튼으로 통일.
- Changed: 쿠폰 코드 입력 UI를 상점 무료 충전 영역에서 제거하고 보상함 팝업 하단으로 이동.
- Changed: 수령 완료된 보상은 보상함 목록에서 숨기고, 저장된 claimed 상태로 중복 수령을 막는 흐름을 유지.
- Note: RewardCodeSystem, RewardInboxSystem, EconomySystem 지급 로직은 유지하고 UI 배치와 렌더링 규칙만 조정.

## [v7.6.13] 일일 미션 닫기 버튼 위치 수정
- Fixed: 일일 미션 팝업 닫기 버튼이 기본 button flex 스타일을 상속받아 헤더 중앙의 큰 버튼처럼 보이던 문제를 수정.
- Changed: 닫기 버튼을 다른 팝업과 맞춰 우측 상단의 작은 원형 버튼으로 고정.
- Note: 일일 미션 진행/보상 로직은 수정하지 않고 UI 스타일만 변경.

## [v7.6.12] BM 상점 세부 분류/카드형 UX 개선
- Changed: 상점 내부를 큰 탭 아래 세부 분류 탭으로 재구성해 한 화면에 한 묶음씩 확인하도록 개선.
- Changed: 재화충전은 다이아/골드, 편의상품은 스킵권/쿠폰/보유·기타, 성장·계약은 운영 성장/상품 계약/프리미엄/진열대/상품 강화로 세분화.
- Changed: 상점 항목을 긴 리스트형에서 발주 카드와 유사한 카드형 그리드로 전환.
- Changed: 상점 배경에서 기존 이미지 흔적이 보이지 않도록 깔끔한 크림/그린 계열 배경으로 교체.
- Fixed: 상점 렌더링 시 동일 마크업이면 DOM을 다시 그리지 않도록 유지해 이미지 깜빡임 가능성을 줄임.
- Note: BMSystem 구매/사용/강화 로직은 수정하지 않고 UIManager/style 중심으로만 변경.


## [v7.9.4] Daily mission entry moved to main HUD

### Changed
- 상점 추천/무료충전 탭에서 일일 미션 패널을 제거했습니다.
- 일일 미션은 메인 UI 설정 버튼 왼쪽의 작은 미션 아이콘으로 진입하도록 분리했습니다.
- 일일 미션 팝업 문구에서 내부 기획 설명인 “7개 중 3개 랜덤” 노출을 제거했습니다.

### Added
- 메인 HUD 일일 미션 바로가기 버튼을 추가했습니다.
- 일일 미션 확인/보상 수령 전용 팝업을 추가했습니다.

### Fixed
- 일일 미션 상태 갱신 시 상점 전체를 불필요하게 다시 그리지 않도록 분리했습니다.

# CHANGELOG

## [v7.6.11] BM 추가 전용 에셋 적용
- Added: 1차/2차 BM 추가 에셋 15개를 `assets/images/bm/` 하위에 용도별로 추가.
- Changed: 알바 강화, 멘탈 회복 선택지, 상품 판매권/계약/대기, 진열대 강화, 창고 확장 카드가 기존 임시 아이콘 대신 전용 에셋을 사용하도록 UI 표시만 교체.
- Changed: Day3 알바 고용 후보 카드에 알바 카드 프레임과 고용 아이콘을 표시하도록 보완. 알바생 캐릭터 본체 이미지는 보류.
- Note: BMSystem 구매/사용/강화 로직은 수정하지 않고, 기존 이벤트 연결과 구매 확인창 흐름을 유지.

## [v7.6.10] BM 상점 구매 확인/렌더 안정화 재검토
- Fixed: 상점 내 판매권/프리미엄/재화 상품 외에 스킵권, 피크타임 쿠폰, 창고 확장, 진열대 강화, 상품 강화, 알바 강화도 바로 실행되지 않고 확인창을 거치도록 보완.
- Fixed: 구매 확인창을 열 수 없거나 상품 데이터를 찾지 못했을 때 즉시 구매 콜백이 실행될 수 있던 fallback을 차단.
- Changed: BM 상태 변경/구매 성공 이벤트가 연속 발생할 때 상점 전체 렌더를 `requestAnimationFrame` 기준으로 1회 병합해 이미지 깜빡임 가능성을 줄임.
- Changed: 상점 지갑 아이콘 영역은 값이 바뀐 경우에만 갱신하도록 정리.
- Verified: 발주 모달 수량 변경 부분 갱신, 발주 확정 버튼 상태 동기화, 발주창 닫기 버튼, OrderSystem InventorySystem import 핫픽스 유지 확인.

## [v7.6.9] BM 상점 UX 구조 리뉴얼
- Changed: 기존 BM 로직은 유지하고 상점 화면 탭 구조를 추천 / 무료충전 / 재화충전 / 편의상품 / 성장·계약으로 재구성.
- Changed: BM 상점 상단 보유 재화 영역에 골드, 다이아, 광고 스킵권, 피크타임 쿠폰 아이콘 적용.
- Changed: 무료 보상, 재화 상품, 편의 아이템, 성장 카드에 현재 BM 에셋을 연결.
- Added: SHOP_UX_REDESIGN_NOTES.md에 상점 탭 구조와 보류 전용 에셋 목록 기록.
- Added: BMAssetMap.js에 골드/다이아 패키지 에셋 경로 추가.
- Fixed: 기존 구매/사용/강화 이벤트 클래스는 그대로 유지하여 BMSystem 동작 충돌을 방지.

## [v7.6.9] BM 에셋 폴더 정리
- Added: BM 에셋을 `assets/images/bm/` 하위 용도별 폴더로 정리
- Added: `BM_ASSET_MANIFEST.md`와 `assets/images/bm/BM_ASSET_MANIFEST.json` 추가
- Added: 향후 상점 UI 리뉴얼용 `data/BMAssetMap.js` 경로 맵 추가
- Changed: `gold.png`/`diamond.png`를 `currency_gold.png`/`currency_diamond.png`로 정규화
- Changed: `icon_requirements_missing.png`를 `icon_not_ready.png`로 정규화
- Note: 기존 상점 UI 구조와 렌더링 로직은 아직 수정하지 않음

## [v7.6.7] 2026-07-05 - 발주 카테고리 탭 높이 축소

### Changed
- 발주창 카테고리 탭의 세로 높이와 상하 패딩을 줄여 상품 영역이 더 넓어 보이도록 조정했습니다.
- 카테고리 숫자 배지 크기를 함께 줄여 탭 내부 정렬이 깨지지 않도록 정리했습니다.
- 작은 화면용 카테고리 탭 높이도 별도 보정했습니다.

## [v6.2.7] 발주 확정 버튼/닫기 버튼 핫픽스
- Fixed: 발주 수량을 0에서 1 이상으로 바꾼 뒤에도 이미지 버튼 상태 클래스가 disabled로 남아 발주 확정 버튼이 회색으로 보이던 문제 수정.
- Fixed: UI 발주 가능 금액 계산과 OrderSystem 검증 금액을 일치시켜, 화면에서는 가능해 보이는데 실제 발주가 거부되는 상황을 방지.
- Fixed: OrderSystem에서 발주 거부 시 UI가 접수 대기 화면에 갇히지 않도록 실패 이벤트를 반환하고 발주 화면으로 복구.
- Added: 발주창 우측 상단 닫기 버튼 추가.

## [v7.7.5] 발주 박스 크기 밸런스 조정
- Changed: 발주 도착 박스를 플레이어 축소 크기 기준에 맞춰 `131px × 112px`에서 `84px × 72px`로 줄였다.
- Changed: 박스가 입구 오른쪽에 유지되도록 기존 배치의 중심/바닥 기준을 맞춰 위치를 `568px, 615px`로 보정했다.
- Changed: 박스 클릭 영역, 그림자, 남은 상품 수량 배지도 축소된 박스 크기에 맞게 조정했다.
- Verified: JS 문법 검사 및 zip 무결성 검사를 통과했다.

## [v7.6.5] 발주 박스 위치 조정
- Changed: 발주 도착 박스를 외부 도로 왼쪽이 아니라 기본 매장 입구 오른쪽 근처로 이동했다.
- Changed: 발주 박스 자동 이동 기준 좌표도 화면 표시 좌표와 동일하게 맞춰, 박스 클릭 시 플레이어가 새 위치로 이동하도록 정렬했다.
- Verified: JS 문법 검사 및 zip 무결성 검사를 통과했다.

## [v7.7.4] 상품 이미지 렌더링 안정화
- Fixed: 발주 모달에서 수량 `+/-` 버튼을 누를 때 `order-modal-body` 전체를 다시 그리면서 상품 이미지가 깜빡이던 문제를 수정했습니다.
- Changed: 발주 수량 변경 시 상품 카드 DOM은 유지하고 수량, 예상 비용, 보유금, 발주 수량, 창고 용량 경고, 발주 확정 버튼 상태만 부분 갱신하도록 변경했습니다.
- Fixed: 택배 박스 정리 화면에서도 상품 정리 상태 변경 시 상품 이미지 DOM을 재생성하지 않고 정리 완료 상태/남은 수량만 갱신하도록 보완했습니다.
- Changed: 상품 진열대 패널도 재고/가격/잠금 상태 변경 시 기존 카드와 이미지를 재사용하고 텍스트/클래스만 갱신하도록 안정화했습니다.
- Changed: 발주/입고/진열대 상품 이미지는 즉시 표시가 필요한 UI라 `loading="eager"` 기준으로 맞췄습니다.
- Changed: 매장 확장 타일 이미지도 상태가 바뀌지 않으면 DOM을 다시 만들지 않도록 시그니처 캐시를 추가했습니다.
- Changed: 공사 오버레이 이미지도 같은 경로로 반복 지정하지 않도록 `src` 변경 여부를 확인하게 했습니다.

## [v7.7.3] 손님 PNG 렌더링 안정화
- Fixed: 손님 렌더링 시 `.customer-npc` 내부를 매번 `innerHTML`로 비워 손님 PNG가 사라졌다 나타나는 문제를 수정했습니다.
- Changed: 손님 sprite/라벨/말풍선 DOM을 재사용하고, 이미지 경로가 바뀔 때만 `src`를 갱신하도록 변경했습니다.
- Fixed: 진상 이벤트 발생 후 `nuisanceProfileId`가 렌더링 payload에도 전달되도록 보완해 진상별 전용 에셋 교체가 안정적으로 작동하게 했습니다.
- Changed: 손님 이미지 로딩은 `eager`로 전환하고, 렌더 안정화용 CSS를 추가했습니다.

## [v7.7.2] 플레이어 이동 렌더링 최적화 및 아이콘 깜빡임 수정
- Fixed: 플레이어 이동 중 `GAME_STATE_CHANGED` 전체 렌더가 매 프레임 발생해 이동 속도가 느려 보이던 문제를 수정했습니다.
- Fixed: 이동/자동 이동 중 플레이어 박스, 창고 박스, 청소 아이콘 이미지가 매 프레임 재생성되어 덜덜 떨리거나 깜빡이던 문제를 수정했습니다.
- Changed: 플레이어 위치 변경은 전용 `PLAYER_POSITION_CHANGED` 이벤트로 플레이어와 상호작용 하이라이트만 갱신하도록 분리했습니다.

## [v7.7.2-order-inventory-import-fix-260705]
### Fixed
- 발주 확정 시 창고 용량 검사를 위해 `OrderSystem.js`에서 사용하는 `InventorySystem` import 누락을 복구했습니다.
- `ORDER_CONFIRMED` 처리 중 `InventorySystem is not defined` 오류가 발생하지 않도록 수정했습니다.

### Notes
- 수정 파일: `systems/OrderSystem.js`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v7.7.1-player-size-balance-260705]
### Changed
- 플레이어 PNG 표시 크기를 `74px × 130px`에서 `58px × 102px`로 줄여 손님 캐릭터와 화면 비율을 맞췄습니다.
- 손님 PNG 크기는 기존 `49px × 87px`로 유지해 플레이어가 손님보다 약간만 크게 보이도록 조정했습니다.
- 플레이어 그림자와 들고 있는 박스 표시 크기를 축소된 플레이어 크기에 맞게 줄였습니다.

### Fixed
- 플레이어 크기 변경 후 상호작용 중심점/자동 이동 위치 계산의 fallback 크기도 `58px × 102px` 기준으로 맞췄습니다.

### Notes
- 수정 파일: `style.css`, `systems/PlayerMovementSystem.js`, `systems/PlayerActionSystem.js`, `ui/UIManager.js`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v7.7.0-customer-assets-260705]
### Added
- 업로드된 손님 PNG 128개를 `assets/images/customers/` 하위 캐릭터별 폴더로 정리했습니다.
- `AssetData.js`에 기본 손님 타입과 진상 `nuisanceProfileId`를 PNG 에셋으로 연결하는 매핑 테이블을 추가했습니다.
- 일반/학생/회사원/급한 손님/진상 손님별 8방향 이미지 경로 선택 헬퍼를 추가했습니다.

### Changed
- 손님 렌더링을 기존 텍스트/이모지 박스에서 `<img class="customer-sprite">` 기반 PNG 캐릭터 렌더링으로 교체했습니다.
- 손님 크기를 플레이어 74x130 기준 1.5배 작은 약 49x87px로 맞췄습니다.
- 급한 손님은 회사원/일반 손님 에셋을 재사용하도록 연결했습니다.
- 봉투 추가 손님은 `customer_trouble_bulky_sleeve_*`, 전자레인지 진상은 `customer_trouble_bargain_perm_*` 에셋을 재사용하도록 연결했습니다.

### Fixed
- 진상 이벤트 발생 후 `nuisanceProfileId`가 붙으면 해당 진상 전용 PNG로 화면 표시가 바뀌도록 보완했습니다.
- 손님 PNG 로딩 실패 시 기존 텍스트 라벨이 fallback으로 보이도록 처리했습니다.

### Notes
- 수정 파일: `data/AssetData.js`, `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 추가 폴더: `assets/images/customers/`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-bm-staff-upgrade-merge-260705]
### Added
- BM 담당자 최신본의 상품별 shelfId/매대 분리 로직을 최신 작업본에 병합했습니다.
- Day 시작 상권 시나리오 확률/추천 상품 갱신 로직을 반영했습니다.
- 상품 최종 강화명/강화 판매가가 발주, 상점, 계산, 재고, 정산 흐름에 표시·반영되도록 연결했습니다.

### Changed
- 알바 능력 강화가 기본 스탯을 직접 변경하지 않고 BM 강화값으로 별도 누적되도록 정리했습니다.
- 진열대 강화가 displayCategory와 shelfId 양쪽 키를 안전하게 인식하도록 수정했습니다.
- 최신본의 지도/발주 카드형 UI 수정은 유지하고, BM 표시명/가격/shelfId 변경만 수동 병합했습니다.

### Fixed
- 결과 모달에서 존재하지 않는 광고 보상 버튼 함수 호출 가능성을 제거했습니다.
- 신선 매대 상호작용 구역을 추가해 냉장/신선/온장/기본 매대 보충 타깃을 분리했습니다.
- 세이브 로딩 시 BM 재화 스냅샷과 레벨 맵이 안전하게 정규화되도록 보완했습니다.

### Notes
- 기준 파일: `260705 일 20시 41분.zip`
- 병합 소스: `Still_Open-bm-staff-upgrade-fix-v1.zip`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-order-summary-right-quantity-fix-260705]
### Changed
- 발주 요약 영역(예상 발주 비용/보유금/발주 수량/발주 확정)을 왼쪽에서 오른쪽 패널로 이동했습니다.
- 상품 카드 목록을 왼쪽 넓은 영역에 배치하도록 발주 모달 그리드 구조를 변경했습니다.
- 작은 화면에서는 카드 폭 확보를 우선해 상품 그리드를 2열로 낮추도록 조정했습니다.

### Fixed
- 작은 화면에서 수량 조절 버튼이 상품 카드 밖으로 튀어나가던 문제를 수정했습니다.
- 수량 조절 영역의 버튼/수량 칸 폭을 카드 내부에 맞게 줄이고, 기존 pseudo 영역의 과한 폭 영향을 제한했습니다.

### Notes
- 수정 파일: `style.css`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-order-tab-font-card-spacing-260705]
### Fixed
- 발주 카테고리 탭의 한글 글씨 크기를 키워 가독성을 개선했습니다.
- 상품 카드 위/아래 줄이 겹치던 문제를 카드 높이와 그리드 행 간격 확대로 보정했습니다.
- 수량 조절 영역이 카드 밖으로 밀리거나 다음 줄 카드와 겹치지 않도록 `position/transform/margin`을 정상 흐름으로 고정했습니다.
- 매입가/판매가 영역과 수량 영역의 최소 높이를 확보해 카드 내부 레이아웃이 안정적으로 유지되도록 수정했습니다.

### Notes
- 수정 파일: `style.css`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-order-grid-area-final-fix-260705]
### Fixed
- 발주 카드형 모달에서 기존 `#order-modal-body`의 `grid-template-areas(header/list/total/message/button)` 구조가 남아 상품 영역을 밀어내던 문제를 수정했습니다.
- 카드형 발주 화면에서만 `order-modal-body--card-draft` 클래스를 적용해 기존 grid-area 기반 레이아웃을 비활성화했습니다.
- 기존 `.order-product-list { grid-area: list !important; }` 충돌을 카드형 발주 모달 내부에서 해제했습니다.
- 카테고리 탭과 상품 카드 리스트가 같은 오른쪽 패널 안에서 정상적으로 위/아래 배치되도록 `toolbar/cards` 레이아웃을 새로 지정했습니다.
- 상품 카드가 오른쪽 절반에 몰리지 않고 오른쪽 상품 패널 전체 폭을 사용하도록 재배치했습니다.

### Changed
- 발주 대기/입고 상태로 넘어갈 때 카드형 전용 body 클래스를 제거하도록 정리했습니다.
- `온장/즉석` 카테고리 명칭은 원문 그대로 유지했습니다.

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-order-full-width-fix-260705]
### Fixed
- 발주 상품 패널이 오른쪽 절반 영역에 갇히던 폭 제한을 제거했습니다.
- 카테고리 탭이 오른쪽 상품 패널 전체 가로폭을 사용하도록 수정했습니다.
- `온장/즉석` 탭명을 유지하면서 탭 길이를 충분히 확보했습니다.
- 상품 카드 그리드가 오른쪽에 몰리지 않고 패널 왼쪽부터 전체 폭을 사용하도록 재배치했습니다.
- 기존 CSS에서 카드형 그리드에 남아 있던 고정 폭/반쪽 폭/offset 계열 제약을 최종 override로 무효화했습니다.

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-order-tab-label-fix-260705]
### Fixed
- 발주 카테고리 탭의 `온장` 축약 표기를 원래 명칭인 `온장/즉석`으로 복구했습니다.
- `온장/즉석` 탭이 잘리지 않도록 발주 상품 영역의 가로폭을 더 확보했습니다.
- 카테고리 탭 텍스트가 말줄임 처리되지 않도록 최종 스타일을 보정했습니다.

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-order-card-final-layout-260705]
### Changed
- `발주하러 가기` 버튼을 실제 버튼 ID 기준으로 다시 잡아 과도하게 길게 늘어나지 않도록 수정했습니다.
- 카테고리 탭을 작게 압축하지 않고 상품 패널 가로폭을 사용해 한 줄로 펼치도록 수정했습니다.
- 온장/즉석 탭 라벨을 `온장`으로 줄여 탭 전체가 한 줄에서 잘리지 않도록 정리했습니다.
- 상품 카드를 세로형 구성으로 재배치했습니다.
  - 이미지 정중앙
  - 이미지 밑 상품명
  - 상품명 밑 재고
  - 매입가
  - 판매가
  - 수량 조절
- 상품 카드가 오른쪽에 몰리지 않도록 상품 패널 전체 폭을 사용하게 수정했습니다.
- 상품 카드 간 좌우/위아래 간격을 넓혀 여유롭게 보이도록 조정했습니다.

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-order-card-align-fix-260705]
### Fixed
- `발주하러 가기` 버튼이 부모 폭 전체로 과하게 늘어나던 문제를 보정했습니다.
- 발주 카테고리 탭의 가로 스크롤바를 제거하고 5개 탭이 한 줄에 모두 보이도록 정리했습니다.
- 카테고리 탭 클릭 시 기본 동작을 막아 탭/스크롤 상태가 튀는 현상을 줄였습니다.
- 상품 카드 그리드가 오른쪽으로 쏠려 보이던 문제를 최종 CSS override로 중앙 재배치했습니다.
- 기존 리스트형 `.order-product-row` 스타일이 카드형 그리드에 섞여 들어가는 문제를 카드형 전용 선택자로 무효화했습니다.

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-order-category-card-260705]
### Added
- 발주 모달에 카테고리 탭을 추가했습니다.
  - 전체
  - 기본 진열
  - 신선식품
  - 냉장식품
  - 온장/즉석
- 발주 상품 목록을 세로 리스트형에서 카드형 그리드 UI로 변경했습니다.
- 상품 카드 이미지 왼쪽 위에 `[오늘의 추천]` 배지가 표시되도록 수정했습니다.
- 카테고리별 상품 수와 현재 선택 수량을 표시하는 요약 영역을 추가했습니다.

### Changed
- 상품 카드 구성을 `이미지 → 상품명 → 매입가/판매가 → 수량 조절` 흐름으로 정리했습니다.
- 기존 수량 증가/감소 및 발주 확정 로직은 유지하고, 렌더링 구조만 카테고리/카드형으로 변경했습니다.
- 화면 크기에 따라 상품 카드가 2열/3열/4열로 반응형 배치되도록 조정했습니다.

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-map-topbar-left-auto-260705]
### Changed
- 상단 상태바의 강제 넓은 가로폭을 제거하고, 현재 표시 내용만큼만 자연스럽게 잡히도록 수정했습니다.
- 상태바 항목을 모두 왼쪽 정렬로 통일했습니다.
- 다이아/재고 항목의 별도 flex 폭 설정을 제거해 가운데 떠 보이는 문제를 보정했습니다.
- 향후 숫자가 길어질 때 상태바가 필요한 만큼 늘어나도록 `fit-content` 기반으로 정리했습니다.

### Notes
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-map-feedback-ui-fix-260705]
### Changed
- 상단 상태바의 가로 폭을 다시 확보해 `재고` 항목이 잘리지 않도록 수정했습니다.
- `Day 1` 텍스트가 줄바꿈되지 않도록 Day 카드 내부 정렬을 보정했습니다.
- 다이아 HUD 문구를 `다이아 0`에서 숫자만 표시하는 방식으로 변경해 긴 숫자에서 넘침 가능성을 줄였습니다.
- 창고/박스 기본 위치를 현재 x축 기준으로 아래로 내려 매장 벽 바로 옆에 붙도록 조정했습니다.

### Notes
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.


## [v-map-focus-feedback-260705]
### Changed
- 상단 HUD를 한 줄형 콤팩트 레이아웃으로 축소해 화면 가림을 줄였습니다.
- 상태 바(`money/diamond/satisfaction/mental/sanitation/stock`)를 2줄 그리드 대신 1줄 플렉스 구조로 보이도록 스타일을 조정했습니다.
- 재고 요약 보조 패널은 숨기고 상단 상태 바만 보이도록 정리했습니다.
- 창고 박스 기본 위치를 매장 바깥 왼쪽 구역으로 이동했습니다.
- 택배 박스 도착 위치를 매장 바깥 하단 왼쪽 구역으로 이동했습니다.
- 확대 보기 포커스를 사용자 피드백 기준으로 재조정했습니다.

### Focus Tuning
- Lv.1 기본 매장: 화면 중심을 약간 오른쪽/위쪽으로 이동
- Lv.2 추가 진열 구역: 포커스를 위쪽으로 이동
- Lv.3 냉장·도시락 구역: 포커스를 위쪽으로 이동
- Lv.4 프리미엄 매장 구역: 포커스를 왼쪽/위쪽으로 이동

## [v-map-position-260705-1215]
### Changed
- 최신 `world (2).zip` 맵 에셋 기준으로 `background`, `unified`, `state`, `bright`, `fixing` 레이어를 월드 전체 캔버스에 맞춰 정렬했습니다.
- `#store-world-map.is-unified-store-layout`의 통합 매장 기준 좌표를 `0,0 / 1672x941`로 변경해 전체 캔버스형 에셋이 배경과 같은 위치에 겹치도록 수정했습니다.
- `data/ExpansionData.js`의 4개 확장 구역 `worldX/worldY/worldWidth/worldHeight`, 포커스 좌표, 이동 가능 영역을 새 맵 이미지 기준으로 재조정했습니다.
- 월드 전체보기 카메라 중심을 새 통합 매장 중심에 맞게 보정했습니다.
- 플레이어 기본 시작 좌표를 새 기본 매장 바닥 영역 안쪽으로 조정했습니다.

### Removed
- 남아 있던 `store-world-shared-floor` DOM 생성 코드와 CSS를 제거했습니다.

### Notes
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v-map-cleanup-260705-1202]
### Changed
- `assets/images/world/` 맵 에셋을 최신 `world (2).zip` 기준으로 교체했습니다.
- `map/background.png`, `unified/unified_store_stage1.png`, 확장 구역, 잠금 상태, 공사 상태, 아이콘 에셋을 최신본으로 맞췄습니다.

### Removed
- 더 이상 사용하지 않는 `assets/images/world/map/map2_floor_clean.png` 에셋을 제거했습니다.
- `ui/UIManager.js`의 `store-map-shared-floor` 이미지 레이어 생성을 제거해 404 가능성과 중복 바닥 레이어 구조를 정리했습니다.

### Notes
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js`는 수정하지 않았습니다.

## [v7.6.0] BM final full alignment pass

### Added
- BM 최종본 기준 상점 3탭 구조를 추가했습니다: 재화 충전 / 편의 상품 / 프리미엄 상품.
- 일일 미션 7종 후보 중 Day 기준 랜덤 3개 선정 및 1개/2개/3개 완료 보상을 추가했습니다.
- 무료 충전소 광고형 보상 3종을 추가했습니다: 다이아 10개, 골드 1,500, 피크타임 쿠폰 50% 할인.
- 다이아 5종 테스트 구매와 골드 3종 다이아 구매를 추가했습니다.
- 피크타임 쿠폰을 20다이아 구매 후 영업 중 1회 사용하는 구조로 분리했습니다.
- 창고 확장, 진열대 강화, 상품별 강화, 알바 강화권을 상점 편의 상품 탭에 추가했습니다.
- 구역 확장 1 Day 대기 및 다이아 즉시 완료권 구조를 추가했습니다.

### Changed
- Day 1 시작 골드를 22,500골드로 조정했습니다.
- 상품 판매 매출 계산이 상품별 강화 판매가를 반영하도록 수정했습니다.
- 알바 역할을 자동 계산 보조가 아닌 창고/진열대/청소 보조 기준으로 정렬했습니다.
- 정산 광고 보상/정산 멘탈 회복 광고 흐름은 BM 최종 기준에서 제외했습니다.

### Fixed
- 창고 용량을 초과하는 발주를 UI와 OrderSystem 양쪽에서 차단했습니다.
- 출석보상 티켓류가 BM 지갑과 동기화되도록 수정했습니다.

## [v청소UI-1]

### Changed
- 상단 HUD의 위생 표시를 다른 스탯 UI와 동일한 스타일로 통일
- 위생 전용 흰색 캡슐형 배경 제거
- 위생 상태 텍스트 대신 수치 중심 표시로 정리

### Fixed
- 위생 HUD가 기존 재화/만족도/멘탈 HUD와 시각적으로 분리되어 보이던 문제 수정

## [v7.4.0] Sanitation and BM final hookup

### Added
- 청소/위생 시스템을 실제 플레이에 연결했습니다: 고정 청소 구역, 위생 HUD, 5초 청소 진행, 청소 완료 이펙트, 위생 저장/불러오기 스냅샷을 추가했습니다.
- 진상/불만 손님 이벤트 발생 시 위생 감소가 반영되도록 기존 고객 이벤트 흐름과 `SanitationSystem`을 연결했습니다.
- 위생 50 이하로 정산 시 만족도 -5 페널티가 정산 결과와 목표 체크에 표시되도록 추가했습니다.
- 판매권/프리미엄 상품 구매 전 “해당 상품을 구매하시겠습니까?” 확인 팝업을 추가했습니다.

### Changed
- 정산 후 기존 업그레이드 선택을 BM 최종안에 맞춰 멘탈 회복 3종 선택지로 교체했습니다: 무료 +15, 골드 3,000 +30, 다이아 10 +60.
- 청소/위생은 자동 처리 없이 플레이어가 청소 구역에서 직접 상호작용해야 회복되도록 유지했습니다.

### Maintained
- 광고 스킵권 조각 시스템은 추가하지 않고, 기존 전체 광고 스킵권/다이아 보상 구조만 유지했습니다.

## [v7.3.9] ArriveBox size fine tune

### Changed
- 발주 도착 박스(ArriveBox) 맵 표시 크기를 추가로 약 5% 축소했습니다.
- 축소 후 위치가 자연스럽도록 좌표를 미세 조정했습니다.

## [v7.3.8] ArriveBox size tune

### Changed
- 발주 도착 박스(ArriveBox) 맵 표시 크기를 소폭 축소했습니다.
- 축소 후에도 입구 오른쪽 배치가 자연스럽게 보이도록 위치를 미세 조정했습니다.

## [v7.3.7] Delivery box wrapper transparency reset

### Fixed
- ArriveBox 주변에 남아 보이던 직사각형/투명 영역이 에셋이 아니라 래퍼 스타일에서 생기는 상황을 대비해 delivery-box wrapper 전체의 background / backdrop-filter / box-shadow를 강제 제거했습니다.
- delivery-box visual/img에 투명 배경 강제값을 추가했습니다.

## [v7.3.6] Exact user box assets applied

### Fixed
- 사용자가 직접 누끼 딴 박스 에셋 원본을 리사이즈/재가공 없이 그대로 적용했습니다.
- 모든 창고/도착/카테고리 박스 이미지를 사용자가 전달한 최신 파일로 일괄 교체했습니다.

### Maintained
- 게임 내 표시 크기는 기존 CSS/레이아웃 기준을 유지해 일관되게 보이도록 했습니다.

## [v7.3.5] User-cleaned warehouse box assets applied

### Changed
- 사용자가 새로 누끼 딴 창고/재고 박스 에셋으로 전면 교체했습니다.
- arrive/basic/category 박스 에셋을 기존 표시 기준에 맞춰 일관된 크기로 재정렬해 적용했습니다.

### Maintained
- 기존 창고 박스/도착 박스 배치와 로직 연결은 유지했습니다.

## [v7.3.4] ArriveBox transparent background fix

### Fixed
- ArriveBox 원본에 남아 있던 반투명 노란 사각 배경/블러 영역을 제거했습니다.
- 도착 박스는 박스와 상품, 일부 반짝임만 남도록 재마스킹했습니다.

## [v7.3.3] Warehouse placement and arrival box cleanup hotfix

### Changed
- BasicBox 창고 박스를 이전보다 더 위쪽으로 이동해 창고 자리와 맞췄습니다.
- ArriveBox 도착 박스를 입구 오른쪽 부근으로 재배치했습니다.
- ArriveBox 도착 박스 표시 크기를 추가로 확대했습니다.

### Fixed
- ArriveBox 주변에 남아 있던 직사각형 형태의 반투명 배경이 덜 보이도록 에셋 마스킹을 추가로 보정했습니다.

## [v7.3.2] Warehouse visual alignment hotfix

### Changed
- BasicBox 창고 박스 위치를 화면 왼쪽 창고 자리 쪽으로 더 위로 올려 재배치했습니다.
- ArriveBox 도착 박스의 화면 표시 크기를 키워 가시성을 높였습니다.

### Fixed
- 창고/도착 박스 이미지 주변의 배경이 덜 남도록 에셋 투명 영역을 추가 정리했습니다.
- 도착 박스가 너무 작게 보이던 문제를 보정했습니다.

## [v7.3.1] Warehouse box hotfix

### Fixed
- 창고 박스 위치를 가게 맵 바깥 왼쪽 목표 위치로 재조정했습니다.
- 발주 도착 박스와 창고 박스의 이동 좌표가 시각 오브젝트 위치와 어긋나던 문제를 수정했습니다.
- 발주 전에도 테스트용 기본 창고 재고로 진열대 보충이 가능하던 문제를 차단했습니다.
- 진열대 보충 이벤트가 InventorySystem의 총 재고를 새로 증가시키지 않도록 `player_shelf_restock` source 예외 처리를 추가했습니다.
- 박스 에셋의 불필요한 배경/체커보드 영역을 줄이고, 시각 영역과 hitbox가 과하게 튀어나오지 않도록 보정했습니다.

### Maintained
- 창고/진열대 수동 작업 시간 5초는 알바 고용 필요성을 위한 피로도 설계로 유지했습니다.


## [v7.2.2] HUD 재화 아이콘 에셋 적용

### Changed
- 상단 HUD의 골드/다이아 아이콘을 임시 CSS/문자 아이콘에서 실제 재화 에셋 이미지로 교체했습니다.
- `assets/ui/currency/gold.png`, `assets/ui/currency/diamond.png`를 추가했습니다.
- 작은 화면에서도 재화 아이콘이 찌그러지지 않도록 `background-size: contain` 기준으로 표시되게 보정했습니다.


## [v7.2.1] 상단 상태바 5칸 HUD 압축 보정

### Fixed
- BM 다이아 표시 추가 후 상단 상태바 글씨가 칸 밖으로 튀어나오던 문제를 수정했습니다.
- 골드/다이아/만족도/멘탈/재고 5개 항목이 한 줄 안에서 압축 표시되도록 폭, 폰트, 아이콘, 패딩을 보정했습니다.
- 작은 가로 화면에서도 상태바 각 칸 내부에서만 텍스트가 보이도록 overflow 처리를 추가했습니다.


## [v7.2.0] BM 작업본 + 출석보상 병합

### Added
- 팀원 BM 작업본의 판매권/프리미엄 상품/멘탈 회복/광고 보상 관련 변경사항과 7일 출석보상 시스템을 한 작업본으로 병합했습니다.
- 출석보상 에셋과 DailyRewardData.js, DailyRewardSystem.js를 BM 작업본에 추가했습니다.

### Changed
- UIManager.js에서 BMSystem/BM_EVENTS와 DailyRewardSystem import 및 팝업 진입 흐름이 함께 동작하도록 병합했습니다.
- 출석보상 다이아 보상이 BMSystem이 사용하는 GameState.bm.diamond에도 반영되도록 연결했습니다.
- style.css의 BM UI 스타일과 출석보상 팝업/투명 확인 버튼 스타일을 함께 유지했습니다.

### Fixed
- UIManager.js, style.css 병합 충돌을 해소했습니다.
- JS 문법 검사 기준으로 신규/수정 JS 파일에 syntax error가 없음을 확인했습니다.



## [v7.1.1] 출석보상 확인 버튼 클릭 영역 보정

### Fixed
- 출석보상 팝업 확인 버튼 위 투명 클릭 영역이 화면에 티나 보이던 문제를 수정했습니다.
- 클릭 영역 위치를 기존보다 아래로 조정하고, 브라우저 기본 버튼/포커스/탭 하이라이트 효과가 노출되지 않도록 처리했습니다.

## [v7.1.0] 7-day daily reward popup
- Added: 7일 출석보상 통이미지 에셋(day1_basic~day7_basic, clickbutton)을 assets/ui/dailyreward/에 추가
- Added: DailyRewardData.js로 1~7일차 보상 데이터와 이미지 경로 분리
- Added: DailyRewardSystem.js로 KST 기준 하루 1회 출석 수령, 7일 주기 갱신, localStorage 저장 구조 추가
- Added: 타이틀에서 새로 시작/이어하기로 게임 진입 시 출석보상 팝업 자동 표시
- Changed: 확인 버튼은 이미지 위 투명 클릭 영역으로 처리해 별도 버튼 이미지 없이도 수령 가능
- Maintained: index.html, main.js, core/GameState.js, core/EventBus.js, core/Constants.js 미수정


## [v7.0.5.1] Player 8-direction asset merge
- Added: 플레이어 8방향 PNG 에셋을 assets/images/player/에 추가
- Added: 키보드/WASD 이동 시 플레이어 방향값 계산 및 data-direction 반영
- Added: 터치/클릭 자동 이동 시 플레이어 방향값 계산
- Changed: 기존 임시 플레이어 표시를 PNG 캐릭터 표시로 교체
- Fixed: 플레이어 사각 박스 방지 CSS 초기화 및 타원 그림자 표시 유지
- Maintained: 기존 온장고/진열대/냉장고/텍스트박스/저장 흐름 유지


## [v7.0.5] Food warmer asset integration
- Added: 온장고(food warmer) full / half / empty, left / right 상태별 에셋 추가
- Added: AssetData.js에 foodWarmer 오브젝트 타입 및 상태별 이미지 경로 추가
- Added: UIManager.js에 온장고 시각 오브젝트 렌더링 구조 추가
- Changed: 소시지 핫바 계열 상품은 향후 온장고 비주얼 재고로 분리되도록 매핑 준비
- Maintained: 기존 진열대/음료 냉장고/계산대/손님/저장 흐름 유지


## [v7.0.4.2] Player textbox readability hotfix
- Fixed: 플레이어/알바생 텍스트박스 글씨를 흰색에서 검은색 계열로 변경해 가독성을 개선
- Changed: 플레이어 대사 텍스트 그림자를 어두운 그림자에서 밝은 하이라이트로 조정
- Maintained: 일반 손님 / 진상 손님 텍스트박스 색상과 표시 흐름 유지

## [v7.0.3] Settings vibration option cleanup
- Removed: 설정 팝업에서 사용하지 않는 진동 옵션 제거
- Maintained: 효과음 / 배경음 표시와 기존 설정 열기/닫기 흐름 유지

## [v7.0.2] Title logo replacement
- Changed: 시작 화면 로고를 신규 고화질 안전 로고 에셋으로 교체
- Removed: 기존 title logo 파일 참조 제거
- Maintained: 기존 타이틀 화면 버튼, 이어하기, 설정 흐름 유지

## [v7.0] Infinite mode game over conditions
- Added: 무한 모드 게임오버 조건 판정 구조 추가
- Added: 멘탈 0 이하 / 만족도 0 이하 / 연속 영업 실패 3회 / 최저 발주 비용 미만 + 재고 없음 조건 처리
- Added: 무한 모드 게임오버 안내 모달 및 종료 사유 표시
- Changed: 무한 모드 게임오버 시 업그레이드 단계로 넘어가지 않고 타이틀 복귀 흐름으로 전환
- Fixed: 게임오버 확정 시 저장 데이터와 무한 모드 진행 데이터를 전체 리셋하도록 처리
- Deferred: 유료 BM 유지 처리는 실제 BM 연동 전까지 보류

## [v6.9] Upgrade and unlock effects
- Added: 신규 상품 해금 시 unlock effect 토스트 표시
- Added: 업그레이드 선택 시 upgrade sparkle 토스트 및 카드 선택 피드백 표시
- Added: 매장 공사 시작/완료 시 loading/construction effect 토스트 표시
- Changed: 확장 완료 puff에 공사 완료 에셋을 사용하도록 시각 효과 보강
- Maintained: 기존 저장/이어하기, 발주, 정산, 업그레이드, 확장 흐름 유지

## [v6.8.2] Delivery box interaction effect cleanup
- Fixed: 택배 박스에 glow ring / finger tap / click sparkle 이펙트가 표시되지 않도록 제거
- Changed: 택배 박스는 기존 클릭/정리 기능만 유지하고 상호작용 이펙트 대상에서 제외
- Maintained: 진열대/계산대 상호작용 이펙트 유지

## [v6.8] Save and continue system


## [v6.8.1] Save/Continue reset hotfix
- Fixed: 새로 시작 직후 기본 Day 1 상태가 자동 저장되어 이어하기 시 초기화처럼 보이던 문제 수정
- Fixed: 의미 있는 진행 데이터가 없는 기본 저장값은 이어하기 데이터로 인정하지 않도록 방어 처리
- Added: Day 시작/발주 확정/발주 도착 시점의 저장 트리거 보강
- Maintained: 기존 타이틀 화면, 설정 팝업, Day 진행, 발주/재고 흐름 유지

- Added: localStorage 기반 저장/불러오기 시스템 추가
- Added: 타이틀 화면 이어하기 버튼을 실제 저장 데이터와 연결
- Added: 저장 데이터가 있으면 이어하기 활성화, 없으면 disabled 유지
- Added: Day, 보유금, 만족도, 멘탈, 목표, 재고 lot, 확장, 업그레이드, 플레이어 위치 등 안전한 상태 저장
- Changed: 새로 시작 클릭 시 기존 저장 데이터를 초기화하고 새 게임 상태로 시작
- Fixed: 손상된 저장 데이터 파싱 실패 시 게임이 멈추지 않도록 방어 처리
- Maintained: index.html, main.js, core/GameState.js, core/EventBus.js, core/Constants.js 미수정

## [v6.7.2] Screen focus accessibility hotfix
- Fixed: 타이틀 화면 숨김 처리 시 새로 시작 버튼에 focus가 남아 발생하던 aria-hidden 경고 제거
- Changed: 화면/모달 숨김 처리 전 내부 focus를 안전하게 제거하는 공통 처리 추가
- Maintained: 기존 타이틀 화면, 설정 팝업, 새로 시작 흐름 유지

## [v6.7.1] Settings modal focus hotfix
- Fixed: 설정 모달 닫기 시 aria-hidden 내부 요소에 focus가 남아 발생하던 접근성 경고 제거
- Changed: 설정 모달 닫기 전 focus blur 또는 안전한 focus 이동 처리
- Maintained: 기존 설정 팝업 열기/닫기 흐름 유지

## [v6.7] Title screen and settings entry
- Added: 타이틀 화면 버튼 구조 정리
- Added: 새로 시작 / 이어하기 / 설정 버튼 배치
- Added: 저장 데이터 없음 상태의 이어하기 disabled 표시 준비
- Added: 인게임 설정 버튼 진입 구조
- Deferred: 실제 저장/이어하기 복원 기능은 다음 작업으로 분리

## [v6.6] Reward 2x ad dummy BM
- Added: 정산 화면 보상 2배 광고 더미 기능
- Added: 광고 시청 중 2초 더미 처리 흐름
- Added: 광고 완료 후 정산 보상 2배 적용
- Added: 보상 2배 버튼 disabled 및 중복 보상 방지
- Added: 다음 정산에서 다시 사용할 수 있도록 사용 상태 초기화
- Maintained: 기존 매출 계산, Day 진행, 진열대/계산대/손님 흐름 유지
- Deferred: 실제 광고 SDK 연동은 배포 단계로 분리

## [v6.5] UI and interaction polish
- Added: 상호작용 가능 오브젝트 glow ring 표시 구조
- Added: 상호작용 가능 상태 finger tap 안내 아이콘 구조
- Added: 클릭/상호작용 성공 시 click sparkle 피드백
- Added: UI 버튼 normal / pressed / disabled 상태 이미지 적용 구조
- Added: 아이콘 버튼 close / back / confirm / cancel / warning 상태 이미지 적용 구조
- Added: 이어하기 / 설정 / 보상 2배 광고 버튼 상태 이미지 적용 구조
- Fixed: 상호작용 이펙트가 클릭을 가로채지 않도록 pointer-events: none 유지
- Maintained: 기존 플레이어 이동, 진열대, 계산대, 손님 흐름 유지
- Deferred: 보상 2배 광고의 실제 BM 보상 지급 로직은 다음 작업으로 분리

## [v6.5] Shelf/Fridge visual placement tuning
- Changed: 진열대/음료 냉장고 위치 간격 및 레이어 순서 보정
- Fixed: 오브젝트 뒤에 보이던 반투명/흐림 배경 제거
- Fixed: visual wrapper / hitbox 영역의 불필요한 배경 표시 제거
- Maintained: 재고 1개 이상일 때 half로 보이는 현재 시각 상태 기준 유지

## [v6.4] Shelf/Fridge visual asset integration
- Added: 진열대/음료 냉장고 상태별 이미지 연결
- Added: stock/capacity 기반 full / half / empty 시각 상태 반영
- Added: left / right 방향별 오브젝트 이미지 표시
- Changed: 오브젝트 이미지는 visual 영역, 상호작용은 hitbox 영역으로 분리
- Fixed: 투명 이미지 영역이 클릭을 과도하게 받는 문제 방지

## [v6.1.3] - 진열대 상호작용 오작동 수정

## [v6.3] Asset integration prep

- Added: 신규 게임용 이미지 assets 적용 전 준비 구조 추가

- Added: AssetData.js 경로 검증

- Added: 진열대/display stand와 음료 냉장고/beverage fridge의 full / half / empty 상태 기반 이미지 구조 준비

- Added: stock/capacity 기준 visual state 유틸 함수 준비

- Added: 이미지 visual 영역과 클릭 hitbox 분리 구조 준비

- Added: interaction effect, glow ring, sparkle, finger tap의 pointer-events: none 처리 준비

- Added: UI 버튼 normal / pressed / disabled 상태 관리 구조 준비

- Added: 이미지 preload 함수 준비

- Fixed: 투명 여백 제거 에셋 적용 시 클릭 범위가 과도하게 잡힐 수 있는 문제 사전 대응

### Fixed
- 플레이어가 진열대에서 상호작용 키를 눌렀을 때 계산대 상호작용으로 잘못 판정되어 손님이 사라지던 문제를 수정했습니다.
- 상호작용 대상 판정을 `계산대 우선` 방식에서 `가장 가까운 대상 우선` 방식으로 변경해 진열대/계산대 입력 충돌을 줄였습니다.
- 월드맵 카메라 확대/이동 상태에서 `getBoundingClientRect()` 화면 좌표와 플레이어 월드 좌표가 섞이던 문제를 막기 위해 상호작용 거리 계산을 `offsetLeft/offsetTop` 기준으로 보정했습니다.
- 플레이어 중심점도 실제 DOM 크기 기준으로 계산하도록 보정해 상호작용 판정 위치를 더 안정화했습니다.

### Preserved
- 기존 계산 완료 이벤트, 진열대 보충 흐름, 플레이어 자동 이동, 손님 렌더링 방식은 유지했습니다.


## [v6.1.2] - 플레이어 이동 시각 고정 해제

### Fixed
- 통합 매장 배치 작업 중 CSS에서 `#player-zone`의 `left/top` 좌표가 `!important`로 고정되어 플레이어가 움직이지 않아 보이던 문제를 수정했습니다.
- `UIManager.renderPlayer()`에서 플레이어 좌표를 inline `!important`로 갱신하도록 변경해 기존 좌표 보정 CSS보다 실제 이동 좌표가 우선 적용되게 했습니다.

### Preserved
- 기존 키보드 이동 로직, 이동 가능 영역, 1번 매장 기본 이동 범위, 해금된 구역만 이동 가능 규칙은 유지했습니다.


## [v6.1.1] - 통합 매장 베이스 이미지/구역별 오버레이 전환

### Added
- 사용자가 제공한 `full_empty_space.png`를 실제 통합 매장 베이스 이미지로 추가했습니다.
- 잠긴 구역용 구역별 dark overlay를 추가해 통합 매장 이미지 위에서 2/3/4번 공간의 잠금 상태를 표현합니다.

### Changed
- 개별 1/2/3/4 공간 이미지를 화면 비주얼로 직접 쌓는 방식에서 `통합 매장 1장 + 투명 구역 hitbox + 잠금 overlay` 방식으로 전환했습니다.
- 구역별 zone id, 클릭 확대, 라벨 팝오버, cloud/lock, 해금 기능은 유지했습니다.
- 1번 기본 매장 좌표 변경에 맞춰 입구/진열대/계산대/플레이어/고객 위치를 재조정했습니다.
- 전체보기 카메라 중심을 통합 매장 기준으로 보정했습니다.

### Fixed
- 4개 개별 공간 이미지의 각도/그림자/벽 두께가 따로 놀아 매장이 자연스럽게 이어지지 않던 문제를 완화했습니다.
- 공간 사이가 이미지끼리 겹쳐 보이던 문제를 줄였습니다.


## [v6.1.0] - 4개 확장 구역 통합 매장 배치 1차

### Added
- `map2_floor_clean.png` 하부 공터 레이어를 추가해 4개 공간이 같은 부지 위에 놓인 것처럼 보이도록 구성했습니다.
- 사용자가 제공한 `full_empty_space` 이미지를 통합 매장 배치 참고용 에셋으로 보관했습니다.

### Changed
- 1/2/3/4번 공간의 월드맵 좌표를 2x2 확장형 매장 구조로 재배치했습니다.
- 각 구역 벽과 경계는 유지하면서 공간 사이 간격을 줄여 하나의 매장처럼 보이도록 조정했습니다.
- 1번 기본 매장 좌표 변경에 맞춰 입구/진열대/계산대/플레이어/고객 위치와 임시 확장 기능 박스 좌표를 재조정했습니다.
- 전체보기 버튼은 4개 공간이 하나의 통합 매장으로 보이도록 중심점과 줌을 보정했습니다.

### Fixed
- 4개 공간이 넓은 공터 위에 뿔뿔이 흩어져 보이던 문제를 완화했습니다.
- 1번 매장 이동 후 플레이어 기본 위치가 기존 좌표에 남아 어색해질 수 있는 문제를 보정했습니다.

### Preserved
- 기존 zone id, 잠금/해금 상태, cloud/lock 표시, 라벨 팝오버, 공간 클릭 확대, 해금된 구역만 이동 가능 규칙은 유지했습니다.


## [v6.0.16] - 알림 토스트 문구 제거/가로폭 보정

### Fixed
- 알림 토스트에 `오늘의 목표` 문구가 계속 보이던 문제를 수정했습니다.
- 기존 CSS의 `#system-message::before` 장식이 남아 알림 본문 앞에 목표 문구를 강제로 붙이던 문제를 제거했습니다.

### Changed
- 알림 토스트 가로폭을 조금 넓혀 안내 문장이 더 자연스럽게 보이도록 조정했습니다.
- `showMessage()`의 목표 문구 제거 정규식을 더 강하게 보정했습니다.


## [v6.0.15] - 알림 토스트 문구/위치 보정

### Fixed
- 알림 토스트 본문에 `오늘의 목표` 문구가 불필요하게 붙어 보이던 문제를 수정했습니다.
- `showMessage()`에서 메시지 안의 `오늘의 목표`/`목표` 접두어를 더 강하게 제거하도록 보정했습니다.

### Changed
- 알림 토스트를 하단 중앙에서 상단 상태바 아래쪽으로 이동했습니다.
- 알림 토스트를 더 작고 얇은 형태로 조정해 플레이 공간을 덜 가리도록 했습니다.


## [v6.0.14] - 목표 패널 복구/우측 HUD 고정/초기 카메라 보정

### Fixed
- 목표 패널이 왼쪽 Day 카드 아래에 보이지 않던 문제를 수정했습니다.
- 작은 화면에서 트로피/우편/설정 아이콘 세트가 위로 붙지 않아 `전체보기` 버튼과 겹치던 문제를 수정했습니다.
- 전체 창 최초 진입 시 전체보기 상태로 시작하던 문제를 보정해 1번 기본 매장 확대 상태로 시작하도록 했습니다.

### Changed
- 트로피/우편/설정 메뉴를 `#game-root` 직속 우측 상단 고정 UI로 이동했습니다.
- 상단 재화/만족도/멘탈/재고 상태바 폭을 더 줄여 우측 HUD 공간을 확보했습니다.
- 목표 패널은 `영업 준비` 버튼 아래에 붙는 작은 고정 패널로 표시됩니다.


## [v6.0.13] - 목표 패널/일시 알림 분리

### Added
- 좌측 상단 `영업 준비` 아래에 고정형 오늘의 목표 패널을 추가했습니다.
- 목표 패널에 현재 매출/목표 매출, 진행 바, 현재 만족도/목표 만족도를 표시합니다.

### Changed
- 기존 목표 메시지 영역은 목표 표시가 아니라 일시 알림 토스트로 역할을 변경했습니다.
- `showMessage()`는 알림을 잠깐 보여준 뒤 자동으로 사라지도록 변경했습니다.
- 목표 안내와 시스템 알림을 분리해 플레이 공간을 덜 가리도록 UX를 개선했습니다.

### Fixed
- 하단 중앙 메시지가 계속 남아 플레이 오브젝트를 가리던 문제를 완화했습니다.


## [v6.0.12] - 상단 HUD/전체보기/목표 메시지 추가 보정

### Fixed
- 작은 화면에서 `전체보기` 버튼이 트로피/우편/설정 아이콘에 가려지던 문제를 추가 보정했습니다.
- 목표 메시지 본문에 `오늘의 목표` 문구가 중복으로 보이던 문제를 수정했습니다.

### Changed
- 재화/만족도/멘탈/재고 상태바의 최대 가로 길이를 줄여 우측 HUD 영역을 확보했습니다.
- 트로피/우편/설정 아이콘을 우측 상단 고정 배치로 정리했습니다.
- `전체보기` 버튼을 우측 아이콘 아래의 작은 보조 버튼으로 재배치했습니다.
- `showMessage()`에서 메시지 앞의 `오늘의 목표` 접두어를 제거하도록 정규화했습니다.


## [v6.0.11] - 전체보기 버튼/목표 메시지 위치 UX 보정

### Fixed
- 작은 화면에서 `전체보기` 버튼이 우측 HUD 아이콘에 가려지던 문제를 수정했습니다.
- 목표 메시지 패널이 플레이 공간 중앙을 어색하게 가리던 문제를 완화했습니다.

### Changed
- `전체보기` 버튼을 우측 HUD 아이콘 아래의 독립 카메라 버튼처럼 보이도록 위치와 크기를 재조정했습니다.
- 목표 메시지 패널을 큰 카드형 안내에서 작은 토스트형 안내로 변경했습니다.
- 작은 화면/낮은 화면에서는 목표 메시지가 더 짧고 낮게 표시되도록 반응형 압축 규칙을 추가했습니다.


## [v6.0.10] - 작은 화면 UX/HUD 최적화

### Fixed
- 작은 화면에서 상단 HUD, 하단 액션 버튼, 메시지 패널이 플레이 영역을 과도하게 가리던 문제를 완화했습니다.
- 모바일 가로/낮은 브라우저 창에서 버튼과 메시지 패널이 너무 크게 보이던 문제를 보정했습니다.

### Changed
- 화면 높이와 폭에 따라 HUD/상태바/상단 아이콘/하단 액션 버튼/영업 시작 버튼/메시지 패널이 단계적으로 작아지도록 반응형 규칙을 추가했습니다.
- 작은 화면에서는 버튼 터치 가능성은 유지하되 플레이 공간을 더 많이 보이도록 UI 밀도를 높였습니다.
- 낮은 화면에서는 메시지 패널을 더 작게 압축하고 긴 문장은 2줄까지만 보이게 조정했습니다.


## [v6.0.9] - 구역 클릭 자동 확대 줌 보정

### Fixed
- 큰 화면/작은 화면 모두에서 마우스 휠로 줌아웃한 뒤 구역을 클릭해도 해당 구역이 충분히 크게 보이지 않던 문제를 수정했습니다.
- 기존 고정 포커스 줌값이 화면 크기에 비해 낮아 클릭해도 확대 체감이 약했던 문제를 보정했습니다.

### Changed
- 구역 클릭 시 현재 화면 크기와 구역 크기를 기준으로 자동 포커스 줌을 계산하도록 변경했습니다.
- 월드 카메라 최대 줌을 `1.45`에서 `2.2`로 상향했습니다.
- 1/2/3/4번 구역 클릭 포커스는 고정 줌이 아니라 `화면에 해당 구역이 크게 들어오는 줌`을 사용합니다.


## [v6.0.8] - 줌아웃 상태 구역 클릭 판정 보강

### Fixed
- 작은 화면에서 마우스 휠로 줌아웃한 뒤 구역 클릭 확대가 동작하지 않던 문제를 수정했습니다.
- DOM 타일 클릭이 잡히지 않는 경우에도 viewport 클릭 좌표를 월드 좌표로 변환해 구역을 판정하는 fallback을 추가했습니다.
- UI 영역, 팝오버, 하단/상단 HUD 클릭은 구역 클릭 판정에서 제외했습니다.

### Changed
- 구역 확대 포커스 판정을 `타일 DOM 클릭` + `월드 좌표 hit-test` 이중 구조로 보강했습니다.


## [v6.0.7] - 전체보기 상태 공간 클릭 확대 복구

### Fixed
- 전체보기/최대 줌아웃 상태에서 각 매장 공간을 클릭해도 해당 구역으로 확대되지 않던 문제를 수정했습니다.
- 공간 타일 전체를 다시 클릭 가능하게 하되, 드래그 이동은 viewport pan으로 전달되도록 이벤트 흐름을 재조정했습니다.

### Changed
- 공간 바닥/이미지 클릭: 해당 구역으로 확대 포커스
- 공간 바닥/이미지 드래그: 월드맵 pan 이동
- 구역명 라벨 클릭: 확장 조건 팝오버 표시


## [v6.0.6] - 월드맵 드래그/라벨 팝오버 조작 개선

### Fixed
- 공간 이미지 위에서 드래그가 되지 않던 문제를 수정했습니다.
- 확대된 상태에서 1번 매장 주변만 보이고 다른 구역으로 pan 이동하기 어려웠던 문제를 수정했습니다.
- 작은 브라우저 창에서 16:9 게임판이 세로 중앙에 떠 보여 위쪽 여백이 과도하게 생기던 문제를 완화했습니다.

### Changed
- 확장 조건 팝오버는 공간 전체 클릭이 아니라 `Lv.2/Lv.3/Lv.4` 구역명 라벨을 눌렀을 때 열리도록 조작 방식을 분리했습니다.
- 매장 공간 바닥/이미지/구름/잠금 아이콘은 카메라 드래그 대상으로 사용하고, 라벨만 팝오버 트리거로 사용합니다.


## [v6.0.5] - 확장 공간 클릭 팝오버 이벤트 수정

### Fixed
- 확장 공간을 클릭해도 확장 조건 팝오버가 열리지 않던 문제를 수정했습니다.
- 월드맵 pan 처리를 위한 pointer capture가 공간 클릭 이벤트를 가로채지 않도록 `.store-space-tile`을 카메라 드래그 제외 대상으로 추가했습니다.
- 확장 공간 타일의 pointerdown/click 이벤트가 viewport 드래그 이벤트로 전파되지 않도록 차단했습니다.

### Changed
- 2~4번 공간 클릭 시 카메라 이동과 확장 조건 팝오버 표시가 안정적으로 동작하도록 이벤트 흐름을 분리했습니다.


## [v6.0.4] - 확장 조건 팝오버 위치 보정

### Fixed
- 확장 조건 팝오버가 좌측 HUD/영업 준비 버튼 옆에 고정되어 보이던 문제를 수정했습니다.
- 2~4번 공간을 클릭하면 해당 공간 중심 근처에 팝오버가 뜨도록 위치 계산을 변경했습니다.
- 모바일/낮은 가로 화면에서 팝오버가 상단 HUD와 하단 액션 UI를 최대한 피하도록 안전 여백을 적용했습니다.

### Changed
- 공간 클릭 포커스가 기본 조작이므로 1~4번 카메라 버튼은 숨기고, `전체보기` 버튼만 우측 보조 버튼으로 이동했습니다.


## [v6.0.3] - 월드맵 최소 줌/가장자리 노출 방지

### Fixed
- 마우스 휠/모바일 핀치로 월드맵을 과하게 축소했을 때 맵의 끝과 바깥 어두운 배경이 게임 화면 안에 보이던 문제를 수정했습니다.
- 카메라 최소 줌을 고정값이 아니라 현재 `store-area` 크기와 `store-world-map` 크기로 계산하는 동적 cover zoom으로 변경했습니다.
- `전체보기` 버튼도 맵 전체를 작게 보여주는 방식이 아니라, 게임판을 배경 맵으로 꽉 채운 상태에서 4개 매장 구성이 보이도록 보정했습니다.
- 브라우저 크기 변경/모바일 방향 전환 후에도 현재 줌이 최소 cover zoom 아래로 내려가지 않도록 clamp 로직을 보강했습니다.

### Changed
- `worldCamera.minZoom`은 기본 안전값으로만 유지하고, 실제 최소 줌은 `getWorldCoverZoom()` 기준으로 적용합니다.


## [v6.0.2] - 16:9 모바일 안전 프레임 보정

### Fixed
- 게임 루트를 모바일/PC 모두에서 16:9 비율로 고정하도록 수정했습니다.
- `map2` 월드맵이 게임 화면 일부만 차지하지 않고 게임판 전체를 덮도록 `#game-screen`, `#store-composition`, `#store-area` 레이아웃을 보정했습니다.
- 모바일 가로 화면에서 상단 HUD, 하단 액션 버튼, 메시지 패널이 잘리지 않도록 낮은 화면 높이용 압축 규칙을 추가했습니다.
- 브라우저/디바이스 크기 변경 시 카메라 포커스가 깨지지 않도록 월드 카메라 resize 보정을 추가했습니다.

### Changed
- 월드 카메라 뷰포트를 기존 카드형 영역이 아니라 16:9 게임판 전체 배경/플레이 영역으로 사용하도록 조정했습니다.

# CHANGELOG

## [v6.0.1] 월드맵 카메라 시각 오류 긴급 수정

### Fixed
- 빈 공간/구름/자물쇠 에셋에 포함되어 있던 흰색·회색 체크 배경을 투명 처리했습니다.
- `map2` 원본 비율에 맞춰 월드맵 크기를 `1672x941`로 재조정했습니다.
- 1번 왼쪽 아래 / 2번 왼쪽 위 / 3번 오른쪽 아래 / 4번 오른쪽 위 배치를 베이지 부지 안에 맞게 축소 재배치했습니다.
- 전체보기 카메라가 화면 아래에 큰 빈 녹색 영역을 남기지 않도록 뷰포트 기준 동적 줌으로 보정했습니다.
- 1번 매장의 플레이어, 입구, 진열대, 계산대, 고객 위치를 새 월드 좌표에 맞게 재배치했습니다.

### Changed
- 2~4번 임시 기능 박스 위치를 새 2x2 배치에 맞게 조정했습니다.
- 잠금 공간의 cloud/lock 크기를 줄여 공간 내부를 넘치지 않게 조정했습니다.

---

## [v6.0-world-camera] 4공간 월드맵 카메라 구현

### Added
- `assets/images/world/` 아래에 `map2`, bright/dark empty space, cloud, lock 아이콘 에셋을 추가했습니다.
- 1번 왼쪽 아래 / 2번 왼쪽 위 / 3번 오른쪽 아래 / 4번 오른쪽 위의 2x2 월드맵 배치를 추가했습니다.
- 자유 pan, 마우스 휠 줌, 모바일 두 손가락 핀치 줌, 공간 클릭 포커스 카메라를 추가했습니다.
- 2~4번 공간 해금 후 연결할 임시 오브젝트 핫스팟을 미리 생성했습니다.

### Changed
- 1번 매장을 `first_empty_space` 기반으로 전환하고 기존 진열대/계산대/입구/플레이어 기능은 월드맵 좌표의 placeholder hotspot으로 유지했습니다.
- 잠긴 확장 공간은 `dark_empty_space + cloud_icon2 + lock_icon` 조합으로 표시되도록 변경했습니다.
- 확장 완료 시 해당 공간이 bright 에셋으로 전환되고 cloud/lock 표시가 제거되도록 변경했습니다.
- 플레이어 이동 기준을 월드맵 크기로 전환하고, 1차에서는 기본 매장 이동 범위만 활성화되도록 조정했습니다.

### Fixed
- 카메라 줌/팬 상태에서도 계산대와 진열대 거리 판정이 깨지지 않도록 상호작용 좌표 계산을 월드 좌표 기준으로 수정했습니다.

### Notes
- 수정 파일: `data/ExpansionData.js`, `systems/PlayerMovementSystem.js`, `systems/PlayerActionSystem.js`, `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 공통 파일 직접 수정 없음
- 2~4번 공간 내부 오브젝트의 실제 기능 연결은 에셋 확정 후 placeholder 위치에 교체하는 방식으로 이어가면 됩니다.

---

## [v6.2] Layered Map Unlock Integration

### Added
- `store_map_base`를 CSS 배경이 아니라 `#store-map-art-layer`의 실제 이미지 레이어로 올렸습니다.
- `ExpansionData.js`의 `scene.clipPath`를 이용해 확장 구역마다 맵 위에 폴리곤 잠금 마스크를 적용했습니다.
- 해금 완료 시 잠금 마스크와 조건 카드가 사라지고 원본 맵 공간이 드러나는 해제 연출을 추가했습니다.
- `assets/images/map/README.md`에 clean map / future layer asset 제작 규칙을 정리했습니다.

### Changed
- 확장 구역 좌표를 새 맵 이미지의 실제 방 위치에 더 맞도록 재조정했습니다.
- 잠긴 구역의 어두운 표현을 단순 사각 카드가 아니라 맵 구역 위에 얹히는 조명 꺼짐 마스크 방식으로 변경했습니다.
- 시스템 알바 캐릭터가 있을 경우 배경에 붙은 그림처럼 보이지 않도록 맵 좌표 기준 위치를 분리했습니다.

### Notes
- 단일 통짜 base 이미지 안에 이미 그려진 캐릭터/소품은 코드만으로 완전 삭제할 수 없습니다.
- 실제 인테리어가 해금 전/후로 달라져야 하면 구역별 locked/unlocked overlay 이미지가 추가로 필요합니다.

---

## [v6.1] Asset Map Quarter-view Integration

### Added
- 새 맵 이미지 `assets/images/map/store_map_base.webp`를 실제 플레이 배경으로 사용하는 쿼터뷰 맵 레이어를 추가했습니다.
- 상단 HUD에 `재고 현재/최대` 표시를 추가해 참고 이미지처럼 돈/만족도/멘탈/재고가 한 바에 보이도록 했습니다.
- 맵 이미지 위에 `진열대`, `계산대`, `입구` 상호작용 핀과 기본 매장 라벨을 오버레이했습니다.

### Changed
- 기존 CSS 오브젝트 기반 매장/확장방 표현을 숨기고, 실제 맵 이미지 위에 잠금 오버레이와 해금 조건 카드만 표시하도록 재구성했습니다.
- 확장 구역 좌표를 새 맵 이미지 기준으로 재배치했습니다.
- 플레이어 기본 위치와 이동 기준 크기를 새 쿼터뷰 맵에 맞게 조정했습니다.

### Fixed
- 평면형 박스 UI처럼 보이던 확장 구역을 이미지 맵과 자연스럽게 겹치는 잠긴 구역 표현으로 수정했습니다.

프로젝트 버전 기록

---

## [v6.0] 쿼터뷰 매장 구조 전면 재구성
### Added
- 참고 이미지 방향에 맞춘 전체 화면형 쿼터뷰 매장 씬 레이어 추가
- 기본 매장 방, 바닥, 벽, 진열대, 계산대, 냉장고, 입구 오브젝트형 CSS 구조 추가
- 상단 HUD를 Day 카드, 자원 바, 아이콘 메뉴 형태로 재배치
- 하단 액션 독을 정산/발주/업그레이드/상점 + 대형 영업 시작 버튼 구조로 재배치
- 확장 구역에 인맵 조건 카드와 잠금/해금 상태 표시 추가

### Changed
- index.html 하단/상단 UI 구조를 쿼터뷰 타이쿤 레이아웃에 맞게 변경
- UIManager.js에서 quarter-view scene DOM을 자동 생성하도록 변경
- 확장 구역 레이어가 별도 카드가 아니라 매장 화면 내부의 방처럼 보이도록 변경
- ExpansionData.js의 확장 구역 좌표와 이동 가능 영역을 우측/하단 확장맵 기준으로 재배치
- style.css에 v6.0 최종 오버라이드 레이어를 추가해 기존 평면형 화면을 전체 화면 맵 중심 구조로 대체

### Notes
- 수정 파일: index.html, ui/UIManager.js, data/ExpansionData.js, style.css, CHANGELOG.md
- 공통 파일 수정 허용 요청에 따라 index.html도 수정함
- 발주/영업 시작/정산 기존 버튼 id는 유지해서 기존 시스템 이벤트 연결은 유지함
- 업그레이드/상점 하단 버튼은 현재 비활성 플레이스홀더로 배치함

---

## [v5.2-hotfix-2] 확장 맵 잠긴 구역 시각 재조정
### Changed
- 잠긴 확장 구역이 검은 박스/오브젝트처럼 보이던 문제를 개선
- 잠긴 구역을 실제 매장 일부처럼 보이도록 반투명 조명 오버레이 방식으로 재조정
- 바닥 타일과 벽 형태가 잠긴 구역 안에서도 희미하게 보이도록 수정
- 구역 라벨을 단순화하고 중앙 배지 형태로 정리해 가독성 개선
- 확장 구역의 과한 그림자와 검은 배경감을 줄이고 메인 매장과 자연스럽게 연결되도록 개선
- 플레이어, 진열대, 계산대, 입구가 확장 구역보다 위에 보이도록 z-index 정리

### Notes
- 수정 파일: data/ExpansionData.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 확장 조건/비용/Day 조건 유지
- 플레이어/손님 이동 가능 영역 로직은 변경하지 않음

---

## [v5.2-hotfix] 2.5D 확장 맵 UI 재작업
### Changed
- 검은 카드처럼 보이던 확장 구역 UI를 방/구역형 맵 UI로 재작업
- 확장 구역 레이어를 매장 화면 내부로 옮겨 플레이어/진열대/계산대와 같은 장면 안에 보이도록 조정
- 잠긴 구역이 실제 매장 일부처럼 보이도록 바닥 패턴과 벽 형태 위에 어두운 오버레이 적용
- 열린 구역과 잠긴 구역의 밝기 대비 개선
- 잠긴 구역 클릭 시 기존 확장 조건 팝오버와 닫기 버튼 유지

### Notes
- 수정 파일: data/ExpansionData.js, ui/UIManager.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 기존 확장 조건/비용/Day 조건 유지
- 플레이어/손님 이동 가능 영역 로직은 변경하지 않음

---


## [v5.4] 확장 구역 이동 가능 연동
### Added
- 플레이어가 잠긴 구역에 진입할 수 없도록 이동 제한 추가
- 손님이 잠긴 구역에 진입할 수 없도록 행동 영역 제한 추가
- 확장 완료 후 새 구역이 이동 가능 영역으로 활성화되도록 추가

### Notes
- 수정 파일: systems/PlayerMovementSystem.js, systems/CustomerSystem.js, systems/ExpansionSystem.js, core/GameState.js
- 날짜 처리는 GameState.day 기준 유지

---

## [v5.3] 확장 오픈 연출 추가
### Added
- 확장 성공 시 먼지/연기 팡 애니메이션 연출 추가
- 확장 완료 시 어두운 구역이 밝아지는 전환 효과 추가

### Notes
- 수정 파일: systems/ExpansionSystem.js, ui/UIManager.js, style.css
- 확장 로직 자체보다 시각 연출 강화 중심

---

## [v5.2] 2.5D 장면형 확장 맵 UI 1차 전환
### Changed
- 기존 세로 확장 카드 중심 UI를 2.5D 장면형 구역 맵 기반 UI로 전환
- 열려 있는 구역은 밝게, 잠긴 구역은 어둡게 보이도록 시각 상태 개선
- 잠긴 구역 클릭 시 기존 확장 조건 팝오버가 맵 상에서 표시되도록 개선

### Notes
- 수정 파일: data/ExpansionData.js, systems/ExpansionSystem.js, ui/UIManager.js, style.css
- 공통 파일 수정 있음: core/GameState.js
- 기존 확장 조건 데이터와 팝오버 내용은 유지

---

## [v5.1] 알바 캐릭터 매장 표시 / 근무 상태 UI 개선
### Added
- 고용한 알바가 매장 화면 안에 캐릭터로 표시되도록 추가
- 알바 이름 및 근무 상태 라벨 표시 추가
- 알바 자동 계산 횟수 상태 표시 추가

### Changed
- 알바 고용 상태를 텍스트 정보뿐 아니라 매장 내 시각 요소로도 확인할 수 있도록 개선
- 모바일 화면에서 알바 캐릭터가 자연스럽게 보이도록 스타일 조정

### Notes
- 수정 파일: ui/UIManager.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 알바 계산 로직 및 매출 정산 로직 수정 없음

---

## [v5.0] 알바 자동 계산 보조 / 인건비 정산 연동
### Added
- 고용한 알바가 영업 중 자동으로 계산을 보조하는 기능 추가
- 알바 타입별 자동 계산 간격 차이 추가
- 알바의 일일 계산 횟수 기록 추가
- 하루 정산에서 알바 인건비 차감 추가
- 정산 화면에 알바 계산 건수와 인건비 표시 추가
- 현재 고용 알바 UI에 자동 계산 보조 상태 표시 추가

### Changed
- 알바 고용이 단순 표시 상태에서 실제 게임 플레이에 영향을 주도록 개선
- 하루 종료 시 알바 고용 여부와 일급을 함께 반영하도록 정산 흐름 개선

### Notes
- 날짜 처리는 GameState.day 기준
- 공통 파일 수정 없음
- Date 객체 및 Date.now() 사용 없음
- 매출 직접 중복 누적 없이 기존 계산 이벤트 흐름 재사용

---

## [v4.9] 알바 고용 팝업 / 기본 고용 시스템 추가
### Added
- Day 3부터 알바 고용 팝업이 노출되도록 추가
- 알바 후보 3명 카드 UI 추가
- 각 후보의 시급, 예상 일급, 근태, 능력치 표시 추가
- 알바 고용하기 및 오늘은 넘기기 기능 추가
- 선택한 알바 정보를 GameState에 저장하는 기본 상태 추가
- 현재 고용 중인 알바 정보를 화면에 표시

### Notes
- 수정 파일: systems/GameFlowSystem.js, ui/UIManager.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 날짜 처리는 GameState.day 기준
- 인건비 차감 및 능력치 효과 연동은 다음 버전에서 진행 예정

---

## [v4.6] 정산 화면 / 업그레이드 화면 UI 개선
### Changed
- 정산 화면을 귀여운 타이쿤 스타일의 영업 결과 카드 UI로 개선
- 매출, 만족도, 멘탈 등 주요 결과 항목의 카드형 표시 강화
- 업그레이드 선택 화면을 스티커/쿠폰 카드 느낌으로 개선
- 선택 가능/불가능 업그레이드 상태를 시각적으로 구분
- 모바일 화면에서 정산 및 업그레이드 카드가 자연스럽게 정렬되도록 반응형 개선

### Notes
- 수정 파일: style.css
- 공통 파일 수정 없음
- 정산 로직 및 업그레이드 적용 로직 수정 없음

## [v4.7] 손님 이벤트 모달 / 선택지 UI 개선
### Changed
- 손님 이벤트 모달을 귀여운 상황 카드/말풍선 스타일로 개선
- 이벤트 제목, 설명, 결과 메시지의 시각적 구분 강화
- 이벤트 선택지 버튼의 모바일 터치 영역과 간격 개선
- 위험/부정 선택지를 코랄 계열로 부드럽게 구분

### Notes
- 수정 파일: style.css
- 공통 파일 수정 없음
- 이벤트 발생 로직 및 선택지 처리 로직 수정 없음

## [v4.8] 모바일 하단 버튼 / 터치 UX 최적화
### Changed
- 하단 주요 버튼 영역의 모바일 터치 UX 개선
- Day 시작, 영업 시작, 하루 종료 버튼의 크기와 간격 조정
- 버튼 활성/비활성 상태의 시각적 구분 강화
- 작은 화면에서 모달, 카드, 버튼이 안정적으로 표시되도록 반응형 보완

### Notes
- 수정 파일: style.css
- 공통 파일 수정 없음
- 게임 진행 로직 수정 없음

---

## [v4.5] 상품 카드 텍스트 정렬 개선
### Changed
- 발주 상품 카드의 상품명이 화면 크기에 맞게 자연스럽게 표시되도록 개선
- 긴 상품명은 말줄임 처리하지 않고 최대 2줄까지 깔끔하게 줄바꿈되도록 조정
- 줄바꿈 발생 시에도 상품 이미지, 재고 정보, 발주/해금 배지 정렬이 깨지지 않도록 개선
- PC/태블릿/모바일 반응형 카드 구조 유지

### Notes
- 수정 파일: style.css
- 공통 파일 수정 없음
- 발주 로직 및 상품 데이터 수정 없음

---

## v4.3

### Changed
- PC 화면에서 발주 상품 카드가 3열로 표시되도록 개선
- 태블릿 화면에서는 2열, 모바일 화면에서는 1열로 표시되도록 반응형 조정
- 수량 조절 버튼의 모바일 터치 영역 유지
- 오늘 추천 배지가 카드 내부에서 안정적으로 표시되도록 조정

### Notes
- 수정 파일: style.css
- 공통 파일 수정 없음
- 발주 로직 및 상품 데이터 수정 없음

---

## v1.0

- 프로젝트 폴더 구조 생성
- GitHub 저장소 생성
- README 작성

---

## v1.1

- Constants.js 작성
- EventBus.js 작성
- GameState.js 작성

---

## v1.2

- UI 기본 화면 구축
- UIManager 작성
- index.html 구성
- style.css 작성

---

## v1.3

- GameFlowSystem 구축
- Day 시작
- 영업 시작
- 하루 종료 흐름 구현

---

## v1.4

- ResultSystem 구축
- 하루 정산
- 만족도
- 멘탈 계산

---

## v1.5

- UpgradeSystem 구축
- 업그레이드 단계
- 자동 업그레이드 적용

---

## v1.6

- Next Day 반복 시스템 구축
- 업그레이드 완료 후 다음 Day로 자동 이동
- Day 증가 처리 추가
- todayStats 초기화 처리 추가
- 목표 매출 증가 로직 추가
- 난이도 증가 로직 추가
- Day 6부터 무한모드 진입 구조 추가

---

## v1.7

- Day별 목표 매출 및 만족도 목표 구조 추가
- Day 1~5 스토리 모드용 임시 밸런스 테이블 추가
- Day 6 이후 무한모드용 자동 난이도 계산 구조 추가
- `GameState.difficulty` 값이 Day에 따라 갱신되도록 개선
- `DAY_STARTED`, `ORDER_PHASE_STARTED`, `STORE_OPENED` 이벤트 payload에 목표/난이도 데이터 전달 구조 유지
- 실제 날짜(Date)가 아닌 `GameState.day` 기준으로 밸런스 계산

---

## v1.8

- Day 5 이후 스토리 모드 클리어 및 무한모드 진입 흐름 추가
- Day 6부터 무한모드 상태가 명확하게 표시되도록 개선
- 잘못된 버튼 순서 입력 방지 로직 추가
- Day 시작 전 영업 시작 방지
- 영업 시작 전 하루 종료 방지
- 영업 중 Day 시작 중복 실행 방지
- 기존 `GameState.day` 기준 Day 진행 규칙 유지

---

## v1.9

- 팀원 시스템 연결을 위한 EventBus 수신 구조 추가
- PlayerActionSystem 이벤트를 ResultSystem에서 정산 데이터로 반영
- CustomerSystem 이벤트를 ResultSystem에서 손님 통계로 반영
- Economy / Inventory / RandomEvent 이벤트를 ResultSystem에서 비용 및 손익 데이터로 반영
- `CHECKOUT_COMPLETED`, `CUSTOMER_ENTERED`, `CUSTOMER_SATISFIED`, `CUSTOMER_ANGRY`, `CUSTOMER_LEFT` 이벤트 수신 처리 추가
- `REVENUE_CHANGED`, `COST_CHANGED`, `EXPIRED_LOSS_RECORDED`, `EVENT_PENALTY_RECORDED`, `BM_BONUS_APPLIED` 이벤트 수신 처리 추가
- 각 담당 시스템이 `GameState.todayStats`를 직접 수정하지 않고 EventBus로 정산 데이터에 반영될 수 있도록 구조 개선
- 기존 EventBus 기반 연결 규칙 유지

---

## v2.0

- MVP 기본 게임 루프 완성
- Day 시작 → 영업 시작 → 하루 종료 → 정산 → 업그레이드 → 다음 Day 흐름 연결
- 목표 매출 및 목표 만족도 기준 성공/실패 판정 구조 추가
- 멘탈 0 이하 여부를 결과 판정에 반영
- 정산 결과 메시지 개선
- 업그레이드 단계 메시지 개선
- 성공/실패 결과에 따라 자동 업그레이드 선택 기준 추가
- 정산 메시지가 업그레이드 메시지로 즉시 덮이지 않도록 지연 처리 추가
- 업그레이드 적용 후 다음 Day로 넘어가는 흐름 개선
- NPC / Inventory / Economy 시스템 연결 전 테스트 가능한 임시 MVP 데이터 구조 추가
- 추후 팀원 시스템 연결 시 임시 MVP 데이터 제거 가능하도록 주석 처리
- 기존 EventBus 기반 연결 규칙 유지
- 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 유지

---

## v2.1

- 정산 결과 확인 모달 구조 추가
- 정산 결과가 자동으로 사라지지 않고 확인 버튼 클릭 후 다음 단계로 진행되도록 개선
- `RESULT_CALCULATED` 이후 업그레이드 단계 자동 진입 흐름을 확인 버튼 기반으로 변경
- 모바일 터치 환경에서도 확인 버튼을 누르기 쉽도록 모달 UI 추가
- `UIManager.showResultModal()` 및 `UIManager.hideResultModal()` 추가
- `UpgradeSystem`의 정산 이후 진행 흐름을 모달 확인 방식으로 변경
- 기존 EventBus 기반 흐름 유지

---

## v2.2 / v2.2.1

* 3번 담당 손님 NPC 작업물을 현재 프로젝트 구조에 맞게 병합용으로 변환
* `data/CustomerData.js` 추가
* `systems/CustomerSystem.js` 추가 및 EventBus 기반 구조로 변환
* `main.js`에 `CustomerSystem.init()` 연결
* 손님 타입 5종 추가

  * 일반 손님
  * 학생
  * 회사원
  * 급한 손님
  * 진상 손님
* 손님별 구매 희망 상품 데이터 추가

  * `wantedProductId`
  * `wantedProductName`
* 손님 상태 관리값 추가

  * `status`
  * `currentZone`
  * `targetZone`
  * `waitTime`
  * `mood`
* 영업 시작 시 손님 자동 생성 기능 추가
* 손님 생성 시 `CUSTOMER_ENTERED` 이벤트가 발생하도록 연결
* 계산 완료 시 대기 손님을 만족 처리하고 `CUSTOMER_SATISFIED` 이벤트가 발생하도록 연결
* 대기시간 초과 시 `CUSTOMER_ANGRY`, `CUSTOMER_LEFT` 이벤트가 발생할 수 있도록 구조 추가
* 계산 대상 손님 조회 로직 보완

  * `waiting` 상태 손님 우선 조회
  * 대기 손님이 없을 경우 계산대 근처 손님, 쇼핑 중 손님, 입장 중 손님 순서로 조회
* 테스트 타이밍에 따라 `CHECKOUT_COMPLETED` 이벤트가 먼저 발생해도 손님 만족 처리가 가능하도록 개선
* 랜덤 이벤트 후보 손님 조회 함수 추가
* 손님 타입별 이벤트 후보 판정 구조 추가
* `Date.now()` 사용 제거
* 손님 ID를 `GameState.day`와 내부 counter 기준으로 생성하도록 변경
* `GameState.todayStats`를 직접 수정하지 않고 ResultSystem과 EventBus로 연결되도록 개선
* 3번 담당 작업물의 기존 손님 NPC 로직은 유지하고, 현재 프로젝트 구조에 맞게 병합 안정화
* 기존 EventBus 기반 연결 규칙 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.3

* 4번 담당 상품 / 재고 / 유통기한 작업물을 현재 프로젝트 구조에 맞게 병합
* `data/ProductData.js` 추가
* `systems/InventorySystem.js` 추가
* `systems/ExpirationSystem.js` 추가
* `main.js`에 `ExpirationSystem.init()`, `InventorySystem.init()` 연결
* 상품 데이터 16종 추가
* 바나나우유 상품 데이터 추가

  * 매입가 1,000원
  * 판매가 1,800원
  * Day 2 해금
* 상품별 매입가, 판매가, 유통기한, 해금 Day, 초기 재고 데이터 추가
* 손님 요청 상품 ID와 실제 상품 ID 연결 구조 추가

  * 예: `lunch_box` 요청을 도시락 상품군과 연결
* 재고 입고 기능 추가
* 상품 판매 시 재고 차감 구조 추가
* 유통기한이 빠른 재고부터 차감하는 선입선출 구조 추가
* Day 기준 유통기한 검사 구조 추가
* 유통기한 만료 상품 폐기 및 폐기 손실 계산 구조 추가
* 폐기 손실 발생 시 `EXPIRED_LOSS_RECORDED` 이벤트가 발생하도록 연결
* 재고 변경 시 `INVENTORY_CHANGED` 이벤트가 발생하도록 연결
* `CUSTOMER_SATISFIED` 이벤트를 받아 손님이 원하는 상품 기준으로 재고 차감이 가능하도록 연결
* 실제 날짜(Date)가 아닌 `GameState.day` 기준으로 유통기한을 처리하도록 유지
* 현재 구조상 계산 전 품절 여부 차단은 아직 미구현이며, 추후 `PlayerActionSystem`에서 계산 전 재고 검증 규칙 연결 필요

---

## v2.4

* 업그레이드 자동 적용 구조를 플레이어 선택 구조로 변경
* 정산 결과 확인 후 업그레이드 선택 모달이 표시되도록 개선
* 업그레이드 카드 UI 추가
* 플레이어가 업그레이드 1개를 직접 선택하면 효과가 적용되도록 변경
* 업그레이드 선택 후 다음 Day로 이동하는 흐름 유지
* `UIManager.showUpgradeModal()` 및 `UIManager.hideUpgradeModal()` 추가
* `UpgradeSystem`에서 자동 업그레이드 선택 타이머 제거
* 정산 → 확인 → 업그레이드 선택 → 다음 Day로 이어지는 성장 루프 개선
* 기존 EventBus 기반 Day 진행 / 정산 / 업그레이드 흐름 유지

---

## v2.5

* 4번 담당 상품 카드 UI 및 이미지 연결 작업물을 현재 프로젝트 구조에 맞게 부분 병합
* 상품 이미지 16종 추가

  * 바나나우유
  * 치즈 김치볶음밥
  * 초코바
  * 커피
  * 콜라
  * 달걀샌드
  * 오렌지주스
  * 왕돈가스 도시락
  * 감자칩
  * 컵라면
  * 소시지 핫바
  * 제육도시락
  * 새우스낵
  * 삼각김밥
  * 우동
  * 생수
* `data/ProductData.js`에 상품별 `imagePath` 추가
* `ui/UIManager.js`에 상품 카드 패널 생성 및 렌더링 코드 추가
* `INVENTORY_CHANGED` 이벤트 수신 시 상품 카드 UI가 갱신되도록 연결
* 모바일 화면 기준 2열 상품 카드 UI 추가
* 상품 카드에 상품 이미지, 가격, 재고, 다음 폐기 Day 표시 추가
* 잠금 상품에 해금 Day 표시 추가
* 바나나우유 이미지 연결 반영
* 상품 이미지 매칭 및 이벤트 기반 렌더링 테스트 완료
* 계산 테스트 후 상품 카드 재고 갱신 확인
* 기존 v2.4 업그레이드 선택 UI 유지
* 기존 손님 NPC 표시 UI 유지
* `main.js`, `index.html`, `core` 파일은 수정하지 않음
* 기존 `ExpirationSystem.init()` → `InventorySystem.init()` 초기화 순서 유지
* 기존 EventBus 기반 연결 규칙 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.6

* 발주 버튼 입력 이벤트 구조 추가
* `ORDER_BUTTON_CLICKED` 이벤트 추가
* `ORDER_REQUESTED` 이벤트 추가
* 상품 카드에 발주 버튼 추가
* 발주 버튼 클릭 시 `ORDER_REQUESTED` 이벤트가 발생하도록 연결
* 발주 요청 payload에 `day`, `productId`, `productName`, `quantity` 포함
* 잠금 상품은 발주 버튼이 비활성화되도록 처리
* 실제 발주 처리, 비용 차감, 재고 입고는 추후 `OrderSystem`에서 처리하도록 이벤트 입구만 구성
* 기존 상품 카드 UI, 손님 NPC 표시 UI, 업그레이드 선택 UI 유지
* 기존 EventBus 기반 연결 규칙 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.7

* 매장 구역 확장 시스템 1차 구현
* `data/ExpansionData.js` 추가
* `systems/ExpansionSystem.js` 추가
* 확장 구역 데이터 추가

  * Lv.1 먼지 나는 단칸 편의점
  * Lv.2 추가 진열 구역
  * Lv.3 냉장·도시락 구역
  * Lv.4 프리미엄 매장 구역
* `EXPANSION_REQUESTED`, `EXPANSION_COMPLETED`, `EXPANSION_FAILED` 이벤트 추가
* 미확장 구역을 어두운 오버레이와 구름/먼지 느낌으로 표시
* 확장 가능 조건을 만족하면 확장 버튼이 활성화되도록 처리
* 확장 완료 시 돈을 차감하고 구역 상태를 unlocked로 변경
* 확장 완료 구역은 밝게 표시되도록 개선
* 기존 Day 진행, 정산, 업그레이드 선택, 손님 NPC, 상품 카드, 발주 버튼 흐름 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.8

* 확장 구역 효과를 실제 게임 진행에 반영
* 확장 구역별 `effects` 데이터 추가
* 해금된 확장 구역의 누적 효과 계산 구조 추가
* 확장 완료 시 `EXPANSION_COMPLETED` 이벤트 payload에 누적 효과 포함
* `GameFlowSystem`에서 확장 효과를 Day 목표 및 난이도 계산에 반영
* 확장 효과에 따라 목표 매출 보너스 적용
* 확장 효과에 따라 손님 방문율 보너스 적용
* 확장 패널에 현재 매장 효과 표시 추가
* 기존 Day 진행, 정산, 업그레이드 선택, 손님 NPC, 상품 카드, 발주 버튼 흐름 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v2.9

* 최종 확장 목표 및 엔딩 모달 구조 추가
* `ENDING_ACHIEVED` 이벤트 추가
* `ENDING_MODAL_CLOSED` 이벤트 추가
* 최종 확장 구역 `zone_premium_store`에 엔딩 조건 추가
* 프리미엄 매장 구역 확장 완료 시 “세계 1등 편의점 달성” 엔딩 모달 표시
* Day 6 이후에만 최종 엔딩 이벤트가 발생하도록 방어 조건 추가
* `requiredDay`는 자동 해금이 아니라 확장 가능 조건임을 명시
* 확장 성공 시에만 구역이 unlocked 상태로 변경되는 규칙 점검
* 엔딩 모달에 달성 Day, 최종 구역명, 매장 효과 요약 표시
* 엔딩 확인 후에도 무한모드를 계속 진행할 수 있도록 처리
* 기존 Day 진행, 정산, 업그레이드 선택, 손님 NPC, 상품 카드, 발주 버튼, 확장 패널 흐름 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## v3.0

* Day 1~5 프롤로그/스토리 모드 진행 기준 정리
* Day 1부터 발주, 손님 입장, 계산, 정산까지 전체 운영 루프 진행 유지
* Day별 안내 데이터 `DayScenarioData.js` 추가
* Day 1 기본 영업 안내 추가
* Day 2 상품 증가 및 손님 다양화 안내 추가
* Day 3 재고/폐기 부담 증가 안내 추가
* Day 4 진상 손님 및 랜덤 이벤트 증가 안내 추가
* Day 5 프롤로그 마지막 날 및 무한모드 예고 추가
* Day 6 무한모드 시작 안내 추가
* Day 시작 후 안내 모달, 발주 팝업, 발주 확정, 상품 도착, 재고 정리 완료, 편의점 오픈 순서 추가
* `OrderSystem.js` 추가
* `ORDER_MODAL_OPENED`, `ORDER_CONFIRMED`, `ORDER_DELIVERED`, `STOCK_ORGANIZED` 이벤트 추가
* 발주 확정 시 `GameState.money`만 차감하고 `GameState.todayStats`는 직접 수정하지 않도록 처리
* 발주 입고 시 `RESTOCK_COMPLETED` payload에 `source: "order_delivery"` 포함
* Day별 차이를 시스템 제한이 아닌 손님 비율, 상품 해금, 이벤트 빈도, 난이도 상승으로 표현
* Day 6 이후 Day 1~5에 등장했던 손님/상품/이벤트가 랜덤 조합으로 등장하는 무한모드 기준 정리
* Day 2~5까지 판매 가능 상품이 점진적으로 늘어나도록 상품 해금 Day 조정
* 기존 정산, 업그레이드, 엔딩, 손님 NPC, 상품 카드, 발주 버튼, 확장 패널 흐름 유지
* 실제 날짜(Date)가 아닌 `GameState.day` 기준 진행 규칙 유지

---

## [v5.2-hotfix-3] 확장 구역 위치 재배치
### Changed
- 잠긴 확장 구역 레이어를 `#store-area` 내부가 아니라 `store-composition-layout` 기준으로 배치하도록 조정
- 확장 구역이 플레이 화면 안을 가리지 않도록 상단/우측 바깥 영역으로 이동
- 확장 구역 좌표를 재조정해 기본 매장과 분리된 외곽 공간처럼 보이도록 수정
- 플레이 화면은 그대로 유지하면서 확장 구역 팝오버 동작은 유지

### Notes
- 수정 파일: ui/UIManager.js, data/ExpansionData.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 확장 조건/비용/Day 조건 유지
- 플레이어/손님 이동 가능 영역 로직은 변경하지 않음


## [v5.2-hotfix-4] 확장 구역 외곽 연결감 개선
### Changed
- 확장 구역이 플레이 화면 위에 떠 있는 상자처럼 보이지 않도록 매장 테두리 뒤쪽 레이어로 재배치
- 확장 구역과 기본 매장이 맞닿아 있는 벽/방 구조처럼 보이도록 z-index와 그림자 조정
- 확장 구역마다 기본 매장과 이어지는 작은 통로/문 표시 추가
- 확장 조건 팝오버는 매장 위에 정상 표시되도록 레이어 우선순위 조정

### Notes
- 수정 파일: style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 확장 조건/비용/Day 조건 유지
- 플레이어/손님 이동 가능 영역 로직은 변경하지 않음


## [v5.2-hotfix-5] 전체 매장 4분할 확장 구조 재정의
### Changed
- `#store-area`를 현재 플레이 공간이 아닌 전체 매장 확장 면적으로 재정의
- 기본 매장은 전체 매장의 좌상단 1/4만 사용 가능하도록 시각 구조 변경
- 나머지 3개 구역은 같은 매장 내부의 잠긴 방처럼 어둡게 표시되도록 재배치
- 중앙 벽 라인을 추가해 하나의 큰 공간이 4개 구역으로 나뉜 느낌을 강화
- 진열대, 계산대, 입구 등 기본 오브젝트를 사용 가능한 기본 매장 구역 안으로 재배치
- 잠긴 구역 클릭 시 기존 확장 조건 팝오버가 유지되도록 레이어 정리

### Notes
- 수정 파일: ui/UIManager.js, data/ExpansionData.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 확장 조건/비용/Day 조건 유지
- 플레이어 이동 가능 영역은 `GameState.expansion.movementBounds` 기준으로 기본 구역만 허용하도록 조정


## [v5.2-hotfix-6] 플레이 가능 구역 중심형 재배치
### Changed
- 현재 사용 가능한 기본 매장을 좌상단 고정이 아닌 중하단 중심 구역으로 재배치
- 잠긴 3개 구역이 기본 매장을 둘러싸는 느낌이 나도록 장면 좌표를 재조정
- 방 형태를 완전한 네모보다 유기적인 라운드 형태로 보정해 일러스트형 공간감 강화
- 진열대, 계산대, 입구, 플레이어 위치를 현재 사용 가능한 기본 구역 내부로 재배치
- 잠긴 구역과 기본 구역을 잇는 연한 통로/연결부 시각 요소 추가

### Notes
- 수정 파일: data/ExpansionData.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 확장 조건/비용/Day 조건 유지
- 플레이어/손님 이동 가능 영역은 기본 구역 중심 배치에 맞게 movementBounds만 조정


## [v5.2-hotfix-7] 장면형 확장 맵 구조 재설계
### Changed
- 확장 구역이 카드처럼 보이던 구조를 장면형 방/구역 레이어 구조로 재설계
- 현재 사용 가능한 기본 구역을 중하단 조명 영역으로 표현
- 잠긴 3개 구역이 기본 구역을 둘러싸는 어두운 방처럼 보이도록 좌표와 스타일 재조정
- 방마다 살짝 다른 라운드 형태와 벽/바닥 레이어를 적용해 일러스트형 공간감 강화
- 진열대, 계산대, 입구를 현재 사용 가능한 구역 안에 오브젝트처럼 배치
- 기존 확장 조건 팝오버 동작 유지

### Notes
- 수정 파일: data/ExpansionData.js, systems/PlayerMovementSystem.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 확장 조건/비용/Day 조건 유지
- 플레이어 기본 위치와 기본 이동 가능 영역을 중하단 구역 기준으로 조정

## [v5.3] 쿼터뷰 매장 씬 레이아웃 1차 전환
### Changed
- 기존 평면형 매장 화면을 쿼터뷰 스타일의 장면형 매장 UI로 전환
- 기본 매장과 잠긴 확장 구역을 하나의 큰 매장 씬 안에 배치
- 기본 매장 바닥/벽 레이어를 추가해 와라편의점형 공간감을 강화
- 잠긴 구역을 어두운 오버레이와 방 바닥/벽 레이어로 표현
- 진열대, 계산대, 입구, 플레이어 위치를 쿼터뷰 매장 구조에 맞게 재배치
- 기존 확장 조건 팝오버 동작 유지

### Notes
- 수정 파일: ui/UIManager.js, data/ExpansionData.js, systems/PlayerMovementSystem.js, style.css, CHANGELOG.md
- 공통 파일 수정 없음
- 에셋 없이 CSS/DOM 기반 쿼터뷰 프로토타입으로 구현
- 확장 조건/비용/Day 조건 유지

## [v6.1.3] 신규 space 에셋 전면 교체
### Changed
- 기존 `map2` 기반 월드 배경을 사용자가 전달한 `background.png` 기준 배경으로 교체
- 통합 밝은 매장 베이스를 `unified_store_stage1` 기준으로 교체
- `bright_first/second/third/fourth_space`를 매장 구역 레이어로 추가해 4개 공간을 동일 각도의 분리 에셋으로 정렬
- 확장 상태에 따라 `all_dark_empty_space` / `two_dark_empty_space` / `one_dark_empty_space`가 보이도록 매장 상태 오버레이를 교체
- 2/3/4구역 확장 시 3초 동안 `fixing_second/third/fourth_space` 공사 상태 이미지를 보여준 뒤 해금 완료되도록 확장 흐름을 조정
- 신규 매장 기울기와 크기에 맞춰 구역 좌표, 이동 가능 bounds, 플레이어/NPC 기준 위치를 재정렬

### Fixed
- 기존 통합 매장용 dark overlay / cloud / lock이 신규 상태 이미지와 중복되어 보이던 구조 제거
- 월드맵 공용 floor 레이어가 신규 배경/매장 에셋과 겹치던 문제 비활성화

### Notes
- 수정 파일: `ui/UIManager.js`, `systems/ExpansionSystem.js`, `data/ExpansionData.js`, `style.css`, `CHANGELOG.md`
- 추가 에셋: `assets/images/world/map/background.png`, `assets/images/world/unified/unified_store_stage1.png`, `assets/images/world/state/*`, `assets/images/world/fixing/*`
- 공통 파일(`index.html`, `main.js`, `core/*`) 수정 없음

## [v6.1.4] 통합 매장 크기/구역 박스 재정렬
### Changed
- 통합 매장(`unified_store_stage1`) 전체 크기와 위치를 축소해 background 중앙 흙 부지 안쪽에 더 자연스럽게 맞도록 조정
- 4개 확장 구역의 월드 hitbox(`worldX`, `worldY`, `worldWidth`, `worldHeight`)를 새 매장 크기에 맞춰 재설정
- 각 구역의 이동 가능 bounds를 새 레이아웃 기준으로 다시 조정
- 플레이어/입구/진열대/계산대/배송 박스/NPC 기준 좌표를 축소된 매장에 맞게 재배치

### Fixed
- 구역 hover/selected 시 보이던 노란 사각형 테두리 표시 제거
- 매장이 background 대비 과하게 크게 보이던 문제 완화

### Notes
- 수정 파일: `style.css`, `data/ExpansionData.js`, `CHANGELOG.md`
- 기존 팝오버 위치/해금 흐름/공사중 연출 로직은 유지

## [v6.1.5] 매장 전체 축소 및 부지 안쪽 재배치
### Changed
- 통합 매장 레이어 크기를 `1040x585`에서 `900x506`으로 축소하고 위치를 `x=390, y=215`로 이동해 background 중앙 흙 부지 안쪽에 더 들어오도록 조정
- 매장 전체 축소 비율에 맞춰 1~4구역 hitbox와 이동 가능 bounds를 동일 비율로 재계산
- 플레이어/입구/진열대/계산대/NPC 기준 위치를 축소된 매장 좌표에 맞춰 재배치

### Notes
- 이번 수정은 매장 전체 크기/좌표 조정만 적용했으며, 해금 팝오버와 공사중 3초 연출 로직은 건드리지 않음


## [v6.1.6] 구역 클릭 확대 비율/중심 재조정
### Changed
- 1번/2번/4번 매장을 클릭했을 때 카메라가 너무 과하게 확대되던 문제를 줄이기 위해 구역별 focus frame(확대 기준 영역)을 별도로 설정
- 구역 포커스 시 화면 중앙이 아니라 실제 플레이 가시 영역 중심으로 맞추도록 safe area 기반 카메라 중심 계산을 추가
- 좌측 HUD와 우측 상단 버튼에 가려지지 않도록 구역별 포커스 중심을 미세 조정
- 3번 구역도 동일한 규칙으로 보정해 전체 포커스 동작의 일관성을 맞춤

### Notes
- 수정 파일: `ui/UIManager.js`, `data/ExpansionData.js`, `CHANGELOG.md`
- 팝오버/해금 조건/공사중 연출/매장 에셋 교체 로직은 유지


## [v6.1.7] 2구역 카드/팝오버 위치 및 확대 보정
### Changed
- 2구역(`zone_extra_shelf`) 클릭 시 카메라가 너무 멀게 보이던 문제를 완화하기 위해 focus zoom과 focus frame을 소폭 재조정
- 2구역의 구역명 조건 카드가 매장 바깥쪽으로 밀려 보이던 문제를 해결하기 위해 구역별 라벨 좌표(`labelX`, `labelY`)를 추가하고 매장 안쪽 기준으로 재배치
- 확장 팝오버가 타일 정중앙이 아닌 실제 구역 라벨/커스텀 anchor 기준으로 열리도록 보완하여 2구역 팝오버도 매장 안쪽에서 뜨게 수정

### Notes
- 수정 파일: `data/ExpansionData.js`, `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 다른 구역 팝오버/팝업 구조는 유지하고, 2구역 문제 위주로 좌표만 보정

## [v6.1.8] 구역별 카메라 포커스/라벨 앵커 재조정
### Changed
- 1번 매장 클릭 시 기존보다 더 가까운 확대 비율로 보이도록 기본 매장 focus frame을 축소하고 중심점을 오른쪽 안쪽으로 보정
- 2번 매장 클릭 시 너무 멀어 보이던 카메라를 더 가까운 확대 비율로 조정하고, 2구역 라벨/팝오버 앵커를 매장 안쪽 중앙으로 이동
- 3번/4번 매장 클릭 시 각각 구역 안쪽이 중심에 오도록 focus frame과 중심점을 재조정
- 구역 라벨을 눌러 팝오버를 열 때도 해당 구역 중심으로 카메라가 먼저 이동한 뒤 팝오버가 뜨도록 수정
- 상단 확장 구역 팝오버는 라벨 아래쪽에 뜨도록 위치 계산을 보정해 HUD 바깥쪽으로 밀리는 현상을 줄임

### Notes
- 수정 파일: `data/ExpansionData.js`, `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 해금 조건/공사중 3초 연출/상태 이미지 교체 로직은 유지

## [v6.1.9] 2구역 팝오버/조건 카드 우측 이동
### Changed
- 2구역(`zone_extra_shelf`) 구역명 조건 카드를 매장 안쪽 오른쪽으로 이동
- 2구역 확장 조건 팝오버도 라벨 기준보다 더 오른쪽에서 열리도록 `popoverOffsetX`를 추가 적용
- 구역별 팝오버 위치를 개별 조정할 수 있도록 `popoverOffsetX`, `popoverOffsetY` 값을 UIManager에서 읽도록 보완

### Notes
- 수정 파일: `data/ExpansionData.js`, `ui/UIManager.js`, `CHANGELOG.md`
- 카메라 확대 비율, 해금 조건, 공사중 연출, 매장 에셋은 유지


## [v6.2.0] 모바일 가로형 모달 UX / 확대 구역 이름 패널 분리
### Added
- 확대 플레이 중 현재 구역 이름을 좌측 Day/목표 패널 아래에 보여주는 `focused-zone-panel` 추가
- 카메라 상태에 따라 `store-area`에 `is-zone-focused` / `is-world-overview` 클래스를 부여하는 뷰 모드 처리 추가

### Changed
- 구역 확대 상태에서는 매장 내부 구역 이름표를 숨기고, 좌측 HUD 아래 구역 패널로 이동해 플레이 공간을 덜 가리게 변경
- 전체보기 또는 충분히 줌아웃된 상태에서는 기존처럼 각 구역 중앙의 이름표가 다시 보이도록 변경
- 발주/정산/업그레이드/배송 정리 모달을 모바일 가로 화면에서 더 낮고 넓은 형태로 보이도록 CSS 최적화
- 모바일 가로 화면에서 발주 상품 행, 수량 버튼, 정산 체크 리스트, 업그레이드 카드 간격과 폰트 크기를 축소

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 해금 조건/공사중 연출/구역별 카메라 포커스 값은 유지

## [v6.2.1] 발주/정산/업그레이드 가로형 모달 강제 적용
### Fixed
- v6.2.0의 모바일 가로 모달 CSS가 `max-height` 조건에 걸려 PC 브라우저/넓은 가로 화면에서 적용되지 않던 문제 수정
- 발주 모달을 좌측 요약/확정 영역 + 우측 상품 리스트 영역의 2컬럼 가로형 작업창으로 강제 적용
- 정산 모달을 좌측 영업 기록 + 우측 목표 체크 리스트 형태의 2컬럼 가로형 정산창으로 강제 적용
- 업그레이드 모달을 2열 카드 선택형으로 강제 적용

### Changed
- 주요 모달의 `width`, `max-height`, 내부 스크롤, 상품 행 높이, 버튼 크기를 가로 화면 기준으로 재정렬
- 배송 정리 화면도 3열 카드형으로 보이도록 조정

### Notes
- 수정 파일: `style.css`, `CHANGELOG.md`
- 화면이 매우 좁은 경우에는 1열로 자동 fallback


## [v6.2.2] 발주 전 브리핑/발주/정산 UX 가로형 재정리
### Changed
- 발주 시작 전 영업 브리핑 화면을 모바일 가로 화면에 맞춰 2컬럼 구조로 재배치
- 발주 화면을 좌측 요약/확정 영역과 우측 상품 리스트 영역으로 다시 정리하고 상품 행 높이/간격/스크롤을 재조정
- 배송 정리 화면도 좌측 안내 + 우측 상품 카드 그리드로 정리
- 정산 화면을 좌측 영업 기록 + 우측 목표 체크 리스트 구조로 재정리
- 업그레이드 화면은 2열 카드형을 유지하되 높이와 스크롤 영역을 재조정

### Fixed
- 발주 상품 리스트의 상품명/가격/수량 버튼이 눌리거나 잘려 보이던 문제 완화
- 정산 화면에서 오른쪽 영역이 비어 보이고 세로형 카드처럼 느껴지던 문제 완화

### Changed
- Day 1에는 0개 발주 확정이 불가능하도록 버튼을 비활성화하고 안내 문구 표시
- Day 2부터는 0개 발주도 허용하여 바로 영업 준비 완료 상태로 넘어가도록 기존 empty order 흐름 유지

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 구역 카메라/해금/공사중 연출 로직은 유지

## [v6.2.3] 발주 이미지/택배 박스 클릭/발주·정산 레이아웃 긴급 수정
### Fixed
- 발주 상품 이미지가 깨져 보이는 문제를 줄이기 위해 상품 이미지 경로를 PNG 기준으로 교체하고, 이미지 로드 실패 시 이모지 대체 아이콘이 표시되도록 fallback 추가
- 발주 화면 왼쪽 안내 영역에 불필요하게 보이던 택배 박스 아이콘을 제거
- 발주 화면의 좌측 요약/우측 상품 리스트 구조를 명시적 wrapper 기준으로 다시 구성해 상품 행과 수량 버튼이 아래로 밀리거나 겹치던 문제 수정
- 택배 박스 버튼에 pointerdown/click 전파 차단을 추가하고, 월드 카메라 드래그/클릭 판정에서 택배 박스를 제외해 박스 클릭이 막히던 문제 수정
- 배송 정리 화면을 좌측 안내 + 우측 상품 카드 그리드 구조로 재정리
- 정산 화면을 명시적 `result-landscape-layout` 기준으로 재구성해 좌측 영업 기록/우측 목표 체크가 안정적으로 보이도록 수정

### Changed
- Day 1에는 0개 발주를 막고, Day 2부터는 0개 발주를 허용하는 안내 문구를 발주 화면에 명확히 표시
- 상품 이미지 webp를 png로 변환한 사본을 추가하고 `ProductData.js`의 `imagePath`를 png 기준으로 변경

### Notes
- 수정 파일: `ui/UIManager.js`, `data/ProductData.js`, `style.css`, `CHANGELOG.md`
- 추가 에셋: `assets/images/products/*.png`
- 구역 카메라/확장/공사중 연출 로직은 유지


## [v6.2.4] 택배 박스 렌더링 누락 긴급 수정
### Fixed
- v6.2.3에서 `renderDeliveryBox`, `handleOrderDelivered`, `showOrderDelivered`, `clearDeliveryBox` 메서드가 누락되어 `UIManager.render()`에서 TypeError가 발생하던 문제 수정
- 발주 배송 도착 후 택배 박스가 다시 화면에 표시되고 클릭 가능하도록 복구
- 택배 박스 클릭 시 월드 카메라 드래그/클릭 이벤트와 충돌하지 않도록 `pointerdown` / `click` 전파 차단 보강
- 배송 정리 모달의 상품 이미지 fallback을 유지하면서 정리 버튼 클릭이 가능하도록 복구

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 발주/정산 레이아웃, Day 1 0개 발주 제한, Day 2+ 0개 발주 허용 규칙은 유지


## [v6.2.5] 발주 왼쪽 확인 영역 밀림 긴급 수정
### Fixed
- v6.2.1/v6.2.2의 `grid-area: header/total/message/button` 스타일이 v6.2.3의 발주 사이드바 내부 요소에 남아 적용되면서 왼쪽 발주 확인 영역이 아래로 밀리던 문제 수정
- 발주 화면 왼쪽 영역을 `flex` 기반으로 강제 재정렬해 안내, 예상 비용/보유금, 경고 문구, 발주 확정 버튼이 순서대로 보이도록 복구
- 발주 확정 버튼이 화면 아래로 사라져 발주를 확인할 수 없던 문제 수정
- 좁은 가로 화면에서도 왼쪽 확인 영역이 숨지지 않도록 여백과 폰트 크기 일부 압축

### Notes
- 수정 파일: `style.css`, `CHANGELOG.md`
- UIManager 함수/택배 박스 클릭 복구/상품 이미지 fallback 로직은 v6.2.4 상태 유지


## [v6.2.6] 발주 확정 오류/상품 행 정렬 수정
### Fixed
- `showOrderWaiting()`에서 정의되지 않은 `remainingCount`, `deliveredItems`, `orderData`를 참조해 발주 확정 버튼 클릭 시 ReferenceError가 발생하던 문제 수정
- 발주 확정 직후에는 배송 상품 목록을 그리지 않고, 단순 발주 접수 대기 화면만 표시하도록 정리
- 발주 상품 행의 이미지/상품명/가격/수량 버튼이 한 상품 카드 안에서 세로로 밀리거나 겹치던 문제 완화
- 상품 상태 텍스트는 행 안에서 공간을 과하게 차지하지 않도록 숨기고, 상품명/재고/가격/수량 중심으로 재정렬

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- Day 1 0개 발주 제한, Day 2+ 0개 발주 허용, 택배 박스 클릭 복구 로직은 유지


## [v6.2.7] 오늘 추천 배지 위치 수정
### Changed
- 발주 상품명 옆에 붙어 있던 `[오늘 추천]` 배지를 수량 선택 영역 위로 이동
- 추천 배지가 `- / 수량 / +` 버튼과 겹치지 않도록 `order-quantity-panel` 구조를 추가
- 추천 상품이 아닌 행도 높이가 흔들리지 않도록 placeholder 영역을 추가

### Notes
- 수정 파일: `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 발주 확정 오류 수정, 택배 박스 정리 로직, Day 1 0개 발주 제한 규칙은 유지

## [v6.2.8] 오늘 추천 중복 배지/발주 행 무너짐 수정
### Fixed
- 기존 CSS의 `.order-product-row.is-recommended::before` 추천 배지가 남아 수량 영역 위 추천 배지와 2개로 겹치던 문제 제거
- 발주 상품 행 높이를 수량 패널 구조에 맞게 재조정해 `오늘 추천` 배지, `- / 수량 / +` 버튼이 한 상품 카드 안에 들어오도록 수정
- 상품명 옆 추천 배지용으로 남아 있던 title padding/min-height 스타일을 제거해 상품명 영역이 불필요하게 밀리지 않도록 수정
- 가격 영역과 수량 영역을 카드 중앙에 맞춰 정렬

### Notes
- 수정 파일: `style.css`, `CHANGELOG.md`
- UIManager 로직, 발주 확정 오류 수정, 택배 박스 정리 로직은 v6.2.7 상태 유지


## [v6.2.9] 영업 시작 즉시 실패/택배 박스 클릭 보정
### Fixed
- Day 2 이후 0개 발주 또는 소량 발주 상태에서 영업 시작 버튼을 누르자마자 정산 실패로 넘어가던 문제 수정
- 오늘 상권 수요와 맞는 재고가 0개여도 영업을 즉시 종료하지 않고, 하루 종료 정산에서 성공/실패를 판정하도록 변경
- Day 4 등 후반 Day에서 상품 1개만 발주했을 때도 오픈 직후 `stock_out`으로 강제 종료되던 문제 수정
- 택배 박스 클릭 영역을 확대하고 z-index를 플레이어보다 높여, 플레이어가 근처에 있거나 지나가도 클릭이 먹히도록 보정

### Notes
- 수정 파일: `systems/GameFlowSystem.js`, `style.css`, `CHANGELOG.md`
- Day 1 0개 발주 제한, Day 2+ 0개 발주 허용, 발주/배송 정리 UI 구조는 유지


## [v6.2.10] 택배 박스 시각 크기 축소
### Changed
- 택배 박스 UI가 플레이 화면을 과하게 가리지 않도록 화면에 보이는 카드 크기와 아이콘/텍스트 크기를 축소
- 플레이어 근처에서도 클릭이 가능하도록 투명 클릭 여유 영역은 유지

### Notes
- 수정 파일: `style.css`, `CHANGELOG.md`
- 영업 시작 즉시 실패 방지, 발주/배송 정리 로직은 v6.2.9 상태 유지


## [v6.2.11] PlayerAction 판정 복구 / 택배 박스 카드 추가 축소
### Changed
- `PlayerActionSystem.getZoneCenter()`를 사용자가 전달한 `getBoundingClientRect()` 기반 계산 방식으로 복구
- 단, 현재 맵 기준으로 조정된 `shelf`, `warehouseZone` 좌표는 유지하여 자동 이동 위치가 예전 좌표로 돌아가지 않게 처리
- 택배 박스의 화면상 네모 카드 크기를 아이콘/텍스트에 맞게 더 작게 축소
- 택배 박스의 투명 클릭 여유 영역은 유지하여 플레이어 근처에서도 클릭하기 쉽게 유지

### Notes
- 수정 파일: `systems/PlayerActionSystem.js`, `style.css`, `CHANGELOG.md`
- 영업 시작 즉시 실패 방지, 발주 UX, 배송 정리 로직은 v6.2.10 상태 유지


## [v6.2.12] 택배 박스 투명 클릭 영역 제거
### Changed
- 택배 박스의 투명 클릭 여유 영역(`::before`)을 제거
- 이제 화면에 보이는 택배 박스 네모 카드 크기만큼만 클릭되도록 변경

### Notes
- 수정 파일: `style.css`, `CHANGELOG.md`
- `PlayerActionSystem.getZoneCenter()` 복구와 현재 맵 기준 좌표는 v6.2.11 상태 유지


## [v6.2.13] 택배 박스 세로 길이 추가 축소
- 택배 박스 월드 카드의 세로 높이를 아이콘/문구 실제 내용 크기에 맞춰 더 작게 축소
- 카드 폭/높이, 내부 padding, gap, 텍스트 크기를 재조정해 불필요한 빈 여백을 제거
- 클릭 영역은 보이는 카드 영역과 동일하게 유지


## [v6.2.14] 예전 맵/잠금 에셋 참조 정리
### Fixed
- `data/ExpansionData.js`에 남아 있던 예전 `dark_empty_space/second_empty_space.png`, `third_empty_space.png`, `fourth_empty_space.png` 참조를 `null` 처리
- `style.css`에 남아 있던 예전 `assets/images/map/store_map_base.webp/png` 배경 참조를 현재 `assets/images/world/map/background.png` 기준으로 교체
- 브라우저 콘솔에 예전 에셋 경로 404가 뜰 수 있던 잔여 참조를 정리

### Notes
- 수정 파일: `data/ExpansionData.js`, `style.css`, `CHANGELOG.md`
- 현재 화면 구성은 `background.png`, `unified_store_stage1`, `state/all_dark_empty_space`, `two_dark_empty_space`, `one_dark_empty_space` 중심 구조 유지
- 택배 박스 크기/클릭 영역, PlayerAction 판정 복구, 영업 시작 즉시 실패 방지 로직은 유지
## [v7.0.1] Infinite mode retry checkpoint
### Changed
- 무한 모드 게임오버 후 `타이틀로 돌아가기`를 누르면 전체 새 게임 리셋이 아니라 Day 6 초기 무한 모드 체크포인트로 저장되도록 변경
- Day 5 클리어 기록은 유지하고, 타이틀의 `이어하기` 버튼으로 Day 6 무한 모드부터 다시 시작할 수 있게 조정
- `새로 시작` 버튼은 기존처럼 저장 데이터를 삭제하고 Day 1부터 완전히 새 유저 상태로 시작하도록 유지
- 타이틀 이어하기 상태 문구에 무한 모드 재도전 가능 상태를 표시

### Fixed
- 무한 모드 게임오버 후 이어하기 버튼이 비활성화되거나 Day 1로 리셋되던 흐름 수정
- 게임오버 안내 문구를 `무한 모드 진행만 초기화 / 새로 시작은 완전 초기화`로 구분해 혼동을 줄임

### Notes
- 수정 파일: `systems/SaveSystem.js`, `ui/UIManager.js`, `style.css`, `CHANGELOG.md`
- 유료 BM 유지 처리는 실제 BM 연동 전까지 보류

## [v7.0.4] NPC and player textbox assets
### Added
- 손님 NPC 대사에 `normalcustomer_npc_textbox.png` 텍스트박스 에셋 적용
- 진상 손님/분노 상태 손님 대사에 `badcustomer_textbox.png` 텍스트박스 에셋 적용
- 플레이어/알바생 행동 메시지에 `player_textbox.png` 텍스트박스 에셋 적용
- 계산대 대기 손님 기본 대사 추가: `계산해주세요`, `계산 부탁드립니다`, `저 급해요` 등 손님 타입별 기본 문구 분기
- 고객 이벤트 모달의 손님 대사에도 normal/bad customer 텍스트박스 분기 적용

### Changed
- 기존 상품명 중심 말풍선을 NPC가 직접 말하는 대사형 텍스트박스로 변경
- 계산 성공 메시지를 `계산해드릴게요` 톤의 플레이어 대사로 보이도록 조정

### Notes
- 수정 파일: `data/AssetData.js`, `ui/UIManager.js`, `systems/PlayerActionSystem.js`, `style.css`, `CHANGELOG.md`
- 추가 에셋: `assets/ui/textbox/normalcustomer_npc_textbox.png`, `assets/ui/textbox/player_textbox.png`, `assets/ui/textbox/badcustomer_textbox.png`
- 기존 손님 이동, 계산대, 진열대, 저장/이어하기, 설정 흐름은 유지

## [v7.0.4.1] Player textbox anchor hotfix
- Fixed: 플레이어/알바생 대사가 전역 알림 토스트 위치에 떠서 계산대/진열대 위에 겹쳐 보이던 문제 수정
- Changed: 플레이어 행동 메시지를 `#message-panel`이 아니라 `#player-zone` 위 전용 대사 박스로 표시하도록 변경
- Maintained: 일반 손님 / 진상 손님 텍스트박스 표시 흐름 유지

## [v7.3.0] Warehouse box interaction and carrying animation

### Added
- BasicBox를 기존 창고 좌표와 연결된 맵 오브젝트로 배치
- ArriveBox 발주 도착/입고 운반 연출 추가
- 플레이어 카테고리별 박스 운반 레이어 추가
- warehouse/box 에셋 경로 매핑 추가

### Changed
- 발주 도착 클릭 시 즉시 입고 모달 대신 ArriveBox 이동, 창고 운반, 물류 정리 대기 후 기존 입고 흐름을 실행하도록 변경
- 재고 보충 시 창고 5초 작업 후 상품 카테고리에 맞는 박스를 들고 진열대로 이동하도록 변경

### Maintained
- 기존 수동 창고/진열대 5초 작업 시간 유지
- 기존 발주/입고 데이터 구조와 RESTOCK_COMPLETED 기반 재고 반영 흐름 유지
- index.html, main.js, core/GameState.js, core/EventBus.js, core/Constants.js 미수정

## [v7.9.6] Reward inbox UI and checkout delay hotfix

### Added
- 보상함 전용 선물 아이콘 SVG 추가: `assets/ui/icons/reward_inbox_gift.svg`
- 플레이어 직접 계산 시 3초 계산 대기 연출 추가
- BM 성장/계약 상품 강화 탭 카드 생성 메서드 추가

### Changed
- 보상함 메인 버튼을 일일 미션과 구분되는 블루 계열 이미지형 UI로 변경
- 보상함 팝업을 일일 미션과 다른 블루/인박스 톤 레이아웃으로 재정리
- 보상함 닫기 버튼을 팝업 오른쪽 위 작은 원형 X 버튼으로 고정
- 보상함 목록 렌더링에서 수령 완료 보상은 계속 숨김 처리

### Fixed
- 상점 성장/계약 > 상품 강화 탭 클릭 시 `createBMProductUpgradeCardMarkup is not a function` 오류 수정
- 보상함 닫기 버튼이 상단 중앙의 큰 버튼처럼 보이던 UI 문제 수정

### Maintained
- 보상함 수령/쿠폰/저장/중복 수령 방지 로직 유지
- 상점 구매 및 EconomySystem 재화 처리 흐름 유지
- 공통 파일 `index.html`, `main.js`, `core/GameState.js`, `core/EventBus.js`, `core/Constants.js` 미수정


[v7.9.8] Staff sprite asset integration
- Added 8-direction staff sprite assets for three staff candidates (male cashier, female glasses, female friendly).
- Wired staff candidate data to use assetVariant mapping.
- Updated staff hire modal to show actual staff sprites instead of generic icons.
- Updated in-store hired staff display to show sprite image instead of letter badge.

## [v7.0.9] 2026-07-06 17:25 - 정산/알바/BM 표시 규칙 보정

### Changed
- 임시 MVP 정산 더미 데이터 자동 적용을 기본 비활성화했습니다. 실제 플레이 정산은 누적된 매출/비용/고객/위생 데이터를 기준으로 계산됩니다.
- 알바 후보 문구를 고정 담당 역할처럼 보이지 않도록 정리형/창고형/위생형 보조 콘셉트로 수정했습니다.
- 알바 능력치와 알바 강화권 효과가 창고/진열/청소 작업 시간 감소에 반영되도록 연결했습니다.
- 상품 최종 강화명은 해당 상품이 Lv.5 강화 완료된 뒤에만 표시되도록 BM 표시 규칙을 명확히 했습니다.

### Fixed
- 판매권/프리미엄 상품 payload에서 최종 강화명이 사전 노출될 수 있는 필드를 제거했습니다.

## [v7.9.9] Staff natural movement pass

### Changed
- 알바 상태 변경 시 좌표만 즉시 바꾸던 방식을 프레임 단위 자동 이동 루프로 변경했습니다.
- 알바가 청소/창고 재고 확인/진열 보조/복귀 목표 위치까지 이동한 뒤 작업 타이머가 시작되도록 조정했습니다.
- 알바 이동 방향에 따라 8방향 스프라이트가 자연스럽게 전환되도록 `direction` 상태값을 추가했습니다.
- 이동 중에는 가벼운 걷기 흔들림 애니메이션을 적용했습니다.

### Maintained
- 알바는 발주 박스/도착 물류 박스/택배 박스를 조작하지 않습니다.
- 알바는 계산대 자동 계산을 수행하지 않습니다.
- BM/상품 해금/정산/발주 로직은 수정하지 않았습니다.

[v7.2.1] Staff Assist 안정화
- Fixed: 알바 이동 프레임마다 알바 요약 패널을 다시 그리던 문제를 줄이고, 캐릭터 위치만 갱신하도록 조정.
- Fixed: 알바 요약/캐릭터 라벨에서 디버그 좌표 노출 제거.
- Fixed: 플레이어 청소 중에는 알바 자동 청소가 중복 시작되지 않도록 방어 조건 추가.
- Changed: 알바 자동보조는 영업 시작 후(STORE_RUNNING)부터 작동하며, 영업 시작 시 입구 위치에서 매장 안 대기 위치로 들어오는 연출로 변경.
- Deferred: 진열대 재고/UI 연결 관련 수정은 담당자 진열대 작업 병합 후 재검수 예정.

## [v7.11.5] 튜토리얼 말풍선/스포트라이트 UX 수정

### Changed
- 체험형 튜토리얼 UI를 큰 팝업 패널이 아닌 작은 말풍선 형태로 재조정했습니다.
- 튜토리얼 단계 문구를 한 행동 단위의 짧은 안내문으로 축약했습니다.
- 배경 전체 블러/강한 딤을 제거하고, 눌러야 할 대상 주변만 제외한 스포트라이트 딤 처리로 변경했습니다.

### Fixed
- 튜토리얼 하이라이트 대상 버튼이 딤 레이어 아래에서 어둡게 보이던 문제를 수정했습니다.
- 대상 버튼/오브젝트가 선명하게 보이도록 스포트라이트 구멍과 노란 하이라이트 링을 분리했습니다.

## [v7.11.6] 체험형 튜토리얼 클릭 차단 수정

### Fixed
- 체험형 튜토리얼에서 `발주하러 가기` 등 강조 대상 버튼이 눌리지 않는 문제를 수정했습니다.
- 기존 단일 딤 레이어/스포트라이트 그림자 방식 대신, 대상 영역을 비워두는 4방향 딤 패널 방식으로 변경했습니다.
- 눌러야 할 버튼 영역 위에는 실제 딤 레이어가 올라가지 않도록 수정했습니다.
- 튜토리얼 닫기/전환 시 `aria-hidden` 포커스 경고가 발생하지 않도록 포커스 처리와 aria-hidden 사용 방식을 정리했습니다.

### Kept
- 10단계 체험형 튜토리얼 구조 유지.
- 영업 전 루프 유지: 발주 → 확정 → 택배 도착 → 창고 정리 → 첫 진열 자동 보충 → 영업 시작.
- 새 매장 시작 시 BM 지갑/출석 보상 기록 유지.

## [v7.12.0] Tutorial click-safety hotfix
- Fixed: 체험형 튜토리얼 오버레이가 발주/발주하러 가기 등 실제 게임 버튼 클릭을 막지 않도록 pointer-event 구조를 재정리.
- Changed: 튜토리얼 완료 저장 키를 v4로 갱신해, 개발 중 기존 v3 완료 기록이 있어도 새 말풍선 튜토리얼을 다시 검수할 수 있게 수정.
- Fixed: 튜토리얼 문구 문자열의 줄바꿈을 안전한 `\n` 표기로 정리.
- Kept: 첫 자동 튜토리얼은 계정 기준 1회, 이후 도움말 버튼으로 다시 보기 가능.


## [v7.12.1] 체험형 튜토리얼 포커스/발주 버튼 클릭 복구

### Fixed
- 튜토리얼 중 `발주하러 가기` 버튼이 눌리지 않는 문제를 방지하기 위해 브리핑 모달/버튼의 pointer-events를 명시적으로 복구했습니다.
- 브리핑 CTA 클릭 시 발주 데이터가 아직 연결되지 않은 예외 상황에서도 발주창으로 이어지는 fallback을 추가했습니다.

### Changed
- 튜토리얼 딤 처리를 다시 활성화하되, 노란 하이라이트 대상 영역만 구멍처럼 비워 클릭 가능하게 조정했습니다.
- 배경은 살짝 어둡고 흐리게 처리해 시선을 유도하고, 표시된 대상 외 영역은 클릭을 막도록 변경했습니다.
- 새 말풍선 튜토리얼 검수를 위해 튜토리얼 완료 키를 `stillOpen.tutorial.v5.completed`로 갱신했습니다.

## [v7.12.3] 체험형 튜토리얼 최종 루프/포커스 정리
- Changed: 브리핑 단계에서 목표/상권/추천 카드와 [발주하러 가기] 버튼을 함께 밝게 보여주도록 튜토리얼 포커스 범위를 확장했습니다.
- Changed: 발주 수량 선택 단계는 상품 1개 클릭 즉시 넘어가지 않고, 사용자가 원하는 상품을 예산/창고 한도 내에서 자유롭게 선택한 뒤 [수량 선택 완료]로 진행하도록 변경했습니다.
- Fixed: 발주 + 버튼은 보유 골드 또는 창고 한도를 넘기는 경우 비활성화되며, 감소 버튼은 선택 수량이 0이면 비활성화됩니다.
- Changed: 도착한 발주 박스 클릭 후 별도 상품 클릭 단계를 제거하고, 창고 정리 진행 안내 후 정리 완료 이벤트를 기다리도록 수정했습니다.
- Changed: 계산대/진열대/청소는 직접 상호작용을 강제하지 않고 클로즈업 요약 안내로 보여준 뒤 마지막에 [영업 시작] 버튼을 강조하도록 수정했습니다.
- Changed: 튜토리얼 딤 처리 강도를 높여 표시 대상만 밝고 주변은 어둡고 흐리게 보이도록 조정했습니다.

## [v7.12.4] 2026-07-07
### Fixed
- 튜토리얼 포커스 처리 중 화면 중앙에 검은 세로 딤 막대가 남는 문제를 제거했습니다.
- 튜토리얼 강조 대상에 적용되던 과한 노란 발광/밝기 보정 효과를 제거했습니다.
- 튜토리얼 딤 구조를 네 방향 패널 방식에서 전체 딤 1장 + 대상 z-index 강조 방식으로 단순화했습니다.
- 발주 확정 직후 튜토리얼이 도착 박스 단계로 넘어가지 않고 이전 문구에 머무르던 문제를 완화했습니다.
- 도착 박스/창고 정리 튜토리얼 문구를 실제 루프 기준으로 수정했습니다.

### Changed
- 브리핑 단계는 오늘 목표/상권 정보/추천 상품 카드와 [발주하러 가기] 버튼이 함께 선명하게 보이도록 정리했습니다.
- 발주 박스 클릭 후에는 박스 안 상품을 눌러 창고 재고로 정리해야 한다는 안내가 명확히 보이도록 수정했습니다.

## [v7.12.5] 알바생 4구역 진열 보조 루트 재설정

### Changed
- `StaffAssistSystem.js` 알바 이동 기준을 기존 `standX/standY` 보정값에서 F8 좌표 모드의 `interactionX/interactionY` 기반 도착점으로 변경했습니다.
- 1~4구역 진열대/냉장고/신선매대/온장고별 알바 전용 발 위치 보정값을 추가했습니다.
- 알바가 진열대로 이동할 때 중앙 통로와 구역별 통로 경유지를 거쳐 이동하도록 루트 이동 함수를 분리했습니다.
- 진열대 도착 후에는 해당 매대를 바라보는 방향값을 유지하도록 도착 방향 처리를 보완했습니다.

### Fixed
- 알바 보충 완료 시 `PlayerActionSystem.shelfStocks`의 `products` 구조를 깨뜨리던 저장 방식을 수정했습니다.
- 창고에 정리된 재고가 없을 때 안내 문구를 “창고에 정리된 재고가 없어 보충할 수 없어요.”로 정리했습니다.

### Maintained
- 플레이어 이동, F8 좌표 모드, 마스터모드, 발주/도착박스, 튜토리얼 흐름은 수정하지 않았습니다.
- 알바는 계산대, 발주 박스, 배송/도착 박스를 조작하지 않습니다.

## [v7.12.6] 알바생 잠긴 구역 이동 차단

### Fixed
- 알바 자동 진열 보조 대상에서 아직 해금되지 않은 2~4구역 진열대를 제외하도록 `StaffAssistSystem.js`에 구역 해금 필터를 추가했습니다.
- `GameState.expansion.unlockedZoneIds` 기준으로 해금된 구역만 보충 후보에 포함되며, 기본 1구역(`zone_basic`)은 항상 접근 가능하도록 보정했습니다.

### Maintained
- 알바 이동 루트, F8 좌표 모드, 플레이어 이동, 발주/도착 박스, 튜토리얼 흐름은 추가 수정하지 않았습니다.

## [v7.13.67] Checkout Customer Queue Y Position Fine Tune

### Changed
- 손님 계산대 대기열의 X좌표는 유지하고, Y좌표만 계산대 앞쪽까지 위로 조정했습니다.

### Maintained
- 계산대 상호작용키, 충돌 영역, 플레이어/알바 이동 좌표는 수정하지 않았습니다.
## [v7.13.68] Checkout Customer Queue Y Position Second Fine Tune

### Changed
- 손님 계산대 대기열의 X좌표는 유지하고, Y좌표만 30px 더 위로 조정했습니다.

### Maintained
- 계산대 상호작용키, 충돌 영역, 플레이어/알바 이동 좌표는 수정하지 않았습니다.


## [v7.13.70] Checkout Customer Queue X Position Fourth Fine Tune

### Changed
- 손님 계산대 대기열의 Y좌표는 고정하고, X좌표만 40px 더 오른쪽으로 조정했습니다.

### Maintained
- 계산대 상호작용키, 충돌 영역, 플레이어/알바 이동 좌표는 수정하지 않았습니다.

## [v7.13.71] Checkout Customer Queue X Position Fifth Fine Tune

### Changed
- 손님 계산대 대기열의 Y축은 `445px`로 고정한 상태에서 X축만 오른쪽으로 35px 추가 조정했습니다.
- 최종 계산대 대기열 기준 좌표를 `left: 610px`, `top: 445px`로 설정했습니다.

### Unchanged
- 계산대 상호작용키/클릭 영역은 변경하지 않았습니다.
- 계산대 충돌 영역은 변경하지 않았습니다.
- 플레이어/알바 이동 좌표는 변경하지 않았습니다.

## [v7.13.72] Day 2+ Zero Quantity Order Confirm

### Changed
- Day 2부터 발주 수량이 0개여도 [발주 확정] 버튼을 누를 수 있도록 발주 UI 활성화 조건을 변경했습니다.
- 0개 발주 확정 시 배송 박스 생성 없이 바로 영업 준비 완료 상태로 넘어가도록 `OrderSystem.js` 빈 발주 처리 흐름을 추가했습니다.
- 0개 발주 준비 완료 메시지는 “재고 정리 완료”가 아니라 “발주 없이 준비 완료” 흐름으로 표시되도록 `GameFlowSystem.js` 메시지를 분기했습니다.

### Maintained
- Day 1 튜토리얼/초기 발주 단계에서는 기존처럼 1개 이상 선택해야 발주 확정이 가능합니다.
- 예산 초과, 창고 수량 초과, 잠긴 상품 차단 조건은 기존대로 유지했습니다.

## [v7.13.73] Shelf Restock Empty Target Priority

### Fixed
- 플레이어가 여러 진열대 근처에 있을 때, 단순 거리순이 아니라 `비어 있음 + 창고 재고 있음` 상태의 매대를 우선 보충 대상으로 선택하도록 수정했습니다.
- 선택한 매대에 상품이 남아 있거나 창고 재고가 없더라도, 근처에 보충 가능한 빈 매대가 있으면 자동으로 해당 매대로 전환되도록 보완했습니다.

### Maintained
- 진상 이벤트 모달 중 상호작용 차단, 계산 직전 재고 검증, 재고 예약 처리 로직은 유지했습니다.

## [v7.13.74] Staff NPC Collision Ignore

### Changed
- `StaffAssistSystem.js` 알바 이동 충돌 판정에서 손님 NPC 충돌 영역을 제외했습니다.
- 알바는 계산대/진열대/냉장고 등 매장 오브젝트 충돌은 유지하되, 손님 NPC와는 충돌하지 않고 이동하도록 수정했습니다.
- 손님 NPC 충돌 무시에 맞춰 알바 창고 이동/복귀 경유점을 간소화했습니다.

### Maintained
- 알바의 진열 보조/청소 보조 역할 제한은 유지했습니다.
- 기존 진상 이벤트, 계산 직전 재고 검증, 재고 예약 처리, 빈 진열대 우선 보충 판정은 유지했습니다.


## [v7.13.80] Warehouse Box / Cleaning Tool Collision Add

### Added
- 기존 계산대/진열대/냉장고 충돌 범위는 수정하지 않고, 창고 박스와 청소 도구함 전용 이동 차단 범위를 `data/CollisionData.js`에 추가했습니다.

### Changed
- 1구역 청소 도구함을 계산대 바로 오른쪽 위 위치로 옮기고, 화면에서 보이는 청소 이미지 크기를 더 작게 줄였습니다.
- 저장 데이터에 예전 청소 좌표가 남아 있어도 최신 청소 도구함 좌표를 우선 사용하도록 UI 정규화 로직을 보완했습니다.

### Maintained
- 기존 오브젝트 차단 범위, 계산대 충돌 범위, 진열대/냉장고 충돌 프리셋은 변경하지 않았습니다.
- 손님 계산대 대기 좌표와 발주/배송 박스 좌표는 변경하지 않았습니다.
