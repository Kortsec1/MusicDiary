import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildRecapPayload } from "@/lib/recap";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const albums = await prisma.dailyAlbum.findMany({
    where: { userId: user.id, status: "FINALIZED" },
    orderBy: { albumDate: "desc" },
    take: 30,
    select: { id: true },
  });
  const recaps = (await Promise.all(albums.map(({ id }) => buildRecapPayload(id, user.id))))
    .filter((recap) => recap !== null);
  return NextResponse.json({ recaps });
}
