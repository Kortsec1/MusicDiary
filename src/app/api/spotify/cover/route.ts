import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";
const allowedHosts = new Set(["i.scdn.co", "mosaic.scdn.co"]);

export async function GET(request: Request) {
  if (!await getSessionUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Missing URL" }, { status: 400 });
  let target: URL;
  try { target = new URL(raw); } catch { return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); }
  if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  const response = await fetch(target, { signal: AbortSignal.timeout(8_000) });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) return NextResponse.json({ error: "Image unavailable" }, { status: 502 });
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 5_000_000) return NextResponse.json({ error: "Image too large" }, { status: 413 });
  return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
