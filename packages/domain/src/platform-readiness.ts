export type PlatformReadinessStatus = "ready" | "partial" | "missing";

export interface PlatformFoundationRequirement {
  key: string;
  label: string;
  status: PlatformReadinessStatus;
  evidence: string;
  nextStep?: string;
}

export interface PlatformModuleBoundary {
  key: string;
  label: string;
  packageName: string;
  owns: string[];
  dependsOn: string[];
  status: "completed" | "signoff";
}

export interface PlatformFoundationReadiness {
  status: PlatformReadinessStatus;
  readyCount: number;
  partialCount: number;
  missingCount: number;
  requirements: PlatformFoundationRequirement[];
  modules: PlatformModuleBoundary[];
}

export const platformModuleBoundaries: PlatformModuleBoundary[] = [
  {
    key: "lead_capture",
    label: "Lead Capture + Instant Follow-Up",
    packageName: "@one-system/lead-capture",
    owns: ["lead intake defaults", "first-response workflow"],
    dependsOn: ["domain", "database", "messaging", "workflows"],
    status: "completed",
  },
  {
    key: "reactivation",
    label: "Database Reactivation",
    packageName: "@one-system/reactivation",
    owns: ["dormant audience selection", "reactivation run execution"],
    dependsOn: ["domain", "database", "messaging", "integrations"],
    status: "completed",
  },
  {
    key: "reviews_referrals",
    label: "Reviews + Referrals",
    packageName: "@one-system/reviews-referrals",
    owns: ["post-visit requests", "reply routing", "referral capture"],
    dependsOn: ["domain", "database", "messaging", "ai"],
    status: "completed",
  },
  {
    key: "paid_ads",
    label: "Paid Ads + Lead Nurturing",
    packageName: "@one-system/paid-ads",
    owns: ["attributed audience selection", "paid nurture execution"],
    dependsOn: ["domain", "database", "workflows", "integrations"],
    status: "completed",
  },
  {
    key: "sales_enablement",
    label: "Sales Enablement",
    packageName: "@one-system/sales-enablement",
    owns: ["consultation transcript ingestion", "sales analysis reporting"],
    dependsOn: ["domain", "database", "ai", "integrations"],
    status: "signoff",
  },
];

export const platformFoundationRequirements: PlatformFoundationRequirement[] = [
  {
    key: "workspaces",
    label: "Accounts and workspaces",
    status: "ready",
    evidence: "Workspace is canonical in domain and Prisma, with default workspace bootstrapping.",
  },
  {
    key: "contacts_leads_customers",
    label: "Contacts, leads, and customers",
    status: "partial",
    evidence: "Contacts and leads are canonical; customer lifecycle remains represented through appointments and events.",
    nextStep: "Add an explicit customer/profile boundary when repeat-customer workflows need durable customer state.",
  },
  {
    key: "conversations_messages",
    label: "Conversations and message history",
    status: "ready",
    evidence: "Inbound and outbound messages persist into conversations with delivery status visibility.",
  },
  {
    key: "bookings_outcomes",
    label: "Bookings and outcomes",
    status: "ready",
    evidence: "Appointments are first-class records and emit appointment.booked events used by module reporting.",
  },
  {
    key: "workflow_engine",
    label: "Workflow engine",
    status: "partial",
    evidence: "Modules execute reusable workflow functions and queue message events through the worker path.",
    nextStep: "Promote common workflow step metadata into packages/workflows before adding a configurable workflow builder.",
  },
  {
    key: "prompt_template_system",
    label: "Prompt and template system",
    status: "ready",
    evidence: "Reusable prompt primitives exist for lead follow-up, reviews, and sales analysis.",
  },
  {
    key: "event_tracking",
    label: "Event tracking",
    status: "ready",
    evidence: "All five modules emit first-class events used by reporting and downstream routing.",
  },
  {
    key: "integrations_framework",
    label: "Integrations framework",
    status: "ready",
    evidence: "Twilio, CRM, ads, and sales transcript adapter contracts live behind packages/integrations.",
  },
  {
    key: "permissions_settings_auditability",
    label: "Permissions, settings, and auditability",
    status: "partial",
    evidence: "Operator API keys and dashboard mutation guardrails exist; full user/session permissions are not implemented.",
    nextStep: "Add user/session-aware dashboard auth before production multi-operator rollout.",
  },
  {
    key: "module_reporting",
    label: "Module reporting",
    status: "ready",
    evidence: "Dashboard and API reporting surfaces exist across reactivation, reviews, paid ads, and sales enablement.",
  },
];

export function getPlatformFoundationReadiness(): PlatformFoundationReadiness {
  const readyCount = platformFoundationRequirements.filter(
    (requirement) => requirement.status === "ready",
  ).length;
  const partialCount = platformFoundationRequirements.filter(
    (requirement) => requirement.status === "partial",
  ).length;
  const missingCount = platformFoundationRequirements.filter(
    (requirement) => requirement.status === "missing",
  ).length;
  const status: PlatformReadinessStatus =
    missingCount > 0 ? "missing" : partialCount > 0 ? "partial" : "ready";

  return {
    status,
    readyCount,
    partialCount,
    missingCount,
    requirements: platformFoundationRequirements,
    modules: platformModuleBoundaries,
  };
}
