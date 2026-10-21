import type { FastifyInstance } from "fastify";
import { isValidTimeZone, localDateKey, type DateKey } from "@kinextion/shared";

declare module "fastify" {
  interface FastifyRequest {
    /** The caller's IANA time zone from `X-Time-Zone`, else "UTC". Every
     *  "today" on this API is the user's today, not the server's. */
    timeZone: string;
    /** Today's date for the caller, in their zone. */
    localToday: () => DateKey;
  }
}

/**
 * Reads the client's time zone once per request.
 *
 * A header rather than a stored profile field so it follows the user when
 * they travel, and so older app builds that don't send it fall back to UTC —
 * exactly the behaviour they had before — instead of failing.
 */
export function registerTimeZone(app: FastifyInstance) {
  app.decorateRequest("timeZone", "UTC");
  app.decorateRequest("localToday", function (this: { timeZone: string }) {
    return localDateKey(new Date(), this.timeZone);
  });

  app.addHook("onRequest", async (request) => {
    const header = request.headers["x-time-zone"];
    const tz = Array.isArray(header) ? header[0] : header;
    request.timeZone = isValidTimeZone(tz) ? tz : "UTC";
  });
}
