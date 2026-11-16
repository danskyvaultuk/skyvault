-- BL-080 / SPEC-029 C3: record photo refusals. Adds one table; changes nothing else.
CREATE TABLE "PhotoRefusal" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoRefusal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhotoRefusal_createdAt_idx" ON "PhotoRefusal"("createdAt");

ALTER TABLE "PhotoRefusal" ADD CONSTRAINT "PhotoRefusal_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
