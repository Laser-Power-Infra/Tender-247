-- AlterTable
ALTER TABLE "gem_tenders" ADD COLUMN     "bidStatus" TEXT,
ADD COLUMN     "differenceBetweenRank1" TEXT;

-- CreateTable
CREATE TABLE "evaluations" (
    "id" SERIAL NOT NULL,
    "gemTenderId" INTEGER NOT NULL,
    "sellerName" TEXT NOT NULL,
    "offeredItem" TEXT,
    "totalPrice" TEXT,
    "rank" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluations_gemTenderId_idx" ON "evaluations"("gemTenderId");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_gemTenderId_fkey" FOREIGN KEY ("gemTenderId") REFERENCES "gem_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
