"use client";

import {
  Bell, BookOpen, CalendarDays, Check, Disc3, Download, ExternalLink,
  Library, LocateFixed, Menu, Music2, Settings, Smartphone, UserRound, X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Moment = { title: string; artist: string; time: string; note?: string };
type SessionState = {
  connected: boolean;
  configured: boolean;
  user: { displayName: string; avatarUrl?: string } | null;
};
type TrackState = {
  playing: boolean;
  progressMs?: number;
  track: null | {
    title: string; artist: string; album?: string; coverUrl?: string;
    durationMs: number; spotifyUrl?: string;
  };
};
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const initialMoments: Moment[] = [
  { title: "Midnight City", artist: "M83", time: "21:41", note: "지금 재생 중" },
  { title: "Wait", artist: "M83", time: "21:32" },
  { title: "Outro", artist: "M83", time: "21:28" },
];

function formatTime(milliseconds = 0) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
    const hydrationTimer = window.setTimeout(() => {
      setPermissionsChecked(localStorage.getItem("daytrack-permissions-checked") === "true");
      setInstalled(window.matchMedia("(display-mode: standalone)").matches);
      void loadSession();
    }, 0);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", captureInstall);
    window.addEventListener("appinstalled", () => setInstalled(true), { once: true });
    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("beforeinstallprompt", captureInstall);
    };
  }, [loadSession]);

  async function requestPermissions() {
    setPermissionBusy(true);
    if ("geolocation" in navigator) {
      await new Promise<void>((resolve) => navigator.geolocation.getCurrentPosition(
        () => { setLocationState("허용됨"); resolve(); },
        () => { setLocationState("허용 안 됨"); resolve(); },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      ));
    } else {
      setLocationState("지원 안 됨");
    }
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
    return <main className="onboarding"><div className="onboarding-card"><div className="spinner" /><p>DAYTRACK 준비 중…</p></div></main>;
  }
  if (!permissionsChecked || !session.connected) {
    return (
      <main className="onboarding">
        <section className="onboarding-card">
          <div className="onboarding-mark"><Disc3 /><span>DAYTRACK</span></div>
          <h1 className="serif">음악과 함께<br />오늘을 시작하세요.</h1>
          <p className="onboarding-copy">처음 한 번만 권한과 Spotify 연결을 확인합니다. 위치는 순간 기록에만 사용하며 음악 토큰은 서버에서 암호화해 보관합니다.</p>

          <ol className="setup-list">
            <li className={permissionsChecked ? "done" : "active"}>
              <span className="step-icon">{permissionsChecked ? <Check /> : <LocateFixed />}</span>
              <div><strong>기기 권한 확인</strong><small>위치 {locationState} · 알림 {notificationState}</small></div>
              {!permissionsChecked && <button onClick={requestPermissions} disabled={permissionBusy}>{permissionBusy ? "확인 중…" : "권한 확인"}</button>}
            </li>
            <li className={session.connected ? "done" : permissionsChecked ? "active" : ""}>
              <span className="step-icon">{session.connected ? <Check /> : <Music2 />}</span>
              <div><strong>Spotify 연결</strong><small>{session.connected ? `${session.user?.displayName} 계정 연결됨` : "현재 재생 음악과 최근 기록 읽기"}</small></div>
              {!session.connected && permissionsChecked && session.configured && <a href="/api/auth/spotify">연결하기</a>}
            </li>
            <li className={installed ? "done" : ""}>
              <span className="step-icon">{installed ? <Check /> : <Smartphone />}</span>
              <div><strong>홈 화면에 추가</strong><small>{installed ? "앱 모드로 실행 중" : "전체 화면으로 빠르게 실행"}</small></div>
              {!installed && <button onClick={installApp}><Download /> 추가</button>}
            </li>
          </ol>

          {!session.configured && permissionsChecked && (
            <div className="spotify-setup">
              <strong>Spotify 앱 설정이 필요합니다</strong>
              <p>Spotify Developer Dashboard에서 앱을 만든 뒤 Redirect URI에 아래 주소를 등록하세요.</p>
              <code>https://daytrack-nine.vercel.app/api/auth/spotify/callback</code>
              <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Spotify 앱 만들기 <ExternalLink /></a>
            </div>
          )}
          <p className="privacy-note">권한을 거부해도 설정에서 나중에 변경할 수 있습니다.</p>
        </section>
      </main>
    );
  }

  return <DiaryHome session={session} onInstall={installApp} installed={installed} />;
}

