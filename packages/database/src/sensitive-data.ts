const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern =
  /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;

export const sensitiveEventNames = [
  "lead.created",
  "lead.responded",
  "lead.qualified",
  "appointment.booked",
  "message.inbound_received",
  "message.outbound_queued",
  "message.delivered",
  "message.suppressed",
  "sales_enablement.transcript_received",
  "sales_enablement.analysis_completed",
  "sales_enablement.score_recorded",
] as const;

export function redactSensitiveText(value: string): string {
  return value
    .replace(emailPattern, "[redacted-email]")
    .replace(phonePattern, "[redacted-phone]");
}
