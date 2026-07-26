"use client";

import { useEffect, useRef, useState } from "react";

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

const SEOUL = { latitude: 37.5665, longitude: 126.978 };

export function DayMap({ moments, currentLocation }: {
  moments: MapMoment[];
  currentLocation?: { latitude: number; longitude: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const currentLatitude = currentLocation?.latitude;
  const currentLongitude = currentLocation?.longitude;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let map: import("leaflet").Map | null = null;

    void import("leaflet").then((L) => {
      if (disposed || !containerRef.current) return;
      const located = moments.filter((moment) => moment.location);
      const hasCurrentLocation = currentLatitude !== undefined && currentLongitude !== undefined;
      const center = hasCurrentLocation
        ? { latitude: currentLatitude, longitude: currentLongitude }
        : located.at(-1)?.location ?? SEOUL;

      map = L.map(containerRef.current, {
        center: [center.latitude, center.longitude],
        zoom: 15,
        zoomControl: true,
        attributionControl: true,
      });
      const tiles = L.tileLayer(
        "/api/map/tiles/{z}/{y}/{x}",
        {
          minZoom: 6,
          maxZoom: 19,
          tileSize: 256,
          attribution: "© 국토교통부 VWorld",
        },
      );
      let tileErrors = 0;
      tiles.on("load", () => setMapStatus("ready"));
      tiles.on("tileerror", () => {
        tileErrors += 1;
        if (tileErrors >= 3) setMapStatus("error");
      });
      tiles.addTo(map);

      const coordinates = located.map((moment) => [
        moment.location!.latitude,
        moment.location!.longitude,
      ] as [number, number]);

      if (coordinates.length > 1) {
        L.polyline(coordinates, { color: "#8c2f39", weight: 4, opacity: 0.82 }).addTo(map);
        map.fitBounds(L.latLngBounds(coordinates).pad(0.18), { maxZoom: 16 });
      }

      located.forEach((moment, index) => {
        const marker = L.marker(
          [moment.location!.latitude, moment.location!.longitude],
          {
            icon: L.divIcon({
              className: "daytrack-leaflet-marker",
              html: `<span><b>${index + 1}</b></span>`,
              iconSize: [34, 42],
              iconAnchor: [17, 40],
              popupAnchor: [0, -36],
            }),
          },
        );
        const time = new Date(moment.occurredAt).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const popup = document.createElement("div");
        popup.className = "map-popup";
        const strong = document.createElement("strong");
        strong.textContent = moment.title;
        const artist = document.createElement("span");
        artist.textContent = moment.artist;
        const detail = document.createElement("small");
        detail.textContent = `${moment.location!.placeLabel || "저장한 위치"} · ${time}`;
        popup.append(strong, artist, detail);
        marker.bindPopup(popup).addTo(map!);
      });

      if (hasCurrentLocation) {
        L.circleMarker([currentLatitude, currentLongitude], {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: "#246bfd",
          fillOpacity: 1,
        }).bindTooltip("현재 위치", { direction: "top" }).addTo(map);
      }

      window.setTimeout(() => map?.invalidateSize(), 0);
    });

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [currentLatitude, currentLongitude, moments]);

  return (
    <div className="day-map-shell">
      <div ref={containerRef} className="day-map" aria-label="오늘 기록 지도" />
      {mapStatus === "loading" ? <div className="map-status">한국 지도 불러오는 중…</div> : null}
      {mapStatus === "error" ? <div className="map-status map-status-error">지도를 불러오지 못했어요. 화면을 새로고침해 주세요.</div> : null}
    </div>
  );
}
