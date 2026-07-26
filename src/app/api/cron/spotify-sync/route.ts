import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRecentlyPlayed } from "@/lib/spotify/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connections = await prisma.spotifyConnection.findMany({ select: { userId: true } });
  const results = [];
  for (const { userId } of connections) {
    try {
      results.push({ userId, ok: true, ...(await syncRecentlyPlayed(userId)) });
    } catch (error) {
      console.error("[cron-spotify-sync]", userId, error);
      results.push({ userId, ok: false });
    }
  }
  return NextResponse.json({ synced: results.filter((item) => item.ok).length, total: results.length });
}
