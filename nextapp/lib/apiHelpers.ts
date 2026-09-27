import { NextResponse } from "next/server";
import { UnauthorizedError } from "./auth";

export function jsonError(status: number, detail: string) {
  return NextResponse.json({ detail }, { status });
}

export async function withErrorHandling(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError(401, err.message);
    }
    console.error(err);
    return jsonError(500, err instanceof Error ? err.message : "Internal server error");
  }
}
