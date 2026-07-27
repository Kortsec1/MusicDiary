/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image elements. */
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const events = await prisma.listeningEvent.findMany({
    where: { userId: user.id }, orderBy: { playedAt: "asc" },
    select: { playedAt: true, track: { select: { album: { select: { id: true, coverImageUrl: true } } } } },
  });
  const albums = new Map<string, { id: string; coverUrl: string | null; count: number }>();
  events.forEach((event) => {
    const album = event.track.album;
    if (!album) return;
    const current = albums.get(album.id);
    if (current) current.count += 1;
    else albums.set(album.id, { id: album.id, coverUrl: album.coverImageUrl, count: 1 });
  });
  const source = [...albums.values()];
  let seed = source.length * 17;
  source.sort(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - .5; });
  const size = 24;
  const occupied = Array.from({ length: size }, () => Array(size).fill(false));
  const placed: Array<{ id: string; coverUrl: string | null; x: number; y: number; span: number }> = [];
  source.forEach((album) => {
    let span = album.count >= 18 ? 3 : album.count >= 7 ? 2 : 1;
    let position: { x: number; y: number } | null = null;
    while (!position && span > 0) {
      for (let y = 0; y <= size - span && !position; y += 1) for (let x = 0; x <= size - span && !position; x += 1) {
        let free = true;
        for (let row = y; row < y + span; row += 1) for (let column = x; column < x + span; column += 1) if (occupied[row][column]) free = false;
        if (free) position = { x, y };
      }
      if (!position) span -= 1;
    }
    if (!position || !span) return;
    for (let row = position.y; row < position.y + span; row += 1) for (let column = position.x; column < position.x + span; column += 1) occupied[row][column] = true;
    placed.push({ ...album, ...position, span });
  });
  if (source.length) {
    let fillIndex = 0;
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      if (occupied[y][x]) continue;
      const album = source[fillIndex % source.length];
      fillIndex += 1;
      placed.push({ id: `${album.id}-fill-${x}-${y}`, coverUrl: album.coverUrl, x, y, span: 1 });
    }
  }
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#171714", overflow: "hidden" }}>
      {placed.map((album) => <div key={album.id} style={{ position: "absolute", display: "flex", left: `${album.x * (100 / size)}%`, top: `${album.y * (100 / size)}%`, width: `${album.span * (100 / size)}%`, height: `${album.span * (100 / size)}%`, overflow: "hidden", background: "#171714" }}>
        {album.coverUrl ? <img src={album.coverUrl} alt="" width="100%" height="100%" style={{ objectFit: "contain", background: "#171714" }} /> : null}
      </div>)}
    </div>,
    { width: 1080, height: 1080, headers: { "Content-Disposition": "attachment; filename=daytrack-cumulative-albums.png" } },
  );
}
