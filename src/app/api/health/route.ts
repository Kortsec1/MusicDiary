import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "daytrack",
    database: process.env.DATABASE_URL ? "configured" : "missing",
    spotify: process.env.SPOTIFY_CLIENT_ID ? "configured" : "demo",
    timestamp: new Date().toISOString(),
  });
}
