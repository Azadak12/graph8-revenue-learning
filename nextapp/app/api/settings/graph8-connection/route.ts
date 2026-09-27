import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { withErrorHandling } from "../../../../lib/apiHelpers";
import { encryptSecret } from "../../../../lib/secrets";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const connection = await prisma.graph8Connection.findUnique({
      where: { organizationId: user.organizationId },
    });
    if (!connection) {
      return NextResponse.json({ mode: "demo", status: "not_configured", graph8_org_id: null, last_sync_at: null });
    }
    return NextResponse.json({
      mode: connection.mode,
      status: connection.status,
      graph8_org_id: connection.graph8OrgId,
      last_sync_at: connection.lastSyncAt,
    });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const payload = await request.json();

    let connection = await prisma.graph8Connection.findUnique({
      where: { organizationId: user.organizationId },
    });
    const encryptedApiKeyRef = encryptSecret(payload.api_key);

    if (!connection) {
      connection = await prisma.graph8Connection.create({
        data: {
          organizationId: user.organizationId,
          encryptedApiKeyRef,
          mode: "live",
          status: "connected",
        },
      });
    } else {
      connection = await prisma.graph8Connection.update({
        where: { id: connection.id },
        data: { encryptedApiKeyRef, mode: "live", status: "connected" },
      });
    }

    return NextResponse.json({
      mode: connection.mode,
      status: connection.status,
      graph8_org_id: connection.graph8OrgId,
      last_sync_at: connection.lastSyncAt,
    });
  });
}
