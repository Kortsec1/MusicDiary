/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image elements. */
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { buildRecapPayload } from "@/lib/recap";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function routePoints(items: Array<{ location: { latitude: number; longitude: number } | null }>) {
  const locations = items.flatMap((item) => item.location ? [item.location] : []);
  if (!locations.length) return [];
  const latitudes = locations.map((item) => item.latitude);
  const longitudes = locations.map((item) => item.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  return locations.map((item) => ({
    x: 70 + ((item.longitude - minLng) / Math.max(maxLng - minLng, 0.001)) * 720,
    y: 270 - ((item.latitude - minLat) / Math.max(maxLat - minLat, 0.001)) * 190,
  }));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const recap = await buildRecapPayload(id, user.id);
  if (!recap) return new Response("Not found", { status: 404 });
  const photoId = recap.items.find((item) => item.photoAssetId)?.photoAssetId;
  const photo = photoId ? await prisma.mediaAsset.findFirst({
    where: { id: photoId, userId: user.id },
    select: { data: true, mimeType: true },
  }) : null;
  const photoUrl = photo?.data ? `data:${photo.mimeType};base64,${Buffer.from(photo.data).toString("base64")}` : null;
  const points = routePoints(recap.items);
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const hours = recap.items.map((item) => new Date(item.occurredAt).getHours());
  const averageHour = hours.length ? hours.reduce((sum, hour) => sum + hour, 0) / hours.length : 12;
  const dayCharacter = averageHour >= 20 ? "밤의 산책자" : averageHour >= 16 ? "해질녘 수집가" : averageHour >= 12 ? "오후의 탐험가" : "아침의 선곡가";
  const counts = new Map<string, number>();
  recap.items.forEach((item) => counts.set(item.title, (counts.get(item.title) ?? 0) + 1));
  const repeated = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const dateLabel = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long", timeZone: "UTC" })
    .format(new Date(`${recap.date}T12:00:00Z`));
  const [regularFont, boldFont] = await Promise.all([
    fetch(new URL("/fonts/Pretendard-Regular.woff", request.url)).then((response) => response.arrayBuffer()),
    fetch(new URL("/fonts/Pretendard-Bold.woff", request.url)).then((response) => response.arrayBuffer()),
  ]);
  const albumMap = new Map<string, { title: string; coverUrl: string | null; count: number }>();
  recap.items.forEach((item) => {
    const key = `${item.albumTitle}:${item.coverUrl ?? ""}`;
    const current = albumMap.get(key);
    if (current) current.count += 1;
    else albumMap.set(key, { title: item.albumTitle, coverUrl: item.coverUrl, count: 1 });
  });
  const albums = [...albumMap.values()].sort((a, b) => b.count - a.count).slice(0, 9);
  if (new URL(request.url).searchParams.get("variant") === "artwork") {
    const hero = albums[0];
    const rest = albums.slice(1);
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#171512", color: "#f2ecdf", padding: 48, fontFamily: "Pretendard" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
            <span>DAY / TRACK · {recap.date.replaceAll("-", ".")}</span><span>LISTENING FREQUENCY</span>
          </div>
          <div style={{ display: "flex", whiteSpace: "nowrap", marginTop: 18, fontSize: 54, fontWeight: 700, letterSpacing: -4 }}>오늘의 앨범 모자이크</div>
          <div style={{ flex: 1, display: "flex", gap: 10, marginTop: 30, overflow: "hidden" }}>
            <div style={{ width: "58%", display: "flex", position: "relative", background: "#302b27" }}>
              {hero?.coverUrl ? <img src={hero.coverUrl} alt={hero.title} width="100%" height="100%" style={{ objectFit: "contain" }} /> : <div style={{ margin: "auto", fontSize: 36 }}>{hero?.title || "NO ALBUM"}</div>}
              {hero ? <div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", background: "#791f2b", padding: "8px 13px", fontSize: 22, fontWeight: 700 }}>{hero.count}×</div> : null}
            </div>
            <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {rest.map((album, index) => (
                <div key={`${album.title}-${index}`} style={{ width: rest.length <= 2 ? "100%" : "calc(50% - 5px)", height: rest.length <= 2 ? "calc(50% - 5px)" : "calc(33.333% - 7px)", display: "flex", position: "relative", background: index % 2 ? "#791f2b" : "#ded3c2", overflow: "hidden" }}>
                  {album.coverUrl ? <img src={album.coverUrl} alt={album.title} width="100%" height="100%" style={{ objectFit: "contain" }} /> : <span style={{ margin: "auto", padding: 12, fontSize: 18 }}>{album.title}</span>}
                  {album.count > 1 ? <span style={{ position: "absolute", right: 8, bottom: 8, display: "flex", background: "#171512", padding: "5px 8px", fontSize: 15, fontWeight: 700 }}>{album.count}×</span> : null}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 30 }}>
            <div style={{ display: "flex", flexDirection: "column" }}><span style={{ color: "#b8aa99", fontSize: 16 }}>가장 오래 머문 앨범</span><b style={{ marginTop: 7, fontSize: 30 }}>{hero?.title || "오늘의 음악"}</b></div>
            <div style={{ display: "flex", color: "#b8aa99", fontSize: 15 }}>Album artwork from Spotify · open.spotify.com</div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
        headers: { "Content-Disposition": `attachment; filename="daytrack-artwork-${recap.date}.png"` },
        fonts: [
          { name: "Pretendard", data: regularFont, weight: 400 },
          { name: "Pretendard", data: boldFont, weight: 700 },
        ],
      },
    );
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f2ecdf", color: "#181714", padding: "58px 64px", fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#791f2b", fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
          <span>{dateLabel}</span><span>DAY / TRACK</span>
        </div>
        <div style={{ display: "flex", whiteSpace: "nowrap", fontSize: 76, lineHeight: 1, fontWeight: 700, letterSpacing: -5, marginTop: 20 }}>오늘의 사운드트랙</div>
        <div style={{ display: "flex", marginTop: 42, height: 320, border: "3px solid #181714", boxShadow: "12px 12px 0 #791f2b", background: "#e5ddce", position: "relative", overflow: "hidden" }}>
          <svg width="100%" height="100%" viewBox="0 0 860 320">
            <path d="M 0 75 H 860 M 0 160 H 860 M 0 245 H 860 M 170 0 V 320 M 430 0 V 320 M 690 0 V 320" stroke="#c8bdad" strokeWidth="2" />
            {path ? <path d={path} fill="none" stroke="#791f2b" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {points.map((point, index) => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="22" fill="#791f2b" stroke="#f2ecdf" strokeWidth="6" />)}
            {points.map((point, index) => <text key={index} x={point.x} y={point.y + 8} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700">{index + 1}</text>)}
          </svg>
          <div style={{ position: "absolute", left: 22, bottom: 18, display: "flex", padding: "8px 12px", background: "#f2ecdf", color: "#791f2b", fontSize: 18, fontWeight: 700 }}>{recap.stats.places}곳의 오늘</div>
        </div>
        <div style={{ display: "flex", marginTop: 42, gap: 36, height: 340 }}>
          <div style={{ width: "45%", display: "flex", position: "relative", background: "#ded3c2", border: "2px solid #b7aa98", overflow: "hidden" }}>
            {/* ImageResponse requires a native img element for embedded data URLs. */}
            {photoUrl ? <img src={photoUrl} alt="오늘의 사진" width="100%" height="100%" style={{ objectFit: "cover" }} /> : <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", color: "#791f2b", fontSize: 32, fontWeight: 700 }}>NO PHOTO<br />JUST MUSIC</div>}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", color: "#791f2b", fontSize: 38, lineHeight: 1.35, fontWeight: 700 }}>“{recap.summary || "좋아하는 음악과 함께 지나온 오늘의 장면들."}”</div>
            <div style={{ display: "flex", gap: 18 }}>
              {[["곡", recap.stats.tracks], ["장소", recap.stats.places], ["분", recap.stats.durationMinutes]].map(([label, value]) => (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", borderTop: "3px solid #181714", paddingTop: 12 }}>
                  <b style={{ fontSize: 42 }}>{value}</b><span style={{ color: "#6e665b", fontSize: 17 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 42, borderTop: "3px solid #181714", borderBottom: "3px solid #181714", padding: "26px 0", gap: 28 }}>
          <div style={{ width: "36%", display: "flex", flexDirection: "column" }}><span style={{ color: "#791f2b", fontSize: 17, fontWeight: 700 }}>TODAY&apos;S CHARACTER</span><b style={{ fontSize: 34, marginTop: 8 }}>{dayCharacter}</b></div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}><span style={{ color: "#791f2b", fontSize: 17, fontWeight: 700 }}>MOST PLAYED</span><b style={{ fontSize: 30, marginTop: 8 }}>{repeated ? `${repeated[0]} · ${repeated[1]}회` : "오늘의 첫 재생"}</b></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
          {recap.items.slice(0, 4).map((item, index) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", minHeight: 62, borderBottom: "1px solid #b9ad9d" }}>
              <span style={{ width: 42, color: "#791f2b", fontWeight: 700 }}>{String(index + 1).padStart(2, "0")}</span>
              <b style={{ flex: 1, fontSize: 22 }}>{item.title}</b>
              <span style={{ color: "#6e665b", fontSize: 18 }}>{item.artist}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", color: "#791f2b", fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>
          <span>나의 하루를 음악으로</span><span>Spotify에서 감상하기</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: { "Content-Disposition": `attachment; filename="daytrack-${recap.date}.png"` },
      fonts: [
        { name: "Pretendard", data: regularFont, weight: 400 },
        { name: "Pretendard", data: boldFont, weight: 700 },
      ],
    },
  );
}
