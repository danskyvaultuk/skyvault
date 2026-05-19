-- Survey.customerId: cascade delete surveys when user is deleted
ALTER TABLE "Survey" DROP CONSTRAINT "Survey_customerId_fkey";
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Image.uploadedById: cascade delete images when user is deleted
ALTER TABLE "Image" DROP CONSTRAINT "Image_uploadedById_fkey";
ALTER TABLE "Image" ADD CONSTRAINT "Image_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DroneJob.operatorId: set null when operator user is deleted (job stays open)
ALTER TABLE "DroneJob" DROP CONSTRAINT "DroneJob_operatorId_fkey";
ALTER TABLE "DroneJob" ADD CONSTRAINT "DroneJob_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
