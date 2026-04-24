import assert from "node:assert/strict";

import { generateConsultationAnalysis } from "@one-system/ai";
import {
  ingestConsultationTranscript,
  MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH,
} from "./index";

function testConsultationAnalysisDetectsPriceObjection() {
  const result = generateConsultationAnalysis({
    transcriptText:
      "Client: I love the idea, but I am worried about price and whether it fits my budget. Advisor: We do have package options and can recommend the best starting plan.",
  });

  assert.equal(result.scorecard.primaryObjection, "price");
  assert.ok(result.summary.includes("Cost sensitivity"));
  assert.ok(result.scorecard.nextStep.includes("package"));
}

function testConsultationAnalysisDetectsBookingIntent() {
  const result = generateConsultationAnalysis({
    transcriptText:
      "Advisor: We can book your consultation next week. Client: Yes, I would like to schedule and see your availability.",
  });

  assert.ok(result.scorecard.bookingIntentScore >= 4);
  assert.ok(result.scorecard.nextStep.includes("consultation times"));
}

async function testTranscriptIngestionRejectsOversizedText() {
  await assert.rejects(
    () =>
      ingestConsultationTranscript({
        workspaceId: "workspace_medspa_demo",
        appointmentId: "appointment_oversized",
        source: "manual",
        transcriptText: "x".repeat(MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH + 1),
      }),
    {
      message: `\`transcriptText\` must be ${MAX_CONSULTATION_TRANSCRIPT_TEXT_LENGTH} characters or fewer.`,
    },
  );
}

function run() {
  testConsultationAnalysisDetectsPriceObjection();
  testConsultationAnalysisDetectsBookingIntent();
}

async function runAll() {
  run();
  await testTranscriptIngestionRejectsOversizedText();
  console.log("[sales-enablement] module tests passed");
}

await runAll();
