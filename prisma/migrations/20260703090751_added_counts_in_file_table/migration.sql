-- AlterTable
ALTER TABLE "files" ADD COLUMN     "excludedCount" INTEGER DEFAULT 0,
ADD COLUMN     "totalCount" INTEGER DEFAULT 0;
