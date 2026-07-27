"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Initial client-only session and device state are synchronized after hydration. */

import {
  Archive, BookOpen, CalendarDays, Camera, Check, ChevronRight, Disc3, Download, Grid3X3, Library,
  LoaderCircle, LocateFixed, Map as MapIcon, Menu, Music2, Navigation, Settings,
  Smartphone, UserRound, X,
} from "lucide-react";
import Image from "next/image";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DayMap, type MapMoment } from "@/components/day-map";
import { RecapCard, type Recap } from "@/components/recap-card";
import { MosaicStudio } from "@/components/mosaic-studio";

type SessionState = {
  connected: boolean;
  configured: boolean;
  user: { displayName: string; avatarUrl?: string } | null;
};
type TrackState = {
  playing: boolean;
  progressMs?: number;
  sampledAt?: string;
  track: null | {
    id: string;
    title: string;
    artist: string;
    album?: string;
    coverUrl?: string;
    durationMs: number;
    spotifyUrl?: string;
  };
};
type Moment = MapMoment & {
  album: string;
  coverUrl: string | null;
  spotifyUrl: string;
  note: string;
  mood: string | null;
  photos: Array<{ id: string; url: string; width: number | null; height: number | null }>;
};
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type ActiveView = "today" | "calendar" | "map" | "studio" | "archive" | "settings";
type CurrentLocation = { latitude: number; longitude: number; accuracyMeters?: number };
type SpotifyPlaylist = { id: string; name: string; public: boolean | null; collaborative: boolean; imageUrl: string | null; total: number };

async function preparePhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) throw new Error("사진을 준비하지 못했습니다.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "moment"}.jpg`, { type: "image/jpeg" });
}

const moodOptions = ["평온", "기쁨", "그리움", "몰입"];

function dayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    date: [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, "0"),
      String(start.getDate()).padStart(2, "0"),
    ].join("-"),
  };
}

function formatTime(milliseconds = 0) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function getCurrentLocation(): Promise<CurrentLocation | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: coords.accuracy,
    }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
  ));
}

export function TodayScreen() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [locationState, setLocationState] = useState("확인 전");
  const [notificationState, setNotificationState] = useState("확인 전");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  const loadSession = useCallback(async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    setSession(await response.json());
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setPermissionsChecked(localStorage.getItem("daytrack-permissions-checked") === "true");
      setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    });
    void loadSession();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => window.removeEventListener("beforeinstallprompt", captureInstall);
  }, [loadSession]);

  async function requestPermissions() {
    setPermissionBusy(true);
    const location = await getCurrentLocation();
    setLocationState(location ? "허용됨" : "허용 안 됨");
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setNotificationState(result === "granted" ? "허용됨" : "허용 안 됨");
    } else {
      setNotificationState("지원 안 됨");
    }
    localStorage.setItem("daytrack-permissions-checked", "true");
    setPermissionsChecked(true);
    setPermissionBusy(false);
  }

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    alert(/iPad|iPhone|iPod/.test(navigator.userAgent)
      ? "Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요."
      : "브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.");
  }

  if (!session) {
    return <main className="onboarding"><div className="onboarding-card loading-card"><div className="spinner" /><p>DAYTRACK 준비 중</p></div></main>;
  }
  if (!permissionsChecked || !session.connected) {
    return (
      <main className="onboarding">
        <section className="onboarding-card">
          <div className="onboarding-mark"><Disc3 /><span>DAYTRACK</span></div>
          <h1 className="serif">음악과 함께<br />오늘을 시작하세요</h1>
          <p className="onboarding-copy">Spotify로 로그인하면 각 사용자의 재생 기록을 본인 계정에서 가져옵니다. 위치는 기록 버튼을 누를 때만 저장합니다.</p>
          {!session.connected && session.configured ? <a className="spotify-login" href="/api/auth/spotify"><Music2 />Spotify로 로그인</a> : null}
          {!session.connected && !session.configured ? <button className="spotify-login disabled" disabled><Music2 />Spotify 로그인 준비 중</button> : null}
          <ol className="setup-list">
            <li className={session.connected ? "done" : "active"}>
              <span className="step-icon">{session.connected ? <Check /> : <Music2 />}</span>
              <div><strong>Spotify 로그인</strong><small>{session.connected ? `${session.user?.displayName} 계정으로 연결됨` : "재생 음악과 최근 기록 접근 승인"}</small></div>
            </li>
            <li className={permissionsChecked ? "done" : session.connected ? "active" : ""}>
              <span className="step-icon">{permissionsChecked ? <Check /> : <LocateFixed />}</span>
              <div><strong>기기 권한 확인</strong><small>위치 {locationState} · 알림 {notificationState}</small></div>
              {!permissionsChecked && session.connected ? <button onClick={requestPermissions} disabled={permissionBusy}>{permissionBusy ? "확인 중" : "권한 확인"}</button> : null}
            </li>
            <li className={installed ? "done" : ""}>
              <span className="step-icon">{installed ? <Check /> : <Smartphone />}</span>
              <div><strong>홈 화면에 추가</strong><small>{installed ? "앱 모드로 실행 중" : "전체 화면으로 빠르게 실행"}</small></div>
              {!installed ? <button onClick={installApp}><Download />추가</button> : null}
            </li>
          </ol>
          <p className="privacy-note">권한은 설정에서 언제든 변경할 수 있습니다.</p>
        </section>
      </main>
    );
  }
  return <DiaryHome session={session} onInstall={installApp} installed={installed} />;
}

