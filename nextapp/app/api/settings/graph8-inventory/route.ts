import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../lib/apiHelpers";
import { settings } from "../../../../lib/config";
import { decryptSecret } from "../../../../lib/secrets";
import { cleanApiKey } from "../../../../lib/services/graph8/liveProvider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Record types worth checking for revenue history, matched against Graph8's API list.
const INTERESTING = /(deals|opportunities|meetings|calls|recordings|transcripts|conversations|activities|contacts|companies|accounts|lists|notes|tasks|emails|sequences|campaigns|signals)$/i;

/** Read-only inventory of what the saved Graph8 key can see: for each list
 * endpoint, whether it answers and how many records it reports. GET only. */
export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const connection = await prisma.graph8Connection.findUnique({ where: { organizationId: user.organizationId } });
    if (!connection?.encryptedApiKeyRef) return jsonError(400, "Save a Graph8 API key in Settings first.");
    const key = cleanApiKey(decryptSecret(connection.encryptedApiKeyRef));
    const base = settings.graph8BaseUrl;

    const get = async (path: string) => {
      try {
        const res = await fetch(base + path, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
        const body = await res.json().catch(() => null);
        return { status: res.status, body };
      } catch (err) {
        return { status: 0, body: String(err) };
      }
    };

    const spec = await get("/openapi.json");
    const paths: string[] = spec.body?.paths
      ? Object.entries(spec.body.paths as Record<string, any>)
          .filter(([p, ops]) => ops?.get && !p.includes("{") && INTERESTING.test(p))
          .map(([p]) => p.replace(/^\/api\/v1/, ""))
      : ["/deals", "/companies", "/contacts", "/notes", "/tasks"];

    const results = await Promise.all(
      paths.slice(0, 60).map(async (p) => {
        const r = await get(`${p}?limit=1`);
        const b = r.body;
        const data = b?.data;
        const total =
          b?.pagination?.total ?? b?.total ?? b?.count ?? data?.total ??
          (Array.isArray(data) ? (data.length ? `${data.length}+` : 0) : Array.isArray(b) ? (b.length ? `${b.length}+` : 0) : null);
        return [p, r.status === 200 ? total ?? "answers (no count)" : `status ${r.status}`] as const;
      })
    );

    const withData = Object.fromEntries(results.filter(([, v]) => v !== 0 && v !== "0" && !String(v).startsWith("status")));
    const empty = results.filter(([, v]) => v === 0 || v === "0").map(([p]) => p);
    const unavailable = results.filter(([, v]) => String(v).startsWith("status")).length;

    return NextResponse.json({
      note: "Counts include the 22 sample deals, their companies, contacts and notes added by the seed script.",
      checked: results.length,
      has_records: withData,
      empty,
      not_available_to_this_key: unavailable,
    });
  });
}
