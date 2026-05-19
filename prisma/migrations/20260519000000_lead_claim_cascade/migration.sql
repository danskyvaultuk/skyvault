-- AlterTable: add CASCADE on LeadClaim.rooferId so deleting a user removes their claims
ALTER TABLE "LeadClaim" DROP CONSTRAINT "LeadClaim_rooferId_fkey";
ALTER TABLE "LeadClaim" ADD CONSTRAINT "LeadClaim_rooferId_fkey"
  FOREIGN KEY ("rooferId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
