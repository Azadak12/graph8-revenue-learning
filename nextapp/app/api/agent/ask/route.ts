import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { withErrorHandling } from "../../../../lib/apiHelpers";
import { ask } from "../../../../lib/services/agents/revenueLearningAgent";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const payload = await request.json();
    const [answer, sources, suggestedActions] = await ask({
      organizationId: user.organizationId,
      question: payload.question,
    });

    await prisma.agentRun.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        question: payload.question,
        answer,
        toolsUsed: { sources },
      },
    });

    return NextResponse.json({ answer, sources, suggested_actions: suggestedActions });
  });
}
