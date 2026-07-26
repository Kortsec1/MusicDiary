# 아키텍처

- Next.js App Router: 서버 컴포넌트와 Route Handler
- Prisma: PostgreSQL 접근 및 migration
- Spotify 서버 계층: Client, token service, mapper, sync, playlist service
- 브라우저: 화면이 visible일 때만 현재 곡 폴링; 위치는 사용자 동작 또는 곡 변경 시에만 수집
- Worker: 만료 세션 정리, 누락 하루 앨범 생성, 실패 미디어 정리
- Storage Adapter: 개발은 로컬, 운영은 R2/S3 교체 지점

Vercel에서는 애플리케이션을 실행하고 Supabase의 Supavisor transaction pool(6543)을 런타임 `DATABASE_URL`로, session pool(5432) 또는 direct URL을 migration용 `DIRECT_URL`로 사용한다.
