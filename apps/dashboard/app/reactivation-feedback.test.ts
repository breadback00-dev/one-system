import assert from "node:assert/strict";

import {
  getQueueActionFeedback,
  getReactivationRunErrorMessage,
  getReactivationRunFeedback,
} from "./reactivation-feedback";
import {
  getReviewsDraftErrorMessage,
  getReviewsDraftFeedback,
  getReviewsRunErrorMessage,
  getReviewsRunFeedback,
} from "./reviews-referrals-feedback";

function testReactivationRunFeedbackQueued() {
  const feedback = getReactivationRunFeedback({
    reactivationRun: "queued",
    campaignKey: "spring-2026",
    runId: "run-123",
    queuedCount: "7",
    skippedCount: "2",
  });

  assert.ok(feedback, "Expected queued run feedback to be present.");
  assert.equal(feedback.campaignKey, "spring-2026");
  assert.equal(feedback.runId, "run-123");
  assert.equal(feedback.queuedCount, "7");
  assert.equal(feedback.skippedCount, "2");
  assert.equal(feedback.cooldownDays, "14");
}

function testReactivationRunFeedbackNotQueued() {
  const feedback = getReactivationRunFeedback({
    reactivationRun: "error",
  });

  assert.equal(feedback, null);
}

function testReactivationRunErrorFallback() {
  const error = getReactivationRunErrorMessage({
    reactivationRun: "error",
  });

  assert.equal(error, "Unable to queue the reactivation campaign.");
}

function testQueueActionFeedbackDefaults() {
  const feedback = getQueueActionFeedback({
    queueAction: "book_slot",
    queueActionStatus: "success",
  });

  assert.ok(feedback, "Expected queue action feedback to be present.");
  assert.equal(feedback.action, "book_slot");
  assert.equal(feedback.status, "success");
  assert.equal(feedback.message, "Reactivation booking action processed.");
}

function testQueueActionFeedbackInvalidShape() {
  const feedback = getQueueActionFeedback({
    queueAction: "unknown",
    queueActionStatus: "success",
  });

  assert.equal(feedback, null);
}

function testReviewsRunFeedbackQueued() {
  const feedback = getReviewsRunFeedback({
    reviewsRun: "queued",
    campaignKey: "reviews-q2",
    runId: "run-xyz",
    queuedCount: "4",
    skippedCount: "1",
    completedDaysAgo: "3",
  });

  assert.ok(feedback, "Expected queued reviews run feedback to be present.");
  assert.equal(feedback.campaignKey, "reviews-q2");
  assert.equal(feedback.runId, "run-xyz");
  assert.equal(feedback.queuedCount, "4");
  assert.equal(feedback.skippedCount, "1");
  assert.equal(feedback.cooldownDays, "14");
  assert.equal(feedback.completedDaysAgo, "3");
}

function testReviewsRunFeedbackNotQueued() {
  const feedback = getReviewsRunFeedback({
    reviewsRun: "error",
  });

  assert.equal(feedback, null);
}

function testReviewsRunErrorFallback() {
  const error = getReviewsRunErrorMessage({
    reviewsRun: "error",
  });

  assert.equal(error, "Unable to queue the reviews/referrals campaign.");
}

function testReviewsDraftFeedbackReady() {
  const feedback = getReviewsDraftFeedback({
    reviewsDraft: "ready",
    reviewsDraftSentiment: "promoter",
    reviewsDraftConfidence: "high",
    reviewsDraftAction: "invite_public_review",
    reviewsDraftText: "Thanks for the kind words.",
  });

  assert.ok(feedback, "Expected reviews draft feedback to be present.");
  assert.equal(feedback.sentiment, "promoter");
  assert.equal(feedback.confidence, "high");
  assert.equal(feedback.suggestedAction, "invite_public_review");
  assert.equal(feedback.draft, "Thanks for the kind words.");
}

function testReviewsDraftFeedbackNotReady() {
  const feedback = getReviewsDraftFeedback({
    reviewsDraft: "error",
  });

  assert.equal(feedback, null);
}

function testReviewsDraftErrorFallback() {
  const error = getReviewsDraftErrorMessage({
    reviewsDraft: "error",
  });

  assert.equal(error, "Unable to generate a reviews/referrals response draft.");
}

function run() {
  testReactivationRunFeedbackQueued();
  testReactivationRunFeedbackNotQueued();
  testReactivationRunErrorFallback();
  testQueueActionFeedbackDefaults();
  testQueueActionFeedbackInvalidShape();
  testReviewsRunFeedbackQueued();
  testReviewsRunFeedbackNotQueued();
  testReviewsRunErrorFallback();
  testReviewsDraftFeedbackReady();
  testReviewsDraftFeedbackNotReady();
  testReviewsDraftErrorFallback();
  console.log("[dashboard] feedback parser tests passed");
}

run();
