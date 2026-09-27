import { PrismaClient } from "@prisma/client";

// Vercel's native Neon integration sets DATABASE_URL / DATABASE_URL_UNPOOLED.
// The older "Vercel Postgres" template integration instead sets
// POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING. Normalize whichever is
// present into the names prisma/schema.prisma reads, so either works.
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DATABASE_URL_UNPOOLED && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DATABASE_URL_UNPOOLED = process.env.POSTGRES_URL_NON_POOLING;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
