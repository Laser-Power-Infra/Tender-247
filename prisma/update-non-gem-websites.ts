import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl =
  process.env.ENVIRONMENT === "PROD"
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL_DEV;

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl!),
});

const YEAR_PREFIX = /^\d{4}_/;

function extractState(location: string): string | null {
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length !== 3) return null;
  return parts[1];
}

async function main() {
  console.log("Updating NonGemTender websites from location fields...");

  const tenders = await prisma.nonGemTender.findMany({
    where: {
      location: { not: null },
    },
    select: { id: true, referenceNo: true, location: true },
  });

  console.log(`Found ${tenders.length} tenders with location.`);

  let updated = 0;
  let skipped = 0;

  for (const tender of tenders) {
    const state = extractState(tender.location!);
    if (!state) {
      skipped++;
      continue;
    }

    const isYearPrefixed = YEAR_PREFIX.test(tender.referenceNo);

    const statusRecords = await prisma.tenderStatusTable.findMany({
      where: {
        state: { equals: state, mode: "insensitive" },
        website: { not: null },
        ...(isYearPrefixed ? { type: "NIC" } : {}),
      },
      select: { website: true },
    });

    const websites = statusRecords
      .map((r) => r.website!)
      .filter(Boolean)
      .join(",");

    if (!websites) {
      skipped++;
      continue;
    }

    await prisma.nonGemTender.update({
      where: { id: tender.id },
      data: { website: websites },
    });

    updated++;
  }

  console.log(`Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
