import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { spotifyRedirectUri } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const base = process.env.APP_BASE_URL || request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("spotify_oauth_state")?.value;
  const verifier = request.cookies.get("spotify_pkce_verifier")?.value;
  if (!code || !state || state !== expectedState || !verifier) {
    return NextResponse.redirect(new URL("/?spotify=invalid-state", base));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?spotify=not-configured", base));
  }
  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: spotifyRedirectUri(),
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/?spotify=token-error", base));
  }
  const token = await tokenResponse.json() as {
    access_token: string; refresh_token: string; expires_in: number; scope: string;
  };
  const profileResponse = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (!profileResponse.ok) {
    return NextResponse.redirect(new URL("/?spotify=profile-error", base));
  }
  const profile = await profileResponse.json() as {
    id: string; display_name?: string; images?: Array<{ url: string }>;
  };

  const user = await prisma.user.upsert({
    where: { spotifyAccountId: profile.id },
    create: {
      spotifyAccountId: profile.id,
      displayName: profile.display_name || "Spotify 사용자",
      avatarUrl: profile.images?.[0]?.url,
    },
    update: {
      displayName: profile.display_name || "Spotify 사용자",
      avatarUrl: profile.images?.[0]?.url,
    },
  });
  await prisma.spotifyConnection.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: encryptToken(token.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      grantedScopes: token.scope.split(" "),
    },
    update: {
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: encryptToken(token.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      grantedScopes: token.scope.split(" "),
    },
  });
  await createSession(user.id);
  const response = NextResponse.redirect(new URL("/?spotify=connected", base));
  response.cookies.delete("spotify_oauth_state");
  response.cookies.delete("spotify_pkce_verifier");
  return response;
}

