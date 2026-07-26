const API_BASE = "https://api.spotify.com/v1";

export class SpotifyClient {
  constructor(private readonly accessToken: string) {}

  async request<T>(path: string, init?: RequestInit, retry = true): Promise<T | null> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
    if (response.status === 204) return null;
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      throw new Error(`SPOTIFY_RATE_LIMIT:${retryAfter}`);
    }
    if (response.status === 401 && retry) throw new Error("SPOTIFY_TOKEN_EXPIRED");
    if (!response.ok) throw new Error(`Spotify request failed (${response.status})`);
    return response.json() as Promise<T>;
  }

  currentPlayback<T>() { return this.request<T>("/me/player/currently-playing"); }
  recentTracks<T>(after?: bigint) { return this.request<T>(`/me/player/recently-played?limit=50${after ? `&after=${after}` : ""}`); }
  searchTracks<T>(query: string) { return this.request<T>(`/search?type=track&limit=10&q=${encodeURIComponent(query)}`); }
  createPrivatePlaylist<T>(userId: string, name: string) {
    return this.request<T>(`/users/${encodeURIComponent(userId)}/playlists`, { method: "POST", body: JSON.stringify({ name, public: false }) });
  }
  addPlaylistItems<T>(playlistId: string, uris: string[]) {
    return this.request<T>(`/playlists/${encodeURIComponent(playlistId)}/items`, { method: "POST", body: JSON.stringify({ uris }) });
  }
}
