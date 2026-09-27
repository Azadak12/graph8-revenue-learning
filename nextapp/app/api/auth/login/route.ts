import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { createAccessToken, verifyPassword } from "../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../lib/apiHelpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const payload = await request.json();
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user || !(await verifyPassword(payload.password, user.hashedPassword))) {
      return jsonError(401, "Invalid credentials");
    }
    const token = await createAccessToken(user.id, user.organizationId);
    return NextResponse.json({
      access_token: token,
      user_id: user.id,
      organization_id: user.organizationId,
      name: user.name,
      role: user.role,
    });
  });
}
