/** Ported from backend/app/services/graph8/webhook_security.py */
import crypto from "crypto";

export const SIGNATURE_HEADER = "x-graph8-signature";
export const TIMESTAMP_HEADER = "x-graph8-timestamp";
const MAX_AGE_SECONDS = 5 * 60;

export class WebhookVerificationError extends Error {}

export function verifySignature(args: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret: string;
}): void {
  const { rawBody, timestamp, signature, secret } = args;
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) throw new WebhookVerificationError("Invalid timestamp header");

  if (Math.abs(Date.now() / 1000 - ts) > MAX_AGE_SECONDS) {
    throw new WebhookVerificationError("Webhook timestamp too old");
  }

  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`), Buffer.from(rawBody)]);
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (
    expectedBuf.length !== signatureBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, signatureBuf)
  ) {
    throw new WebhookVerificationError("Signature mismatch");
  }
}
