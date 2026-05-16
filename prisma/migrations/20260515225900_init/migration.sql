-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'roofer', 'operator', 'admin');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('residential', 'commercial');

-- CreateEnum
CREATE TYPE "SurveyType" AS ENUM ('self_upload', 'drone_capture');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('draft', 'pending', 'analysing', 'complete', 'failed');

-- CreateEnum
CREATE TYPE "ImageValidationStatus" AS ENUM ('pending', 'valid', 'invalid');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'published', 'overridden');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "LeadClaimStatus" AS ENUM ('interested', 'quoted', 'won', 'lost');

-- CreateEnum
CREATE TYPE "DroneJobStatus" AS ENUM ('posted', 'accepted', 'in_progress', 'images_uploaded', 'complete', 'cancelled');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('basic', 'pro');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'cancelled');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'customer',
    "company" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "town" TEXT,
    "type" "PropertyType" NOT NULL DEFAULT 'residential',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "SurveyType" NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "sizeBytes" INTEGER,
    "validationStatus" "ImageValidationStatus" NOT NULL DEFAULT 'pending',
    "validationNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "conditionScore" INTEGER NOT NULL,
    "defectsJson" JSONB NOT NULL,
    "estimatedRemainingLife" INTEGER,
    "recommendations" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "rawAiResponse" JSONB,
    "pdfS3Key" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "maxRoofers" INTEGER NOT NULL DEFAULT 3,
    "status" "LeadStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadClaim" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "rooferId" TEXT NOT NULL,
    "status" "LeadClaimStatus" NOT NULL DEFAULT 'interested',
    "quoteAmount" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DroneJob" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "operatorId" TEXT,
    "status" "DroneJobStatus" NOT NULL DEFAULT 'posted',
    "postcode" TEXT NOT NULL,
    "payoutAmount" DECIMAL(10,2) NOT NULL DEFAULT 30.00,
    "stripePayout" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DroneJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "rooferId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "stripeSubId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_postcode_idx" ON "User"("postcode");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Property_postcode_idx" ON "Property"("postcode");

-- CreateIndex
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");

-- CreateIndex
CREATE INDEX "Survey_customerId_idx" ON "Survey"("customerId");

-- CreateIndex
CREATE INDEX "Survey_propertyId_idx" ON "Survey"("propertyId");

-- CreateIndex
CREATE INDEX "Survey_status_idx" ON "Survey"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Image_s3Key_key" ON "Image"("s3Key");

-- CreateIndex
CREATE INDEX "Image_surveyId_idx" ON "Image"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_surveyId_key" ON "Report"("surveyId");

-- CreateIndex
CREATE INDEX "Report_conditionScore_idx" ON "Report"("conditionScore");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_surveyId_key" ON "Lead"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_reportId_key" ON "Lead"("reportId");

-- CreateIndex
CREATE INDEX "Lead_postcode_idx" ON "Lead"("postcode");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "LeadClaim_rooferId_idx" ON "LeadClaim"("rooferId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadClaim_leadId_rooferId_key" ON "LeadClaim"("leadId", "rooferId");

-- CreateIndex
CREATE UNIQUE INDEX "DroneJob_surveyId_key" ON "DroneJob"("surveyId");

-- CreateIndex
CREATE INDEX "DroneJob_status_idx" ON "DroneJob"("status");

-- CreateIndex
CREATE INDEX "DroneJob_postcode_idx" ON "DroneJob"("postcode");

-- CreateIndex
CREATE INDEX "DroneJob_operatorId_idx" ON "DroneJob"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_rooferId_key" ON "Subscription"("rooferId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubId_key" ON "Subscription"("stripeSubId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubId_idx" ON "Subscription"("stripeSubId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadClaim" ADD CONSTRAINT "LeadClaim_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadClaim" ADD CONSTRAINT "LeadClaim_rooferId_fkey" FOREIGN KEY ("rooferId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroneJob" ADD CONSTRAINT "DroneJob_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroneJob" ADD CONSTRAINT "DroneJob_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_rooferId_fkey" FOREIGN KEY ("rooferId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
