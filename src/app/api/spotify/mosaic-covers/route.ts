import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getSpotifyAccessToken } from "@/lib/spotify/auth";
import { SpotifyClient } from "@/lib/spotify/client";

export const dynamic = "force-dynamic";

type SearchResult = { tracks?: { items?: Array<{ album?: { id?: string; name?: string; images?: Array<{ url: string }> }; artists?: Array<{ name: string }> }> } };

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const spotify = new SpotifyClient(await getSpotifyAccessToken(user.id));
    const queries = ["genre:indie", "genre:jazz", "genre:electronic", "genre:rock", "genre:r-n-b", "genre:classical"];
    const results = await Promise.all(queries.map((query) => spotify.searchTracks<SearchResult>(query)));
    const seen = new Set<string>();
    const covers = results.flatMap((result) => result?.tracks?.items ?? []).flatMap((track) => {
      const album = track.album;
      const url = album?.images?.[0]?.url;
      if (!album?.id || !url || seen.has(album.id)) return [];
      seen.add(album.id);
      return [{ id: album.id, url, title: album.name ?? "Spotify album", artist: track.artists?.map((artist) => artist.name).join(", ") ?? "Spotify" }];
    }).slice(0, 28);
    return NextResponse.json({ covers });
  } catch {
    return NextResponse.json({ error: "Spotify covers are unavailable" }, { status: 502 });
  }
}
