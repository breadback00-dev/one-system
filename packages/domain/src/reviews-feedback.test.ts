import assert from "node:assert/strict";

import { classifyReviewReferralReplySignals } from "./reviews-feedback";

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

function run() {
  testPromoterOnlySignal();
  testRecoveryOnlySignal();
  testMixedSignalPrefersRecovery();
  testReferralSignalWhenPositive();
  testReferralSignalBlockedByRecovery();
  console.log("[domain] review feedback signal tests passed");
}

run();
