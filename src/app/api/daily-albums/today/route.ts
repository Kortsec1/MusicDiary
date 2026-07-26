import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

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
  if (!parsed.success) return NextResponse.json({ error: "Invalid recap" }, { status: 400 });

  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      occurredAt: { gte: new Date(parsed.data.start), lt: new Date(parsed.data.end) },
    },
    orderBy: { occurredAt: "asc" },
  });
  if (!entries.length) return NextResponse.json({ error: "정산할 기록이 아직 없습니다." }, { status: 409 });

  const uniqueTracks = new Set(entries.map((entry) => entry.trackId)).size;
  const albumDate = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const album = await prisma.$transaction(async (tx) => {
    const saved = await tx.dailyAlbum.upsert({
      where: { userId_albumDate: { userId: user.id, albumDate } },
      create: {
        userId: user.id,
        albumDate,
        timezone: user.timezone,
        title: `${parsed.data.date}의 음악 지도`,
        summary: parsed.data.summary,
        status: "FINALIZED",
        finalizedAt: new Date(),
        stats: { moments: entries.length, tracks: uniqueTracks },
      },
      update: {
        summary: parsed.data.summary,
        status: "FINALIZED",
        finalizedAt: new Date(),
        stats: { moments: entries.length, tracks: uniqueTracks },
      },
    });
    await tx.dailyAlbumItem.deleteMany({ where: { dailyAlbumId: saved.id } });
    await tx.dailyAlbumItem.createMany({
      data: entries.map((entry, position) => ({
        dailyAlbumId: saved.id,
        trackId: entry.trackId,
        diaryEntryId: entry.id,
        position,
        caption: entry.note || null,
      })),
    });
    return saved;
  });
  return NextResponse.json({
    album: { id: album.id, status: album.status, moments: entries.length, tracks: uniqueTracks },
  });
}
