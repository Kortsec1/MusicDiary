import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { spotifyRedirectUri } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const base = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
  if (!clientId) {
    return NextResponse.redirect(new URL("/?spotify=not-configured", base));
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: [
      "user-read-private",
      "user-read-email",
      "user-read-currently-playing",
      "user-read-playback-state",
      "user-read-recently-played",
    ].join(" "),
    redirect_uri: spotifyRedirectUri(),
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
    show_dialog: "true",
  });
  const response = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  response.cookies.set("spotify_oauth_state", state, cookieOptions);
  response.cookies.set("spotify_pkce_verifier", verifier, cookieOptions);
  return response;
}
