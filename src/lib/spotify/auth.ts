import { decryptToken, encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

export function spotifyRedirectUri() {
  return process.env.SPOTIFY_REDIRECT_URI
    || `${process.env.APP_BASE_URL || "http://127.0.0.1:3000"}/api/auth/spotify/callback`;
}

function credentials() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify credentials are not configured");
  return { id, secret };
}

export async function getSpotifyAccessToken(userId: string) {
  const connection = await prisma.spotifyConnection.findUnique({ where: { userId } });
  if (!connection) throw new Error("Spotify is not connected");
  if (connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptToken(connection.encryptedAccessToken);
  }

  const { id, secret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptToken(connection.encryptedRefreshToken),
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Spotify token refresh failed (${response.status})`);
  const token = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  await prisma.spotifyConnection.update({
    where: { userId },
    data: {
      encryptedAccessToken: encryptToken(token.access_token),
      encryptedRefreshToken: token.refresh_token
        ? encryptToken(token.refresh_token)
        : connection.encryptedRefreshToken,
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      grantedScopes: token.scope?.split(" ") || connection.grantedScopes,
    },
  });
  return token.access_token;
}
