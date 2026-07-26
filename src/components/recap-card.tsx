"use client";

import { Clock3, Disc3, MapPin, Music2, Share2, X } from "lucide-react";
import Image from "next/image";
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
    coverUrl: string | null;
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

export function RecapCard({ recap, publicToken, onClose, onShare }: {
  recap: Recap;
  publicToken?: string;
  onClose?: () => void;
  onShare?: () => void;
}) {
  const located = recap.items.filter((item) => item.location);
  const photo = recap.items.find((item) => item.photoAssetId);
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
      {onShare ? <div className="recap-actions"><button onClick={onShare}><Share2 />공유하기</button></div> : null}
      <footer className="recap-brand">DAYTRACK · 나의 하루를 음악으로</footer>
    </article>
  );
}
