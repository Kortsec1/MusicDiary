import { z } from "zod";

const spotifyTrackSchema = z.object({
  id: z.string(),
  uri: z.string(),
  name: z.string(),
  duration_ms: z.number().int(),
  explicit: z.boolean(),
  external_urls: z.object({ spotify: z.string().url() }),
  album: z.object({
    id: z.string(),
    name: z.string(),
    album_type: z.string(),
    release_date: z.string(),
    images: z.array(z.object({ url: z.string().url(), width: z.number().nullable(), height: z.number().nullable() })),
    external_urls: z.object({ spotify: z.string().url() }),
  }),
  artists: z.array(z.object({ id: z.string(), name: z.string(), external_urls: z.object({ spotify: z.string().url() }) })),
});

export type NormalizedTrack = {
  provider: "spotify";
  providerTrackId: string;
  uri: string;
  externalUrl: string;
  title: string;
  durationMs: number;
  explicit: boolean;
  album: { providerAlbumId: string; title: string; coverImageUrl: string | null; externalUrl: string };
  artists: Array<{ providerArtistId: string; name: string; externalUrl: string }>;
  originalMetadataSnapshot: unknown;
};

export function mapSpotifyTrack(input: unknown): NormalizedTrack {
  const track = spotifyTrackSchema.parse(input);
  return {
    provider: "spotify",
    providerTrackId: track.id,
    uri: track.uri,
    externalUrl: track.external_urls.spotify,
    title: track.name,
    durationMs: track.duration_ms,
    explicit: track.explicit,
    album: {
      providerAlbumId: track.album.id,
      title: track.album.name,
      coverImageUrl: track.album.images[0]?.url ?? null,
      externalUrl: track.album.external_urls.spotify,
    },
    artists: track.artists.map((artist) => ({ providerArtistId: artist.id, name: artist.name, externalUrl: artist.external_urls.spotify })),
    originalMetadataSnapshot: input,
  };
}
