-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" TEXT NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "tenderType" TEXT NOT NULL,
    "briefText" TEXT NOT NULL,
    "originalAi" TEXT NOT NULL,
    "correctedAi" TEXT NOT NULL,
    "feedbackReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_feedback_tenderId_tenderType_key" ON "ai_feedback"("tenderId", "tenderType");
