-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('pending', 'allocated', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "Applicant" (
    "id" SERIAL NOT NULL,
    "applicantCode" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "maritalStatus" TEXT,
    "signDate" TIMESTAMP(3),
    "documentType" TEXT,
    "documentNumber" TEXT,
    "email" TEXT,
    "altPhone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "area" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "permanentAddress" TEXT,
    "occupationType" TEXT,
    "employerName" TEXT,
    "natureOfBusiness" TEXT,
    "annualIncome" INTEGER,
    "yearsInOccupation" INTEGER,
    "introducerName" TEXT,
    "introducerId" TEXT,
    "nomineeName" TEXT,
    "nomineeRelation" TEXT,
    "nomineeDob" TIMESTAMP(3),
    "nomineeMobile" TEXT,
    "chitValue" INTEGER NOT NULL DEFAULT 0,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'pending',
    "documentsUploaded" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_applicantCode_key" ON "Applicant"("applicantCode");

-- CreateIndex
CREATE INDEX "Applicant_branch_idx" ON "Applicant"("branch");

-- CreateIndex
CREATE INDEX "Applicant_status_idx" ON "Applicant"("status");

-- CreateIndex
CREATE INDEX "Applicant_createdAt_idx" ON "Applicant"("createdAt");

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
