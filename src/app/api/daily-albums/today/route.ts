import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { buildRecapPayload } from "@/lib/recap";

export const dynamic = "force-dynamic";

const finalizeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().datetime(),
  end: z.string().datetime(),
  summary: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = finalizeSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "잘못된 날짜 범위예요." }, { status: 400 });
  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  const albumDate = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const existingAlbum = await prisma.dailyAlbum.findUnique({
    where: { userId_albumDate: { userId: user.id, albumDate } },
  });
  const existingStats = existingAlbum?.stats && typeof existingAlbum.stats === "object"
    ? existingAlbum.stats as Record<string, unknown>
    : null;
  if (existingAlbum?.status === "FINALIZED" && existingStats?.version === 2) {
    return NextResponse.json({
      album: await buildRecapPayload(existingAlbum.id, user.id),
      alreadyFinalized: true,
    });
  }

  const [entries, events] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { userId: user.id, deletedAt: null, occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.listeningEvent.findMany({
      where: { userId: user.id, playedAt: { gte: start, lt: end } },
      orderBy: { playedAt: "asc" },
    }),
  ]);
  if (!entries.length && !events.length) {
    return NextResponse.json({ error: "정산할 음악 기록이 아직 없어요." }, { status: 409 });
  }

  const timeline: Array<{
    trackId: string;
    listeningEventId?: string;
    diaryEntryId?: string;
    at: Date;
    caption: string | null;
  }> = entries.map((entry) => ({
    trackId: entry.trackId,
    listeningEventId: entry.sourceListeningEventId ?? undefined,
    diaryEntryId: entry.id,
    at: entry.occurredAt,
    caption: entry.note || null,
  }));
  for (const event of events) {
    const matchedMoment = entries.some((entry) =>
      entry.trackId === event.trackId
      && Math.abs(entry.occurredAt.getTime() - event.playedAt.getTime()) <= 120_000,
    );
    if (!matchedMoment) {
      timeline.push({
        trackId: event.trackId,
        listeningEventId: event.id,
        at: event.playedAt,
        caption: null,
      });
    }
  }
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  const uniqueTracks = new Set(timeline.map((item) => item.trackId)).size;
  const album = await prisma.$transaction(async (tx) => {
    const saved = await tx.dailyAlbum.upsert({
      where: { userId_albumDate: { userId: user.id, albumDate } },
      create: {
        userId: user.id,
        albumDate,
        timezone: user.timezone,
        title: "오늘의 사운드트랙",
        subtitle: parsed.data.date,
        summary: parsed.data.summary,
        coverDiaryEntryId: entries.find((entry) => entry.id)?.id,
        status: "FINALIZED",
        finalizedAt: new Date(),
        stats: { version: 2, moments: entries.length, plays: timeline.length, tracks: uniqueTracks },
      },
      update: {
        summary: parsed.data.summary,
        status: "FINALIZED",
        finalizedAt: new Date(),
        stats: { version: 2, moments: entries.length, plays: timeline.length, tracks: uniqueTracks },
      },
    });
    await tx.dailyAlbumItem.deleteMany({ where: { dailyAlbumId: saved.id } });
    if (timeline.length) {
      await tx.dailyAlbumItem.createMany({
        data: timeline.map((item, position) => ({
          dailyAlbumId: saved.id,
          trackId: item.trackId,
          diaryEntryId: item.diaryEntryId,
          listeningEventId: item.listeningEventId,
          position,
          caption: item.caption,
        })),
      });
    }
    return saved;
  });
  return NextResponse.json({ album: await buildRecapPayload(album.id, user.id) });
}
