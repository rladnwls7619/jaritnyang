# 자릿냥 Google Maps 연동 구조

## 역할 분리

- Google Maps iframe/URL: 매장 위치 확인과 지도 보기
- Google Places API: 음식점, 카페, 스터디카페 등 매장 검색과 내 주변 검색
- 자릿냥 DB: 좌석 현황, 예상 이용 시간, 포인트, 신고, 신뢰도 저장

## 현재 MVP에서의 동작

`index.html`을 직접 열어도 데모 매장과 오른쪽 Google Maps iframe은 동작합니다.

`server.js`로 실행하면 `/api/google-places-search`와 `/api/google-places-nearby`가 Google Places API를 대신 호출합니다. 이 구조를 쓰면 브라우저에 `GOOGLE_MAPS_API_KEY`를 직접 노출하지 않고 장소 검색을 붙일 수 있습니다.

## 실행 예시

PowerShell:

```powershell
$env:GOOGLE_MAPS_API_KEY="발급받은_구글_지도_API_KEY"
& "C:\Users\rladn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\server.js
```

브라우저에서 `http://localhost:8787`을 열고 검색어를 입력한 뒤 `구글 검색`을 누르거나, 위치 권한을 허용한 뒤 `내 주변`을 누르면 됩니다.

## 저비용 운영 전략

- 초기에는 데모/사용자 제보 매장 + Google Maps URL/iframe으로 시작합니다.
- 사용자가 늘어난 뒤 Google Places Text Search를 켭니다.
- 내 주변 검색은 API 키가 없을 때 데모 매장을 거리순으로 보여주는 폴백을 둡니다.
- 검색 결과 전체를 저장하지 않고, 사용자가 좌석 정보를 남긴 매장만 최소 식별 정보로 연결합니다.
- 좌석 상태, 포인트, 신뢰도는 Google이 아니라 자릿냥 DB에 저장합니다.

## 좌석도 저장 구조

- 매장 사진: Storage에 이미지 파일로 저장
- 좌석 위치: 사진 기준 `x`, `y` 퍼센트 좌표로 저장
- 좌석 상태: `available`, `occupied`, `ended` 같은 상태값으로 저장
- 매장주 수정: 추후 관리자 인증을 붙여 수정 권한을 제한합니다.
