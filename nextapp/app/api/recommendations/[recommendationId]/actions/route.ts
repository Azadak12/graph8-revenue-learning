import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../../lib/apiHelpers";
import { proposeAction } from "../../../../../lib/services/recommendations/actions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { recommendationId: string } }) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const recommendation = await prisma.recommendation.findUnique({ where: { id: params.recommendationId } });
    if (!recommendation || recommendation.organizationId !== user.organizationId) {
      return jsonError(404, "Recommendation not found");
    }
    const payload = await request.json();
    const action = await proposeAction({ recommendationId: params.recommendationId, actionType: payload.action_type });
    return NextResponse.json({ id: action.id, status: action.status });
  });
}
