/**
 * Encrypts secrets (Graph8 API keys) before they touch the database.
 * AES-256-GCM keyed off a SHA-256 digest of SECRET_ENCRYPTION_KEY, mirroring
 * the intent of the original Fernet-based implementation (symmetric,
 * server-only key never exposed to the frontend).
 */
import crypto from "crypto";
import { settings } from "./config";

function key(): Buffer {
  return crypto.createHash("sha256").update(settings.secretEncryptionKey).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
