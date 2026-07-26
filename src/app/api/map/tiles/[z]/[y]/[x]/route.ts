import { NextResponse } from "next/server";

const TILE_PATTERN = /^\d+$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; y: string; x: string }> },
) {
  const { z, y, x } = await context.params;
  if (![z, y, x].every((value) => TILE_PATTERN.test(value))) {
    return NextResponse.json({ error: "Invalid tile" }, { status: 400 });
  }
  const zoom = Number(z);
  if (zoom < 6 || zoom > 19) {
    return NextResponse.json({ error: "Unsupported zoom" }, { status: 400 });
  }

  const key = process.env.VWORLD_API_KEY;
  if (!key) return NextResponse.json({ error: "Map is not configured" }, { status: 503 });

  const tileUrl = `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(key)}/Base/${z}/${y}/${x}.png`;
  const response = await fetch(tileUrl, {
    headers: {
      Referer: `${process.env.APP_BASE_URL || "https://daytrack-nine.vercel.app"}/`,
      "User-Agent": "DAYTRACK/1.0 (+https://daytrack-nine.vercel.app)",
    },
    next: { revalidate: 86_400 },
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    console.error("map.tile.failed", { status: response.status, z, y, x });
    return NextResponse.json({ error: "Map tile unavailable" }, { status: 502 });
  }

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
