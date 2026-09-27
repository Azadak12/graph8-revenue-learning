import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../lib/apiHelpers";
import { getProviderForOrg } from "../../../../lib/services/graph8/factory";
import { analyzeLiveDeals, finishLiveSync, startLiveSync } from "../../../../lib/services/graph8/liveSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const connection = await prisma.graph8Connection.findUnique({ where: { organizationId: user.organizationId } });
    if (connection?.mode !== "live" || !connection.encryptedApiKeyRef) {
      return jsonError(400, "Add a Graph8 API key before syncing.");
    }
    const provider = await getProviderForOrg(user.organizationId);
    const body = await request.json().catch(() => ({}));
    const step = body?.step;
    if (!["start", "analyze", "finish"].includes(step)) {
      // An out-of-date page calling without a step would clear the data and stop.
      return jsonError(409, "This page is out of date. Press Cmd + Shift + R (Ctrl + Shift + R on Windows) and click Sync again.");
    }
    let result;
    try {
      if (step === "analyze") {
        const deals = Array.isArray(body.deals) ? body.deals.slice(0, 10) : [];
        result = await analyzeLiveDeals(user.organizationId, provider, deals);
      } else if (step === "finish") {
        result = await finishLiveSync(user.organizationId, provider);
      } else {
        result = await startLiveSync(user.organizationId, provider);
      }
    } catch (err) {
      return jsonError(502, `Could not read deals from Graph8: ${err instanceof Error ? err.message : String(err)}`);
    }
    return NextResponse.json(result);
  });
}
