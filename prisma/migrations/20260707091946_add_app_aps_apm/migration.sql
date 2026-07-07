-- CreateEnum
CREATE TYPE "decision" AS ENUM ('YES', 'NO', 'NOT_DECIDED');

-- AlterTable
ALTER TABLE "gem_tenders" ADD COLUMN     "apm" "decision" NOT NULL DEFAULT 'NOT_DECIDED',
ADD COLUMN     "app" "decision" NOT NULL DEFAULT 'NOT_DECIDED',
ADD COLUMN     "aps" "decision" NOT NULL DEFAULT 'NOT_DECIDED';

-- AlterTable
ALTER TABLE "non_gem_tenders" ADD COLUMN     "apm" "decision" NOT NULL DEFAULT 'NOT_DECIDED',
ADD COLUMN     "app" "decision" NOT NULL DEFAULT 'NOT_DECIDED',
ADD COLUMN     "aps" "decision" NOT NULL DEFAULT 'NOT_DECIDED';
