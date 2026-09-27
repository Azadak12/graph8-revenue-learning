"""Graph8 webhook signature verification.

CONFIRMED: Graph8 signs webhooks with HMAC-SHA256 over a timestamp + raw body, and
rejects deliveries more than 5 minutes old (graph8.com/roles/developers). Also confirmed
against a live account's OpenAPI spec (2026-09-27): webhook secrets are per-webhook-
subscription, not one global secret -- `POST /webhooks` returns a `secret` field "only
returned on create and rotate-secret", and `POST /webhooks/{id}/rotate-secret` exists.
Graph8Connection.encrypted_api_key_ref stores the org's Graph8 API key; the webhook secret
for the one webhook this app registers per org should be stored alongside it the same way
once webhook registration is implemented (not yet built -- there's no live tenant with
webhook delivery access in this environment to register and test against).

UNCONFIRMED: the exact header names and the precise string that gets signed
(e.g. `f"{timestamp}.{body}"` vs `f"{timestamp}{body}"`). These aren't modeled in the
OpenAPI spec at all (it documents request/response schemas, not delivery headers), so
they couldn't be pulled the way the webhook event catalog and REST schemas were. The
constants below remain placeholders — confirm them from Graph8 support or a real captured
delivery before processing a real signed payload, and add a contract test pinning the real
header names once known.
"""

from __future__ import annotations

import hashlib
import hmac
import time

SIGNATURE_HEADER = "X-Graph8-Signature"  # UNCONFIRMED header name
TIMESTAMP_HEADER = "X-Graph8-Timestamp"  # UNCONFIRMED header name
MAX_AGE_SECONDS = 5 * 60


class WebhookVerificationError(Exception):
    pass


def verify_signature(*, raw_body: bytes, timestamp: str, signature: str, secret: str) -> None:
    try:
        ts = int(timestamp)
    except ValueError as exc:
        raise WebhookVerificationError("Invalid timestamp header") from exc

    if abs(time.time() - ts) > MAX_AGE_SECONDS:
        raise WebhookVerificationError("Webhook timestamp too old")

    signed_payload = f"{timestamp}.".encode() + raw_body
    expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise WebhookVerificationError("Signature mismatch")
