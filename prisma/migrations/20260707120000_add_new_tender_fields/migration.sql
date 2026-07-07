-- AlterTable: gem_tenders
ALTER TABLE "gem_tenders" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "downloadLink" TEXT,
ADD COLUMN     "markedStatus" TEXT,
ADD COLUMN     "ready" TEXT,
ADD COLUMN     "scrapedDate" TEXT,
ADD COLUMN     "searchKey" TEXT,
ADD COLUMN     "sheetStatus" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "t247Id" TEXT;

-- AlterTable: non_gem_tenders (add new column first, migrate data, then drop old)
ALTER TABLE "non_gem_tenders" ADD COLUMN "estimatedBidValue" TEXT;
UPDATE "non_gem_tenders" SET "estimatedBidValue" = "estimatedCost";
ALTER TABLE "non_gem_tenders" DROP COLUMN "estimatedCost";

ALTER TABLE "non_gem_tenders" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "downloadLink" TEXT,
ADD COLUMN     "markedStatus" TEXT,
ADD COLUMN     "ready" TEXT,
ADD COLUMN     "scrapedDate" TEXT,
ADD COLUMN     "searchKey" TEXT,
ADD COLUMN     "sheetStatus" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "t247Id" TEXT;
