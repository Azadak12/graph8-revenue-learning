import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { withErrorHandling } from "../../../../lib/apiHelpers";
import { clearOrgDealData } from "../../../../lib/services/graph8/liveSync";
import { seedDemoData } from "../../../../lib/seed/seedDemoData";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Switches the organization back to Demo Mode and reloads the sample deals. */
export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    await prisma.graph8Connection.upsert({
      where: { organizationId: user.organizationId },
      create: { organizationId: user.organizationId, mode: "demo", status: "connected" },
      update: { mode: "demo", status: "connected", encryptedApiKeyRef: null, lastSyncAt: null },
    });
    await clearOrgDealData(user.organizationId);
    await seedDemoData(user.organizationId);
    const deals = await prisma.deal.count({ where: { organizationId: user.organizationId } });
    return NextResponse.json({ deals });
  });
}
