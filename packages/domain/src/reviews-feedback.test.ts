import assert from "node:assert/strict";

import {
  classifyReviewReferralReplySignals,
  extractReviewReferralSourceDetails,
} from "./reviews-feedback";

function testPromoterOnlySignal() {
  const signals = classifyReviewReferralReplySignals(
    "5/5, amazing service and I love the result.",
  );

  assert.equal(signals.promoter, true);
  assert.equal(signals.recovery, false);
  assert.equal(signals.referralIntent, false);
  assert.equal(signals.mixedSentiment, false);
}

function testRecoveryOnlySignal() {
  const signals = classifyReviewReferralReplySignals(
    "Honestly disappointed and not happy with the visit.",
  );

  assert.equal(signals.promoter, false);
  assert.equal(signals.recovery, true);
  assert.equal(signals.referralIntent, false);
  assert.equal(signals.mixedSentiment, false);
}

function testMixedSignalPrefersRecovery() {
  const signals = classifyReviewReferralReplySignals(
    "The team was great, but I am disappointed overall.",
  );

  assert.equal(signals.promoter, false);
  assert.equal(signals.recovery, true);
  assert.equal(signals.referralIntent, false);
  assert.equal(signals.mixedSentiment, true);
}

function testReferralSignalWhenPositive() {
  const signals = classifyReviewReferralReplySignals(
    "Happy to refer a friend if you want me to.",
  );

  assert.equal(signals.promoter, false);
  assert.equal(signals.recovery, false);
  assert.equal(signals.referralIntent, true);
  assert.equal(signals.mixedSentiment, false);
}

function testReferralSignalBlockedByRecovery() {
  const signals = classifyReviewReferralReplySignals(
    "I can share a friend later but right now I am unhappy.",
  );

  assert.equal(signals.promoter, false);
  assert.equal(signals.recovery, true);
  assert.equal(signals.referralIntent, false);
  assert.equal(signals.mixedSentiment, false);
}

function testSourceExtractionHighConfidenceFromContact() {
  const details = extractReviewReferralSourceDetails(
    "Her name is Sara and her phone is +44 (20) 1234-5678.",
  );

  assert.equal(details.referredName, "Sara");
  assert.equal(details.referredContact, "+442012345678");
  assert.equal(details.captureConfidence, "high");
}

function testSourceExtractionMediumConfidenceFromExplicitName() {
  const details = extractReviewReferralSourceDetails(
    "My friend is jasmine.",
  );

  assert.equal(details.referredName, "Jasmine");
  assert.equal(details.referredContact, undefined);
  assert.equal(details.captureConfidence, "medium");
}

function testSourceExtractionLowConfidenceFromLeadingName() {
  const details = extractReviewReferralSourceDetails(
    "jordan, if you can reach out that would be great.",
  );

  assert.equal(details.referredName, "Jordan");
  assert.equal(details.referredContact, undefined);
  assert.equal(details.captureConfidence, "low");
}

function testSourceExtractionRejectsStopWordLeadingName() {
  const details = extractReviewReferralSourceDetails(
    "my friend, 555-123-4567",
  );

  assert.equal(details.referredName, undefined);
  assert.equal(details.referredContact, "5551234567");
  assert.equal(details.captureConfidence, "high");
}

function run() {
  testPromoterOnlySignal();
  testRecoveryOnlySignal();
  testMixedSignalPrefersRecovery();
  testReferralSignalWhenPositive();
  testReferralSignalBlockedByRecovery();
  testSourceExtractionHighConfidenceFromContact();
  testSourceExtractionMediumConfidenceFromExplicitName();
  testSourceExtractionLowConfidenceFromLeadingName();
  testSourceExtractionRejectsStopWordLeadingName();
  console.log("[domain] review feedback signal tests passed");
}

run();
