-- Expand RoofPart with additional tags that line up with Claude's existing
-- defect categories (ridge/valley/gutter/flashing damage) plus a wide/overview shot.
ALTER TYPE "RoofPart" ADD VALUE 'ridge';
ALTER TYPE "RoofPart" ADD VALUE 'valley';
ALTER TYPE "RoofPart" ADD VALUE 'gutter';
ALTER TYPE "RoofPart" ADD VALUE 'flashing';
ALTER TYPE "RoofPart" ADD VALUE 'overview';

-- CreateEnum
CREATE TYPE "Aspect" AS ENUM ('north', 'south', 'east', 'west');

-- Multi-tag support: roofPart (single, nullable) -> roofParts (array, default empty)
ALTER TABLE "Image" ADD COLUMN "roofParts" "RoofPart"[] NOT NULL DEFAULT '{}';
ALTER TABLE "Image" ADD COLUMN "aspect" "Aspect";

-- Backfill: carry any existing single tag into the new array column
UPDATE "Image" SET "roofParts" = ARRAY["roofPart"] WHERE "roofPart" IS NOT NULL;

ALTER TABLE "Image" DROP COLUMN "roofPart";
