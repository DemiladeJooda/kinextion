/**
 * At-rest encryption for integration OAuth tokens. Access/refresh tokens are
 * bearer credentials for a user's Strava/Whoop/Oura account — storing them
 * in plaintext would turn a database leak into an account-takeover chain for
 * every connected third-party service.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not set — required to store integration tokens.");
  }
  return scryptSync(secret, "kinextion-integrations", 32);
}

/** Format: base64(iv):base64(authTag):base64(ciphertext). */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptToken(stored: string): string {
  const parts = stored.split(":");
  // Check the segment count, not truthiness — an empty plaintext encrypts to
  // an empty ciphertext segment, which is well-formed rather than malformed.
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted token");
  }
  const [ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64) {
    throw new Error("Malformed encrypted token");
  }
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
