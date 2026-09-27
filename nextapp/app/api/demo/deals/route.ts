import { NextResponse } from "next/server";
import { withErrorHandling } from "../../../../lib/apiHelpers";
import { ACTIVE_DEALS, CLOSED_DEALS } from "../../../../lib/seed/demoDeals";

export const dynamic = "force-dynamic";

export async function GET() {
  return withErrorHandling(async () => {
    return NextResponse.json({
      data_source: "demo",
      closed: CLOSED_DEALS.map((d) => ({
        external_id: d.external_id,
        company_name: d.company_name,
        outcome: d.outcome,
      })),
      active: ACTIVE_DEALS.map((d) => ({ external_id: d.external_id, company_name: d.company_name })),
    });
  });
}
