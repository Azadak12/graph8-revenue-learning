/** Shared Deal upsert logic used by both the investigation engine (closed
 * deals) and the future-warning engine (open deals). Ported from
 * backend/app/services/graph8/sync.py. */
import { prisma } from "../../db";
import type { Graph8Provider } from "./base";
import type { G8DealBundle } from "./schemas";
import type { Deal, DealSegment, DealOutcome } from "@prisma/client";

const CONTACT_ROLES = ["champion", "decision_maker", "influencer", "blocker", "coach", "end_user", "unknown"];
const SEGMENTS = ["enterprise", "mid_market", "smb"];

export async function syncDeal(args: {
  organizationId: string;
  provider: Graph8Provider;
  graph8DealId: string;
}): Promise<{ deal: Deal; bundle: G8DealBundle }> {
  const { organizationId, provider, graph8DealId } = args;
  const bundle = await provider.getDealBundle(graph8DealId);
  const g8Deal = bundle.deal;

  let deal = await prisma.deal.findFirst({ where: { organizationId, graph8DealId } });

  const data = {
    name: g8Deal.name,
    companyName: g8Deal.companyName,
    industry: g8Deal.industry,
    segment: (SEGMENTS.includes(g8Deal.segment) ? g8Deal.segment : "mid_market") as DealSegment,
    amount: g8Deal.amount,
    currency: g8Deal.currency,
    pipelineId: g8Deal.pipelineId,
    stageId: g8Deal.stageId,
    stageName: g8Deal.stageName,
    ownerName: g8Deal.ownerName,
    outcome: g8Deal.outcome as DealOutcome,
    closeReasonRaw: g8Deal.closeReasonRaw,
    openedAt: g8Deal.openedAt,
    closedAt: g8Deal.closedAt,
    syncedAt: new Date(),
  };

  if (!deal) {
    deal = await prisma.deal.create({ data: { organizationId, graph8DealId, ...data } });
  } else {
    deal = await prisma.deal.update({ where: { id: deal.id }, data });
  }

  await prisma.dealSnapshot.deleteMany({ where: { dealId: deal.id } });
  await prisma.dealContact.deleteMany({ where: { dealId: deal.id } });

  if (bundle.stageHistory.length > 0) {
    await prisma.dealSnapshot.createMany({
      data: bundle.stageHistory.map((stage) => ({
        dealId: deal!.id,
        stageId: stage.stageId,
        stageName: stage.stageName,
        enteredAt: stage.enteredAt,
        exitedAt: stage.exitedAt,
      })),
    });
  }
  if (bundle.contacts.length > 0) {
    await prisma.dealContact.createMany({
      data: bundle.contacts.map((contact) => ({
        dealId: deal!.id,
        name: contact.name,
        title: contact.title,
        role: (CONTACT_ROLES.includes(contact.role) ? contact.role : "unknown") as any,
        engagedAt: contact.engagedAt,
      })),
    });
  }

  return { deal, bundle };
}
