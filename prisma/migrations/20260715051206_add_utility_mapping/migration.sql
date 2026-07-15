-- AlterTable
ALTER TABLE "gem_tenders" ADD COLUMN     "utilityMappingId" INTEGER;

-- AlterTable
ALTER TABLE "non_gem_tenders" ADD COLUMN     "utilityMappingId" INTEGER;

-- CreateTable
CREATE TABLE "utility_mappings" (
    "id" SERIAL NOT NULL,
    "organization" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utility_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gem_tenders_utilityMappingId_idx" ON "gem_tenders"("utilityMappingId");

-- CreateIndex
CREATE INDEX "non_gem_tenders_utilityMappingId_idx" ON "non_gem_tenders"("utilityMappingId");

-- AddForeignKey
ALTER TABLE "gem_tenders" ADD CONSTRAINT "gem_tenders_utilityMappingId_fkey" FOREIGN KEY ("utilityMappingId") REFERENCES "utility_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_gem_tenders" ADD CONSTRAINT "non_gem_tenders_utilityMappingId_fkey" FOREIGN KEY ("utilityMappingId") REFERENCES "utility_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
