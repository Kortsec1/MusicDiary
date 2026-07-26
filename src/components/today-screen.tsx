"use client";

import { BookOpen, CalendarDays, Disc3, Library, Menu, Settings, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

type Moment = { title: string; artist: string; time: string; note?: string };
const initialMoments: Moment[] = [
  { title: "Midnight City", artist: "M83", time: "21:41", note: "지금 재생 중" },
  { title: "Wait", artist: "M83", time: "21:32" },
  { title: "Outro", artist: "M83", time: "21:28" },
];

export function TodayScreen() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [mood, setMood] = useState("평온");
  const [moments, setMoments] = useState(initialMoments);
  const [toast, setToast] = useState("");

  useEffect(() => { localStorage.setItem("daytrack-draft", note); }, [note]);

  function saveMoment() {
    setMoments((items) => [{ title: "Midnight City", artist: "M83", time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }), note }, ...items]);
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
        <Menu size={20} aria-label="메뉴" />
      </header>
      <p className="date-line">2026년 7월 26일 일요일</p>
      <div className="today-grid">
        <section>
          <div className="cover-wrap" role="img" aria-label="Midnight City 앨범 표지 데모">
            <div className="cover-demo" />
          </div>
          <div className="status"><Disc3 size={15} /><span>조용히 기록 중</span><i className="status-dot" /></div>
          <h1 className="track-title serif">Midnight City</h1>
          <p className="artist serif">M83</p>
          <p className="album serif">Hurry Up, We&apos;re Dreaming</p>
          <div className="progress" />
          <div className="time"><span>1:37</span><span>4:03</span></div>
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
            <div className="stat"><b>21:41</b><span>최근 기록</span></div>
          </div>
          <p className="notice">스마트 자동 기록은 웹앱이 열려 있는 동안 작동하며, 다시 접속하면 Spotify 최근 재생 기록으로 가능한 범위에서 보완합니다.</p>
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
            <div className="timeline-item"><div className="thumb"><Disc3 /></div><div><strong>Midnight City</strong><span>M83 · Spotify 데모</span></div><span /></div>
            <div className="field"><label htmlFor="moment-time">날짜와 시간</label><input id="moment-time" type="datetime-local" defaultValue="2026-07-26T21:41" /></div>
            <div className="field"><label>감정</label><div className="moods">{["평온","기쁨","그리움","몰입"].map((item) => <button className={`mood ${mood === item ? "selected" : ""}`} key={item} onClick={() => setMood(item)}>{item}</button>)}</div></div>
            <div className="field"><label htmlFor="note">짧은 일기</label><textarea id="note" maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="이 음악과 함께 기억하고 싶은 것을 적어보세요." /></div>
            <button className="btn btn-primary" onClick={saveMoment}>비공개로 기록 저장</button>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
