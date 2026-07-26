import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let database: "connected" | "unavailable" | "missing" = "missing";

  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "connected";
    } catch {
      database = "unavailable";
    }
  }

  const status = database === "unavailable" ? "degraded" : "ok";
  return NextResponse.json(
    {
      status,
      service: "daytrack",
      database,
      spotify: process.env.SPOTIFY_CLIENT_ID ? "configured" : "demo",
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
