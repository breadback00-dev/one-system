export interface ReviewReferralReplySignals {
  promoter: boolean;
  recovery: boolean;
  referralIntent: boolean;
  mixedSentiment: boolean;
}

export type ReferralSourceCaptureConfidence = "high" | "medium" | "low";

export interface ReferralSourceDetails {
  referredName?: string;
  referredContact?: string;
  captureConfidence?: ReferralSourceCaptureConfidence;
}

export function classifyReviewReferralReplySignals(
  messageBody: string,
): ReviewReferralReplySignals {
  const normalized = messageBody.toLowerCase();
  const hasPromoterSignal =
    /\b5(?:\/5)?\b/.test(normalized) ||
    normalized.includes("five star") ||
    normalized.includes("great") ||
    normalized.includes("amazing") ||
    normalized.includes("awesome") ||
    normalized.includes("love");
  const hasRecoverySignal =
    /\b[1-3](?:\/5)?\b/.test(normalized) ||
    normalized.includes("bad") ||
    normalized.includes("poor") ||
    normalized.includes("unhappy") ||
    normalized.includes("disappointed") ||
    normalized.includes("not happy") ||
    normalized.includes("not great");
  const hasReferralSignal =
    normalized.includes("refer") ||
    normalized.includes("referral") ||
    normalized.includes("friend") ||
    normalized.includes("family");
  const mixedSentiment = hasPromoterSignal && hasRecoverySignal;

  return {
    promoter: hasPromoterSignal && !hasRecoverySignal,
    recovery: hasRecoverySignal,
    referralIntent: hasReferralSignal && !hasRecoverySignal,
    mixedSentiment,
  };
}

function extractReferralContact(messageBody: string): string | undefined {
  const emailMatch = messageBody.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch?.[0]) {
    return emailMatch[0].toLowerCase();
  }

  const phoneMatch = messageBody.match(/\+?\d[\d\s().-]{6,}\d/);
  if (!phoneMatch?.[0]) {
    return undefined;
  }

  const normalized = phoneMatch[0].replace(/[^\d+]/g, "");

  return normalized.length >= 7 ? normalized : undefined;
}

function toDisplayName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractExplicitReferralName(messageBody: string): string | undefined {
  const explicitMatch = messageBody.match(
    /\b(?:name is|named|it's|its|called|friend is|friend's name is)\s+([a-z][a-z' -]{1,40}?)(?=\s*(?:$|[,.!?]|and\b|but\b|at\b|\+?\d|[A-Z0-9._%+-]+@))/i,
  );

  if (explicitMatch?.[1]) {
    return toDisplayName(explicitMatch[1]);
  }

  return undefined;
}

function extractLeadingReferralName(messageBody: string): string | undefined {
  const leadingStopWords = new Set([
    "i",
    "we",
    "can",
    "could",
    "refer",
    "someone",
    "my",
    "friend",
    "family",
    "their",
    "name",
    "its",
    "it's",
    "and",
    "yes",
    "yeah",
    "sure",
    "the",
    "a",
  ]);
  const leadingMatch = messageBody.match(
    /^\s*([a-z][a-z' -]{1,40})\s*(?:,|-|\/|\(|\d|[A-Z0-9._%+-]+@)/i,
  );

  if (leadingMatch?.[1]) {
    const normalizedFirstWord = leadingMatch[1]
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase();

    if (normalizedFirstWord && leadingStopWords.has(normalizedFirstWord)) {
      return undefined;
    }

    return toDisplayName(leadingMatch[1]);
  }

  return undefined;
}

export function extractReviewReferralSourceDetails(
  messageBody: string,
): ReferralSourceDetails {
  const referredContact = extractReferralContact(messageBody);
  const explicitName = extractExplicitReferralName(messageBody);
  const leadingName = explicitName ? undefined : extractLeadingReferralName(messageBody);
  const referredName = explicitName ?? leadingName;
  const captureConfidence = referredContact
    ? "high"
    : explicitName
      ? "medium"
      : leadingName
        ? "low"
        : undefined;

  return {
    ...(referredName ? { referredName } : {}),
    ...(referredContact ? { referredContact } : {}),
    ...(captureConfidence ? { captureConfidence } : {}),
  };
}
