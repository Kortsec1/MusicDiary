-- CreateEnum
CREATE TYPE "AutoCaptureMode" AS ENUM ('MANUAL', 'SMART', 'FULL');

-- CreateEnum
CREATE TYPE "LocationMode" AS ENUM ('OFF', 'MANUAL', 'SMART');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'LINK', 'FRIENDS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GPS', 'MANUAL', 'REVERSE_GEOCODED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "ListeningSource" AS ENUM ('AUTO_CURRENT', 'AUTO_RECENT', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "AlbumStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "spotifyAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "autoCaptureMode" "AutoCaptureMode" NOT NULL DEFAULT 'SMART',
    "locationMode" "LocationMode" NOT NULL DEFAULT 'OFF',
    "dailyAlbumCloseHour" INTEGER NOT NULL DEFAULT 22,
    "dailyAlbumCloseMinute" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotifyConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "grantedScopes" TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotifyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerArtistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalUrl" TEXT,
    "imageUrl" TEXT,
    "metadataSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAlbumId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "albumType" TEXT,
    "releaseDate" TEXT,
    "coverImageUrl" TEXT,
    "externalUrl" TEXT,
    "coverFetchedAt" TIMESTAMP(3),
    "metadataSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTrackId" TEXT NOT NULL,
    "albumId" UUID,
    "uri" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "metadataSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackArtist" (
    "trackId" UUID NOT NULL,
    "artistId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "TrackArtist_pkey" PRIMARY KEY ("trackId","artistId")
);

-- CreateTable
CREATE TABLE "LocationSnapshot" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "placeLabel" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "source" "LocationSource" NOT NULL,
    "isEstimated" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "locationSnapshotId" UUID,
    "source" "ListeningSource" NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressMs" INTEGER,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT NOT NULL,
    "rawMetadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "sourceListeningEventId" UUID,
    "locationSnapshotId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(4000) NOT NULL,
    "mood" VARCHAR(40),
    "tags" TEXT[],
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "locationVisible" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT NOT NULL DEFAULT 'liner-note',
    "layoutConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "diaryEntryId" UUID NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "thumbnailStorageKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAlbum" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "albumDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "coverDiaryEntryId" UUID,
    "status" "AlbumStatus" NOT NULL DEFAULT 'DRAFT',
    "themeId" TEXT NOT NULL DEFAULT 'paper',
    "stats" JSONB NOT NULL,
    "spotifyPlaylistId" TEXT,
    "spotifyPlaylistUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAlbumItem" (
    "id" UUID NOT NULL,
    "dailyAlbumId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "diaryEntryId" UUID,
    "listeningEventId" UUID,
    "position" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAlbumItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotifySyncState" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recentlyPlayedAfterMs" BIGINT NOT NULL DEFAULT 0,
    "lastCurrentTrackId" TEXT,
    "currentTrackStartedAt" TIMESTAMP(3),
    "lastPollAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "backoffUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotifySyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_spotifyAccountId_key" ON "User"("spotifyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpotifyConnection_userId_key" ON "SpotifyConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_provider_providerArtistId_key" ON "Artist"("provider", "providerArtistId");

-- CreateIndex
CREATE UNIQUE INDEX "Album_provider_providerAlbumId_key" ON "Album"("provider", "providerAlbumId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_provider_providerTrackId_key" ON "Track"("provider", "providerTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackArtist_trackId_position_key" ON "TrackArtist"("trackId", "position");

-- CreateIndex
CREATE INDEX "LocationSnapshot_userId_capturedAt_idx" ON "LocationSnapshot"("userId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ListeningEvent_dedupeKey_key" ON "ListeningEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "ListeningEvent_userId_playedAt_idx" ON "ListeningEvent"("userId", "playedAt");

-- CreateIndex
CREATE INDEX "ListeningEvent_userId_trackId_idx" ON "ListeningEvent"("userId", "trackId");

-- CreateIndex
CREATE INDEX "ListeningEvent_userId_source_idx" ON "ListeningEvent"("userId", "source");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_occurredAt_idx" ON "DiaryEntry"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_trackId_idx" ON "DiaryEntry"("userId", "trackId");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_isFavorite_idx" ON "DiaryEntry"("userId", "isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAlbum_userId_albumDate_key" ON "DailyAlbum"("userId", "albumDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAlbumItem_dailyAlbumId_position_key" ON "DailyAlbumItem"("dailyAlbumId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SpotifySyncState_userId_key" ON "SpotifySyncState"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotifyConnection" ADD CONSTRAINT "SpotifyConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackArtist" ADD CONSTRAINT "TrackArtist_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackArtist" ADD CONSTRAINT "TrackArtist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationSnapshot" ADD CONSTRAINT "LocationSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningEvent" ADD CONSTRAINT "ListeningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningEvent" ADD CONSTRAINT "ListeningEvent_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningEvent" ADD CONSTRAINT "ListeningEvent_locationSnapshotId_fkey" FOREIGN KEY ("locationSnapshotId") REFERENCES "LocationSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_sourceListeningEventId_fkey" FOREIGN KEY ("sourceListeningEventId") REFERENCES "ListeningEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_locationSnapshotId_fkey" FOREIGN KEY ("locationSnapshotId") REFERENCES "LocationSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_diaryEntryId_fkey" FOREIGN KEY ("diaryEntryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAlbum" ADD CONSTRAINT "DailyAlbum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAlbum" ADD CONSTRAINT "DailyAlbum_coverDiaryEntryId_fkey" FOREIGN KEY ("coverDiaryEntryId") REFERENCES "DiaryEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAlbumItem" ADD CONSTRAINT "DailyAlbumItem_dailyAlbumId_fkey" FOREIGN KEY ("dailyAlbumId") REFERENCES "DailyAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAlbumItem" ADD CONSTRAINT "DailyAlbumItem_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAlbumItem" ADD CONSTRAINT "DailyAlbumItem_diaryEntryId_fkey" FOREIGN KEY ("diaryEntryId") REFERENCES "DiaryEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAlbumItem" ADD CONSTRAINT "DailyAlbumItem_listeningEventId_fkey" FOREIGN KEY ("listeningEventId") REFERENCES "ListeningEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotifySyncState" ADD CONSTRAINT "SpotifySyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A daily album item must point to at least one source moment.
ALTER TABLE "DailyAlbumItem" ADD CONSTRAINT "DailyAlbumItem_source_check"
CHECK ("diaryEntryId" IS NOT NULL OR "listeningEventId" IS NOT NULL);
