import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getSpotifyAccessToken } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ playlistId: z.string().min(1).max(100).optional() });
const REQUIRED_SCOPES = ["playlist-modify-private", "playlist-modify-public"];

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!REQUIRED_SCOPES.every((scope) => user.spotifyConnection?.grantedScopes.includes(scope))) {
    return NextResponse.json({ error: "RECONNECT_REQUIRED" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "잘못된 플레이리스트 요청이에요." }, { status: 400 });
  const { id } = await context.params;
  const album = await prisma.dailyAlbum.findFirst({
    where: { id, userId: user.id, status: "FINALIZED" },
    include: { items: { orderBy: { position: "asc" }, include: { track: true } } },
  });
  if (!album) return NextResponse.json({ error: "정산 카드를 찾지 못했어요." }, { status: 404 });
  const uris = [...new Set(album.items.map((item) => item.track.uri).filter(Boolean))];
  if (!uris.length) return NextResponse.json({ error: "추가할 Spotify 곡이 없어요." }, { status: 409 });
  const token = await getSpotifyAccessToken(user.id);
  let playlistId = parsed.data.playlistId;
  let playlistUrl: string | undefined;
  let playlistName: string | undefined;

  if (!playlistId) {
    const createResponse = await fetch("https://api.spotify.com/v1/me/playlists", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `DAYTRACK · ${album.albumDate.toISOString().slice(0, 10)}`,
        description: "DAYTRACK에서 기록한 오늘의 사운드트랙",
        public: false,
      }),
      cache: "no-store",
    });
    if (!createResponse.ok) return NextResponse.json({ error: "Spotify 플레이리스트를 만들지 못했어요." }, { status: createResponse.status });
    const created = await createResponse.json() as { id: string; name: string; external_urls?: { spotify?: string } };
    playlistId = created.id;
    playlistName = created.name;
    playlistUrl = created.external_urls?.spotify;
  }

  const addResponse = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris }),
    cache: "no-store",
  });
  if (!addResponse.ok) return NextResponse.json({ error: "선택한 플레이리스트에 곡을 추가하지 못했어요." }, { status: addResponse.status });
  if (!parsed.data.playlistId) {
    await prisma.dailyAlbum.update({
      where: { id: album.id },
      data: { spotifyPlaylistId: playlistId, spotifyPlaylistUrl: playlistUrl },
    });
  }
  return NextResponse.json({ playlistId, playlistName, playlistUrl, added: uris.length });
}
