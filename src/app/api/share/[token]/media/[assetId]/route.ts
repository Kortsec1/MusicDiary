import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ token: string; assetId: string }> }) {
  const { token, assetId } = await context.params;
  const shareTokenHash = createHash("sha256").update(token).digest("hex");
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: assetId,
      diaryEntry: {
        dailyAlbumItems: { some: { dailyAlbum: { shareTokenHash, sharedAt: { not: null } } } },
      },
    },
    select: { data: true, mimeType: true },
  });
  if (!asset?.data) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
