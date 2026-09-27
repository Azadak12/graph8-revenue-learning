import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "./db";
import { settings } from "./config";
import type { User } from "@prisma/client";

function secretKey() {
  return new TextEncoder().encode(settings.jwtSecret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

export async function createAccessToken(userId: string, organizationId: string): Promise<string> {
  return new SignJWT({ sub: userId, org: organizationId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${settings.accessTokenExpireMinutes}m`)
    .sign(secretKey());
}

export class UnauthorizedError extends Error {}

const DEFAULT_ORG_NAME = "Acme Revenue Team (Demo)";
const DEFAULT_USER_EMAIL = "demo@graph8.com";

/** Login has been removed for this deployment: every request is treated as
 * the single default demo user, auto-provisioned on first use. If a valid
 * Bearer token is still presented (e.g. from an older client), it's honored;
 * otherwise this falls back to the default user rather than rejecting the
 * request. */
async function getOrCreateDefaultUser(): Promise<User> {
  let user = await prisma.user.findUnique({ where: { email: DEFAULT_USER_EMAIL } });
  if (user) return user;

  let org = await prisma.organization.findFirst({ where: { name: DEFAULT_ORG_NAME } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: DEFAULT_ORG_NAME } });
  }
  const connection = await prisma.graph8Connection.findUnique({ where: { organizationId: org.id } });
  if (!connection) {
    await prisma.graph8Connection.create({
      data: { organizationId: org.id, mode: "demo", status: "connected" },
    });
  }

  user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: DEFAULT_USER_EMAIL,
      name: "Demo Admin",
      role: "admin",
      hashedPassword: await hashPassword("demo1234"),
    },
  });
  return user;
}

export async function getCurrentUser(request: NextRequest): Promise<User> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    try {
      const { payload } = await jwtVerify(token, secretKey());
      if (payload.sub) {
        const user = await prisma.user.findUnique({ where: { id: payload.sub } });
        if (user) return user;
      }
    } catch {
      // fall through to the default demo user
    }
  }
  return getOrCreateDefaultUser();
}
