import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getSpotifyAccessToken } from "@/lib/spotify/auth";
import { persistSpotifyTrack } from "@/lib/spotify/persist";

export const dynamic = "force-dynamic";

const createMomentSchema = z.object({
  note: z.string().max(4000).default(""),
  mood: z.string().max(40).optional(),
  occurredAt: z.string().datetime(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().nonnegative().optional(),
    placeLabel: z.string().max(200).optional(),
  }).optional(),
  trackId: z.string().min(1).max(100).optional(),
});

type MomentRecord = Prisma.DiaryEntryGetPayload<{
  include: {
    location: true;
    track: {
      include: {
        album: true;
        artists: { include: { artist: true } };
      };
    };
    mediaAssets: true;
  };
}>;

function serializeMoment(entry: MomentRecord) {
  return {
    id: entry.id,
    occurredAt: entry.occurredAt.toISOString(),
    note: entry.note,
    mood: entry.mood,
    title: entry.track.title,
    artist: entry.track.artists.map(({ artist }) => artist.name).join(", "),
    album: entry.track.album?.title ?? "",
    coverUrl: entry.track.album?.coverImageUrl ?? null,
    spotifyUrl: entry.track.externalUrl,
    photos: entry.mediaAssets.map((asset) => ({
      id: asset.id,
      url: `/api/media/${asset.id}`,
      width: asset.width,
      height: asset.height,
    })),
    location: entry.location ? {
      latitude: Number(entry.location.latitude),
      longitude: Number(entry.location.longitude),
      accuracyMeters: entry.location.accuracyMeters,
      placeLabel: entry.location.placeLabel,
      neighborhood: entry.location.neighborhood,
      city: entry.location.city,
    } : null,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const startParam = request.nextUrl.searchParams.get("start");
  const endParam = request.nextUrl.searchParams.get("end");
  const now = new Date();
  const start = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = endParam ? new Date(endParam) : new Date(start.getTime() + 86_400_000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const entries = await prisma.diaryEntry.findMany({
    where: { userId: user.id, deletedAt: null, occurredAt: { gte: start, lt: end } },
    include: {
      location: true,
      track: {
        include: {
          album: true,
          artists: { orderBy: { position: "asc" }, include: { artist: true } },
        },
      },
      mediaAssets: { where: { mediaType: "IMAGE" }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { occurredAt: "asc" },
  });
  return NextResponse.json({ moments: entries.map(serializeMoment), serverTime: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
  const form = isMultipart ? await request.formData() : null;
  const rawMoment = form
    ? JSON.parse(String(form.get("moment") || "{}"))
    : await request.json();
  const parsed = createMomentSchema.safeParse(rawMoment);
  if (!parsed.success) return NextResponse.json({ error: "Invalid moment" }, { status: 400 });
  const photo = form?.get("photo");
  const maxPhotoBytes = Number(process.env.MAX_MOMENT_PHOTO_BYTES || 3_500_000);
  if (photo instanceof File && (!photo.type.startsWith("image/") || photo.size > maxPhotoBytes)) {
    return NextResponse.json({ error: "사진은 3.5MB 이하의 이미지 파일만 저장할 수 있어요." }, { status: 413 });
  }

  try {
    const accessToken = await getSpotifyAccessToken(user.id);
    const spotifyResponse = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!spotifyResponse.ok && spotifyResponse.status !== 204) {
      return NextResponse.json({ error: "Spotify 재생 정보를 가져오지 못했습니다." }, { status: 502 });
    }
    const playback = spotifyResponse.status === 204 ? {} : await spotifyResponse.json();
    let spotifyTrack = playback.item;
    if ((!spotifyTrack || spotifyTrack.type !== "track") && parsed.data.trackId) {
      const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(parsed.data.trackId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (trackResponse.ok) spotifyTrack = await trackResponse.json();
    }
    if (!spotifyTrack || spotifyTrack.type === "episode") {
      return NextResponse.json({ error: "저장할 Spotify 음악을 찾지 못했어요. 음악 화면을 새로고침해 주세요." }, { status: 409 });
    }

    const occurredAt = new Date(parsed.data.occurredAt);
    const photoBytes = photo instanceof File ? Buffer.from(await photo.arrayBuffer()) : null;
    const entry = await prisma.$transaction(async (tx) => {
      const track = await persistSpotifyTrack(tx, spotifyTrack);
      const location = parsed.data.location ? await tx.locationSnapshot.create({
        data: {
          userId: user.id,
          latitude: parsed.data.location.latitude,
          longitude: parsed.data.location.longitude,
          accuracyMeters: parsed.data.location.accuracyMeters,
          placeLabel: parsed.data.location.placeLabel ?? "현재 위치",
          source: "GPS",
          capturedAt: occurredAt,
        },
      }) : null;
      const estimatedStart = new Date(occurredAt.getTime() - Number(playback.progress_ms ?? 0));
      const dedupeKey = `${user.id}:${spotifyTrack.id}:${estimatedStart.toISOString()}:manual`;
      const listeningEvent = await tx.listeningEvent.upsert({
        where: { dedupeKey },
        create: {
          userId: user.id,
          trackId: track.id,
          locationSnapshotId: location?.id,
          source: "AUTO_CURRENT",
          playedAt: estimatedStart,
          progressMs: playback.progress_ms,
          isPlaying: Boolean(playback.is_playing),
          dedupeKey,
          rawMetadata: playback as Prisma.InputJsonValue,
        },
        update: {
          locationSnapshotId: location?.id,
          progressMs: playback.progress_ms,
          isPlaying: Boolean(playback.is_playing),
        },
      });
      const diaryEntry = await tx.diaryEntry.create({
        data: {
          userId: user.id,
          trackId: track.id,
          sourceListeningEventId: listeningEvent.id,
          locationSnapshotId: location?.id,
          occurredAt,
          note: parsed.data.note,
          mood: parsed.data.mood,
          tags: [],
          locationVisible: Boolean(location),
          layoutConfig: {},
        },
      });
      if (photoBytes && photo instanceof File) {
        await tx.mediaAsset.create({
          data: {
            userId: user.id,
            diaryEntryId: diaryEntry.id,
            mediaType: "IMAGE",
            storageProvider: "postgres",
            storageKey: `${user.id}/${diaryEntry.id}/${crypto.randomUUID()}`,
            mimeType: photo.type,
            byteSize: photo.size,
            data: photoBytes,
          },
        });
      }
      return tx.diaryEntry.findUniqueOrThrow({
        where: { id: diaryEntry.id },
        include: {
          location: true,
          mediaAssets: { where: { mediaType: "IMAGE" }, orderBy: { sortOrder: "asc" } },
          track: {
            include: {
              album: true,
              artists: { orderBy: { position: "asc" }, include: { artist: true } },
            },
          },
        }
      });
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });
    return NextResponse.json({ moment: serializeMoment(entry) }, { status: 201 });
  } catch (error) {
    console.error("moment.create.failed", error);
    return NextResponse.json({ error: "기록 저장에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
