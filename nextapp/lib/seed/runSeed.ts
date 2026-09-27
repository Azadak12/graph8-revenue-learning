/** Seeds one demo organization, one demo user, a demo Graph8Connection, and
 * runs the full investigation pipeline over all seeded closed deals. Ported
 * from backend/app/seed/run_seed.py.
 *
 * Run with: npm run seed  (reads DATABASE_URL from the environment/.env)
 * Idempotent: safe to re-run; it reuses the existing demo org/user if present.
 */
import { prisma } from "../db";
import { hashPassword } from "../auth";
import { DemoGraph8Provider } from "../services/graph8/demoProvider";
import { syncDeal } from "../services/graph8/sync";
import { runInvestigation } from "../services/investigations/orchestrator";
import { refreshPatternsForSegment } from "../services/patterns/engine";
import { refreshRecommendations } from "../services/recommendations/engine";
import { refreshFutureWarnings } from "../services/warnings/engine";
import { ACTIVE_DEALS, CLOSED_DEALS } from "./demoDeals";

const DEMO_ORG_NAME = "Acme Revenue Team (Demo)";
const DEMO_USER_EMAIL = "demo@graph8.com";
const DEMO_USER_PASSWORD = "demo1234";

const provider = new DemoGraph8Provider();

async function ensureOrgAndUser(): Promise<string> {
  let org = await prisma.organization.findFirst({ where: { name: DEMO_ORG_NAME } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: DEMO_ORG_NAME } });
  }

  const connection = await prisma.graph8Connection.findUnique({ where: { organizationId: org.id } });
  if (!connection) {
    await prisma.graph8Connection.create({
      data: { organizationId: org.id, mode: "demo", status: "connected" },
    });
  }

  const user = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
  if (!user) {
    await prisma.user.create({
      data: {
        organizationId: org.id,
        email: DEMO_USER_EMAIL,
        name: "Demo Admin",
        role: "admin",
        hashedPassword: await hashPassword(DEMO_USER_PASSWORD),
      },
    });
  }

  return org.id;
}

async function run() {
  const orgId = await ensureOrgAndUser();
  console.log(`Seed org ready: ${orgId}`);

  for (const dealRaw of CLOSED_DEALS) {
    console.log(`Analyzing deal: ${dealRaw.company_name}`);
    await runInvestigation({ organizationId: orgId, provider, graph8DealId: dealRaw.external_id });
  }

  const distinctSegments = await prisma.deal.findMany({
    where: { organizationId: orgId },
    select: { industry: true, segment: true },
    distinct: ["industry", "segment"],
  });

  for (const { industry, segment } of distinctSegments) {
    await refreshPatternsForSegment({ organizationId: orgId, industry, segment });
  }

  await refreshRecommendations({ organizationId: orgId });

  for (const dealRaw of ACTIVE_DEALS) {
    await syncDeal({ organizationId: orgId, provider, graph8DealId: dealRaw.external_id });
  }

  await refreshFutureWarnings({ organizationId: orgId, provider });

  console.log(`\nDemo org ready. Log in with:\n  email:    ${DEMO_USER_EMAIL}\n  password: ${DEMO_USER_PASSWORD}\n`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