function DiaryHome({ session, onInstall, installed }: { session: SessionState; onInstall: () => void; installed: boolean }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [mood, setMood] = useState("평온");
  const [moments, setMoments] = useState(initialMoments);
  const [toast, setToast] = useState("");
  const [playback, setPlayback] = useState<TrackState | null>(null);

  useEffect(() => {
    const draftTimer = window.setTimeout(() => setNote(localStorage.getItem("daytrack-draft") || ""), 0);
    const loadPlayback = async () => {
      const response = await fetch("/api/spotify/now", { cache: "no-store" });
      if (response.ok) setPlayback(await response.json());
    };
    void loadPlayback();
    const interval = window.setInterval(loadPlayback, 30_000);
    return () => {
      window.clearTimeout(draftTimer);
      window.clearInterval(interval);
    };
  }, []);
  useEffect(() => { localStorage.setItem("daytrack-draft", note); }, [note]);

  const track = playback?.track || {
    title: "재생 중인 음악이 없어요",
    artist: session.user?.displayName || "Spotify",
    album: "Spotify에서 음악을 재생해 보세요",
    durationMs: 0,
  };
  const progress = track.durationMs ? Math.min(100, ((playback?.progressMs || 0) / track.durationMs) * 100) : 0;

  function saveMoment() {
    setMoments((items) => [{
      title: track.title, artist: track.artist,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }), note,
    }, ...items]);
    setComposerOpen(false);
    setNote("");
    localStorage.removeItem("daytrack-draft");
    setToast("이 순간을 비공개 일기로 기록했어요.");
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <UserRound size={20} aria-label="프로필" />
        <div className="wordmark serif">DAYTRACK</div>
        {installed ? <Menu size={20} aria-label="메뉴" /> : <button className="icon-button" onClick={onInstall} aria-label="홈 화면에 추가"><Download size={20} /></button>}
      </header>
      <p className="date-line">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" }).format(new Date())}</p>
      <div className="today-grid">
        <section>
          <div className="cover-wrap" role="img" aria-label={`${track.title} 앨범 표지`}>
            {track.coverUrl ? <Image className="cover" src={track.coverUrl} alt="" fill sizes="(max-width: 760px) calc(100vw - 40px), 580px" priority /> : <div className="cover-demo" />}
          </div>
          <div className="status"><Disc3 size={15} /><span>{playback?.playing ? "Spotify에서 재생 중" : "Spotify 연결됨"}</span><i className="status-dot" /></div>
          <h1 className="track-title serif">{track.title}</h1>
          <p className="artist serif">{track.artist}</p>
          <p className="album serif">{track.album}</p>
          <div className="progress" style={{ "--progress": `${progress}%` } as React.CSSProperties} />
          <div className="time"><span>{formatTime(playback?.progressMs)}</span><span>{formatTime(track.durationMs)}</span></div>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setComposerOpen(true)}><Disc3 size={18} />이 순간 기록하기</button>
            <button className="btn" onClick={() => setToast("오늘의 앨범 초안을 준비했어요.")}><BookOpen size={18} />오늘의 앨범 정리하기</button>
          </div>
          <div className="timeline">
            <div className="timeline-head"><h2>오늘의 리스닝</h2><span className="timeline-time">{moments.length}곡</span></div>
            {moments.map((item, index) => (
              <div className="timeline-item" key={`${item.title}-${item.time}-${index}`}>
                <div className="thumb"><Disc3 size={20} /></div>
                <div><strong>{item.title}</strong><span>{item.note || item.artist}</span></div>
                <time className="timeline-time">{item.time}</time>
              </div>
            ))}
          </div>
        </section>
        <aside className="side-note">
          <h2 className="serif">오늘은 어떤 소리로<br />기억될까요?</h2>
          <p>노래를 중심에 두고, 그때의 장소와 감정을 곁에 적어 둡니다. 자동으로 모인 음악은 후보로만 남고, 당신이 고른 순간만 일기가 됩니다.</p>
          <div className="stat-row">
            <div className="stat"><b>{moments.length}</b><span>기록한 트랙</span></div>
            <div className="stat"><b>1</b><span>기록한 순간</span></div>
            <div className="stat"><b>{moments[0]?.time}</b><span>최근 기록</span></div>
          </div>
          <p className="notice">앱이 열려 있는 동안 Spotify 재생 상태를 확인하며, 다시 접속하면 최근 재생 기록으로 가능한 범위에서 보완합니다.</p>
        </aside>
      </div>
      <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className="nav-item active"><Disc3 size={19} />오늘</button>
        <button className="nav-item"><CalendarDays size={19} />달력</button>
        <button className="nav-item" onClick={() => setComposerOpen(true)} aria-label="새 기록"><span className="record-circle" />기록</button>
        <button className="nav-item"><Library size={19} />보관함</button>
        <button className="nav-item"><Settings size={19} />설정</button>
      </nav>
      {composerOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="composer-title">
          <section className="composer">
            <div className="composer-head"><span>새 기록</span><button className="nav-item" onClick={() => setComposerOpen(false)} aria-label="닫기"><X /></button></div>
            <h2 id="composer-title" className="serif">지금의 음악을<br />한 장면으로</h2>
            <div className="timeline-item"><div className="thumb"><Disc3 /></div><div><strong>{track.title}</strong><span>{track.artist} · Spotify</span></div><span /></div>
            <div className="field"><label htmlFor="moment-time">날짜와 시간</label><input id="moment-time" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></div>
            <div className="field"><label>감정</label><div className="moods">{["평온", "기쁨", "그리움", "몰입"].map((item) => <button className={`mood ${mood === item ? "selected" : ""}`} key={item} onClick={() => setMood(item)}>{item}</button>)}</div></div>
            <div className="field"><label htmlFor="note">짧은 일기</label><textarea id="note" maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="이 음악과 함께 기억하고 싶은 것을 적어보세요." /></div>
            <button className="btn btn-primary" onClick={saveMoment}>비공개로 기록 저장</button>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
