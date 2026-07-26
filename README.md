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

필수 비밀값은 `.env.example`을 참고하세요. `SPOTIFY_CLIENT_SECRET`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, DB 비밀번호는 저장소나 `NEXT_PUBLIC_*` 변수에 넣지 않습니다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

상세 문서는 `docs/`에 있습니다.
