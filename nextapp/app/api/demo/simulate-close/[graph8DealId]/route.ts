/** Demo-only: drives the hackathon demo flow by simulating a Graph8
 * deal.won/deal.lost webhook delivery through the same pipeline a real
 * webhook would use. Ported from backend/app/api/routers/demo.py. */
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../../lib/apiHelpers";
import { CLOSED_DEALS } from "../../../../../lib/seed/demoDeals";
import { processWebhookEventInline } from "../../../../../lib/services/webhooks/processEvent";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { graph8DealId: string } }) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const source = CLOSED_DEALS.find((d) => d.external_id === params.graph8DealId);
    if (!source) return jsonError(404, "Unknown demo deal id");

    const eventType = source.outcome === "won" ? "deal.won" : "deal.lost";
    const event = await prisma.webhookEvent.create({
      data: {
        organizationId: user.organizationId,
        externalEventId: `demo-sim-${randomUUID()}`,
        eventType,
        graph8DealId: params.graph8DealId,
        payload: { event_type: eventType, deal_id: params.graph8DealId, simulated: true },
        receivedAt: new Date(),
        processingStatus: "pending",
      },
    });

    await processWebhookEventInline(event.id);

    return NextResponse.json({ event_id: event.id, event_type: eventType, company_name: source.company_name });
  });
}
