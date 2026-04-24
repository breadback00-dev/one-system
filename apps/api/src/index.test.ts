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
  headers?: Record<string, string>;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${args.baseUrl}${args.pathname}`, {
    method: args.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(args.headers ?? {}),
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
  const createdContact = leadCreated.json.contact as { id: string };
  const duplicateLeadCreated = await requestJson({
    baseUrl,
    pathname: "/leads",
    method: "POST",
    body: {
      workspaceId,
      source: "facebook_ads",
      firstName: "ApiPaidAdsAgain",
      phone,
      attribution: {
        utmSource: "facebook",
        utmMedium: "paid_social",
        utmCampaign,
      },
    },
  });
  assert.equal(duplicateLeadCreated.status, 201);
  assert.equal(
    (duplicateLeadCreated.json.contact as { id: string }).id,
    createdContact.id,
  );
  assert.equal(
    (duplicateLeadCreated.json.lead as { contactId: string }).contactId,
    createdContact.id,
  );

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

async function testSalesEnablementPositiveFlow(baseUrl: string) {
  const workspaceId = "workspace_medspa_demo";
  const uniqueSuffix = Date.now().toString().slice(-8);
  const phone = `+1666${uniqueSuffix}`;

  const leadCreated = await requestJson({
    baseUrl,
    pathname: "/leads",
    method: "POST",
    body: {
      workspaceId,
      source: "manual_consultation",
      firstName: "ApiTranscript",
      phone,
    },
  });
  assert.equal(leadCreated.status, 201);
  const contact = leadCreated.json.contact as { id: string };
  const lead = leadCreated.json.lead as { id: string };

  const appointmentCreated = await requestJson({
    baseUrl,
    pathname: "/appointments",
    method: "POST",
    body: {
      workspaceId,
      contactId: contact.id,
      leadId: lead.id,
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      outcome: "scheduled",
    },
  });
  assert.equal(appointmentCreated.status, 201);
  const appointment = appointmentCreated.json.appointment as { id: string };

  const transcriptCreated = await requestJson({
    baseUrl,
    pathname: "/sales-enablement/transcripts",
    method: "POST",
    body: {
      workspaceId,
      appointmentId: appointment.id,
      source: "manual",
      agentName: "Rep Aurora",
      transcriptText:
        "Advisor: Tell me about your goals. Client: I want help with acne scarring, but I am worried about price. Advisor: We have package options and can book a consultation next week if that helps.",
    },
  });
  assert.equal(transcriptCreated.status, 201);
  const transcript = transcriptCreated.json.transcript as {
    id: string;
    appointmentId: string;
  };
  assert.equal(
    transcript.appointmentId,
    appointment.id,
  );

  const report = await requestJson({
    baseUrl,
    pathname: `/sales-enablement/report?workspaceId=${workspaceId}&limit=25`,
  });
  assert.equal(report.status, 200);
  assert.equal(Number(report.json.transcriptCount) >= 1, true);
  assert.equal(Array.isArray(report.json.transcripts), true);
  const transcripts = report.json.transcripts as Array<{
    transcriptId: string;
    agentName?: string;
  }>;
  const repPerformance = report.json.repPerformance as Array<{
    agentName: string;
    transcriptCount: number;
    coachingFocus: string;
  }>;
  const matchingTranscript = transcripts.find(
    (item) => item.transcriptId === transcript.id,
  );
  assert.equal(matchingTranscript?.agentName, "Rep Aurora");
  assert.equal(Array.isArray(repPerformance), true);
  assert.equal(
    repPerformance.some((rep) => rep.agentName === "Rep Aurora"),
    true,
  );
}

async function testSalesEnablementSyncPositiveFlow(baseUrl: string) {
  const workspaceId = "workspace_medspa_demo";
  const uniqueSuffix = Date.now().toString().slice(-8);
  const phone = `+1777${uniqueSuffix}`;

  const leadCreated = await requestJson({
    baseUrl,
    pathname: "/leads",
    method: "POST",
    body: {
      workspaceId,
      source: "dev_capture",
      firstName: "ApiSyncTranscript",
      phone,
    },
  });
  assert.equal(leadCreated.status, 201);
  const contact = leadCreated.json.contact as { id: string };
  const lead = leadCreated.json.lead as { id: string };

  const appointmentCreated = await requestJson({
    baseUrl,
    pathname: "/appointments",
    method: "POST",
    body: {
      workspaceId,
      contactId: contact.id,
      leadId: lead.id,
      startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      outcome: "scheduled",
    },
  });
  assert.equal(appointmentCreated.status, 201);
  const appointment = appointmentCreated.json.appointment as { id: string };

  const syncPayload = {
    workspaceId,
    dateFrom: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    dateTo: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    limit: 10,
    records: [
      {
        externalId: `api-sync-${uniqueSuffix}`,
        occurredAt: new Date().toISOString(),
        sourceProvider: "dev_capture",
        appointmentExternalId: appointment.id,
        agentName: "Rep Sync",
        transcriptText:
          "Advisor: What are your goals? Client: I want to book but I am worried about budget. Advisor: We can walk through package options and find a strong fit.",
      },
    ],
  };

  const syncResult = await requestJson({
    baseUrl,
    pathname: "/sales-enablement/sync",
    method: "POST",
    body: syncPayload,
  });
  assert.equal(syncResult.status, 201);
  assert.equal(Number(syncResult.json.importedCount), 1);
  assert.equal(Number(syncResult.json.skippedCount), 0);

  const syncRepeatResult = await requestJson({
    baseUrl,
    pathname: "/sales-enablement/sync",
    method: "POST",
    body: syncPayload,
  });
  assert.equal(syncRepeatResult.status, 201);
  assert.equal(Number(syncRepeatResult.json.importedCount), 0);
  assert.equal(Number(syncRepeatResult.json.skippedCount) >= 1, true);

  const report = await requestJson({
    baseUrl,
    pathname: `/sales-enablement/report?workspaceId=${workspaceId}&limit=50`,
  });
  assert.equal(report.status, 200);
  const transcripts = report.json.transcripts as Array<{
    externalId?: string;
    agentName?: string;
  }>;
  const syncTranscript = transcripts.find(
    (item) => item.externalId === `api-sync-${uniqueSuffix}`,
  );
  assert.equal(syncTranscript?.agentName, "Rep Sync");
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

    process.env.ONE_SYSTEM_API_KEY = "api-test-secret";
    const unauthenticatedProtectedRoute = await requestJson({
      baseUrl,
      pathname: "/leads",
      method: "POST",
      body: {
        source: "facebook_ads",
        firstName: "AuthTest",
        phone: "+15550000002",
      },
    });
    assert.equal(unauthenticatedProtectedRoute.status, 401);
    assert.equal(
      unauthenticatedProtectedRoute.json.error,
      "Missing or invalid operator API credentials.",
    );

    const authenticatedProtectedRouteValidation = await requestJson({
      baseUrl,
      pathname: "/leads",
      method: "POST",
      headers: {
        authorization: "Bearer api-test-secret",
      },
      body: {
        firstName: "AuthTest",
        phone: "+15550000002",
      },
    });
    assertErrorMessage(
      authenticatedProtectedRouteValidation,
      "`source` is required.",
    );
    delete process.env.ONE_SYSTEM_API_KEY;

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

    const missingTranscriptAppointment = await requestJson({
      baseUrl,
      pathname: "/sales-enablement/transcripts",
      method: "POST",
      body: {
        transcriptText: "hello",
        source: "manual",
      },
    });
    assertErrorMessage(
      missingTranscriptAppointment,
      "`appointmentId` is required.",
    );

    const missingTranscriptText = await requestJson({
      baseUrl,
      pathname: "/sales-enablement/transcripts",
      method: "POST",
      body: {
        appointmentId: "appt_123",
        source: "manual",
      },
    });
    assertErrorMessage(missingTranscriptText, "`transcriptText` is required.");

    const oversizedTranscriptText = await requestJson({
      baseUrl,
      pathname: "/sales-enablement/transcripts",
      method: "POST",
      body: {
        appointmentId: "appt_123",
        source: "manual",
        transcriptText: "x".repeat(20_001),
      },
    });
    assertErrorMessage(
      oversizedTranscriptText,
      "`transcriptText` must be 20000 characters or fewer.",
    );

    const missingSyncRecords = await requestJson({
      baseUrl,
      pathname: "/sales-enablement/sync",
      method: "POST",
      body: {
        dateFrom: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        dateTo: new Date().toISOString(),
      },
    });
    assertErrorMessage(
      missingSyncRecords,
      "`records` must be a non-empty array.",
    );

    const oversizedSyncTranscriptText = await requestJson({
      baseUrl,
      pathname: "/sales-enablement/sync",
      method: "POST",
      body: {
        dateFrom: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        dateTo: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        records: [
          {
            externalId: "api-sync-oversized",
            occurredAt: new Date().toISOString(),
            sourceProvider: "dev_capture",
            appointmentExternalId: "appt_123",
            transcriptText: "x".repeat(20_001),
          },
        ],
      },
    });
    assertErrorMessage(
      oversizedSyncTranscriptText,
      "records[0].transcriptText must be 20000 characters or fewer.",
    );

    await testPaidAdsPositiveFlow(baseUrl);
    await testSalesEnablementPositiveFlow(baseUrl);
    await testSalesEnablementSyncPositiveFlow(baseUrl);

    console.log("[api] endpoint validation, paid-ads flow, sales-enablement flow, and sales sync flow tests passed");
  } finally {
    await stopServer(server);
  }
}

await run();
