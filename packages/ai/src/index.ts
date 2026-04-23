export interface PromptTemplate {
  key: string;
  purpose: string;
  system: string;
}

export const leadFollowUpPrompt: PromptTemplate = {
  key: "medspa.lead-follow-up.v1",
  purpose: "Generate a warm, fast, premium med spa lead follow-up message.",
  system: "You are writing a premium but friendly first-response message for a med spa lead.",
};

export type ReviewFeedbackSentiment = "promoter" | "recovery" | "neutral";
export type ReviewResponseConfidence = "high" | "medium";
export type ReviewResponseAction =
  | "invite_public_review"
  | "offer_service_recovery"
  | "gather_more_detail";

export interface GenerateReviewResponseDraftInput {
  customerFirstName?: string;
  customerMessage: string;
}

export interface GenerateReviewResponseDraftResult {
  promptKey: string;
  sentiment: ReviewFeedbackSentiment;
  confidence: ReviewResponseConfidence;
  suggestedNextAction: ReviewResponseAction;
  draft: string;
}

export const reviewResponsePrompt: PromptTemplate = {
  key: "medspa.review-response-draft.v1",
  purpose:
    "Generate a concise operator-ready reply draft to post-visit customer feedback.",
  system:
    "You are writing warm, professional med spa follow-up replies to post-visit customer messages.",
};

function normalizeMessage(message: string): string {
  return message.trim().replace(/\s+/g, " ").toLowerCase();
}

function detectReviewFeedbackSentiment(
  customerMessage: string,
): {
  sentiment: ReviewFeedbackSentiment;
  confidence: ReviewResponseConfidence;
} {
  const normalized = normalizeMessage(customerMessage);

  const promoterSignal =
    /\b5\b/.test(normalized) ||
    normalized.includes("great") ||
    normalized.includes("amazing") ||
    normalized.includes("awesome") ||
    normalized.includes("love");
  const recoverySignal =
    /\b1\b/.test(normalized) ||
    /\b2\b/.test(normalized) ||
    /\b3\b/.test(normalized) ||
    normalized.includes("bad") ||
    normalized.includes("poor") ||
    normalized.includes("unhappy") ||
    normalized.includes("disappointed");

  if (promoterSignal && !recoverySignal) {
    return { sentiment: "promoter", confidence: "high" };
  }

  if (recoverySignal && !promoterSignal) {
    return { sentiment: "recovery", confidence: "high" };
  }

  return { sentiment: "neutral", confidence: "medium" };
}

function buildReviewResponseDraft(args: {
  customerFirstName: string;
  sentiment: ReviewFeedbackSentiment;
}): {
  draft: string;
  suggestedNextAction: ReviewResponseAction;
} {
  if (args.sentiment === "promoter") {
    return {
      draft:
        `Thank you ${args.customerFirstName} for sharing that feedback. We are so glad you had a great visit. If you are open to it, we can send you our quick review link. We would also be happy to welcome any friend or family member you refer.`,
      suggestedNextAction: "invite_public_review",
    };
  }

  if (args.sentiment === "recovery") {
    return {
      draft:
        `Thank you ${args.customerFirstName} for your honest feedback. We are sorry your visit did not fully meet expectations. Our team would like to follow up directly and make this right. If you are open to it, please share the best number and time for us to reach you.`,
      suggestedNextAction: "offer_service_recovery",
    };
  }

  return {
    draft:
      `Thank you ${args.customerFirstName} for sharing your feedback. We appreciate hearing about your experience. If you are open to it, we would love to learn a little more so we can keep improving your visits.`,
    suggestedNextAction: "gather_more_detail",
  };
}

export function generateReviewResponseDraft(
  input: GenerateReviewResponseDraftInput,
): GenerateReviewResponseDraftResult {
  const customerMessage = input.customerMessage.trim();

  if (!customerMessage) {
    throw new Error("Customer feedback message is required.");
  }

  const customerFirstName = input.customerFirstName?.trim() || "there";
  const sentimentResult = detectReviewFeedbackSentiment(customerMessage);
  const response = buildReviewResponseDraft({
    customerFirstName,
    sentiment: sentimentResult.sentiment,
  });

  return {
    promptKey: reviewResponsePrompt.key,
    sentiment: sentimentResult.sentiment,
    confidence: sentimentResult.confidence,
    suggestedNextAction: response.suggestedNextAction,
    draft: response.draft,
  };
}
