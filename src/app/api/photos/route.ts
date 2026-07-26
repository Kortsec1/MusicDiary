import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const photos = await prisma.mediaAsset.findMany({
    where: { userId: user.id, mediaType: "IMAGE", data: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, diaryEntry: { select: { occurredAt: true, track: { select: { title: true } } } } },
  });
  return NextResponse.json({ photos: photos.map((photo) => ({
    id: photo.id, url: `/api/media/${photo.id}`,
    occurredAt: photo.diaryEntry.occurredAt.toISOString(), trackTitle: photo.diaryEntry.track.title,
  })) });
}
