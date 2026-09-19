-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "sportmonksId" TEXT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "sportmonksId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_sportmonksId_key" ON "Team"("sportmonksId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_sportmonksId_key" ON "Match"("sportmonksId");
