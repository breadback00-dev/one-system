-- CreateTable
CREATE TABLE "ConsultationTranscript" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "leadId" TEXT,
    "appointmentId" TEXT,
    "externalId" TEXT,
    "source" TEXT NOT NULL,
    "transcriptText" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "rapportScore" INTEGER NOT NULL,
    "needsScore" INTEGER NOT NULL,
    "objectionHandlingScore" INTEGER NOT NULL,
    "bookingIntentScore" INTEGER NOT NULL,
    "primaryObjection" TEXT,
    "nextStep" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationTranscript_workspaceId_createdAt_idx" ON "ConsultationTranscript"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationTranscript_contactId_createdAt_idx" ON "ConsultationTranscript"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationTranscript_appointmentId_idx" ON "ConsultationTranscript"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationTranscript_workspaceId_source_externalId_key" ON "ConsultationTranscript"("workspaceId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "ConsultationTranscript" ADD CONSTRAINT "ConsultationTranscript_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationTranscript" ADD CONSTRAINT "ConsultationTranscript_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationTranscript" ADD CONSTRAINT "ConsultationTranscript_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationTranscript" ADD CONSTRAINT "ConsultationTranscript_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
