# 자릿냥 MVP

방문자가 직접 좌석 이용 예정 시간을 업데이트하고, 다른 사용자가 그 정보를 기준으로 매장 잔여 자리를 확인하는 웹앱 프로토타입입니다.

## 실제 DB 연결

Supabase 연결용 코드가 추가되었습니다.

1. `supabase-schema.sql`을 Supabase SQL Editor에서 실행합니다.
2. `supabase-seed.sql`을 실행해서 테스트 매장/좌석을 넣습니다.
3. `config.js`에 Supabase `Project URL`과 `anon public key`를 입력합니다.
4. GitHub에 다시 올리면 Vercel이 자동 재배포합니다.

자세한 순서는 `SUPABASE_SETUP.md`를 보면 됩니다.

## 첫 버전 기능

- 매장 목록 검색과 카테고리 필터
- 현재 위치 기반 내 주변 매장 확인
- Google Places API 연동용 서버 엔드포인트
- Google Maps iframe과 장소 링크 표시
- 매장 사진 업로드/촬영 기반 좌석도 편집
- 매장주 수정 모드에서 좌석 추가, 삭제, 상태 변경
- 매장별 잔여 좌석, 곧 비는 좌석, 예상 정확도 표시
- 좌석 선택 후 예상 이용 시간 등록
- 예상 시간보다 일찍 자리 비우기 시 포인트 적립
- 포인트 적립은 사용자 기준 1시간에 1회로 제한
- 이메일, 전화번호, 카카오톡, 구글 가입 흐름 데모
- 방문 인증 기반 포인트 지급
- 검증 방문 기준 광고비 과금 데모
- 다른 방문자 업데이트 시뮬레이션
- 브라우저 `localStorage` 기반 데이터 저장

## 실행 방법

`index.html` 파일을 브라우저에서 열면 바로 실행됩니다.

Google Places API까지 연결하려면 `server.js`로 실행합니다. API 키가 없어도 데모 매장과 오른쪽 Google Maps iframe은 동작합니다.

```powershell
$env:GOOGLE_MAPS_API_KEY="발급받은_구글_지도_API_KEY"
& "C:\Users\rladn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\server.js
```

그다음 브라우저에서 `http://localhost:8787`을 열고 `구글 검색` 또는 `내 주변` 버튼을 누르면 됩니다.

## PWA 설치 방법

로컬 테스트:

1. `server.js`를 실행합니다.
2. Chrome 또는 Edge에서 `http://localhost:8787`을 엽니다.
3. 주소창 오른쪽의 설치 아이콘을 누르거나, 메뉴에서 `앱 설치`를 선택합니다.
4. 휴대폰에서는 배포된 HTTPS 주소로 접속한 뒤 `홈 화면에 추가`를 선택합니다.

PWA 구성 파일:

- `manifest.webmanifest`: 앱 이름, 아이콘, 시작 URL, 화면 모드 설정
- `sw.js`: 서비스 워커와 오프라인 캐시
- `offline.html`: 네트워크가 끊겼을 때 보여줄 화면
- `icons/icon-192.png`, `icons/icon-512.png`: 설치 아이콘
- `pwa.js`: 서비스 워커 등록과 설치 버튼 처리

실제 배포 조건:

- HTTPS 주소가 필요합니다. Vercel, Netlify, Cloudflare Pages는 기본으로 HTTPS를 제공합니다.
- 아이콘은 192px, 512px 이상이 필요합니다.
- 서비스 워커가 정상 등록되어야 합니다.
- Google Places API 키는 브라우저에 직접 넣지 말고 서버 환경 변수로 넣어야 합니다.

## 실제 서비스로 확장할 때

초기 검증 후에는 다음 구조를 추천합니다.

- Frontend: Next.js 또는 React PWA
- Store Search: Google Places API
- Map: Google Maps iframe 또는 Google Maps URL
- Auth: Supabase Auth
- Database: Supabase Postgres
- Realtime: Supabase Realtime
- Hosting: Vercel
- 주요 테이블: `stores`, `seats`, `seat_sessions`, `point_events`, `reports`
- 가입/권한 테이블: `profiles`, `merchant_profiles`, `store_claims`
- 광고 테이블: `ad_campaigns`, `verified_visits`, `billing_events`
- 좌석도 이미지: Supabase Storage 또는 Cloudflare R2
- 좌석 좌표: `seats.x`, `seats.y` 비율 좌표로 저장
- 포인트 제한: 서버 기준 사용자별 1시간 쿨다운과 위치 검증

## 개인정보/공유 방지 기본 정책

- 사용자의 실제 이름 대신 익명 사용자 토큰 사용
- 좌석 이용 기록은 필요한 기간만 보관
- 다른 사용자에게는 좌석 상태와 예상 종료 시간만 노출
- 상세 메모는 민감 정보가 들어가지 않도록 짧게 제한
- 실제 서비스에서는 Row Level Security로 본인 기록만 조회 가능하게 설정

## 포인트 악용 방지 기본 정책

- 포인트 적립은 서버 기준 사용자별 1시간 1회로 제한
- 매장 반경 안에서만 좌석 이용/자리 비우기 허용
- 매장 QR, NFC, 영수증 코드 중 하나로 실제 방문 확인
- 너무 짧은 이용 시간, 반복 등록/취소, 비정상 위치 이동은 포인트 제외
- 신고가 많은 사용자는 포인트 보류 또는 신뢰도 하락
- 매장주 인증 계정이 좌석 상태를 정정할 수 있게 설계

## 가입과 광고 과금 구조

- 가입은 Supabase Auth로 이메일, 전화번호 OTP, 카카오, 구글을 연결합니다.
- 방문자는 좌석 이용 전에 로그인해야 합니다.
- 포인트는 로그인 + 방문 인증 + 1시간 제한을 통과해야 적립됩니다.
- 광고비는 단순 노출이 아니라 `verified_visits` 기준으로 `billing_events`에 기록합니다.
- 매장주는 `merchant_profiles`와 `store_claims`로 매장 소유 인증 후 광고 캠페인을 운영합니다.
