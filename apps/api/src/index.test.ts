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

    console.log("[api] endpoint validation tests passed");
  } finally {
    await stopServer(server);
  }
}

await run();
