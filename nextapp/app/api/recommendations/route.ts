import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { withErrorHandling } from "../../../lib/apiHelpers";
import { serializeRecommendation } from "../../../lib/services/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const status = searchParams.get("status");

    const recommendations = await prisma.recommendation.findMany({
      where: {
        organizationId: user.organizationId,
        ...(department ? { department: department as any } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { priority: "asc" },
    });

    const out = await Promise.all(
      recommendations.map(async (r) => {
        const actions = await prisma.recommendationAction.findMany({ where: { recommendationId: r.id } });
        return serializeRecommendation(r, actions);
      })
    );
    return NextResponse.json(out);
  });
}
