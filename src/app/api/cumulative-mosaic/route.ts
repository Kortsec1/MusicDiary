import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.listeningEvent.findMany({
    where: { userId: user.id },
    orderBy: { playedAt: "asc" },
    select: {
      playedAt: true,
      track: { select: { album: { select: { id: true, title: true, coverImageUrl: true, externalUrl: true } } } },
    },
  });
  const albums = new Map<string, { id: string; title: string; coverUrl: string | null; spotifyUrl: string | null; count: number; firstPlayedAt: string }>();
  events.forEach((event) => {
    const album = event.track.album;
    if (!album) return;
    const current = albums.get(album.id);
    if (current) current.count += 1;
    else albums.set(album.id, {
      id: album.id,
      title: album.title,
      coverUrl: album.coverImageUrl,
      spotifyUrl: album.externalUrl,
      count: 1,
      firstPlayedAt: event.playedAt.toISOString(),
    });
  });
  return NextResponse.json({
    albums: [...albums.values()],
    stats: { albums: albums.size, plays: events.length },
  });
}
