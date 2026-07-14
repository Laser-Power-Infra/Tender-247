-- AlterTable
ALTER TABLE "gem_tenders" ADD COLUMN     "itemCategory" TEXT,
ADD COLUMN     "totalQuantity" TEXT;

-- CreateTable
CREATE TABLE "reportings" (
    "id" SERIAL NOT NULL,
    "gemTenderId" INTEGER NOT NULL,
    "officer" TEXT NOT NULL,
    "address" TEXT,
    "quantity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reportings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reportings_gemTenderId_idx" ON "reportings"("gemTenderId");

-- AddForeignKey
ALTER TABLE "reportings" ADD CONSTRAINT "reportings_gemTenderId_fkey" FOREIGN KEY ("gemTenderId") REFERENCES "gem_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
