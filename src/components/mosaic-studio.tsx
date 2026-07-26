"use client";

import { Camera, Check, Download, Grid3X3, ImagePlus, LoaderCircle, LockKeyhole, Share2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Recap } from "@/components/recap-card";

type Photo = { id: string; url: string; trackTitle: string };
type Balance = "photo" | "balanced" | "album";
type Tile = { url: string; count: number; image: HTMLImageElement; rgb: number[] };

const imageFrom = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
});
function square(ctx: CanvasRenderingContext2D, image: HTMLImageElement, size: number) {
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
}
function colorOf(image: HTMLImageElement) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 10;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(image, 0, 0, 10, 10);
  const data = ctx.getImageData(0, 0, 10, 10).data; const rgb = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) { rgb[0] += data[i]; rgb[1] += data[i + 1]; rgb[2] += data[i + 2]; }
  return rgb.map((value) => value / 100);
}

export function MosaicStudio({ recap }: { recap: Recap | null }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [source, setSource] = useState("");
  const [density, setDensity] = useState<40 | 60>(60);
  const [balance, setBalance] = useState<Balance>("balanced");
  const [weighted, setWeighted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localUrl = useRef("");
  useEffect(() => {
    fetch("/api/photos", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (!data) return; setPhotos(data.photos); if (data.photos[0]) setSource(data.photos[0].url);
    }).catch(() => undefined);
    return () => { if (localUrl.current) URL.revokeObjectURL(localUrl.current); };
  }, []);
  const covers = useMemo(() => {
    const map = new Map<string, number>();
    recap?.items.forEach((item) => { if (item.coverUrl) map.set(item.coverUrl, (map.get(item.coverUrl) ?? 0) + 1); });
    return [...map].map(([url, count]) => ({ url, count }));
  }, [recap]);

  async function render(size = 1080) {
    if (!source) return setNotice("먼저 사진을 선택해 주세요.");
    if (!covers.length) return setNotice("하루 정산을 완료하면 오늘 들은 앨범으로 만들 수 있어요.");
    setBusy(true); setReady(false); setNotice(""); setProgress(2);
    try {
      const photo = await imageFrom(source); const tiles: Tile[] = [];
      for (let i = 0; i < covers.length; i++) {
        try {
          const image = await imageFrom(`/api/spotify/cover?url=${encodeURIComponent(covers[i].url)}`);
          tiles.push({ ...covers[i], image, rgb: colorOf(image) });
        } catch {}
        setProgress(4 + Math.round((i + 1) / covers.length * 16));
      }
      if (!tiles.length) throw new Error("앨범 커버를 불러오지 못했어요.");
      const sampler = document.createElement("canvas"); sampler.width = sampler.height = density;
      const sampleCtx = sampler.getContext("2d", { willReadFrequently: true })!; square(sampleCtx, photo, density);
      const pixels = sampleCtx.getImageData(0, 0, density, density).data;
      const canvas = canvasRef.current!; canvas.width = canvas.height = size; const ctx = canvas.getContext("2d")!;
      const unit = size / density, overlay = balance === "photo" ? .42 : balance === "balanced" ? .22 : .07;
      for (let y = 0; y < density; y++) {
        for (let x = 0; x < density; x++) {
          const p = (y * density + x) * 4, target = [pixels[p], pixels[p + 1], pixels[p + 2]];
          let best = tiles[0], score = Infinity;
          for (const tile of tiles) {
            const distance = tile.rgb.reduce((sum, value, i) => sum + (value - target[i]) ** 2, 0) - (weighted ? tile.count * 650 * Math.random() : 0);
            if (distance < score) { score = distance; best = tile; }
          }
          const l = Math.floor(x * unit), t = Math.floor(y * unit), r = Math.ceil((x + 1) * unit), b = Math.ceil((y + 1) * unit);
          ctx.drawImage(best.image, l, t, r - l, b - t); ctx.fillStyle = `rgba(${target.join(",")},${overlay})`; ctx.fillRect(l, t, r - l, b - t);
        }
        setProgress(20 + Math.round((y + 1) / density * 80));
        if (y % 3 === 0) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      setReady(true); setProgress(100);
    } catch (error) { setNotice(error instanceof Error ? error.message : "생성에 실패했어요."); }
    finally { setBusy(false); }
  }
  async function save() {
    setNotice("2048px 고화질로 다시 그리고 있어요."); await render(2048);
    const blob = await new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], `DAYTRACK-mosaic-${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "DAYTRACK 모자이크" });
    else { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    setNotice("고화질 PNG로 저장했어요.");
  }
  return <section className="mosaic-studio">
    <header className="studio-heading"><div><span>DAYTRACK LABS · BETA</span><h1>모자이크 스튜디오 <i>β</i></h1><p>오늘의 음악으로 사진을 다시 그려요.</p></div><Grid3X3 /></header>
    <div className="studio-step"><b>01</b><div><strong>사진 고르기</strong><small>기록 사진 또는 지금 올린 사진</small></div></div>
    <div className="studio-photos">{photos.slice(0, 6).map((photo) => <button className={source === photo.url ? "selected" : ""} key={photo.id} onClick={() => { setSource(photo.url); setReady(false); }}><img src={photo.url} alt={photo.trackTitle} />{source === photo.url ? <Check /> : null}</button>)}<label className="studio-upload"><ImagePlus /><span>새 사진</span><input type="file" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (localUrl.current) URL.revokeObjectURL(localUrl.current); localUrl.current = URL.createObjectURL(file); setSource(localUrl.current); setReady(false); }} /></label></div>
    <div className={`studio-canvas-wrap ${ready ? "ready" : ""}`}><canvas ref={canvasRef} />{!ready && source ? <img src={source} alt="선택한 원본" /> : null}{!source ? <div className="studio-placeholder"><Camera /><strong>사진을 골라주세요</strong></div> : null}{busy ? <div className="studio-progress"><LoaderCircle /><b>{progress}%</b><span>앨범 커버를 배치하는 중</span></div> : null}{ready && !busy ? <span className="studio-finished"><Sparkles /> 완성</span> : null}</div>
    <div className="studio-controls"><div><label>모자이크 밀도</label><div className="studio-segments"><button className={density === 40 ? "active" : ""} onClick={() => setDensity(40)}>40×40</button><button className={density === 60 ? "active" : ""} onClick={() => setDensity(60)}>60×60</button></div></div><div><label>시각적 균형</label><div className="studio-segments three">{([["photo","사진 선명"],["balanced","균형"],["album","앨범 강조"]] as const).map(([value,label]) => <button className={balance === value ? "active" : ""} onClick={() => setBalance(value)} key={value}>{label}</button>)}</div></div><label className="studio-switch"><span><strong>재생 빈도 반영</strong><small>자주 들은 앨범을 더 많이 사용해요</small></span><input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} /></label></div>
    <p className="studio-privacy"><LockKeyhole /> 원본 사진은 새로 저장하지 않고 이 기기 안에서만 처리해요.</p>{notice ? <p className="studio-message">{notice}</p> : null}
    <button className="studio-generate" onClick={() => render()} disabled={busy}><Sparkles />{busy ? "만드는 중…" : ready ? "설정 바꿔 다시 만들기" : "모자이크 만들기"}</button>
    {ready ? <div className="studio-result-actions"><button onClick={save}><Download />고화질 이미지 저장</button><button onClick={save}><Share2 />공유</button></div> : null}<footer>Album artwork from Spotify · DAYTRACK LABS</footer>
  </section>;
}
