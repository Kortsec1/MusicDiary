"use client";

/* eslint-disable @next/next/no-img-element -- Authenticated media and local object URLs cannot use the public optimizer. */
import { Camera, Check, Download, Grid3X3, ImagePlus, LoaderCircle, LockKeyhole, RotateCcw, Share2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Recap } from "@/components/recap-card";

type Photo = { id: string; url: string; trackTitle: string };
type Balance = "photo" | "balanced" | "album";
type Tile = { count: number; image: HTMLImageElement; rgb: number[]; luminance: number };
const DB_NAME = "daytrack-mosaic", STORE = "renders";
const luminance = (rgb: number[]) => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function cached(key: string) {
  const db = await openDb();
  return new Promise<Blob | undefined>((resolve) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(undefined);
  });
}
async function cache(key: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, key);
    request.onsuccess = () => resolve(); request.onerror = () => resolve();
  });
}
const imageFrom = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
});
function drawSquare(ctx: CanvasRenderingContext2D, image: HTMLImageElement, size: number) {
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size);
}
function colorOf(image: HTMLImageElement) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 12;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!; ctx.drawImage(image, 0, 0, 12, 12);
  const data = ctx.getImageData(0, 0, 12, 12).data, rgb = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) { rgb[0] += data[i]; rgb[1] += data[i + 1]; rgb[2] += data[i + 2]; }
  return rgb.map((value) => value / 144);
}

