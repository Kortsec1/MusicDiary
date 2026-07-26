import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { syncRecentlyPlayed } from "@/lib/spotify/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await syncRecentlyPlayed(user.id));
  } catch (error) {
    console.error("[spotify-sync]", error);
    return NextResponse.json({ error: "최근 재생 기록을 동기화하지 못했어요." }, { status: 502 });
  }
}
