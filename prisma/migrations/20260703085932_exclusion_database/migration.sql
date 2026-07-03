-- CreateTable
CREATE TABLE "ExlusionKeywords" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT DEFAULT 'cable',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExlusionKeywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExlusionKeywords_category_key" ON "ExlusionKeywords"("category");