function DiaryHome({ session, onInstall, installed }: {
  session: SessionState;
  onInstall: () => void;
  installed: boolean;
}) {
  const [activeView, setActiveView] = useState<ActiveView>("today");
  const [studioStatus, setStudioStatus] = useState({ busy: false, progress: 0 });
  const handleStudioBusy = useCallback((busy: boolean, progress: number) => setStudioStatus({ busy, progress }), []);
  const [composerOpen, setComposerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [mood, setMood] = useState("평온");
  const [includeLocation, setIncludeLocation] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [moments, setMoments] = useState<Moment[]>([]);
  const [playback, setPlayback] = useState<TrackState | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [playlistNeedsReconnect, setPlaylistNeedsReconnect] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const progressTimer = useRef<number | null>(null);

  const loadMoments = useCallback(async () => {
    const range = dayRange();
    const response = await fetch(`/api/moments?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      startTransition(() => setMoments(payload.moments));
    }
  }, []);

  const loadPlayback = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    setSyncing(true);
    try {
      const response = await fetch("/api/spotify/now", { cache: "no-store" });
      if (response.ok) {
        const next = await response.json() as TrackState;
        setPlayback(next);
        setDisplayProgress(next.progressMs ?? 0);
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  const loadRecaps = useCallback(async () => {
    const response = await fetch("/api/daily-albums", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      setRecaps(payload.recaps);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setNote(localStorage.getItem("daytrack-draft") || ""));
    void Promise.all([loadPlayback(), loadMoments(), loadRecaps(), getCurrentLocation().then(setCurrentLocation), fetch("/api/spotify/sync", { method: "POST" })]);
  }, [loadMoments, loadPlayback, loadRecaps]);

  useEffect(() => {
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    const timer = window.setTimeout(() => {
      setMoments([]);
      setRecap(null);
      setComposerOpen(false);
      setNote("");
      localStorage.removeItem("daytrack-draft");
      void Promise.all([loadMoments(), loadPlayback(), loadRecaps()]);
    }, Math.max(1_000, nextDay.getTime() - now.getTime()));
    return () => window.clearTimeout(timer);
  }, [loadMoments, loadPlayback, loadRecaps]);

  useEffect(() => {
    const schedule = () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
      pollTimer.current = window.setTimeout(async () => {
        await loadPlayback();
        schedule();
      }, playback?.playing ? 8_000 : 20_000);
    };
    schedule();
    const refresh = () => {
      if (document.visibilityState === "visible") void Promise.all([loadPlayback(), loadMoments(), fetch("/api/spotify/sync", { method: "POST" })]);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadMoments, loadPlayback, playback?.playing]);

  useEffect(() => {
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    if (playback?.playing) {
      progressTimer.current = window.setInterval(() => {
        setDisplayProgress((value) => Math.min(value + 1_000, playback.track?.durationMs ?? value + 1_000));
      }, 1_000);
    }
    return () => { if (progressTimer.current) window.clearInterval(progressTimer.current); };
  }, [playback?.playing, playback?.track?.durationMs, playback?.track?.id]);

  useEffect(() => { localStorage.setItem("daytrack-draft", note); }, [note]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const track = playback?.track ?? null;
  const progress = track?.durationMs ? Math.min(100, (displayProgress / track.durationMs) * 100) : 0;
  const locatedMoments = useMemo(() => moments.filter((moment) => moment.location), [moments]);

  async function saveMoment() {
    if (!track || saving) {
      setToast("Spotify에서 음악을 재생한 뒤 기록해 주세요.");
      return;
    }
    setSaving(true);
    const location = includeLocation ? await getCurrentLocation() : null;
    if (location) setCurrentLocation(location);
    const moment = {
      note,
      mood,
      trackId: track.id,
      occurredAt: new Date().toISOString(),
      location: location ? { ...location, placeLabel: "현재 위치" } : undefined,
    };
    const formData = new FormData();
    formData.set("moment", JSON.stringify(moment));
    if (photo) formData.set("photo", photo);
    const response = await fetch("/api/moments", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (response.ok) setRecap(payload.album);
    if (response.ok) {
      setMoments((items) => [...items, payload.moment]);
      setComposerOpen(false);
      setNote("");
      setPhoto(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview("");
      localStorage.removeItem("daytrack-draft");
      setToast(location ? "음악과 위치가 지도에 저장됐어요." : "음악 기록이 저장됐어요.");
    } else {
      setToast(payload.error || "저장하지 못했습니다.");
    }
    setSaving(false);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function finalizeDay() {
    if (finalizing) return;
    setFinalizing(true);
    const range = dayRange();
    try {
      const response = await fetch("/api/daily-albums/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...range, summary: note || undefined }),
      });
      const payload = await response.json();
      if (response.ok) {
        setRecap(payload.album);
        setRecaps((items) => [payload.album, ...items.filter((item) => item.id !== payload.album.id)]);
        setConfirmFinalize(false);
        setToast(payload.alreadyFinalized ? "이미 정산된 오늘의 카드를 다시 열었어요." : "오늘의 정산 카드가 완성됐어요.");
      } else {
        setToast(payload.error);
      }
    } finally {
      setFinalizing(false);
      window.setTimeout(() => setToast(""), 3200);
    }
  }

  async function shareRecap() {
    if (!recap) return;
    const response = await fetch(`/api/daily-albums/${recap.id}/share`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setToast(payload.error || "공유 링크를 만들지 못했어요.");
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: recap.title, text: "나의 오늘을 음악으로 기록했어요.", url: payload.url });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setToast("공유를 완료하지 못했어요.");
      }
    } else {
      await navigator.clipboard.writeText(payload.url);
      setToast("공유 링크를 복사했어요.");
    }
  }

  async function saveRecapImage(variant: "artwork" | "recap" = "recap") {
    if (!recap) return;
    setToast("공유 이미지를 만들고 있어요…");
    const response = await fetch(`/api/daily-albums/${recap.id}/poster?variant=${variant}`);
    if (!response.ok) {
      setToast("이미지를 만들지 못했어요.");
      return;
    }
    const blob = await response.blob();
    const file = new File([blob], `daytrack-${variant}-${recap.date}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: recap.title });
        setToast("");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setToast("이미지를 저장했어요.");
  }

  async function openPlaylistPicker() {
    if (!recap) return;
    setPlaylistOpen(true);
    setPlaylistBusy(true);
    setPlaylistNeedsReconnect(false);
    const response = await fetch("/api/spotify/playlists", { cache: "no-store" });
    const payload = await response.json();
    setPlaylistBusy(false);
    if (response.status === 403 && payload.error === "RECONNECT_REQUIRED") {
      setPlaylistNeedsReconnect(true);
      return;
    }
    if (!response.ok) {
      setToast(payload.error || "플레이리스트를 불러오지 못했어요.");
      return;
    }
    setPlaylists(payload.playlists);
    setPlaylistsLoaded(true);
  }

  async function saveToSpotify() {
    if (!recap || playlistBusy) return;
    setPlaylistBusy(true);
    const response = await fetch(`/api/daily-albums/${recap.id}/playlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selectedPlaylistId ? { playlistId: selectedPlaylistId } : {}),
    });
    const payload = await response.json();
    setPlaylistBusy(false);
    if (response.status === 403 && payload.error === "RECONNECT_REQUIRED") {
      setPlaylistNeedsReconnect(true);
      return;
    }
    if (!response.ok) {
      setToast(payload.error || "Spotify에 저장하지 못했어요.");
      return;
    }
    setPlaylistOpen(false);
    setToast(`${payload.added}곡을 Spotify에 저장했어요.`);
    if (payload.playlistUrl) window.open(payload.playlistUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <UserRound size={20} aria-label="프로필" />
        <div className="wordmark serif">DAYTRACK</div>
        {installed ? <button className="icon-button" onClick={() => setActiveView("settings")} aria-label="설정 열기"><Menu size={20} /></button> : <button className="icon-button" onClick={onInstall} aria-label="홈 화면에 추가"><Download size={20} /></button>}
      </header>
      {activeView === "today" ? (
        <TodayView
          track={track}
          playback={playback}
          progress={progress}
          displayProgress={displayProgress}
          moments={moments}
          syncing={syncing}
          onRecord={() => setComposerOpen(true)}
          onMap={() => setActiveView("map")}
        />
      ) : null}
      {activeView === "map" ? (
        <MapTimeline
          moments={moments}
          locatedMoments={locatedMoments}
          currentLocation={currentLocation}
          onRecord={() => setComposerOpen(true)}
          onFinalize={() => setConfirmFinalize(true)}
          finalizing={finalizing}
        />
      ) : null}
      {activeView === "calendar" ? <CalendarView moments={moments} /> : null}
      {activeView === "archive" ? <ArchiveView recaps={recaps} onOpen={setRecap} /> : null}
      <div hidden={activeView !== "studio"}><MosaicStudio recap={recaps[0] ?? null} onBusyChange={handleStudioBusy} /></div>
      {activeView === "settings" ? <SettingsView session={session} installed={installed} onInstall={onInstall} /> : null}
      {studioStatus.busy && activeView !== "studio" ? <button className="studio-global-progress" onClick={() => setActiveView("studio")}><LoaderCircle className="spin-icon" /><span><b>모자이크 생성 중 · {studioStatus.progress}%</b><small>눌러서 진행 화면으로 돌아가기</small></span></button> : null}
      <BottomNavV2 activeView={activeView} busy={studioStatus.busy} onChange={(view) => {
        if (studioStatus.busy && view !== "studio") { setToast("모자이크가 완성될 때까지 Studio 화면을 유지해 주세요."); return; }
        setActiveView(view);
      }} onRecord={() => {
        if (studioStatus.busy) { setToast("모자이크가 완성된 뒤 기록을 추가할 수 있어요."); return; }
        setComposerOpen(true);
      }} />
      {composerOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="composer-title">
          <section className="composer">
            <div className="composer-head"><span>지금의 순간</span><button className="icon-button composer-close" onClick={() => setComposerOpen(false)} aria-label="닫기"><X /></button></div>
            <h2 id="composer-title" className="serif">지금의 음악을<br />이 장소에 남겨요</h2>
            <div className="timeline-item composer-track">
              <div className="thumb">{track?.coverUrl ? <Image src={track.coverUrl} alt="" fill sizes="46px" /> : <Disc3 />}</div>
              <div><strong>{track?.title ?? "재생 중인 음악 없음"}</strong><span>{track?.artist ?? "Spotify"}</span></div>
            </div>
            <div className="field"><label>감정</label><div className="moods">{moodOptions.map((item) => <button className={`mood ${mood === item ? "selected" : ""}`} key={item} onClick={() => setMood(item)}>{item}</button>)}</div></div>
            <div className="field"><label htmlFor="note">지금의 일기</label><textarea id="note" maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="이 음악과 함께 기억하고 싶은 것을 적어보세요." /></div>
            <div className="photo-field">
              {photoPreview ? (
                <div className="photo-preview">
                  {/* A local object URL is intentionally used for the unsaved preview. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="선택한 순간 사진 미리보기" />
                  <button type="button" onClick={() => { URL.revokeObjectURL(photoPreview); setPhotoPreview(""); setPhoto(null); }}><X size={16} />사진 빼기</button>
                </div>
              ) : (
                <label className="photo-picker">
                  <Camera size={20} />
                  <span><strong>사진 한 장 추가</strong><small>카메라로 찍거나 보관함에서 선택하세요</small></span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={async (event) => {
                      const selected = event.target.files?.[0];
                      if (!selected) return;
                      try {
                        const prepared = await preparePhoto(selected);
                        setPhoto(prepared);
                        setPhotoPreview(URL.createObjectURL(prepared));
                      } catch {
                        setToast("사진을 준비하지 못했어요.");
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <label className="location-toggle">
              <input type="checkbox" checked={includeLocation} onChange={(event) => setIncludeLocation(event.target.checked)} />
              <Navigation size={17} /><span>현재 위치를 지도에 함께 저장</span>
            </label>
            <div className="composer-submit">
              <button className="btn btn-primary" onClick={saveMoment} disabled={saving}>{saving ? "저장 중…" : "이 순간 저장하기"}</button>
              <small>음악, 메모, 사진과 선택한 위치는 나에게만 보여요.</small>
            </div>
          </section>
        </div>
      ) : null}
      {confirmFinalize ? (
        <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="finalize-title">
          <section className="finalize-sheet">
            <span className="finalize-mark"><BookOpen /></span>
            <p>오늘의 기록을 한 장으로</p>
            <h2 id="finalize-title">지금 정산할까요?</h2>
            <div className="finalize-preview">
              <div><b>{moments.length}</b><span>직접 남긴 순간</span></div>
              <div><b>{locatedMoments.length}</b><span>지도에 남긴 장소</span></div>
              <div><b>{moments.filter((item) => item.photos.length).length}</b><span>함께 담을 사진</span></div>
            </div>
            <p className="finalize-note">정산하면 오늘의 카드는 보관함에 저장됩니다. 같은 날 다시 눌러도 순간이 중복되거나 늘어나지 않아요.</p>
            <div className="finalize-buttons">
              <button onClick={() => setConfirmFinalize(false)} disabled={finalizing}>아직 더 기록할게요</button>
              <button className="finalize-primary" onClick={finalizeDay} disabled={finalizing}>
                {finalizing ? <><LoaderCircle className="spin-icon" />정산 중…</> : "정산하고 카드 보기"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {recap ? <div className="recap-backdrop" role="dialog" aria-modal="true" aria-label="오늘의 정산 카드"><RecapCard recap={recap} onClose={() => setRecap(null)} onShare={shareRecap} onSaveImage={() => saveRecapImage()} onSaveArtwork={() => saveRecapImage("artwork")} onPlaylist={openPlaylistPicker} /></div> : null}
      {playlistOpen ? (
        <div className="confirm-backdrop playlist-backdrop" role="dialog" aria-modal="true" aria-labelledby="playlist-title">
          <section className="playlist-sheet">
            <div className="playlist-sheet-head"><div><p>오늘 들은 음악을 그대로</p><h2 id="playlist-title">Spotify에 저장</h2></div><button onClick={() => setPlaylistOpen(false)} aria-label="닫기"><X /></button></div>
            {playlistBusy && !playlists.length ? <div className="playlist-loading"><LoaderCircle className="spin-icon" />플레이리스트를 불러오는 중…</div> : null}
            {!playlistBusy && playlistNeedsReconnect ? (
              <div className="spotify-reconnect">
                <Music2 /><strong>Spotify 권한을 한 번 갱신해 주세요</strong>
                <p>플레이리스트 생성과 기존 목록 추가 권한이 새로 필요합니다.</p>
                <a href="/api/auth/spotify">Spotify 다시 연결</a>
              </div>
            ) : null}
            {!playlistNeedsReconnect && playlistsLoaded ? (
              <>
                <button className={`playlist-choice new-playlist-choice ${selectedPlaylistId === "" ? "selected" : ""}`} onClick={() => setSelectedPlaylistId("")}>
                  <span><Music2 /></span><div><strong>새 플레이리스트 만들기</strong><small>DAYTRACK · {recap?.date}</small></div><Check />
                </button>
                <div className="playlist-options">
                  {playlists.map((item) => (
                    <button className={`playlist-choice ${selectedPlaylistId === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelectedPlaylistId(item.id)}>
                      <span>{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="48px" /> : <Music2 />}</span>
                      <div><strong>{item.name}</strong><small>{item.total}곡 · {item.public ? "공개" : "비공개"}</small></div>
                      {selectedPlaylistId === item.id ? <Check /> : null}
                    </button>
                  ))}
                </div>
                <button className="playlist-save" onClick={saveToSpotify} disabled={playlistBusy}>{playlistBusy ? <><LoaderCircle className="spin-icon" />저장 중…</> : selectedPlaylistId ? "이 플레이리스트에 추가" : "새 플레이리스트 만들기"}</button>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}

