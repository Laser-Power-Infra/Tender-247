-- AlterTable
ALTER TABLE "gem_tenders" ADD COLUMN     "aiRelevanceReason" TEXT,
ADD COLUMN     "aiRelevanceValid" BOOLEAN;

-- AlterTable
ALTER TABLE "non_gem_tenders" ADD COLUMN     "aiRelevanceReason" TEXT,
ADD COLUMN     "aiRelevanceValid" BOOLEAN;
