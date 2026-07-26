import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    connected: Boolean(user?.spotifyConnection),
    configured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    user: user ? { displayName: user.displayName, avatarUrl: user.avatarUrl } : null,
  });
}

