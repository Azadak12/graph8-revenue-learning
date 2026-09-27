import { NextResponse } from "next/server";
import { settings } from "../../../lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", app: settings.appName });
}
