import assert from "node:assert/strict";

import {
  getPlatformFoundationReadiness,
  platformFoundationRequirements,
  platformModuleBoundaries,
} from "./platform-readiness";

function testCoversAllBusinessModules() {
  assert.deepEqual(
    platformModuleBoundaries.map((module) => module.key),
    [
      "lead_capture",
      "reactivation",
      "reviews_referrals",
      "paid_ads",
      "sales_enablement",
    ],
  );
}

function testEveryRequirementHasEvidence() {
  for (const requirement of platformFoundationRequirements) {
    assert.ok(requirement.evidence.trim(), `${requirement.key} needs evidence`);
  }
}

function testReadinessCountsMatchRequirements() {
  const readiness = getPlatformFoundationReadiness();
  const countedRequirements =
    readiness.readyCount + readiness.partialCount + readiness.missingCount;

  assert.equal(countedRequirements, readiness.requirements.length);
  assert.equal(readiness.status, "partial");
  assert.equal(readiness.missingCount, 0);
}

function run() {
  testCoversAllBusinessModules();
  testEveryRequirementHasEvidence();
  testReadinessCountsMatchRequirements();
  console.log("[domain] platform readiness tests passed");
}

run();
