import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSpotifyAccessToken } from "@/lib/spotify/auth";
import { persistSpotifyTrack } from "@/lib/spotify/persist";

type RecentTrack = {
  played_at: string;
  context?: unknown;
  track: { id: string };
};

type RecentResponse = {
  items: RecentTrack[];
  cursors?: { after?: string };
};

export async function syncRecentlyPlayed(userId: string) {
  const state = await prisma.spotifySyncState.findUnique({ where: { userId } });
  const after = state?.recentlyPlayedAfterMs ?? BigInt(0);
  const token = await getSpotifyAccessToken(userId);
  const url = new URL("https://api.spotify.com/v1/me/player/recently-played");
  url.searchParams.set("limit", "50");
  if (after > BigInt(0)) url.searchParams.set("after", after.toString());

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Spotify recent playback failed (${response.status})`);
  const payload = await response.json() as RecentResponse;
  let newest = after;
  let added = 0;

  for (const item of payload.items ?? []) {
    const playedAt = new Date(item.played_at);
    if (Number.isNaN(playedAt.getTime()) || !item.track?.id) continue;
    const track = await persistSpotifyTrack(prisma, item.track);
    const dedupeKey = `spotify:${userId}:${item.track.id}:${playedAt.toISOString()}`;
    const result = await prisma.listeningEvent.upsert({
      where: { dedupeKey },
      create: {
        userId,
        trackId: track.id,
        source: "AUTO_RECENT",
        playedAt,
        dedupeKey,
        rawMetadata: item as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });
    if (result.createdAt.getTime() === result.capturedAt.getTime()) added += 1;
    newest = newest > BigInt(playedAt.getTime()) ? newest : BigInt(playedAt.getTime());
  }

  if (payload.cursors?.after) {
    const cursor = BigInt(payload.cursors.after);
    newest = cursor > newest ? cursor : newest;
  }
  await prisma.spotifySyncState.upsert({
    where: { userId },
    create: { userId, recentlyPlayedAfterMs: newest, lastSuccessfulSyncAt: new Date(), lastPollAt: new Date() },
    update: { recentlyPlayedAfterMs: newest, lastSuccessfulSyncAt: new Date(), lastPollAt: new Date(), backoffUntil: null },
  });
  return { added, received: payload.items?.length ?? 0, cursor: newest.toString() };
}
