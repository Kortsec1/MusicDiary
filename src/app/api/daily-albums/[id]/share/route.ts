import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const album = await prisma.dailyAlbum.findFirst({ where: { id, userId: user.id, status: "FINALIZED" } });
  if (!album) return NextResponse.json({ error: "정산 카드를 찾지 못했어요." }, { status: 404 });
  const token = randomBytes(24).toString("base64url");
  const shareTokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.dailyAlbum.update({
    where: { id },
    data: { shareTokenHash, sharedAt: new Date() },
  });
  return NextResponse.json({ url: `${request.nextUrl.origin}/share/${token}` });
}
