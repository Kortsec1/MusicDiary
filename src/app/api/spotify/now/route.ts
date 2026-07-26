import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getSpotifyAccessToken } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const token = await getSpotifyAccessToken(user.id);
    const current = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (current.status === 204) return NextResponse.json({ playing: false, track: null });
    if (!current.ok) throw new Error(`Spotify playback request failed (${current.status})`);
    const payload = await current.json();
    return NextResponse.json({
      playing: Boolean(payload.is_playing),
      progressMs: payload.progress_ms,
      track: payload.item ? {
        title: payload.item.name,
        artist: payload.item.artists?.map((artist: { name: string }) => artist.name).join(", "),
        album: payload.item.album?.name,
        coverUrl: payload.item.album?.images?.[0]?.url,
        durationMs: payload.item.duration_ms,
        spotifyUrl: payload.item.external_urls?.spotify,
      } : null,
    });
  } catch {
    return NextResponse.json({ error: "Spotify playback unavailable" }, { status: 502 });
  }
}

