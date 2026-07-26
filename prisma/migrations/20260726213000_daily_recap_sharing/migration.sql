ALTER TABLE "DailyAlbum"
ADD COLUMN "shareTokenHash" TEXT,
ADD COLUMN "sharedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "DailyAlbum_shareTokenHash_key" ON "DailyAlbum"("shareTokenHash");