export function MosaicStudio({ recap, onBusyChange }: { recap: Recap | null; onBusyChange?: (busy: boolean, progress: number) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [source, setSource] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [density, setDensity] = useState<48 | 72>(72);
  const [balance, setBalance] = useState<Balance>("photo");
  const [weighted, setWeighted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasCache, setHasCache] = useState(false);
  const [notice, setNotice] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localUrl = useRef("");

  useEffect(() => {
    fetch("/api/photos", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (!data) return; setPhotos(data.photos);
      if (data.photos[0]) { setSource(data.photos[0].url); setSourceKey(`photo:${data.photos[0].id}`); }
    }).catch(() => undefined);
    return () => { if (localUrl.current) URL.revokeObjectURL(localUrl.current); };
  }, []);
  useEffect(() => { onBusyChange?.(busy, progress); }, [busy, progress, onBusyChange]);
  useEffect(() => {
    let active = true;
    if (sourceKey) void cached(sourceKey).then((blob) => { if (active) setHasCache(Boolean(blob)); });
    return () => { active = false; };
  }, [sourceKey]);
  const covers = useMemo(() => {
    const map = new Map<string, number>();
    recap?.items.forEach((item) => { if (item.coverUrl) map.set(item.coverUrl, (map.get(item.coverUrl) ?? 0) + 1); });
    return [...map].map(([url, count]) => ({ url, count }));
  }, [recap]);
  const selectPhoto = (photo: Photo) => {
    if (busy) return; setSource(photo.url); setSourceKey(`photo:${photo.id}`); setReady(false); setHasCache(false); setNotice("사진을 골랐어요. 아래에서 표현 방식을 정해 주세요.");
  };
  const loadCached = useCallback(async () => {
    const blob = await cached(sourceKey); if (!blob) return;
    const url = URL.createObjectURL(blob);
    try {
      const image = await imageFrom(url), canvas = canvasRef.current!, ctx = canvas.getContext("2d")!;
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; ctx.drawImage(image, 0, 0);
      setReady(true); setNotice("이 사진으로 전에 만든 결과를 불러왔어요.");
    } finally { URL.revokeObjectURL(url); }
  }, [sourceKey]);

  async function render(size = 1200, persist = true) {
    if (!source) return setNotice("먼저 위에서 사진을 선택해 주세요.");
    if (!covers.length) return setNotice("하루 정산을 먼저 완료하면 오늘 들은 앨범으로 만들 수 있어요.");
    setBusy(true); setReady(false); setNotice("이 화면을 그대로 두세요. 앨범 커버를 준비하고 있어요."); setProgress(2);
    try {
      const photo = await imageFrom(source), tiles: Tile[] = [];
      for (let i = 0; i < covers.length; i++) {
        try {
          const image = await imageFrom(`/api/spotify/cover?url=${encodeURIComponent(covers[i].url)}`);
          const rgb = colorOf(image); tiles.push({ count: covers[i].count, image, rgb, luminance: luminance(rgb) });
        } catch {}
        setProgress(5 + Math.round((i + 1) / covers.length * 15));
      }
      if (!tiles.length) throw new Error("앨범 커버를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      const sampler = document.createElement("canvas"); sampler.width = sampler.height = density;
      const sampleCtx = sampler.getContext("2d", { willReadFrequently: true })!; drawSquare(sampleCtx, photo, density);
      const pixels = sampleCtx.getImageData(0, 0, density, density).data;
      const canvas = canvasRef.current!; canvas.width = canvas.height = size; const ctx = canvas.getContext("2d")!, unit = size / density;
      for (let y = 0; y < density; y++) {
        for (let x = 0; x < density; x++) {
          const p = (y * density + x) * 4, target = [pixels[p], pixels[p + 1], pixels[p + 2]], targetLum = luminance(target);
          let best = tiles[0], score = Infinity;
          for (const tile of tiles) {
            const normalized = tile.rgb.map((value) => value * clamp(targetLum / Math.max(tile.luminance, 12), .35, 2.1));
            const distance = normalized.reduce((sum, value, i) => sum + (value - target[i]) ** 2, 0) - (weighted ? tile.count * 420 * Math.random() : 0);
            if (distance < score) { score = distance; best = tile; }
          }
          const left = Math.floor(x * unit), top = Math.floor(y * unit), right = Math.ceil((x + 1) * unit), bottom = Math.ceil((y + 1) * unit);
          const brightness = clamp(targetLum / Math.max(best.luminance, 10), .32, 2.25);
          ctx.filter = `brightness(${brightness}) contrast(1.08) saturate(.92)`;
          ctx.drawImage(best.image, left, top, right - left, bottom - top); ctx.filter = "none";
          ctx.fillStyle = `rgba(${target.join(",")},${balance === "photo" ? .22 : balance === "balanced" ? .14 : .06})`;
          ctx.fillRect(left, top, right - left, bottom - top);
        }
        setProgress(20 + Math.round((y + 1) / density * 72));
        if (y % 2 === 0) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      ctx.save(); ctx.globalCompositeOperation = "luminosity"; ctx.globalAlpha = balance === "photo" ? .48 : balance === "balanced" ? .32 : .16; drawSquare(ctx, photo, size); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = balance === "photo" ? .24 : .14; drawSquare(ctx, photo, size); ctx.restore();
      setProgress(96); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob && persist && sourceKey) { await cache(sourceKey, blob); setHasCache(true); }
      setReady(true); setProgress(100); setNotice("완성했어요. 결과는 이 사진에 자동 저장됐어요.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "생성에 실패했어요."); }
    finally { setBusy(false); }
  }
  async function exportImage() {
    if (!ready) return;
    setBusy(true); setNotice("저장용 2048px 이미지를 준비하고 있어요."); await render(2048, false);
    const blob = await new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, "image/png")); setBusy(false);
    if (!blob) return;
    const file = new File([blob], `DAYTRACK-mosaic-${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "DAYTRACK 모자이크" });
    else { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    setNotice("2048px PNG를 저장했어요.");
  }

  return <section className="mosaic-studio">
    <header className="studio-heading"><div><span>DAYTRACK LABS · BETA</span><h1>모자이크 스튜디오 <i>β</i></h1><p>앨범 커버의 명암까지 맞춰 사진을 다시 그려요.</p></div><Grid3X3 /></header>
    <div className="studio-guide"><b>{busy ? "만드는 중" : ready ? "완성" : source ? "설정하기" : "사진 선택"}</b><span>{busy ? "앱을 닫지 말고 잠시 기다려 주세요." : ready ? "자동 저장됨 · 다시 만들거나 이미지로 내보낼 수 있어요." : "① 사진 선택 → ② 표현 방식 선택 → ③ 만들기"}</span></div>
    <div className="studio-step"><b>01</b><div><strong>사진 고르기</strong><small>선택한 사진에는 체크 표시가 나타나요</small></div></div>
    <div className="studio-photos">{photos.slice(0, 8).map((photo) => <button type="button" aria-pressed={source === photo.url} className={source === photo.url ? "selected" : ""} key={photo.id} disabled={busy} onClick={() => selectPhoto(photo)}><img src={photo.url} alt={photo.trackTitle} /><span>{source === photo.url ? "선택됨" : "선택"}</span>{source === photo.url ? <Check /> : null}</button>)}<label className={`studio-upload ${busy ? "disabled" : ""}`}><ImagePlus /><span>새 사진 올리기</span><input disabled={busy} type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (localUrl.current) URL.revokeObjectURL(localUrl.current); localUrl.current = URL.createObjectURL(file); setSource(localUrl.current); setSourceKey(`upload:${file.name}:${file.size}:${file.lastModified}`); setReady(false); setNotice("새 사진을 골랐어요. 표현 방식을 정해 주세요."); }} /></label></div>
    {hasCache && !ready && !busy ? <button type="button" className="studio-restore" onClick={loadCached}><RotateCcw />이 사진의 저장된 결과 바로 불러오기</button> : null}
    <div className={`studio-canvas-wrap ${ready ? "ready" : ""}`}><canvas ref={canvasRef} />{!ready && source ? <img src={source} alt="선택한 원본" /> : null}{!source ? <div className="studio-placeholder"><Camera /><strong>위에서 사진을 먼저 선택해 주세요</strong></div> : null}{busy ? <div className="studio-progress"><LoaderCircle /><b>{progress}%</b><strong>{progress < 20 ? "앨범 커버 준비 중" : progress < 93 ? "사진의 명암을 따라 배치 중" : "결과 자동 저장 중"}</strong><span>다른 메뉴는 완성될 때까지 잠시 잠겨요</span><i><em style={{ width: `${progress}%` }} /></i></div> : null}{ready && !busy ? <span className="studio-finished"><Sparkles /> 자동 저장됨</span> : null}</div>
    <div className="studio-step compact"><b>02</b><div><strong>표현 방식</strong><small>‘사진 선명’을 추천해요</small></div></div>
    <div className="studio-controls"><div><label>디테일</label><div className="studio-segments"><button type="button" disabled={busy} className={density === 48 ? "active" : ""} onClick={() => setDensity(48)}>빠르게 · 48</button><button type="button" disabled={busy} className={density === 72 ? "active" : ""} onClick={() => setDensity(72)}>정교하게 · 72</button></div></div><div><label>원본 강조</label><div className="studio-segments three">{([["photo","사진 선명"],["balanced","균형"],["album","앨범 강조"]] as const).map(([value,label]) => <button type="button" disabled={busy} aria-pressed={balance === value} className={balance === value ? "active" : ""} onClick={() => setBalance(value)} key={value}>{label}{balance === value ? <Check /> : null}</button>)}</div></div><label className="studio-switch"><span><strong>재생 빈도 반영</strong><small>자주 들은 앨범을 더 많이 사용해요</small></span><input disabled={busy} type="checkbox" checked={weighted} onChange={(event) => setWeighted(event.target.checked)} /></label></div>
    <p className="studio-privacy"><LockKeyhole /> 원본과 결과는 이 기기의 DAYTRACK 저장소에서만 처리돼요.</p>{notice ? <p className="studio-message" role="status">{notice}</p> : null}
    <button type="button" className="studio-generate" onClick={() => render()} disabled={busy || !source}><Sparkles />{busy ? `${progress}% · 사진을 만드는 중` : ready ? "현재 설정으로 다시 만들기" : source ? "이 사진으로 모자이크 만들기" : "먼저 사진을 선택해 주세요"}</button>
    {ready && !busy ? <div className="studio-result-actions"><button type="button" onClick={exportImage}><Download />2048px 이미지 저장</button><button type="button" onClick={exportImage}><Share2 />공유</button></div> : null}<footer>Album artwork from Spotify · DAYTRACK LABS</footer>
  </section>;
}
