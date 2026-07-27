"use client";

import Image from "next/image";
import { Disc3, Grid3X3, ImageDown, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CumulativeAlbum = { id: string; title: string; coverUrl: string | null; spotifyUrl: string | null; count: number; firstPlayedAt: string };
type CumulativePayload = { albums: CumulativeAlbum[]; stats: { albums: number; plays: number } };

export function CumulativeMosaic({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<CumulativePayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/cumulative-mosaic", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<CumulativePayload> : Promise.reject())
      .then((payload) => { if (alive) setData(payload); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const tiles = useMemo(() => {
    if (!data?.albums.length) return [];
    let seed = data.albums.length * 17;
    const shuffled = [...data.albums].sort((a, b) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed / 4294967296) - .5 || a.firstPlayedAt.localeCompare(b.firstPlayedAt);
    });
    return shuffled;
  }, [data]);
  const gridSize = Math.min(24, Math.max(8, Math.ceil(Math.sqrt(tiles.length * 1.25))));

  async function saveArtwork() {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await fetch("/api/cumulative-mosaic/poster");
      if (!response.ok) throw new Error("poster failed");
      const blob = await response.blob();
      const file = new File([blob], "daytrack-cumulative-albums.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "나의 누적 앨범 모자이크" }); return; }
        catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } finally {
      setExporting(false);
    }
  }

  if (!data && !failed) return <section className={`cumulative-mosaic cumulative-loading ${compact ? "compact" : ""}`}><LoaderCircle className="spin-icon" /><span>나의 모든 앨범을 모으는 중</span></section>;
  if (failed) return <section className={`cumulative-mosaic cumulative-error ${compact ? "compact" : ""}`}><Grid3X3 /><div><strong>누적 앨범 작품을 불러오지 못했어요</strong><span>연결을 확인한 뒤 화면을 한 번 새로고침해 주세요.</span></div></section>;
  return <section className={`cumulative-mosaic ${compact ? "compact" : ""}`} aria-label="누적 앨범 모자이크">
    <div className="cumulative-mosaic-head"><div><span>{compact ? "HOME WIDGET" : "LIFELONG LISTENING"}</span><h2>{compact ? "내 앨범의 벽" : "나의 누적 앨범 모자이크"}</h2></div>{compact ? <Grid3X3 /> : <button type="button" onClick={saveArtwork} disabled={exporting}>{exporting ? <><LoaderCircle className="spin-icon" />작품 준비 중</> : <><ImageDown />작품 저장</>}</button>}</div>
    <p>{data!.stats.albums ? `${data!.stats.albums}장의 앨범 · ${data!.stats.plays}번의 재생` : "Spotify에서 들은 음악이 쌓이면 이 작품도 함께 자라요."}</p>
    <div className="cumulative-mosaic-grid" style={{ "--mosaic-grid": gridSize } as React.CSSProperties}>
      {tiles.map((album) => {
        const size = album.count >= 18 ? "hero" : album.count >= 7 ? "medium" : "";
        const body = album.coverUrl ? <Image src={album.coverUrl} alt={`${album.title} 앨범 커버`} fill sizes="96px" /> : <Disc3 />;
        return album.spotifyUrl ? <a className={`cumulative-tile ${size}`} key={album.id} href={album.spotifyUrl} target="_blank" rel="noreferrer" aria-label={`${album.title}, ${album.count}회 재생`}>{body}</a> : <span className={`cumulative-tile ${size}`} key={album.id}>{body}</span>;
      })}
    </div>
    {!compact ? <small>같은 앨범은 한 장으로 합쳐지고, 오래 반복한 앨범일수록 더 큰 면적을 차지합니다.</small> : null}
  </section>;
}
