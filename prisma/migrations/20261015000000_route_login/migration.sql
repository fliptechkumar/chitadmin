-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "loginUserId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Route_loginUserId_key" ON "Route"("loginUserId");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_loginUserId_fkey" FOREIGN KEY ("loginUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

