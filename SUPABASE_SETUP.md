# 자릿냥 실제 DB 연결 방법

이 파일은 Vercel에 올라간 자릿냥을 Supabase DB와 연결하는 순서입니다.

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 에 로그인합니다.
2. `New project`를 누릅니다.
3. 프로젝트 이름은 `jaritnyang`처럼 입력합니다.
4. Database Password는 따로 안전한 곳에 기록합니다.
5. Region은 한국 사용자가 많으면 `Northeast Asia` 계열을 고릅니다.

## 2. DB 테이블 만들기

1. Supabase 왼쪽 메뉴에서 `SQL Editor`를 누릅니다.
2. `New query`를 누릅니다.
3. 이 폴더의 `supabase-schema.sql` 내용을 전부 붙여넣고 `Run`을 누릅니다.
4. 다시 `New query`를 누릅니다.
5. `supabase-seed.sql` 내용을 전부 붙여넣고 `Run`을 누릅니다.

`supabase-schema.sql`은 실제 테이블, 로그인 권한, 포인트 적립 함수를 만듭니다.
`supabase-seed.sql`은 처음 테스트할 매장과 좌석을 넣습니다.

## 3. API 설정값 복사하기

1. Supabase 왼쪽 아래 `Project Settings`를 누릅니다.
2. `Data API` 또는 `API` 메뉴를 엽니다.
3. `Project URL`을 복사합니다.
4. `anon public` key를 복사합니다.
5. `config.js`를 열고 아래처럼 넣습니다.

```js
window.JARITNYANG_SUPABASE = {
  url: "https://프로젝트아이디.supabase.co",
  anonKey: "복사한 anon public key",
};
```

절대 `service_role` key는 넣지 마세요. `service_role`은 관리자 비밀번호와 비슷해서 공개 저장소에 올라가면 위험합니다.

## 4. 로그인 켜기

이메일 로그인부터 가장 쉽습니다.

1. Supabase 왼쪽 메뉴에서 `Authentication`을 누릅니다.
2. `Providers`에서 `Email`이 켜져 있는지 확인합니다.
3. `URL Configuration`에서 Vercel 주소를 Site URL에 넣습니다.
4. Redirect URL에도 Vercel 주소를 추가합니다.

카카오톡과 구글 로그인은 각 개발자 콘솔에서 OAuth 앱을 만든 뒤 Supabase `Providers`에 Client ID와 Secret을 넣으면 됩니다.

## 5. GitHub와 Vercel에 반영하기

수정한 파일을 GitHub 저장소에 올리면 Vercel이 자동으로 다시 배포합니다.

반드시 올라가야 하는 파일:

- `config.js`
- `supabase-db.js`
- `app.js`
- `index.html`
- `sw.js`
- `supabase-schema.sql`
- `supabase-seed.sql`

배포 후 앱에서 좌석을 선택하면 `seat_sessions` 테이블에 기록이 생깁니다.
방문 인증 후 자리를 일찍 비우면 Supabase 함수가 1시간 제한을 검사하고 포인트를 기록합니다.
