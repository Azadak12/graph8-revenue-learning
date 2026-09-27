import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { withErrorHandling } from "../../../lib/apiHelpers";
import { buildOverview } from "../../../lib/services/overview";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const overview = await buildOverview({ organizationId: user.organizationId });
    return NextResponse.json(overview);
  });
}
