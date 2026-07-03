-- CreateTable
CREATE TABLE "files" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "uploadedBy" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gem_tenders" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "tenderBrief" TEXT,
    "value" TEXT,
    "deadline" TIMESTAMP(3),
    "location" TEXT,
    "organization" TEXT,
    "documentFees" TEXT,
    "emd" TEXT,
    "msmeExemption" TEXT,
    "startupExemption" TEXT,
    "quantity" TEXT,
    "bidOpeningDateTime" TEXT,
    "bidOfferValidity" TEXT,
    "ministryStateName" TEXT,
    "departmentName" TEXT,
    "officeName" TEXT,
    "minimumAverageAnnualTurnover" TEXT,
    "yearsOfPastExperience" TEXT,
    "oemAverageTurnover" TEXT,
    "contractPeriod" TEXT,
    "financialDocumentPriceBreakupRequired" TEXT,
    "similarCategory" TEXT,
    "pastExperienceSimilarServicesRequired" TEXT,
    "documentRequiredFromSeller" TEXT,
    "pastPerformance" TEXT,
    "bidToRaEnabled" TEXT,
    "raQualificationRule" TEXT,
    "boqTitle" TEXT,
    "bidDetails" TEXT,
    "comprehensiveMaintenanceChargesRequired" TEXT,
    "typeOfBid" TEXT,
    "technicalClarificationTimeAllowed" TEXT,
    "inspectionRequired" TEXT,
    "estimatedBidValue" TEXT,
    "evaluationMethod" TEXT,
    "advisoryBank" TEXT,
    "ePbgPercentage" TEXT,
    "ePbgDurationMonths" TEXT,
    "msePurchasePreference" TEXT,
    "miiPurchasePreference" TEXT,
    "consigneesReportingOfficer" TEXT,
    "mediationClause" TEXT,
    "arbitrationClause" TEXT,
    "checklist" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gem_tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_gem_tenders" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "tenderBrief" TEXT,
    "estimatedCost" TEXT,
    "deadline" TIMESTAMP(3),
    "location" TEXT,
    "organization" TEXT,
    "documentFees" TEXT,
    "emd" TEXT,
    "msmeExemption" TEXT,
    "startupExemption" TEXT,
    "quantity" TEXT,
    "checklist" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "non_gem_tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_extra_fields" (
    "id" SERIAL NOT NULL,
    "gemTenderId" INTEGER,
    "nonGemTenderId" INTEGER,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_extra_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gem_tenders_referenceNo_key" ON "gem_tenders"("referenceNo");

-- CreateIndex
CREATE INDEX "gem_tenders_fileId_idx" ON "gem_tenders"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "non_gem_tenders_referenceNo_key" ON "non_gem_tenders"("referenceNo");

-- CreateIndex
CREATE INDEX "non_gem_tenders_fileId_idx" ON "non_gem_tenders"("fileId");

-- CreateIndex
CREATE INDEX "tender_extra_fields_gemTenderId_idx" ON "tender_extra_fields"("gemTenderId");

-- CreateIndex
CREATE INDEX "tender_extra_fields_nonGemTenderId_idx" ON "tender_extra_fields"("nonGemTenderId");

-- AddForeignKey
ALTER TABLE "gem_tenders" ADD CONSTRAINT "gem_tenders_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_gem_tenders" ADD CONSTRAINT "non_gem_tenders_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_extra_fields" ADD CONSTRAINT "tender_extra_fields_gemTenderId_fkey" FOREIGN KEY ("gemTenderId") REFERENCES "gem_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_extra_fields" ADD CONSTRAINT "tender_extra_fields_nonGemTenderId_fkey" FOREIGN KEY ("nonGemTenderId") REFERENCES "non_gem_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
