/** Shared by app/api/webhooks/graph8/route.ts and the demo simulate-close
 * route — extracted so route.ts files only export HTTP method handlers, as
 * Next.js requires. See webhooks/graph8/route.ts for the queue-vs-inline
 * tradeoff notes. */
import { prisma } from "../../db";
import { getLogger } from "../../logging";
import { getProviderForOrg } from "../graph8/factory";
import { runInvestigation } from "../investigations/orchestrator";

const logger = getLogger("webhooks");

export async function processWebhookEventInline(webhookEventId: string): Promise<void> {
  const event = await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
  if (!event) {
    logger.error("webhook_event_not_found", { webhookEventId });
    return;
  }

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { processingStatus: "processing", attempts: { increment: 1 } },
  });

  try {
    const provider = await getProviderForOrg(event.organizationId);
    await runInvestigation({
      organizationId: event.organizationId,
      provider,
      graph8DealId: event.graph8DealId,
    });
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processingStatus: "completed" } });
  } catch (err) {
    logger.exception("webhook_event_processing_failed", err, { webhookEventId });
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processingStatus: "failed", error: (err instanceof Error ? err.message : String(err)).slice(0, 2000) },
    });
  }
}
