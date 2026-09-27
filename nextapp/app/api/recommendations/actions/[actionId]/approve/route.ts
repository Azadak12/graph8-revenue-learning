import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../../../lib/apiHelpers";
import { getProviderForOrg } from "../../../../../../lib/services/graph8/factory";
import { approveAndExecuteAction } from "../../../../../../lib/services/recommendations/actions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { actionId: string } }) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const action = await prisma.recommendationAction.findUnique({ where: { id: params.actionId } });
    if (!action) return jsonError(404, "Action not found");
    const recommendation = await prisma.recommendation.findUnique({ where: { id: action.recommendationId } });
    if (!recommendation || recommendation.organizationId !== user.organizationId) {
      return jsonError(404, "Action not found");
    }

    const provider = await getProviderForOrg(user.organizationId);
    const updated = await approveAndExecuteAction({
      organizationId: user.organizationId,
      action,
      approvedByUserId: user.id,
      provider,
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      graph8_object_type: updated.graph8ObjectType,
      graph8_object_id: updated.graph8ObjectId,
    });
  });
}
