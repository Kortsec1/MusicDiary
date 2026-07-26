# Spotify 설정

1. Spotify Developer Dashboard에서 Web API 앱을 만든다.
2. Redirect URI를 로컬은 `http://127.0.0.1:3000/api/auth/spotify/callback`, 운영은 `https://도메인/api/auth/spotify/callback`으로 정확히 등록한다.
3. Client ID/Secret을 `.env`와 Vercel 환경 변수에 저장한다. Secret은 브라우저 변수로 만들지 않는다.
4. 권한: `user-read-private user-read-currently-playing user-read-playback-state user-read-recently-played user-top-read playlist-modify-private`.
5. `TOKEN_ENCRYPTION_KEY`는 `openssl rand -base64 32`로 생성한다.

Authorization Code Flow, state 검증, HttpOnly/SameSite=Lax 쿠키, 토큰 AES-256-GCM 저장을 사용한다. 데모 모드는 자격 증명 없이 UI와 테스트를 검증한다.
