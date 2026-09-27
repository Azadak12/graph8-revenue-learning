import { PrismaClient } from "@prisma/client";

// Vercel storage integrations name the connection vars differently depending
// on the integration flavor and any custom prefix chosen at connect time
// (e.g. DATABASE_URL, POSTGRES_PRISMA_URL, ak_DATABASE_URL). A stale empty
// DATABASE_URL can also shadow the real one. Pick the first non-empty match.
function findEnv(patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    for (const [key, value] of Object.entries(process.env)) {
      if (value && pattern.test(key)) return value;
    }
  }
  return undefined;
}

const pooledUrl = findEnv([
  /^DATABASE_URL$/,
  /_DATABASE_URL$/,
  /^POSTGRES_PRISMA_URL$/,
  /_POSTGRES_PRISMA_URL$/,
  /^POSTGRES_URL$/,
  /_POSTGRES_URL$/,
]);
const directUrl = findEnv([
  /^DATABASE_URL_UNPOOLED$/,
  /_DATABASE_URL_UNPOOLED$/,
  /^POSTGRES_URL_NON_POOLING$/,
  /_POSTGRES_URL_NON_POOLING$/,
]);

if (pooledUrl) process.env.DATABASE_URL = pooledUrl;
if (directUrl) process.env.DATABASE_URL_UNPOOLED = directUrl;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(pooledUrl ? { datasourceUrl: pooledUrl } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
