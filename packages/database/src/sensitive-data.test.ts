import assert from "node:assert/strict";

import { redactSensitiveText } from "./sensitive-data";

function testRedactsDirectContactDetails() {
  const redacted = redactSensitiveText(
    "Client email is alex@example.com and phone is +1 (555) 123-4567.",
  );

  assert.equal(redacted.includes("alex@example.com"), false);
  assert.equal(redacted.includes("555"), false);
  assert.equal(
    redacted,
    "Client email is [redacted-email] and phone is [redacted-phone].",
  );
}

function testLeavesOrdinaryNumbersAlone() {
  assert.equal(
    redactSensitiveText("Score was 4 out of 5 after 2 objections."),
    "Score was 4 out of 5 after 2 objections.",
  );
}

function run() {
  testRedactsDirectContactDetails();
  testLeavesOrdinaryNumbersAlone();
  console.log("[database] sensitive data redaction tests passed");
}

run();
