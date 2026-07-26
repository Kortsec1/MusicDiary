import { Prisma, type PrismaClient } from "@prisma/client";
import { mapSpotifyTrack } from "@/lib/spotify/mapper";

type DbClient = Prisma.TransactionClient | PrismaClient;

export async function persistSpotifyTrack(db: DbClient, rawTrack: unknown) {
  const track = mapSpotifyTrack(rawTrack);
  const metadata = track.originalMetadataSnapshot as Prisma.InputJsonValue;
  const album = await db.album.upsert({
    where: { provider_providerAlbumId: { provider: track.provider, providerAlbumId: track.album.providerAlbumId } },
    create: {
      provider: track.provider,
      providerAlbumId: track.album.providerAlbumId,
      title: track.album.title,
      coverImageUrl: track.album.coverImageUrl,
      externalUrl: track.album.externalUrl,
      metadataSnapshot: metadata,
    },
    update: {
      title: track.album.title,
      coverImageUrl: track.album.coverImageUrl,
      externalUrl: track.album.externalUrl,
      metadataSnapshot: metadata,
    },
  });
  const savedTrack = await db.track.upsert({
    where: { provider_providerTrackId: { provider: track.provider, providerTrackId: track.providerTrackId } },
    create: {
      provider: track.provider,
      providerTrackId: track.providerTrackId,
      albumId: album.id,
      uri: track.uri,
      externalUrl: track.externalUrl,
      title: track.title,
      durationMs: track.durationMs,
      explicit: track.explicit,
      metadataSnapshot: metadata,
    },
    update: {
      albumId: album.id,
      title: track.title,
      durationMs: track.durationMs,
      externalUrl: track.externalUrl,
      metadataSnapshot: metadata,
    },
  });
  for (const [position, artist] of track.artists.entries()) {
    const savedArtist = await db.artist.upsert({
      where: { provider_providerArtistId: { provider: track.provider, providerArtistId: artist.providerArtistId } },
      create: {
        provider: track.provider,
        providerArtistId: artist.providerArtistId,
        name: artist.name,
        externalUrl: artist.externalUrl,
        metadataSnapshot: metadata,
      },
      update: { name: artist.name, externalUrl: artist.externalUrl },
    });
    await db.trackArtist.upsert({
      where: { trackId_artistId: { trackId: savedTrack.id, artistId: savedArtist.id } },
      create: { trackId: savedTrack.id, artistId: savedArtist.id, position },
      update: { position },
    });
  }
  return savedTrack;
}
