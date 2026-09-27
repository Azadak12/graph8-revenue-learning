import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../../../../lib/apiHelpers";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { dealId: string; warningId: string } }
) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const warning = await prisma.futureDealWarning.findUnique({ where: { id: params.warningId } });
    if (!warning || warning.organizationId !== user.organizationId || warning.dealId !== params.dealId) {
      return jsonError(404, "Warning not found");
    }
    const payload = await request.json();
    const newStatus = payload.status;
    if (!["acknowledged", "dismissed", "task_created"].includes(newStatus)) {
      return jsonError(400, "Invalid status");
    }
    const updated = await prisma.futureDealWarning.update({
      where: { id: warning.id },
      data: { status: newStatus },
    });
    return NextResponse.json({ id: updated.id, status: updated.status });
  });
}
