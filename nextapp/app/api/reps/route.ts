import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { withErrorHandling } from "../../../lib/apiHelpers";
import { buildRepPerformance } from "../../../lib/services/reps/engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const reps = await buildRepPerformance({ organizationId: user.organizationId });
    return NextResponse.json(reps);
  });
}
