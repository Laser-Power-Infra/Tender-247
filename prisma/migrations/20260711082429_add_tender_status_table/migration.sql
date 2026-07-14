-- AlterTable
ALTER TABLE "gem_tenders" ADD COLUMN     "locationCount" INTEGER,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "tenderStatusId" INTEGER,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "non_gem_tenders" ADD COLUMN     "locationCount" INTEGER,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "tenderStatusId" INTEGER,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "tender_status_table" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT,
    "website" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GEM',
    "userId" TEXT,
    "password" TEXT,
    "mobileNo" TEXT,
    "profilePassword" TEXT,
    "dscName" TEXT,
    "dscPassword" TEXT,

    CONSTRAINT "tender_status_table_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "gem_tenders" ADD CONSTRAINT "gem_tenders_tenderStatusId_fkey" FOREIGN KEY ("tenderStatusId") REFERENCES "tender_status_table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_gem_tenders" ADD CONSTRAINT "non_gem_tenders_tenderStatusId_fkey" FOREIGN KEY ("tenderStatusId") REFERENCES "tender_status_table"("id") ON DELETE SET NULL ON UPDATE CASCADE;
