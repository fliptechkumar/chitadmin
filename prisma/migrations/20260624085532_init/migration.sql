-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('verified', 'pending', 'rejected');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('Manager', 'Agent', 'Accountant', 'Supervisor');

-- CreateEnum
CREATE TYPE "CollectionMode" AS ENUM ('cash', 'online', 'cheque');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('paid', 'pending', 'overdue');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('active', 'completed', 'upcoming');

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "groups" TEXT[],
    "pendingDue" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" INTEGER NOT NULL DEFAULT 0,
    "joinedDate" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'active',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" "EmployeeRole" NOT NULL,
    "branch" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 0,
    "collected" INTEGER NOT NULL DEFAULT 0,
    "joinedDate" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" SERIAL NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "installment" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "mode" "CollectionMode" NOT NULL,
    "date" TEXT NOT NULL,
    "collectedBy" TEXT NOT NULL,
    "status" "CollectionStatus" NOT NULL,
    "penalty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChitGroup" (
    "id" SERIAL NOT NULL,
    "branchName" TEXT NOT NULL,
    "specialType" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "percentage" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "vacants" INTEGER NOT NULL,
    "members" INTEGER NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "ChitGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_receiptNo_key" ON "Collection"("receiptNo");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
