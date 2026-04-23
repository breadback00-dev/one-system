import assert from "node:assert/strict";
import { type AddressInfo } from "node:net";

import { createApiServer } from "./index";

async function startServer() {
  const server = createApiServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve API test server address.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
  };
}

async function stopServer(server: ReturnType<typeof createApiServer>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function requestJson(args: {
  baseUrl: string;
  pathname: string;
  method?: "GET" | "POST";
  body?: unknown;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${args.baseUrl}${args.pathname}`, {
    method: args.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
    ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
  });
  const text = await response.text();

  return {
    status: response.status,
    json: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

function assertErrorMessage(
  response: { status: number; json: Record<string, unknown> },
  expectedMessage: string,
) {
  assert.equal(response.status, 400);
  assert.equal(response.json.error, expectedMessage);
}

async function testPaidAdsPositiveFlow(baseUrl: string) {
  const workspaceId = "workspace_medspa_demo";
  const uniqueSuffix = Date.now().toString().slice(-8);
  const campaignKey = `api-paid-ads-test-${uniqueSuffix}`;
  const utmCampaign = `api_paid_ads_${uniqueSuffix}`;
  const phone = `+1555${uniqueSuffix}`;

  const leadCreated = await requestJson({
    baseUrl,
    pathname: "/leads",
    method: "POST",
    body: {
      workspaceId,
      source: "facebook_ads",
      firstName: "ApiPaidAds",
      phone,
      attribution: {
        utmSource: "facebook",
        utmMedium: "paid_social",
        utmCampaign,
      },
    },
  });
  assert.equal(leadCreated.status, 201);
  assert.equal(leadCreated.json.lead !== undefined, true);

  const readinessQuery = new URLSearchParams({
    workspaceId,
    campaignKey,
    limit: "50",
    cooldownDays: "1",
  });
  const readiness = await requestJson({
    baseUrl,
    pathname: `/paid-ads/readiness?${readinessQuery.toString()}`,
  });
  assert.equal(readiness.status, 200);
  assert.equal(Number(readiness.json.eligibleCount) >= 1, true);

  const runResult = await requestJson({
    baseUrl,
    pathname: "/paid-ads/run",
    method: "POST",
    body: {
      workspaceId,
      campaignKey,
      limit: 1,
      cooldownDays: 1,
    },
  });
  assert.equal(runResult.status, 201);
  assert.equal(Number(runResult.json.queuedCount) >= 1, true);

  const spendResult = await requestJson({
    baseUrl,
    pathname: "/paid-ads/spend",
    method: "POST",
    body: {
      workspaceId,
      source: "facebook_ads",
      utmSource: "facebook",
      utmCampaign,
      amount: 125,
      currency: "USD",
      reportDate: new Date().toISOString(),
    },
  });
  assert.equal(spendResult.status, 201);
  assert.equal(spendResult.json.source, "facebook_ads");

  const reportQuery = new URLSearchParams({
    workspaceId,
    campaignKey,
    limit: "250",
  });
  const report = await requestJson({
    baseUrl,
    pathname: `/paid-ads/report?${reportQuery.toString()}`,
  });
  assert.equal(report.status, 200);
  assert.equal(Number(report.json.queuedCount) >= 1, true);
  assert.equal(Number(report.json.spendAmount) >= 125, true);
}

async function run() {
  const { server, baseUrl } = await startServer();

  try {
    const health = await requestJson({
      baseUrl,
      pathname: "/health",
    });
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);
    assert.equal(health.json.service, "api");

    const paidAdsSpendMissingSource = await requestJson({
      baseUrl,
      pathname: "/paid-ads/spend",
      method: "POST",
      body: {
        amount: 125,
        currency: "USD",
      },
    });
    assertErrorMessage(paidAdsSpendMissingSource, "`source` is required.");

    const paidAdsSpendInvalidAmount = await requestJson({
      baseUrl,
      pathname: "/paid-ads/spend",
      method: "POST",
      body: {
        source: "facebook_ads",
        amount: 0,
        currency: "USD",
      },
    });
    assertErrorMessage(
      paidAdsSpendInvalidAmount,
      "`amount` must be a positive number.",
    );

    const missingLeadSource = await requestJson({
      baseUrl,
      pathname: "/leads",
      method: "POST",
      body: {
        firstName: "Test",
        phone: "+15550000001",
      },
    });
    assertErrorMessage(missingLeadSource, "`source` is required.");

    const missingLeadContactAddress = await requestJson({
      baseUrl,
      pathname: "/leads",
      method: "POST",
      body: {
        source: "facebook_ads",
        firstName: "Test",
      },
    });
    assertErrorMessage(
      missingLeadContactAddress,
      "At least one of `email` or `phone` is required.",
    );

    await testPaidAdsPositiveFlow(baseUrl);

    console.log("[api] endpoint validation and paid-ads flow tests passed");
  } finally {
    await stopServer(server);
  }
}

await run();
