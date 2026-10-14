-- CreateTable
CREATE TABLE "Route" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "inchargeId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteExecutive" (
    "id" SERIAL NOT NULL,
    "routeId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RouteExecutive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Route_code_key" ON "Route"("code");
CREATE INDEX "Route_branch_idx" ON "Route"("branch");
CREATE INDEX "Route_isActive_idx" ON "Route"("isActive");
CREATE INDEX "RouteExecutive_routeId_idx" ON "RouteExecutive"("routeId");
CREATE UNIQUE INDEX "RouteExecutive_routeId_employeeId_key" ON "RouteExecutive"("routeId", "employeeId");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_inchargeId_fkey" FOREIGN KEY ("inchargeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Route" ADD CONSTRAINT "Route_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteExecutive" ADD CONSTRAINT "RouteExecutive_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteExecutive" ADD CONSTRAINT "RouteExecutive_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
