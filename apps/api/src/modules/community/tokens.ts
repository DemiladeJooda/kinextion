import { createHash, randomBytes } from "node:crypto";

/**
 * Founding invite tokens.
 *
 * The token is shown to the founder once and only its hash is stored, the way
 * a password-reset token would be: a database read can't be turned into a
 * working invite to someone else's community.
 */
export function newInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
