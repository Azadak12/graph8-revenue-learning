import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { jsonError, withErrorHandling } from "../../../../../lib/apiHelpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { eventId: string } }) {
  return withErrorHandling(async () => {
    const event = await prisma.webhookEvent.findUnique({ where: { id: params.eventId } });
    if (!event) return jsonError(404, "Event not found");
    return NextResponse.json({
      id: event.id,
      event_type: event.eventType,
      graph8_deal_id: event.graph8DealId,
      processing_status: event.processingStatus,
      error: event.error,
    });
  });
}
