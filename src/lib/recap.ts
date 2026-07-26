import { prisma } from "@/lib/prisma";

export async function buildRecapPayload(albumId: string, userId?: string) {
  const album = await prisma.dailyAlbum.findFirst({
    where: { id: albumId, ...(userId ? { userId } : {}) },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          track: {
            include: {
              album: true,
              artists: { orderBy: { position: "asc" }, include: { artist: true } },
            },
          },
          listeningEvent: { include: { location: true } },
          diaryEntry: {
            include: {
              location: true,
              mediaAssets: { where: { mediaType: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!album) return null;
  const places = new Set<string>();
  let durationMs = 0;
  const items = album.items.map((item) => {
    const location = item.diaryEntry?.location ?? item.listeningEvent?.location ?? null;
    if (location) places.add(`${location.latitude}:${location.longitude}`);
    durationMs += item.track.durationMs;
    const occurredAt = item.diaryEntry?.occurredAt ?? item.listeningEvent?.playedAt ?? album.albumDate;
    return {
      id: item.id,
      title: item.track.title,
      artist: item.track.artists.map(({ artist }) => artist.name).join(", "),
      coverUrl: item.track.album?.coverImageUrl ?? null,
      occurredAt: occurredAt.toISOString(),
      caption: item.caption,
      photoAssetId: item.diaryEntry?.mediaAssets[0]?.id ?? null,
      location: location ? {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        placeLabel: location.placeLabel,
        neighborhood: location.neighborhood,
        city: location.city,
      } : null,
    };
  });
  return {
    id: album.id,
    date: album.albumDate.toISOString().slice(0, 10),
    title: album.title,
    summary: album.summary,
    status: album.status,
    moments: items.length,
    stats: {
      plays: items.length,
      tracks: new Set(items.map((item) => `${item.title}:${item.artist}`)).size,
      places: places.size,
      durationMinutes: Math.round(durationMs / 60_000),
    },
    items,
  };
}
