-- CreateEnum
CREATE TYPE "RoofPart" AS ENUM ('front', 'back', 'side', 'chimney', 'close_up');

-- AlterTable
ALTER TABLE "Image" ADD COLUMN "roofPart" "RoofPart",
                     ADD COLUMN "captureMethod" TEXT,
                     ADD COLUMN "taggedAt" TIMESTAMP(3);
