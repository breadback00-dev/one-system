import assert from "node:assert/strict";

import {
  getSalesEnablementErrorMessage,
  getSalesEnablementFeedback,
  getSalesEnablementSyncErrorMessage,
  getSalesEnablementSyncFeedback,
} from "./sales-enablement-feedback";

function testSalesEnablementFeedbackCaptured() {
  const feedback = getSalesEnablementFeedback({
    salesEnablement: "captured",
    salesTranscriptId: "transcript-123",
    salesAppointmentId: "appointment-456",
    salesFirstName: "Avery",
    salesAgentName: "Rep Aurora",
    salesOverallScore: "4",
    salesPrimaryObjection: "price",
  });

  assert.ok(feedback, "Expected captured transcript feedback to be present.");
  assert.equal(feedback.transcriptId, "transcript-123");
  assert.equal(feedback.appointmentId, "appointment-456");
  assert.equal(feedback.firstName, "Avery");
  assert.equal(feedback.agentName, "Rep Aurora");
  assert.equal(feedback.overallScore, 4);
  assert.equal(feedback.primaryObjection, "price");
}

function testSalesEnablementFeedbackRequiresIdentifiers() {
  const feedback = getSalesEnablementFeedback({
    salesEnablement: "captured",
    salesTranscriptId: "transcript-123",
  });

  assert.equal(feedback, null);
}

function testSalesEnablementErrorFallback() {
  const error = getSalesEnablementErrorMessage({
    salesEnablement: "error",
  });

  assert.equal(error, "Unable to ingest the consultation transcript.");
}

function testSalesEnablementSyncFeedbackCompleted() {
  const feedback = getSalesEnablementSyncFeedback({
    salesSync: "completed",
    salesSyncProvider: "dev_capture",
    salesSyncCandidateCount: "3",
    salesSyncImportedCount: "2",
    salesSyncSkippedCount: "1",
  });

  assert.ok(feedback, "Expected completed sync feedback to be present.");
  assert.equal(feedback.provider, "dev_capture");
  assert.equal(feedback.candidateCount, 3);
  assert.equal(feedback.importedCount, 2);
  assert.equal(feedback.skippedCount, 1);
}

function testSalesEnablementSyncFeedbackRequiresProvider() {
  const feedback = getSalesEnablementSyncFeedback({
    salesSync: "completed",
    salesSyncCandidateCount: "3",
  });

  assert.equal(feedback, null);
}

function testSalesEnablementSyncErrorFallback() {
  const error = getSalesEnablementSyncErrorMessage({
    salesSync: "error",
  });

  assert.equal(error, "Unable to run the adapter-backed transcript sync.");
}

function run() {
  testSalesEnablementFeedbackCaptured();
  testSalesEnablementFeedbackRequiresIdentifiers();
  testSalesEnablementErrorFallback();
  testSalesEnablementSyncFeedbackCompleted();
  testSalesEnablementSyncFeedbackRequiresProvider();
  testSalesEnablementSyncErrorFallback();
  console.log("[dashboard] sales enablement feedback parser tests passed");
}

run();
