-- DAYTRACK uses Prisma from the server and does not expose tables through PostgREST.
-- RLS remains enabled as defense in depth and Data API roles receive no table access.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpotifyConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Artist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Album" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Track" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackArtist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LocationSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListeningEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiaryEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyAlbum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyAlbumItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpotifySyncState" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

CREATE INDEX "Track_albumId_idx" ON "Track"("albumId");
CREATE INDEX "TrackArtist_artistId_idx" ON "TrackArtist"("artistId");
CREATE INDEX "ListeningEvent_trackId_idx" ON "ListeningEvent"("trackId");
CREATE INDEX "ListeningEvent_locationSnapshotId_idx" ON "ListeningEvent"("locationSnapshotId");
CREATE INDEX "DiaryEntry_sourceListeningEventId_idx" ON "DiaryEntry"("sourceListeningEventId");
CREATE INDEX "DiaryEntry_locationSnapshotId_idx" ON "DiaryEntry"("locationSnapshotId");
CREATE INDEX "MediaAsset_userId_idx" ON "MediaAsset"("userId");
CREATE INDEX "MediaAsset_diaryEntryId_idx" ON "MediaAsset"("diaryEntryId");
CREATE INDEX "DailyAlbum_coverDiaryEntryId_idx" ON "DailyAlbum"("coverDiaryEntryId");
CREATE INDEX "DailyAlbumItem_trackId_idx" ON "DailyAlbumItem"("trackId");
CREATE INDEX "DailyAlbumItem_diaryEntryId_idx" ON "DailyAlbumItem"("diaryEntryId");
CREATE INDEX "DailyAlbumItem_listeningEventId_idx" ON "DailyAlbumItem"("listeningEventId");
