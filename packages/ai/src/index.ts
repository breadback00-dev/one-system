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

export interface GenerateConsultationAnalysisInput {
  transcriptText: string;
}

export interface GenerateConsultationAnalysisResult {
  promptKey: string;
  summary: string;
  scorecard: {
    overallScore: number;
    rapportScore: number;
    needsScore: number;
    objectionHandlingScore: number;
    bookingIntentScore: number;
    primaryObjection?: string;
    nextStep: string;
  };
}

export const consultationAnalysisPrompt: PromptTemplate = {
  key: "medspa.consultation-analysis.v1",
  purpose:
    "Summarize a med spa consultation transcript and score conversion-critical behaviors.",
  system:
    "You are analyzing med spa consultation transcripts for conversion quality, objections, and coaching next steps.",
};

function normalizeMessage(message: string): string {
  return message.trim().replace(/\s+/g, " ").toLowerCase();
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function countMatches(input: string, terms: string[]): number {
  return terms.reduce((count, term) => count + (input.includes(term) ? 1 : 0), 0);
}

function detectPrimaryObjection(input: string): string | undefined {
  const objectionSignals = [
    {
      label: "price",
      matches: countMatches(input, [
        "price",
        "cost",
        "expensive",
        "budget",
        "afford",
      ]),
    },
    {
      label: "timing",
      matches: countMatches(input, [
        "busy",
        "schedule",
        "timing",
        "next month",
        "later",
      ]),
    },
    {
      label: "results uncertainty",
      matches: countMatches(input, [
        "results",
        "work for me",
        "before and after",
        "not sure",
        "difference",
      ]),
    },
    {
      label: "recovery concern",
      matches: countMatches(input, [
        "pain",
        "downtime",
        "recovery",
        "healing",
        "nervous",
      ]),
    },
  ].sort((left, right) => right.matches - left.matches);

  return objectionSignals[0]?.matches ? objectionSignals[0].label : undefined;
}

function buildConsultationSummary(input: string): string {
  const opening =
    input.includes("acne") || input.includes("pigment") || input.includes("skin")
      ? "The consultation focused on the client's treatment goals and skin concerns."
      : "The consultation covered the client's goals, questions, and readiness to move forward.";
  const objection = detectPrimaryObjection(input);

  if (objection === "price") {
    return `${opening} Cost sensitivity came up as the main objection, and the next step should reinforce value while offering a clear path to book.`;
  }

  if (objection === "timing") {
    return `${opening} Scheduling friction was the main blocker, so the follow-up should narrow the choice to a small set of appointment options.`;
  }

  if (objection === "results uncertainty") {
    return `${opening} Confidence in likely results needs strengthening, so the follow-up should clarify expected outcomes and the right treatment fit.`;
  }

  if (objection === "recovery concern") {
    return `${opening} Recovery concerns were the main hesitation, so the follow-up should reduce uncertainty around downtime and aftercare.`;
  }

  return `${opening} The conversation shows enough context to move toward a concrete booking follow-up.`;
}

function buildConsultationNextStep(args: {
  primaryObjection?: string;
  bookingIntentScore: number;
}): string {
  if (args.bookingIntentScore >= 4) {
    return "Send two concrete consultation times and ask the client to choose one.";
  }

  if (args.primaryObjection === "price") {
    return "Follow up with package framing, value anchors, and one simple starter option.";
  }

  if (args.primaryObjection === "timing") {
    return "Offer a tight set of appointment windows and confirm the soonest workable slot.";
  }

  if (args.primaryObjection === "results uncertainty") {
    return "Share likely treatment outcomes, suitability guidance, and a low-friction next consultation step.";
  }

  if (args.primaryObjection === "recovery concern") {
    return "Reassure on downtime, aftercare, and what to expect in the first few days after treatment.";
  }

  return "Follow up with a concise recap of goals and invite the client to book the consultation.";
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

export function generateConsultationAnalysis(
  input: GenerateConsultationAnalysisInput,
): GenerateConsultationAnalysisResult {
  const transcriptText = input.transcriptText.trim();

  if (!transcriptText) {
    throw new Error("Consultation transcript text is required.");
  }

  const normalized = normalizeMessage(transcriptText);
  const rapportScore = clampScore(
    2 +
      countMatches(normalized, [
        "thank you",
        "absolutely",
        "glad",
        "happy to help",
        "great question",
      ]),
  );
  const needsScore = clampScore(
    2 +
      countMatches(normalized, [
        "goal",
        "concern",
        "looking for",
        "want to improve",
        "tell me",
      ]),
  );
  const objectionHandlingScore = clampScore(
    2 +
      countMatches(normalized, [
        "options",
        "package",
        "plan",
        "we can",
        "recommend",
      ]),
  );
  const bookingIntentScore = clampScore(
    1 +
      countMatches(normalized, [
        "book",
        "schedule",
        "consultation",
        "next week",
        "availability",
        "appointment",
      ]),
  );
  const overallScore = clampScore(
    (rapportScore + needsScore + objectionHandlingScore + bookingIntentScore) / 4,
  );
  const primaryObjection = detectPrimaryObjection(normalized);
  const nextStep = buildConsultationNextStep({
    bookingIntentScore,
    ...(primaryObjection ? { primaryObjection } : {}),
  });

  return {
    promptKey: consultationAnalysisPrompt.key,
    summary: buildConsultationSummary(normalized),
    scorecard: {
      overallScore,
      rapportScore,
      needsScore,
      objectionHandlingScore,
      bookingIntentScore,
      ...(primaryObjection ? { primaryObjection } : {}),
      nextStep,
    },
  };
}
