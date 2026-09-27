import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../lib/apiHelpers";
import { serializePatternDetail } from "../../../../lib/services/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { patternId: string } }) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const pattern = await prisma.pattern.findUnique({ where: { id: params.patternId } });
    if (!pattern || pattern.organizationId !== user.organizationId) {
      return jsonError(404, "Pattern not found");
    }
    const occurrences = await prisma.patternOccurrence.findMany({ where: { patternId: pattern.id } });
    return NextResponse.json(serializePatternDetail(pattern, occurrences));
  });
}
