import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { RecapCard } from "@/components/recap-card";
import { prisma } from "@/lib/prisma";
import { buildRecapPayload } from "@/lib/recap";

export const dynamic = "force-dynamic";

export default async function SharedRecapPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shareTokenHash = createHash("sha256").update(token).digest("hex");
  const album = await prisma.dailyAlbum.findUnique({ where: { shareTokenHash } });
  if (!album || !album.sharedAt) notFound();
  const recap = await buildRecapPayload(album.id);
  if (!recap) notFound();
  return <main className="shared-recap"><RecapCard recap={recap} publicToken={token} /></main>;
}
