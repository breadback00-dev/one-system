export const appConfig = {
  appName: "One System",
  launchNiche: "medspa",
  defaultTimezone: "Europe/London",
  appBaseUrl: process.env.APP_BASE_URL,
  bookingHandoffUrl:
    process.env.BOOKING_HANDOFF_URL ??
    "https://booking.example.com/consultation",
  messageProvider: process.env.MESSAGE_PROVIDER ?? "dev-log",
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
