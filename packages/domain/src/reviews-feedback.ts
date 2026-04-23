export interface ReviewReferralReplySignals {
  promoter: boolean;
  recovery: boolean;
  referralIntent: boolean;
  mixedSentiment: boolean;
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
