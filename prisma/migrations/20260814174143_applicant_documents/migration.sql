/*
  Warnings:

  - You are about to drop the column `documentNumber` on the `Applicant` table. All the data in the column will be lost.
  - You are about to drop the column `documentType` on the `Applicant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Applicant" DROP COLUMN "documentNumber",
DROP COLUMN "documentType",
ADD COLUMN     "aadhaarNumber" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ApplicantDocument" (
    "id" SERIAL NOT NULL,
    "applicantId" INTEGER NOT NULL,
    "docType" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,

    CONSTRAINT "ApplicantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicantDocument_applicantId_idx" ON "ApplicantDocument"("applicantId");

-- AddForeignKey
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
