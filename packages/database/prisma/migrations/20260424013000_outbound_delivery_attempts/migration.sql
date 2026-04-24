-- CreateTable
CREATE TABLE "OutboundDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "queuedEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboundDeliveryAttempt_queuedEventId_key" ON "OutboundDeliveryAttempt"("queuedEventId");

-- CreateIndex
CREATE INDEX "OutboundDeliveryAttempt_workspaceId_status_claimedAt_idx" ON "OutboundDeliveryAttempt"("workspaceId", "status", "claimedAt");

-- CreateIndex
CREATE INDEX "OutboundDeliveryAttempt_contactId_claimedAt_idx" ON "OutboundDeliveryAttempt"("contactId", "claimedAt");

-- AddForeignKey
ALTER TABLE "OutboundDeliveryAttempt" ADD CONSTRAINT "OutboundDeliveryAttempt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundDeliveryAttempt" ADD CONSTRAINT "OutboundDeliveryAttempt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
