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

export async function getCurrentUser(request: NextRequest): Promise<User> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Not authenticated");
  }
  const token = authHeader.slice("Bearer ".length);

  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    userId = payload.sub;
  } catch {
    throw new UnauthorizedError("Invalid token");
  }
  if (!userId) throw new UnauthorizedError("Invalid token");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError("User not found");
  return user;
}
