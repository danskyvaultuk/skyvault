-- BL-074 / SPEC-022: count postcode lookups per user. Adds one table; changes nothing else.
CREATE TABLE "AddressLookup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddressLookup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AddressLookup_userId_createdAt_idx" ON "AddressLookup"("userId", "createdAt");

ALTER TABLE "AddressLookup" ADD CONSTRAINT "AddressLookup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