function TodayView({ track, playback, progress, displayProgress, moments, syncing, onRecord, onMap }: {
  track: TrackState["track"];
  playback: TrackState | null;
  progress: number;
  displayProgress: number;
  moments: Moment[];
  syncing: boolean;
  onRecord: () => void;
  onMap: () => void;
}) {
  return (
    <>
      <p className="date-line">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" }).format(new Date())}</p>
      <div className="today-grid">
        <section>
          <div className="cover-wrap">
            {track?.coverUrl ? <Image className="cover" src={track.coverUrl} alt={`${track.title} 앨범 표지`} fill sizes="(max-width: 760px) calc(100vw - 40px), 580px" priority /> : <div className="cover-demo" />}
          </div>
          <div className="status"><Disc3 size={15} /><span>{playback?.playing ? "Spotify에서 재생 중" : "Spotify 연결됨"}</span><i className={`status-dot ${syncing ? "syncing" : ""}`} /></div>
          <h1 className="track-title serif">{track?.title ?? "음악을 재생해 주세요"}</h1>
          <p className="artist serif">{track?.artist ?? "Spotify"}</p>
          <p className="album serif">{track?.album ?? "현재 음악이 실시간으로 표시됩니다."}</p>
          <div className="progress" style={{ "--progress": `${progress}%` } as React.CSSProperties} />
          <div className="time"><span>{formatTime(displayProgress)}</span><span>{formatTime(track?.durationMs)}</span></div>
          <div className="actions">
            <button className="btn btn-primary" onClick={onRecord}><Disc3 size={18} />이 순간 기록하기</button>
            <button className="btn" onClick={onMap}><MapIcon size={18} />오늘의 지도 타임라인</button>
          </div>
          <MomentList moments={moments} />
        </section>
        <aside className="side-note">
          <h2 className="serif">오늘은 어떤 소리와<br />장소로 기억될까요</h2>
          <p>기록 버튼을 누르면 음악, 감정, 메모와 현재 위치가 하나의 순간으로 저장됩니다. 하루가 끝나면 지도 위에서 시간순으로 다시 볼 수 있어요.</p>
          <div className="stat-row">
            <div className="stat"><b>{moments.length}</b><span>기록한 순간</span></div>
            <div className="stat"><b>{moments.filter((item) => item.location).length}</b><span>지도 위치</span></div>
            <div className="stat"><b>{moments.at(-1) ? new Date(moments.at(-1)!.occurredAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "—"}</b><span>최근 기록</span></div>
          </div>
        </aside>
      </div>
    </>
  );
}

function MapTimeline({ moments, locatedMoments, currentLocation, onRecord, onFinalize, finalizing }: {
  moments: Moment[];
  locatedMoments: Moment[];
  currentLocation: CurrentLocation | null;
  onRecord: () => void;
  onFinalize: () => void;
  finalizing: boolean;
}) {
  return (
    <section className="map-screen">
      <div className="view-heading">
        <div><p>{new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}</p><h1 className="serif">하루 지도 타임라인</h1></div>
        <button className="text-action finalize-trigger" onClick={onFinalize} disabled={finalizing}>
          {finalizing ? <><LoaderCircle className="spin-icon" />정산 중…</> : "오늘을 정산하기"}
        </button>
      </div>
      <div className="map-frame">
        <DayMap moments={locatedMoments} currentLocation={currentLocation} />
      </div>
      {!locatedMoments.length ? <div className="map-empty"><MapIcon /><span><strong>아직 지도 기록이 없어요</strong><small>첫 순간을 저장하면 이곳에 오늘의 동선이 그려져요.</small></span><button onClick={onRecord}>첫 순간 저장</button></div> : null}
      <div className="journey-summary"><strong>{locatedMoments.length}개의 장소</strong><span>{moments.length}개의 음악 기록</span><button onClick={onRecord}><Navigation size={16} />현재 위치에 저장</button></div>
      <MomentList moments={moments} mapTimeline />
    </section>
  );
}

function MomentList({ moments, mapTimeline = false }: { moments: Moment[]; mapTimeline?: boolean }) {
  return (
    <div className={`timeline ${mapTimeline ? "map-timeline" : ""}`}>
      <div className="timeline-head"><h2>{mapTimeline ? "시간순 음악 여정" : "오늘의 기록"}</h2><span className="timeline-time">{moments.length}곡</span></div>
      {!moments.length ? <p className="empty-copy">기록한 순간이 여기에 시간순으로 쌓입니다.</p> : null}
      {moments.map((item, index) => (
        <article className={`moment-card ${item.photos?.length ? "has-photo" : ""}`} key={item.id}>
          {item.photos?.[0] ? (
            <div className="moment-photo">
              {/* Authenticated image routes cannot be optimized by the public image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.photos[0].url} alt={`${item.title} 순간 사진`} />
            </div>
          ) : null}
          <div className="moment-card-body">
            <div className="thumb">{item.coverUrl ? <Image src={item.coverUrl} alt="" fill sizes="46px" /> : <Disc3 size={20} />}</div>
            <div className="moment-copy">
              <strong>{mapTimeline && item.location ? `${index + 1}. ` : ""}{item.title}</strong>
              <span>{item.artist}</span>
              {item.note ? <p>{item.note}</p> : null}
              {item.location ? <small><Navigation size={12} />{item.location.placeLabel || "저장한 위치"}</small> : null}
            </div>
            <time className="timeline-time">{new Date(item.occurredAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time>
          </div>
        </article>
      ))}
    </div>
  );
}

function CalendarView({ moments }: { moments: Moment[] }) {
  const today = new Date();
  const days = Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, index) => index + 1);
  return <section className="utility-screen"><div className="view-heading"><div><p>{today.getFullYear()}년</p><h1 className="serif">{today.getMonth() + 1}월의 기록</h1></div></div><div className="calendar-grid">{["일","월","화","수","목","금","토"].map((day) => <b key={day}>{day}</b>)}{Array.from({ length: new Date(today.getFullYear(), today.getMonth(), 1).getDay() }, (_, i) => <span key={`blank-${i}`} />)}{days.map((day) => <span className={day === today.getDate() ? "today" : ""} key={day}>{day}{day === today.getDate() && moments.length ? <i /> : null}</span>)}</div><MomentList moments={moments} /></section>;
}

function ArchiveView({ recaps, onOpen }: { recaps: Recap[]; onOpen: (recap: Recap) => void }) {
  return (
    <section className="utility-screen archive-screen">
      <div className="view-heading"><div><p>완료된 하루는 여기에</p><h1 className="serif">정산 카드 보관함</h1></div><Archive /></div>
      {!recaps.length ? (
        <div className="archive-empty"><BookOpen /><strong>아직 완성된 카드가 없어요</strong><p>지도에서 ‘오늘을 정산하기’를 누르면 이곳에 계속 보관됩니다.</p></div>
      ) : (
        <div className="recap-library">
          {recaps.map((item) => (
            <button className="recap-library-item" key={item.id} onClick={() => onOpen(item)}>
              <div className="library-covers">
                {item.items.slice(0, 3).map((track) => (
                  <span key={track.id}>{track.coverUrl ? <Image src={track.coverUrl} alt="" fill sizes="72px" /> : <Disc3 />}</span>
                ))}
              </div>
              <div className="library-copy">
                <time>{new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${item.date}T12:00:00Z`))}</time>
                <strong>{item.title}</strong>
                <small>{item.moments}개의 순간 · {item.stats.tracks}곡 · {item.stats.places}곳</small>
                {item.items.some((track) => track.photoAssetId) ? <em><Camera />사진 포함</em> : null}
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsView({ session, installed, onInstall }: { session: SessionState; installed: boolean; onInstall: () => void }) {
  return <section className="utility-screen"><div className="view-heading"><div><p>{session.user?.displayName}</p><h1 className="serif">설정</h1></div><Settings /></div><div className="settings-list"><div><LocateFixed /><span><strong>위치 저장</strong><small>기록할 때마다 선택</small></span><b>수동</b></div><div><Music2 /><span><strong>Spotify 동기화</strong><small>재생 중 8초마다 확인</small></span><b>연결됨</b></div><button onClick={onInstall}><Smartphone /><span><strong>홈 화면 앱</strong><small>{installed ? "설치됨" : "앱처럼 빠르게 실행"}</small></span><b>{installed ? <Check /> : "추가"}</b></button></div></section>;
}

function BottomNavV2({ activeView, busy, onChange, onRecord }: { activeView: ActiveView; busy: boolean; onChange: (view: ActiveView) => void; onRecord: () => void }) {
  return <nav className={`bottom-nav ${busy ? "studio-busy" : ""}`} aria-label="주요 메뉴">
    <button type="button" disabled={busy} className={`nav-item ${activeView === "today" || activeView === "map" ? "active" : ""}`} onClick={() => onChange("today")}><Disc3 size={20} />오늘</button>
    <button type="button" disabled={busy} className={`nav-item ${activeView === "calendar" ? "active" : ""}`} onClick={() => onChange("calendar")}><CalendarDays size={20} />타임라인</button>
    <button type="button" disabled={busy} className="nav-item nav-record" onClick={onRecord} aria-label="새 기록"><span className="record-circle" />기록</button>
    <button type="button" className={`nav-item ${activeView === "studio" ? "active" : ""}`} onClick={() => onChange("studio")}><Grid3X3 size={20} />{busy ? "생성 중" : "Studio"}<sup>β</sup></button>
    <button type="button" disabled={busy} className={`nav-item ${activeView === "archive" ? "active" : ""}`} onClick={() => onChange("archive")}><Library size={20} />보관함</button>
  </nav>;
}

function studioStatusLabel(_busy: boolean) { return "생성 중"; }
function BottomNav({ activeView, busy, onChange, onRecord }: { activeView: ActiveView; busy: boolean; onChange: (view: ActiveView) => void; onRecord: () => void }) {
  if (activeView === "studio" || activeView === "today" || activeView === "calendar" || activeView === "map" || activeView === "archive" || activeView === "settings") return <nav className={`bottom-nav ${busy ? "studio-busy" : ""}`} aria-label="주요 메뉴"><button disabled={busy} className={`nav-item ${activeView === "today" ? "active" : ""}`} onClick={() => onChange("today")}><Disc3 size={19} />오늘</button><button disabled={busy} className={`nav-item ${activeView === "calendar" ? "active" : ""}`} onClick={() => onChange("calendar")}><CalendarDays size={19} />달력</button><button disabled={busy} className="nav-item" onClick={onRecord} aria-label="새 기록"><span className="record-circle" />기록</button><button disabled={busy} className={`nav-item ${activeView === "map" ? "active" : ""}`} onClick={() => onChange("map")}><MapIcon size={19} />지도</button><button className={`nav-item ${activeView === "studio" ? "active" : ""}`} onClick={() => onChange("studio")}><Grid3X3 size={19} />{busy ? `${studioStatusLabel(busy)}` : "Studio"}<sup>β</sup></button><button disabled={busy} className={`nav-item ${activeView === "archive" ? "active" : ""}`} onClick={() => onChange("archive")}><Library size={19} />보관함</button></nav>;
  return <nav className="bottom-nav" aria-label="주요 메뉴"><button className={`nav-item ${activeView === "today" ? "active" : ""}`} onClick={() => onChange("today")}><Disc3 size={19} />오늘</button><button className={`nav-item ${activeView === "calendar" ? "active" : ""}`} onClick={() => onChange("calendar")}><CalendarDays size={19} />달력</button><button className="nav-item" onClick={onRecord} aria-label="새 기록"><span className="record-circle" />기록</button><button className={`nav-item ${activeView === "map" ? "active" : ""}`} onClick={() => onChange("map")}><MapIcon size={19} />지도</button><button className={`nav-item ${activeView === "archive" ? "active" : ""}`} onClick={() => onChange("archive")}><Library size={19} />보관함</button></nav>;
}
void BottomNav;
