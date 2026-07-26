import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getSpotifyAccessToken } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

const REQUIRED_SCOPE = "playlist-read-private";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.spotifyConnection?.grantedScopes.includes(REQUIRED_SCOPE)) {
    return NextResponse.json({ error: "RECONNECT_REQUIRED" }, { status: 403 });
  }
  const token = await getSpotifyAccessToken(user.id);
  const response = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ error: "Spotify 플레이리스트를 불러오지 못했어요." }, { status: response.status });
  const payload = await response.json() as {
    items: Array<{ id: string; name: string; public: boolean | null; collaborative: boolean; images?: Array<{ url: string }>; items?: { total: number }; tracks?: { total: number } }>;
  };
  return NextResponse.json({
    playlists: payload.items.map((item) => ({
      id: item.id,
      name: item.name,
      public: item.public,
      collaborative: item.collaborative,
      imageUrl: item.images?.[0]?.url ?? null,
      total: item.items?.total ?? item.tracks?.total ?? 0,
    })),
  });
}
