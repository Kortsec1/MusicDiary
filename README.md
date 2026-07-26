# DAYTRACK

음악과 함께 하루의 순간을 기록하는 모바일 우선 개인 음악 일기입니다. Next.js, TypeScript, Prisma, PostgreSQL 16으로 구성되며 Spotify 자격 증명이 없을 때는 데모 화면으로 실행됩니다.

## 로컬 실행

필수: Node.js 20 이상, pnpm 10, Docker Desktop.

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm prisma migrate dev
pnpm dev
```

`http://127.0.0.1:3000`에서 확인합니다. 웹만 실행하려면 `pnpm dev:web`, 워커만 실행하려면 `pnpm dev:worker`를 사용합니다.

## Supabase 무료 DB + Vercel 배포

1. Supabase 무료 프로젝트를 만들고 Connect에서 Supavisor 연결 문자열을 복사합니다.
2. Vercel 런타임 `DATABASE_URL`에는 transaction pool(포트 6543), migration용 `DIRECT_URL`에는 session pool(포트 5432)을 설정합니다.
3. Vercel에서 GitHub `Kortsec1/MusicDiary`를 Import하고 Production/Preview 환경 변수를 등록합니다.
4. `pnpm prisma migrate deploy`로 운영 migration을 적용한 뒤 main 브랜치를 배포합니다.
5. Spotify 운영 Redirect URI를 배포 도메인과 정확히 맞춥니다.

## Spotify 연결

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)에서 앱을 생성합니다.
2. 앱의 Redirect URI에 `https://daytrack-nine.vercel.app/api/auth/spotify/callback`을 등록합니다.
3. Vercel Production 환경 변수에 `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
   `SPOTIFY_REDIRECT_URI`를 등록합니다.
4. 재배포한 뒤 DAYTRACK 첫 화면의 `Spotify 연결하기`를 누릅니다.

OAuth access/refresh token은 브라우저에 노출하지 않고 AES-256-GCM으로 암호화해
`SpotifyConnection`에 저장합니다. 로그인 세션은 HttpOnly·Secure·SameSite 쿠키를 사용합니다.

## 홈 화면에 추가

- iPhone/iPad: Safari 공유 버튼 → `홈 화면에 추가`
- Android/Chrome: DAYTRACK 첫 화면의 `추가` 버튼 또는 브라우저 메뉴 → `앱 설치`

서비스 워커와 PWA manifest가 포함되어 설치 후 standalone 앱으로 실행됩니다.

필수 비밀값은 `.env.example`을 참고하세요. `SPOTIFY_CLIENT_SECRET`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, DB 비밀번호는 저장소나 `NEXT_PUBLIC_*` 변수에 넣지 않습니다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

상세 문서는 `docs/`에 있습니다.
