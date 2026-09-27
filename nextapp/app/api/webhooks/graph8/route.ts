/** Real, signature-verified Graph8 webhook ingestion. Ported from
 * backend/app/api/routers/webhooks.py.
 *
 * DEPARTURE FROM THE ORIGINAL: the Python version's fast-ack pattern enqueues
 * the actual investigation onto an RQ/Redis queue and returns 202 immediately.
 * There is no persistent queue worker on Vercel serverless, so this processes
 * the investigation inline before responding. For the demo/deterministic
 * extractor this is fast; with a real ANTHROPIC_API_KEY configured, watch
 * Vercel's function timeout (10s Hobby / 60s+ Pro) — a slow LLM call can hit
 * it. Move this back onto a real queue (e.g. Upstash + QStash) before
 * depending on this for high-volume production traffic. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { settings } from "../../../../lib/config";
import { getLogger } from "../../../../lib/logging";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  WebhookVerificationError,
  verifySignature,
} from "../../../../lib/services/graph8/webhookSecurity";
import { processWebhookEventInline } from "../../../../lib/services/webhooks/processEvent";
import { jsonError, withErrorHandling } from "../../../../lib/apiHelpers";

export const dynamic = "force-dynamic";

const logger = getLogger("webhooks");

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get(SIGNATURE_HEADER);
    const timestamp = request.headers.get(TIMESTAMP_HEADER);

    if (settings.graph8WebhookSecret) {
      if (!signature || !timestamp) return jsonError(401, "Missing signature headers");
      try {
        verifySignature({ rawBody, timestamp, signature, secret: settings.graph8WebhookSecret });
      } catch (err) {
        if (err instanceof WebhookVerificationError) return jsonError(401, err.message);
        throw err;
      }
    } else {
      logger.warning("webhook_signature_check_skipped_no_secret_configured");
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonError(400, "Invalid JSON");
    }

    const externalEventId = payload.event_id || payload.id;
    const eventType = payload.event_type || payload.type;
    const graph8DealId = payload.deal_id || payload.data?.deal_id;
    const organizationHint = payload.organization_id || payload.account_id;

    if (!externalEventId || !eventType || !graph8DealId) {
      return jsonError(400, "Missing required webhook fields");
    }

    let connection = null;
    if (organizationHint) {
      connection = await prisma.graph8Connection.findFirst({
        where: { graph8OrgId: String(organizationHint) },
      });
    }
    if (!connection) return jsonError(404, "No organization mapped to this Graph8 account");

    let event;
    try {
      event = await prisma.webhookEvent.create({
        data: {
          organizationId: connection.organizationId,
          externalEventId: String(externalEventId),
          eventType,
          graph8DealId: String(graph8DealId),
          payload,
          receivedAt: new Date(),
          processingStatus: "pending",
        },
      });
    } catch {
      return NextResponse.json({ status: "duplicate_ignored" });
    }

    if (["deal.won", "deal.updated", "deal.stage_changed"].includes(eventType)) {
      await processWebhookEventInline(event.id);
    }

    return NextResponse.json({ status: "accepted", event_id: event.id }, { status: 202 });
  });
}
