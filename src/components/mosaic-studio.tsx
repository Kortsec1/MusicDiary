"use client";

/* eslint-disable @next/next/no-img-element -- Authenticated media and local object URLs cannot use the public optimizer. */
import { Camera, Check, Download, Grid3X3, ImagePlus, Images, LoaderCircle, LockKeyhole, Music2, RotateCcw, Share2, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Recap } from "@/components/recap-card";

type Photo = { id: string; url: string; trackTitle: string };
type Balance = "photo" | "balanced" | "album";
type Cover = { url: string; count: number; title?: string; artist?: string; key?: string };
type Tile = { key: string; count: number; image: HTMLImageElement; rgb: number[]; luminance: number };
type GalleryItem = { id: string; sourceKey: string; blob: Blob; createdAt: number };
const DB_NAME = "daytrack-mosaic", STORE = "renders", GALLERY = "gallery";
const coverMemory = new Map<string, Tile>();
const luminance = (rgb: number[]) => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); if (!request.result.objectStoreNames.contains(GALLERY)) request.result.createObjectStore(GALLERY, { keyPath: "id" }); };
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
async function galleryItems() {
  const db = await openDb();
  return new Promise<GalleryItem[]>((resolve) => { const request = db.transaction(GALLERY).objectStore(GALLERY).getAll(); request.onsuccess = () => resolve((request.result as GalleryItem[]).sort((a, b) => b.createdAt - a.createdAt)); request.onerror = () => resolve([]); });
}
async function gallerySave(item: GalleryItem) { const db = await openDb(); await new Promise<void>((resolve) => { const request = db.transaction(GALLERY, "readwrite").objectStore(GALLERY).put(item); request.onsuccess = () => resolve(); request.onerror = () => resolve(); }); }
async function galleryRemove(id: string) { const db = await openDb(); await new Promise<void>((resolve) => { const request = db.transaction(GALLERY, "readwrite").objectStore(GALLERY).delete(id); request.onsuccess = () => resolve(); request.onerror = () => resolve(); }); }
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
  const [density, setDensity] = useState<96 | 128>(96);
  const [balance, setBalance] = useState<Balance>("photo");
  const [weighted, setWeighted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasCache, setHasCache] = useState(false);
  const [notice, setNotice] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [coverPromptOpen, setCoverPromptOpen] = useState(false);
  const [supplementalBusy, setSupplementalBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localUrl = useRef("");

  useEffect(() => {
    fetch("/api/photos", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (!data) return; setPhotos(data.photos);
      if (data.photos[0]) { setSource(data.photos[0].url); setSourceKey(`photo:${data.photos[0].id}`); }
    }).catch(() => undefined);
    return () => { if (localUrl.current) URL.revokeObjectURL(localUrl.current); };
  }, []);
  useEffect(() => { void galleryItems().then(setGallery); }, []);
  useEffect(() => { onBusyChange?.(busy, progress); }, [busy, progress, onBusyChange]);
  useEffect(() => {
    let active = true;
    if (sourceKey) void cached(sourceKey).then((blob) => { if (active) setHasCache(Boolean(blob)); });
    return () => { active = false; };
  }, [sourceKey]);
  const covers = useMemo<Cover[]>(() => {
    const map = new Map<string, number>();
    recap?.items.forEach((item) => { if (item.coverUrl) map.set(item.coverUrl, (map.get(item.coverUrl) ?? 0) + 1); });
    return [...map].map(([url, count]) => ({ url, count, key: url }));
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

  async function render(size = density === 128 ? 1536 : 1200, persist = true, extraCovers: Cover[] = []) {
    if (!source) return setNotice("먼저 위에서 사진을 선택해 주세요.");
    if (!covers.length) return setNotice("하루 정산을 먼저 완료하면 오늘 들은 앨범으로 만들 수 있어요.");
    setBusy(true); setReady(false); setNotice("이 화면을 그대로 두세요. 앨범 커버를 준비하고 있어요."); setProgress(2);
    try {
      const photo = await imageFrom(source), tiles: Tile[] = [];
      const renderCovers = [...covers, ...extraCovers.filter((cover) => !covers.some((current) => current.url === cover.url))];
      let loaded = 0;
      const candidates = renderCovers.slice(0, 42);
      const loadedTiles = await Promise.all(candidates.map(async (cover) => {
        const key = cover.key ?? cover.url;
        const cachedTile = coverMemory.get(key);
        if (cachedTile) { loaded += 1; setProgress(5 + Math.round(loaded / candidates.length * 15)); return { ...cachedTile, count: cover.count }; }
        try {
          const image = await imageFrom(`/api/spotify/cover?url=${encodeURIComponent(cover.url)}`);
          const rgb = colorOf(image); const tile = { key, count: cover.count, image, rgb, luminance: luminance(rgb) };
          coverMemory.set(key, tile); return tile;
        } catch { return null; } finally { loaded += 1; setProgress(5 + Math.round(loaded / candidates.length * 15)); }
      }));
      tiles.push(...loadedTiles.filter((tile): tile is Tile => tile !== null));
      if (!tiles.length) throw new Error("앨범 커버를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      const sampler = document.createElement("canvas"); sampler.width = sampler.height = density;
      const sampleCtx = sampler.getContext("2d", { willReadFrequently: true })!; drawSquare(sampleCtx, photo, density);
      const pixels = sampleCtx.getImageData(0, 0, density, density).data;
      const canvas = canvasRef.current!; canvas.width = canvas.height = size; const ctx = canvas.getContext("2d")!, unit = size / density;
      const usage = new Map<string, number>();
      for (let y = 0; y < density; y++) {
        for (let x = 0; x < density; x++) {
          const p = (y * density + x) * 4, target = [pixels[p], pixels[p + 1], pixels[p + 2]], targetLum = luminance(target);
          let best = tiles[0], score = Infinity;
          for (const tile of tiles) {
            const normalized = tile.rgb.map((value) => value * clamp(targetLum / Math.max(tile.luminance, 12), .35, 2.1));
            const distance = normalized.reduce((sum, value, i) => sum + (value - target[i]) ** 2, 0) + (usage.get(tile.key) ?? 0) * 3200 - (weighted ? Math.min(tile.count, 6) * 85 * Math.random() : 0);
            if (distance < score) { score = distance; best = tile; }
          }
          usage.set(best.key, (usage.get(best.key) ?? 0) + 1);
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
      if (blob && persist && sourceKey) {
        await cache(sourceKey, blob); setHasCache(true);
        const item = { id: crypto.randomUUID(), sourceKey, blob, createdAt: Date.now() };
        await gallerySave(item); setGallery((current) => [item, ...current]);
      }
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

  async function startGeneration() {
    if (covers.length >= 12) return render();
    setCoverPromptOpen(true);
  }
  async function addVarietyAndGenerate() {
    setCoverPromptOpen(false); setSupplementalBusy(true);
    try {
      const response = await fetch("/api/spotify/mosaic-covers", { cache: "no-store" });
      const payload = await response.json();
      const extra: Cover[] = response.ok ? payload.covers.map((cover: { id: string; url: string; title: string; artist: string }) => ({ ...cover, count: 0, key: `extra:${cover.id}` })) : [];
      await render(1200, true, extra);
    } finally { setSupplementalBusy(false); }
  }
  async function openGalleryItem(item: GalleryItem) {
    const url = URL.createObjectURL(item.blob);
    try { const image = await imageFrom(url), canvas = canvasRef.current!, context = canvas.getContext("2d")!; canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; context.drawImage(image, 0, 0); setReady(true); setGalleryOpen(false); } finally { URL.revokeObjectURL(url); }
  }
  async function deleteGalleryItem(id: string) { await galleryRemove(id); setGallery((items) => items.filter((item) => item.id !== id)); }

  return <section className="mosaic-studio">
    <header className="studio-heading"><div><span>DAYTRACK LABS · BETA</span><h1>모자이크 스튜디오 <i>β</i></h1><p>앨범 커버의 명암까지 맞춰 사진을 다시 그려요.</p></div><Grid3X3 /></header>
    <button type="button" className="studio-gallery-button" onClick={() => setGalleryOpen(true)}><Images />저장한 작품 <span>{gallery.length}</span></button>
    <div className="studio-guide"><b>{busy ? "만드는 중" : ready ? "완성" : source ? "설정하기" : "사진 선택"}</b><span>{busy ? "앱을 닫지 말고 잠시 기다려 주세요." : ready ? "자동 저장됨 · 다시 만들거나 이미지로 내보낼 수 있어요." : "① 사진 선택 → ② 표현 방식 선택 → ③ 만들기"}</span></div>
    <div className="studio-step"><b>01</b><div><strong>사진 고르기</strong><small>선택한 사진에는 체크 표시가 나타나요</small></div></div>
    <div className="studio-photos">{photos.slice(0, 8).map((photo) => <button type="button" aria-pressed={source === photo.url} className={source === photo.url ? "selected" : ""} key={photo.id} disabled={busy} onClick={() => selectPhoto(photo)}><img src={photo.url} alt={photo.trackTitle} /><span>{source === photo.url ? "선택됨" : "선택"}</span>{source === photo.url ? <Check /> : null}</button>)}<label className={`studio-upload ${busy ? "disabled" : ""}`}><ImagePlus /><span>새 사진 올리기</span><input disabled={busy} type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (localUrl.current) URL.revokeObjectURL(localUrl.current); localUrl.current = URL.createObjectURL(file); setSource(localUrl.current); setSourceKey(`upload:${file.name}:${file.size}:${file.lastModified}`); setReady(false); setNotice("새 사진을 골랐어요. 표현 방식을 정해 주세요."); }} /></label></div>
    <section className="studio-playlist"><div><b>오늘의 플레이리스트</b><span>{recap?.items.length ?? 0}곡 · 시간순</span></div><ol>{recap?.items.map((item) => <li key={item.id}>{item.coverUrl ? <img src={`/api/spotify/cover?url=${encodeURIComponent(item.coverUrl)}`} alt="" /> : <Music2 />}<span><strong>{item.title}</strong><small>{item.artist}</small></span></li>)}</ol></section>
    {hasCache && !ready && !busy ? <button type="button" className="studio-restore" onClick={loadCached}><RotateCcw />이 사진의 저장된 결과 바로 불러오기</button> : null}
    <div className={`studio-canvas-wrap ${ready ? "ready" : ""}`}><canvas ref={canvasRef} />{!ready && source ? <img src={source} alt="선택한 원본" /> : null}{!source ? <div className="studio-placeholder"><Camera /><strong>위에서 사진을 먼저 선택해 주세요</strong></div> : null}{busy ? <div className="studio-progress"><LoaderCircle /><b>{progress}%</b><strong>{progress < 20 ? "앨범 커버 준비 중" : progress < 93 ? "사진의 명암을 따라 배치 중" : "결과 자동 저장 중"}</strong><span>다른 메뉴는 완성될 때까지 잠시 잠겨요</span><i><em style={{ width: `${progress}%` }} /></i></div> : null}{ready && !busy ? <span className="studio-finished"><Sparkles /> 자동 저장됨</span> : null}</div>
    <div className="studio-step compact"><b>02</b><div><strong>표현 방식</strong><small>‘사진 선명’을 추천해요</small></div></div>
    <div className="studio-controls"><div><label>디테일</label><div className="studio-segments studio-density"><button type="button" disabled={busy} className={density === 96 ? "active" : ""} onClick={() => setDensity(96)}>정교 · 96</button><button type="button" disabled={busy} className={density === 128 ? "active" : ""} onClick={() => setDensity(128)}>뮤지엄 · 128</button></div></div><div><label>원본 강조</label><div className="studio-segments three">{([["photo","사진 선명"],["balanced","균형"],["album","앨범 강조"]] as const).map(([value,label]) => <button type="button" disabled={busy} aria-pressed={balance === value} className={balance === value ? "active" : ""} onClick={() => setBalance(value)} key={value}>{label}{balance === value ? <Check /> : null}</button>)}</div></div><label className="studio-switch"><span><strong>재생 빈도 반영</strong><small>자주 들은 앨범을 더 많이 사용해요</small></span><input disabled={busy} type="checkbox" checked={weighted} onChange={(event) => setWeighted(event.target.checked)} /></label></div>
    <p className="studio-privacy"><LockKeyhole /> 원본과 결과는 이 기기의 DAYTRACK 저장소에서만 처리돼요.</p>{notice ? <p className="studio-message" role="status">{notice}</p> : null}
    <button type="button" className="studio-generate" onClick={startGeneration} disabled={busy || !source || supplementalBusy}><Sparkles />{busy || supplementalBusy ? `${progress}% · 사진을 만드는 중` : ready ? "현재 설정으로 다시 만들기" : source ? "이 사진으로 모자이크 만들기" : "먼저 사진을 선택해 주세요"}</button>
    {ready && !busy ? <div className="studio-result-actions"><button type="button" onClick={exportImage}><Download />2048px 이미지 저장</button><button type="button" onClick={exportImage}><Share2 />공유</button></div> : null}
    {coverPromptOpen ? <div className="studio-dialog-backdrop" role="dialog" aria-modal="true"><section className="studio-dialog"><button type="button" onClick={() => setCoverPromptOpen(false)} aria-label="닫기"><X /></button><h2>오늘의 앨범이 {covers.length}장뿐이에요.</h2><p>사진을 더 풍부하게 만들도록, Spotify의 다양한 공개 앨범 커버를 이번 작업에만 더할까요?</p><div><button type="button" onClick={() => render()}>아니요, 오늘 앨범만</button><button type="button" className="primary" onClick={addVarietyAndGenerate}>네, 다양하게 넣기</button></div></section></div> : null}
    {galleryOpen ? <div className="studio-dialog-backdrop gallery-backdrop" role="dialog" aria-modal="true"><section className="studio-gallery"><header><div><h2>저장한 작품</h2><span>이 기기에만 저장돼요</span></div><button type="button" onClick={() => setGalleryOpen(false)} aria-label="닫기"><X /></button></header>{gallery.length ? <div className="studio-gallery-grid">{gallery.map((item) => { const url = URL.createObjectURL(item.blob); return <article key={item.id}><button type="button" onClick={() => openGalleryItem(item)}><img src={url} alt="저장한 모자이크" /></button><div><time>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</time><button type="button" onClick={() => deleteGalleryItem(item.id)} aria-label="삭제"><Trash2 /></button></div></article>; })}</div> : <p className="studio-gallery-empty">아직 저장한 작품이 없어요. 첫 사진을 만들어 보세요.</p>}</section></div> : null}
    <footer>Album artwork from Spotify · DAYTRACK LABS</footer>
  </section>;
}
