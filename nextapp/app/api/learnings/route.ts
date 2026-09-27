import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { withErrorHandling } from "../../../lib/apiHelpers";
import { serializePattern } from "../../../lib/services/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const patterns = await prisma.pattern.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ patternStrength: "desc" }, { lostCount: "desc" }],
    });
    return NextResponse.json(patterns.map(serializePattern));
  });
}
