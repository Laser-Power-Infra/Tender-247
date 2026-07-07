-- CreateTable
CREATE TABLE "associations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_associations" (
    "id" SERIAL NOT NULL,
    "gemTenderId" INTEGER,
    "nonGemTenderId" INTEGER,
    "associationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_associations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tender_associations_gemTenderId_idx" ON "tender_associations"("gemTenderId");

-- CreateIndex
CREATE INDEX "tender_associations_nonGemTenderId_idx" ON "tender_associations"("nonGemTenderId");

-- CreateIndex
CREATE INDEX "tender_associations_associationId_idx" ON "tender_associations"("associationId");

-- CreateIndex
CREATE UNIQUE INDEX "tender_associations_gemTenderId_associationId_key" ON "tender_associations"("gemTenderId", "associationId");

-- CreateIndex
CREATE UNIQUE INDEX "tender_associations_nonGemTenderId_associationId_key" ON "tender_associations"("nonGemTenderId", "associationId");

-- AddForeignKey
ALTER TABLE "tender_associations" ADD CONSTRAINT "tender_associations_gemTenderId_fkey" FOREIGN KEY ("gemTenderId") REFERENCES "gem_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_associations" ADD CONSTRAINT "tender_associations_nonGemTenderId_fkey" FOREIGN KEY ("nonGemTenderId") REFERENCES "non_gem_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_associations" ADD CONSTRAINT "tender_associations_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
