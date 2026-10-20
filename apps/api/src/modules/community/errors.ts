/**
 * A refusal the caller can act on.
 *
 * Carries `statusCode` so the server's error handler passes the message
 * through (it only hides 5xx). `code` is a stable machine-readable reason —
 * the mobile app branches on "UNLOCK_REQUIRED" or "ALREADY_MEMBER", never on
 * the English message, which is free to change.
 */
export class CommunityError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "CommunityError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Deliberately the same for "doesn't exist" and "exists but isn't yours to
 * see". A 403 would confirm that a forming community or a join request id is
 * real, which is exactly what visibility rules exist to hide.
 */
export const notFound = (what: string) => new CommunityError(404, "NOT_FOUND", `${what} not found`);
