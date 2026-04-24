/**
 * Idempotent demo workspace seed.
 * Run: npx tsx packages/database/src/seed-demo.ts
 * Safe to re-run — clears and repopulates the demo workspace each time.
 */

import { prisma } from "./client";
import {
  appendEvents,
  ensureWorkspaceById,
  importReactivationContacts,
  recordInboundMessage,
} from "./index";

const DEMO_ID = process.env.DEMO_WORKSPACE_ID?.trim() || "workspace_medspa_demo";

// --- Name pools -------------------------------------------------------

const FIRST_NAMES = [
  "Sarah","James","Emma","Liam","Olivia","Noah","Ava","Elijah","Isabella","Oliver",
  "Sophia","Lucas","Mia","Aiden","Charlotte","Ethan","Amelia","Caden","Harper","Mason",
  "Evelyn","Logan","Abigail","Jacob","Emily","Jackson","Elizabeth","Sebastian","Sofia","Jack",
  "Aria","Owen","Scarlett","Samuel","Victoria","Asher","Grace","Caleb","Chloe","Ryan",
  "Penelope","Nathan","Layla","Joshua","Riley","Dylan","Zoey","Landon","Nora","Wyatt",
];

const LAST_NAMES = [
  "Smith","Johnson","Williams","Jones","Brown","Davis","Miller","Wilson","Moore","Taylor",
  "Anderson","Thomas","Jackson","White","Harris","Martin","Thompson","Garcia","Martinez","Robinson",
  "Clark","Rodriguez","Lewis","Lee","Walker","Hall","Allen","Young","Hernandez","King",
  "Wright","Lopez","Hill","Scott","Green","Adams","Baker","Gonzalez","Nelson","Carter",
  "Mitchell","Perez","Roberts","Turner","Phillips","Campbell","Parker","Evans","Edwards","Collins",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function isoAgo(days: number, hours = 0): string {
  return new Date(Date.now() - (days * 86400 + hours * 3600) * 1000).toISOString();
}

// --- Clear demo workspace data ----------------------------------------

async function clearDemoData(workspaceId: string) {
  await prisma.$transaction([
    prisma.outboundDeliveryAttempt.deleteMany({ where: { workspaceId } }),
    prisma.message.deleteMany({ where: { workspaceId } }),
    prisma.event.deleteMany({ where: { workspaceId } }),
    prisma.consultationTranscript.deleteMany({ where: { workspaceId } }),
    prisma.appointment.deleteMany({ where: { workspaceId } }),
    prisma.adSpendEntry.deleteMany({ where: { workspaceId } }),
    prisma.lead.deleteMany({ where: { workspaceId } }),
    prisma.conversation.deleteMany({ where: { workspaceId } }),
    prisma.contact.deleteMany({ where: { workspaceId } }),
  ]);
}

// --- Main -------------------------------------------------------------

async function main() {
  console.log(`Seeding demo workspace: ${DEMO_ID}`);

  await ensureWorkspaceById(DEMO_ID);
  await clearDemoData(DEMO_ID);
  console.log("Cleared existing demo data.");

  // 1. Import contacts — 80 past customers, 60 stale leads
  const contactRows = Array.from({ length: 140 }, (_, i) => {
    const isPast = i < 80;
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const daysBack = isPast
      ? 90 + Math.floor(Math.random() * 300)   // 90–390 days ago
      : 45 + Math.floor(Math.random() * 200);   // 45–245 days ago
    return {
      rowNumber: i + 1,
      firstName,
      lastName,
      phone: `+447${String(700000000 + i).padStart(9, "0")}`,
      segment: isPast ? ("past_customer" as const) : ("stale_lead" as const),
      lastActivityAt: daysAgo(daysBack).toISOString(),
    };
  });

  const importResult = await importReactivationContacts({
    workspaceId: DEMO_ID,
    rows: contactRows,
  });
  console.log(`Imported ${importResult.importedCount} contacts.`);

  // Fetch contacts for event building
  const contacts = await prisma.contact.findMany({
    where: { workspaceId: DEMO_ID },
    orderBy: { createdAt: "asc" },
  });

  if (contacts.length === 0) throw new Error("No contacts after import.");

  // 2. Build three campaign runs
  const runs = [
    { key: "reactivation-q1", runId: "run-demo-001", daysBack: 60, count: 45, bookedRatio: 0.11 },
    { key: "reactivation-q2", runId: "run-demo-002", daysBack: 30, count: 55, bookedRatio: 0.09 },
    { key: "reactivation-q3", runId: "run-demo-003", daysBack: 7,  count: 38, bookedRatio: 0    },
  ];

  for (const run of runs) {
    const batch = contacts.slice(0, run.count);
    const queuedEvents: Parameters<typeof appendEvents>[0] = [];
    const deliveredEvents: Parameters<typeof appendEvents>[0] = [];

    for (let i = 0; i < batch.length; i++) {
      const contact = batch[i]!;
      const queuedEventId = `${run.runId}-qev-${i}`;
      const queuedAt = isoAgo(run.daysBack, i % 24);

      queuedEvents.push({
        id: queuedEventId,
        workspaceId: DEMO_ID,
        name: "message.outbound_queued",
        occurredAt: new Date(queuedAt),
        payload: {
          queuedEventId,
          contactId: contact.id,
          channel: "sms",
          destination: contact.phone ?? `+44700${i}`,
          message: `Hi ${contact.firstName}, it's been a while — we'd love to see you back. Reply YES to book or STOP to opt out.`,
          reason: "reactivation.dormant-outreach",
          campaignKey: run.key,
          runId: run.runId,
        },
      });

      // ~85% delivery rate
      if (i % 12 !== 0) {
        deliveredEvents.push({
          id: `${run.runId}-dev-${i}`,
          workspaceId: DEMO_ID,
          name: "message.delivered",
          occurredAt: new Date(isoAgo(run.daysBack - 0.1, i % 24)),
          payload: {
            queuedEventId,
            contactId: contact.id,
            channel: "sms",
            provider: "twilio",
            deliveredAt: isoAgo(run.daysBack - 0.1, i % 24),
          },
        });
      }
    }

    await appendEvents(queuedEvents);
    await appendEvents(deliveredEvents);

    // Replies: ~22% of delivered
    const replyBatch = batch.filter((_, i) => i % 5 === 1 && i % 12 !== 0);
    for (const contact of replyBatch) {
      await recordInboundMessage({
        workspaceId: DEMO_ID,
        contactId: contact.id,
        channel: "sms",
        provider: "twilio",
        from: contact.phone ?? "+44700000000",
        body: "YES interested, what days do you have?",
        receivedAt: isoAgo(run.daysBack - 1),
      });
    }

    // Booked: subset of replies on older runs
    if (run.bookedRatio > 0) {
      const bookedBatch = batch.filter((_, i) => i % 9 === 1 && i % 12 !== 0);
      for (const contact of bookedBatch.slice(0, Math.ceil(run.count * run.bookedRatio))) {
        await prisma.appointment.create({
          data: {
            workspaceId: DEMO_ID,
            contactId: contact.id,
            startsAt: daysAgo(run.daysBack - 14),
            outcome: "completed",
          },
        });
      }
    }

    console.log(`Run ${run.runId}: ${run.count} queued, replies: ${replyBatch.length}`);
  }

  // 3. Ad spend entries — 6 months of monthly spend across 3 sources
  const adSources = [
    { source: "google_ads", utmSource: "google", utmCampaign: "search-local", monthly: 1200 },
    { source: "meta_ads",   utmSource: "facebook", utmCampaign: "reach-retarget", monthly: 800 },
    { source: "tiktok_ads", utmSource: "tiktok",   utmCampaign: "awareness-2025", monthly: 400 },
  ];

  for (let m = 5; m >= 0; m--) {
    const reportDate = daysAgo(m * 30);
    for (const ad of adSources) {
      const variance = 0.85 + Math.random() * 0.30;
      await prisma.adSpendEntry.create({
        data: {
          workspaceId: DEMO_ID,
          reportDate,
          source: ad.source,
          utmSource: ad.utmSource,
          utmCampaign: ad.utmCampaign,
          amount: (ad.monthly * variance).toFixed(2),
          currency: "GBP",
        },
      });
    }
  }
  console.log("Ad spend entries created.");

  // 4. Leads — 30 inbound leads with source attribution
  const leadContacts = contacts.slice(100, 130);
  for (let i = 0; i < leadContacts.length; i++) {
    const contact = leadContacts[i]!;
    const source = i % 3 === 0 ? "google_ads" : i % 3 === 1 ? "meta_ads" : "organic";
    const lead = await prisma.lead.create({
      data: {
        workspaceId: DEMO_ID,
        contactId: contact.id,
        source,
        status: i % 4 === 0 ? "booked" : i % 4 === 1 ? "qualified" : "new",
        utmSource: source === "organic" ? undefined : source.replace("_ads", ""),
        utmCampaign: source === "google_ads" ? "search-local" : source === "meta_ads" ? "reach-retarget" : undefined,
        createdAt: daysAgo(Math.floor(Math.random() * 60)),
      },
    });

    if (i % 4 === 0) {
      await prisma.appointment.create({
        data: {
          workspaceId: DEMO_ID,
          contactId: contact.id,
          leadId: lead.id,
          startsAt: daysAgo(Math.floor(Math.random() * 30)),
          outcome: i % 8 === 0 ? "completed" : undefined,
        },
      });
    }
  }
  console.log("Leads and appointments created.");

  // 5. Consultation transcripts — 4 sample transcripts for Sales Enablement
  const transcriptContacts = contacts.slice(130);
  for (let i = 0; i < Math.min(4, transcriptContacts.length); i++) {
    const contact = transcriptContacts[i]!;
    await prisma.consultationTranscript.create({
      data: {
        workspaceId: DEMO_ID,
        contactId: contact.id,
        externalId: `transcript-demo-${i}`,
        summary: `Consultation with ${contact.firstName}. Client expressed interest in the full package but raised price concern. Follow-up scheduled for next week.`,
        keyTopics: JSON.stringify(["pricing", "scheduling", "treatment-plan"]),
        objections: JSON.stringify(["cost-too-high", "needs-to-check-calendar"]),
        followUpActions: JSON.stringify(["send-price-breakdown", "share-testimonials"]),
        sentiment: i % 3 === 0 ? "positive" : i % 3 === 1 ? "neutral" : "mixed",
        occurredAt: daysAgo(i * 7 + 2),
      },
    });
  }
  console.log("Consultation transcripts created.");

  console.log(`\nDemo workspace '${DEMO_ID}' seeded successfully.`);
  console.log(`  Contacts: ${contacts.length}`);
  console.log(`  Campaign runs: ${runs.length}`);
  console.log("  Ad spend: 6 months × 3 sources");
  console.log("  Leads: 30");
  console.log("  Transcripts: 4");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
