export const OPT_OUT_KEYWORDS = [
  "stop",
  "unsubscribe",
  "quit",
  "cancel",
  "end",
] as const;

const OPT_OUT_WORD_PATTERN = /\b(stop|unsubscribe|quit|cancel|end)\b/i;

export function isOptOutKeywordMessage(body: string): boolean {
  return OPT_OUT_WORD_PATTERN.test(body);
}
