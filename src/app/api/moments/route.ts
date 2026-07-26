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
    },
    orderBy: { occurredAt: "asc" },
  });
  return NextResponse.json({ moments: entries.map(serializeMoment), serverTime: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createMomentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid moment" }, { status: 400 });

  try {
    const accessToken = await getSpotifyAccessToken(user.id);
    const spotifyResponse = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (spotifyResponse.status === 204) {
      return NextResponse.json({ error: "현재 재생 중인 음악이 없습니다." }, { status: 409 });
    }
    if (!spotifyResponse.ok) {
      return NextResponse.json({ error: "Spotify 재생 정보를 가져오지 못했습니다." }, { status: 502 });
    }
    const playback = await spotifyResponse.json();
    if (!playback.item) return NextResponse.json({ error: "현재 재생 중인 음악이 없습니다." }, { status: 409 });

    const occurredAt = new Date(parsed.data.occurredAt);
    const entry = await prisma.$transaction(async (tx) => {
      const track = await persistSpotifyTrack(tx, playback.item);
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
      const dedupeKey = `${user.id}:${playback.item.id}:${estimatedStart.toISOString()}:manual`;
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
      return tx.diaryEntry.create({
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
        include: {
          location: true,
          track: {
            include: {
              album: true,
              artists: { orderBy: { position: "asc" }, include: { artist: true } },
            },
          },
        },
      });
    });
    return NextResponse.json({ moment: serializeMoment(entry) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "기록 저장에 실패했습니다." }, { status: 500 });
  }
}
