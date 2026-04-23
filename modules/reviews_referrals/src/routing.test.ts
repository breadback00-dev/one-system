import assert from "node:assert/strict";

import { evaluateReviewsReferralsReplyRouting } from "./routing";

function testMixedSentimentRoutesRecovery() {
  const evaluation = evaluateReviewsReferralsReplyRouting({
    messageBody: "You were great, but I am unhappy with the overall result.",
    hasRecentReferralFollowUp: false,
  });

  assert.equal(evaluation.followUpStatus, "queued_recovery_follow_up");
  assert.equal(evaluation.recoveryFeedback, true);
  assert.equal(evaluation.promoterFeedback, false);
  assert.equal(evaluation.referralIntentFeedback, false);
}

function testReferralIntentTakesPriorityOverPromoter() {
  const evaluation = evaluateReviewsReferralsReplyRouting({
    messageBody: "5/5 and I can refer someone, her name is Sara at sara@example.com",
    hasRecentReferralFollowUp: false,
  });

  assert.equal(evaluation.followUpStatus, "queued_referral_follow_up");
  assert.equal(evaluation.referralIntentFeedback, true);
  assert.equal(evaluation.canCaptureReferralSource, true);
  assert.equal(evaluation.referredName, "Sara");
  assert.equal(evaluation.referredContact, "sara@example.com");
  assert.equal(evaluation.referralSourceCaptureConfidence, "high");
}

function testLowConfidenceNameDoesNotAutoCaptureWithoutContext() {
  const evaluation = evaluateReviewsReferralsReplyRouting({
    messageBody: "jordan, my friend could use this.",
    hasRecentReferralFollowUp: false,
  });

  assert.equal(evaluation.followUpStatus, "queued_referral_follow_up");
  assert.equal(evaluation.referredName, "Jordan");
  assert.equal(evaluation.referralSourceCaptureConfidence, "low");
  assert.equal(evaluation.canCaptureReferralSource, false);
}

function testLowConfidenceNameCanCaptureWithRecentReferralFollowUp() {
  const evaluation = evaluateReviewsReferralsReplyRouting({
    messageBody: "jordan, if you can reach out that would be great.",
    hasRecentReferralFollowUp: true,
  });

  assert.equal(evaluation.followUpStatus, "queued_promoter_follow_up");
  assert.equal(evaluation.referralSourceCaptureConfidence, "low");
  assert.equal(evaluation.canCaptureReferralSource, true);
}

function testNeutralReplyIsIgnored() {
  const evaluation = evaluateReviewsReferralsReplyRouting({
    messageBody: "Thanks for checking in.",
    hasRecentReferralFollowUp: false,
  });

  assert.equal(evaluation.followUpStatus, "ignored_neutral");
  assert.equal(evaluation.canCaptureReferralSource, false);
}

function run() {
  testMixedSentimentRoutesRecovery();
  testReferralIntentTakesPriorityOverPromoter();
  testLowConfidenceNameDoesNotAutoCaptureWithoutContext();
  testLowConfidenceNameCanCaptureWithRecentReferralFollowUp();
  testNeutralReplyIsIgnored();
  console.log("[reviews-referrals] routing tests passed");
}

run();
