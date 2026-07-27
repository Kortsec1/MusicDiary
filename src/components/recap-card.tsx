"use client";

import { Clock3, Disc3, ImageDown, ListMusic, MapPin, Music2, Repeat2, Share2, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { DayMap } from "@/components/day-map";

export type Recap = {
  id: string;
  date: string;
  title: string;
  summary: string | null;
  moments: number;
  stats: { moments: number; plays: number; tracks: number; places: number; durationMinutes: number };
  items: Array<{
    id: string;
    title: string;
    artist: string;
    albumTitle: string;
    coverUrl: string | null;
    spotifyUrl: string;
    uri: string;
    occurredAt: string;
    caption: string | null;
    isMoment: boolean;
    photoAssetId: string | null;
    location: {
      latitude: number;
      longitude: number;
      placeLabel: string | null;
      neighborhood: string | null;
      city: string | null;
    } | null;
  }>;
};

export function RecapCard({ recap, publicToken, onClose, onShare, onSaveImage, onSaveArtwork, onPlaylist }: {
  recap: Recap;
  publicToken?: string;
  onClose?: () => void;
  onShare?: () => void;
  onSaveImage?: () => void;
  onSaveArtwork?: () => void;
  onPlaylist?: () => void;
}) {
  const located = useMemo(() => recap.items.filter((item) => item.location), [recap.items]);
  const photo = recap.items.find((item) => item.photoAssetId);
  const story = useMemo(() => {
    const counts = new Map<string, number>();
    recap.items.forEach((item) => counts.set(item.title, (counts.get(item.title) ?? 0) + 1));
    const repeated = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const hours = recap.items.map((item) => new Date(item.occurredAt).getHours());
    const average = hours.length ? hours.reduce((sum, hour) => sum + hour, 0) / hours.length : 12;
    const character = average >= 20 ? "밤의 산책자" : average >= 16 ? "해질녘 수집가" : average >= 12 ? "오후의 탐험가" : "아침의 선곡가";
    const first = recap.items.at(0);
    const last = recap.items.at(-1);
    return { repeated, character, first, last };
  }, [recap.items]);
  const albums = useMemo(() => {
    const grouped = new Map<string, { title: string; coverUrl: string | null; count: number; spotifyUrl: string }>();
    recap.items.forEach((item) => {
      const key = `${item.albumTitle}:${item.coverUrl ?? ""}`;
      const current = grouped.get(key);
      if (current) current.count += 1;
      else grouped.set(key, { title: item.albumTitle, coverUrl: item.coverUrl, count: 1, spotifyUrl: item.spotifyUrl });
    });
    return [...grouped.values()];
  }, [recap.items]);
  const mosaicTiles = useMemo(() => {
    if (!albums.length) return [];
    let seed = [...recap.date].reduce((value, character) => value * 31 + character.charCodeAt(0), 17) >>> 0;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const chronological = recap.items.map((item) =>
      albums.find((entry) => entry.title === item.albumTitle && entry.coverUrl === item.coverUrl)
      ?? { title: item.albumTitle, coverUrl: item.coverUrl, count: 1, spotifyUrl: item.spotifyUrl });
    const featured = albums.map((album) => ({ ...album, featured: true }));
    for (let index = featured.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [featured[index], featured[swap]] = [featured[swap], featured[index]];
    }
    const fillers = Array.from({ length: 80 }, (_, index) => ({
      ...chronological[index % chronological.length],
      featured: false,
    }));
    return [...featured, ...fillers];
  }, [albums, recap.date, recap.items]);
  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long", day: "numeric", weekday: "long", timeZone: "UTC",
  }).format(new Date(`${recap.date}T12:00:00Z`));
  const photoUrl = photo?.photoAssetId
    ? publicToken
      ? `/api/share/${publicToken}/media/${photo.photoAssetId}`
      : `/api/media/${photo.photoAssetId}`
    : null;

  return (
    <article className="recap-sheet">
      <header className="recap-head">
        <div><p>{dateLabel} · DAY / TRACK</p><h1>{recap.title}</h1><span className="recap-issue">ISSUE {recap.date.replaceAll("-", ".")}</span></div>
        {onClose ? <button className="recap-close" onClick={onClose} aria-label="정산 카드 닫기"><X /></button> : null}
      </header>
      <div className="recap-map"><DayMap moments={located} /></div>
      <section className="keepsake-card">
        <div className="cover-collage">
          {recap.items.slice(0, 3).map((item, index) => (
            <div className={`recap-cover recap-cover-${index + 1}`} key={item.id}>
              {item.coverUrl ? <Image src={item.coverUrl} alt="" fill sizes="120px" /> : <Disc3 />}
            </div>
          ))}
          {photoUrl ? <div className="recap-photo">
            {/* Shared/private authenticated media routes intentionally bypass the public image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="오늘의 사진" />
          </div> : null}
        </div>
        <blockquote>“{recap.summary || "좋아하는 음악과 함께 지나온 오늘의 장면들."}”</blockquote>
        <div className="recap-stats">
          <div><Music2 /><b>{recap.stats.tracks}</b><span>곡</span></div>
          <div><MapPin /><b>{recap.stats.places}</b><span>곳</span></div>
          <div><Clock3 /><b>{recap.stats.durationMinutes}</b><span>분</span></div>
        </div>
      </section>
      <section className="recap-story">
        <div><Sparkles /><span>오늘의 캐릭터</span><strong>{story.character}</strong></div>
        <div><Repeat2 /><span>{story.repeated?.[1] && story.repeated[1] > 1 ? "오늘의 반복곡" : "오늘의 대표곡"}</span><strong>{story.repeated?.[0] || "첫 번째 음악"}</strong></div>
        <div><Clock3 /><span>음악이 흐른 시간</span><strong>{story.first && story.last ? `${new Date(story.first.occurredAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} — ${new Date(story.last.occurredAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` : "오늘"}</strong></div>
      </section>
      <section className="album-mosaic-section">
        <div className="album-mosaic-head"><div><span>LISTENING FREQUENCY</span><h2>오늘의 앨범 모자이크</h2></div>{onSaveArtwork ? <button onClick={onSaveArtwork}><ImageDown />작품 저장</button> : null}</div>
        <div className="album-mosaic" style={{ "--album-count": albums.length } as React.CSSProperties}>
          {mosaicTiles.map((album, index) => (
            <a
              className={`album-tile ${album.featured && album.count >= 4 ? "album-tile-hero" : album.featured && album.count >= 2 ? "album-tile-medium" : ""}`}
              href={album.spotifyUrl}
              target="_blank"
              rel="noreferrer"
              key={`${album.title}-${index}`}
              aria-label={`${album.title}, ${album.count}회 재생, Spotify에서 열기`}
            >
              {album.coverUrl ? <Image src={album.coverUrl} alt={`${album.title} 앨범 커버`} fill sizes="(max-width: 620px) 45vw, 220px" /> : <span><Disc3 /></span>}
            </a>
          ))}
        </div>
        <div className="album-mosaic-time">
          <time>{recap.items[0] ? new Date(recap.items[0].occurredAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</time>
          <span>{recap.items.slice(0, 18).map((item) => <i key={item.id} title={item.title} />)}</span>
          <time>{recap.items.at(-1) ? new Date(recap.items.at(-1)!.occurredAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</time>
        </div>
        <div className="album-mosaic-legend" aria-hidden="true">
          {albums.slice(0, 4).map((album) => <span key={album.title}><b>{album.count}×</b>{album.title}</span>)}
        </div>
        <p>많이 들은 앨범일수록 더 큰 면적을 차지해요. 커버를 누르면 Spotify에서 열립니다.</p>
      </section>
      <section className="recap-timeline">
        {recap.items.map((item, index) => (
          <div className="recap-row" key={item.id}>
            <span className="recap-number">{index + 1}</span>
            <time>{new Date(item.occurredAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time>
            <div className="recap-mini-cover">{item.coverUrl ? <Image src={item.coverUrl} alt="" fill sizes="52px" /> : <Disc3 />}</div>
            <div><strong>{item.title}</strong><small>{item.artist}</small>{item.location ? <em><MapPin />{item.location.placeLabel || item.location.neighborhood || "기록한 장소"}</em> : null}</div>
          </div>
        ))}
      </section>
      {onShare || onSaveImage || onPlaylist ? <div className="recap-actions">
        {onSaveImage ? <button onClick={onSaveImage}><ImageDown /><span>이미지</span></button> : null}
        {onPlaylist ? <button onClick={onPlaylist}><ListMusic /><span>Spotify</span></button> : null}
        {onShare ? <button onClick={onShare}><Share2 /><span>공유</span></button> : null}
      </div> : null}
      <footer className="recap-brand">DAYTRACK · 나의 하루를 음악으로</footer>
    </article>
  );
}
