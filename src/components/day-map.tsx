"use client";

export type MapMoment = {
  id: string;
  title: string;
  artist: string;
  occurredAt: string;
  location: {
    latitude: number;
    longitude: number;
    placeLabel: string | null;
    neighborhood: string | null;
    city: string | null;
  } | null;
};

export function DayMap({ moments, currentLocation }: {
  moments: MapMoment[];
  currentLocation?: { latitude: number; longitude: number } | null;
}) {
  const located = moments.filter((moment) => moment.location);
  const points = located.map((moment) => ({
    latitude: moment.location!.latitude,
    longitude: moment.location!.longitude,
  }));
  if (!points.length && currentLocation) points.push(currentLocation);
  if (!points.length) points.push({ latitude: 37.5665, longitude: 126.978 });

  const zoom = 13;
  const scale = 2 ** zoom;
  const toTile = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
    const sin = Math.sin((latitude * Math.PI) / 180);
    return {
      x: ((longitude + 180) / 360) * scale,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
    };
  };
  const tiledPoints = points.map(toTile);
  const centerX = tiledPoints.reduce((sum, point) => sum + point.x, 0) / tiledPoints.length;
  const centerY = tiledPoints.reduce((sum, point) => sum + point.y, 0) / tiledPoints.length;
  const leftTile = Math.floor(centerX) - 1;
  const topTile = Math.floor(centerY) - 1;
  const projected = located.map((moment) => {
    const tile = toTile(moment.location!);
    return {
      moment,
      x: ((tile.x - leftTile) / 3) * 100,
      y: ((tile.y - topTile) / 3) * 100,
    };
  });
  const route = projected.map((point) => `${point.x},${point.y}`).join(" ");
  const tiles = Array.from({ length: 9 }, (_, index) => ({
    x: leftTile + (index % 3),
    y: topTile + Math.floor(index / 3),
    index,
  }));

  return (
    <div className="day-map" aria-label="오늘 기록 지도">
      <div className="map-tile-grid">
        {tiles.map((tile) => (
          // OpenStreetMap tiles are map data, not decorative app imagery.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tile.x}-${tile.y}`}
            src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
            alt=""
            onLoad={(event) => { event.currentTarget.style.opacity = "1"; }}
            onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
          />
        ))}
      </div>
      <svg className="map-route-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {projected.length > 1 ? <polyline points={route} /> : null}
      </svg>
      <div className="map-pins" aria-hidden="true">
        {projected.map(({ moment, x, y }, index) => (
          <span className="map-pin" style={{ left: `${x}%`, top: `${y}%` }} key={moment.id}>
            <b>{index + 1}</b>
          </span>
        ))}
      </div>
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
    </div>
  );
}
