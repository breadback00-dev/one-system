-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN "utmSource" TEXT,
ADD COLUMN "utmMedium" TEXT,
ADD COLUMN "utmCampaign" TEXT,
ADD COLUMN "utmTerm" TEXT,
ADD COLUMN "utmContent" TEXT;

-- CreateTable
CREATE TABLE "AdSpendEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSpendEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_workspaceId_source_utmCampaign_idx" ON "Lead"("workspaceId", "source", "utmCampaign");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_workspaceId_contactId_channel_key" ON "Conversation"("workspaceId", "contactId", "channel");

-- CreateIndex
CREATE INDEX "AdSpendEntry_workspaceId_reportDate_idx" ON "AdSpendEntry"("workspaceId", "reportDate");

-- CreateIndex
CREATE INDEX "AdSpendEntry_workspaceId_source_utmCampaign_idx" ON "AdSpendEntry"("workspaceId", "source", "utmCampaign");

-- AddForeignKey
ALTER TABLE "AdSpendEntry" ADD CONSTRAINT "AdSpendEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
