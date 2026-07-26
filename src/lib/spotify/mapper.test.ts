import { describe, expect, it } from "vitest";
import { mapSpotifyTrack } from "./mapper";

describe("SpotifyMapper", () => {
  it("normalizes a Spotify track response", () => {
    const track = mapSpotifyTrack({
      id: "track-1", uri: "spotify:track:track-1", name: "Midnight City", duration_ms: 243000, explicit: false,
      external_urls: { spotify: "https://open.spotify.com/track/track-1" },
      album: { id: "album-1", name: "Hurry Up", album_type: "album", release_date: "2011", images: [], external_urls: { spotify: "https://open.spotify.com/album/album-1" } },
      artists: [{ id: "artist-1", name: "M83", external_urls: { spotify: "https://open.spotify.com/artist/artist-1" } }],
    });
    expect(track.providerTrackId).toBe("track-1");
    expect(track.album.coverImageUrl).toBeNull();
    expect(track.artists[0]?.name).toBe("M83");
  });
});
