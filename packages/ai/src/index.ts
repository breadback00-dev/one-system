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

