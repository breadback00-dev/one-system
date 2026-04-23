import assert from "node:assert/strict";

import { isOptOutKeywordMessage } from "./opt-out";

function testExactOptOutKeywords() {
  assert.equal(isOptOutKeywordMessage("STOP"), true);
  assert.equal(isOptOutKeywordMessage("Please unsubscribe me"), true);
  assert.equal(isOptOutKeywordMessage("end"), true);
}

function testNonOptOutContentWithEmbeddedKeywordFragments() {
  assert.equal(isOptOutKeywordMessage("Can you send me details?"), false);
  assert.equal(isOptOutKeywordMessage("I am away this weekend"), false);
}

function run() {
  testExactOptOutKeywords();
  testNonOptOutContentWithEmbeddedKeywordFragments();
  console.log("[database] opt-out keyword tests passed");
}

run();
