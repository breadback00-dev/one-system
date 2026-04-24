export const appConfig = {
  appName: "One System",
  launchNiche: "medspa",
  defaultTimezone: "Europe/London",
  appBaseUrl: process.env.APP_BASE_URL,
  bookingHandoffUrl:
    process.env.BOOKING_HANDOFF_URL ??
    "https://booking.example.com/consultation",
  messageProvider: process.env.MESSAGE_PROVIDER ?? "dev-log",
  operatorApiKey: process.env.ONE_SYSTEM_API_KEY,
  allowUnauthenticatedDashboardActions:
    process.env.ALLOW_UNAUTHENTICATED_DASHBOARD_ACTIONS === "true",
  sensitiveDataRetentionDays: process.env.SENSITIVE_DATA_RETENTION_DAYS,
  sensitiveDataRetentionSweepMs: process.env.SENSITIVE_DATA_RETENTION_SWEEP_MS,
  outboundDeliveryClaimTimeoutMs:
    process.env.OUTBOUND_DELIVERY_CLAIM_TIMEOUT_MS,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },
} as const;

export type MessageProvider = "dev-log" | "twilio";

export function getMessageProvider(): MessageProvider {
  return appConfig.messageProvider === "twilio" ? "twilio" : "dev-log";
}

export function hasTwilioCredentials() {
  return Boolean(
    appConfig.twilio.accountSid &&
      appConfig.twilio.authToken &&
      appConfig.twilio.fromNumber,
  );
}

export function canValidateTwilioWebhooks() {
  return Boolean(appConfig.twilio.authToken);
}

export function getOperatorApiKey() {
  return process.env.ONE_SYSTEM_API_KEY;
}

export function hasOperatorApiKey() {
  return Boolean(getOperatorApiKey()?.trim());
}

export function canRunUnauthenticatedDashboardActions() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_UNAUTHENTICATED_DASHBOARD_ACTIONS === "true"
  );
}

export function assertDashboardMutationAllowed() {
  if (!canRunUnauthenticatedDashboardActions()) {
    throw new Error(
      "Dashboard mutations require an authenticated production session. Set up dashboard auth before enabling production actions.",
    );
  }
}

export function getSensitiveDataRetentionDays() {
  const parsed = Number.parseInt(
    process.env.SENSITIVE_DATA_RETENTION_DAYS ?? "180",
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180;
}

export function getSensitiveDataRetentionSweepMs() {
  const parsed = Number.parseInt(
    process.env.SENSITIVE_DATA_RETENTION_SWEEP_MS ?? "86400000",
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 86_400_000;
}

export function getOutboundDeliveryClaimTimeoutMs() {
  const parsed = Number.parseInt(
    process.env.OUTBOUND_DELIVERY_CLAIM_TIMEOUT_MS ?? "900000",
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900_000;
}
