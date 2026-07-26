import { z } from "zod";

const spotifyTrackSchema = z.object({
  id: z.string(),
  uri: z.string().optional(),
  name: z.string(),
  duration_ms: z.number().int(),
  explicit: z.boolean().default(false),
  external_urls: z.object({ spotify: z.string().url().optional() }).optional(),
  album: z.object({
    id: z.string(),
    name: z.string(),
    images: z.array(z.object({ url: z.string().url(), width: z.number().nullable().optional(), height: z.number().nullable().optional() })).default([]),
    external_urls: z.object({ spotify: z.string().url().optional() }).optional(),
  }),
  artists: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    external_urls: z.object({ spotify: z.string().url().optional() }).optional(),
  })).min(1),
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
    uri: track.uri ?? `spotify:track:${track.id}`,
    externalUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
    title: track.name,
    durationMs: track.duration_ms,
    explicit: track.explicit,
    album: {
      providerAlbumId: track.album.id,
      title: track.album.name,
      coverImageUrl: track.album.images[0]?.url ?? null,
      externalUrl: track.album.external_urls?.spotify ?? `https://open.spotify.com/album/${track.album.id}`,
    },
    artists: track.artists.map((artist, index) => ({
      providerArtistId: artist.id ?? `${track.id}:artist:${index}`,
      name: artist.name,
      externalUrl: artist.external_urls?.spotify ?? "",
    })),
    originalMetadataSnapshot: input,
  };
}
