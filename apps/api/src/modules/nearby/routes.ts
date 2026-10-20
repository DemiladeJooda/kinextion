import type { FastifyInstance } from "fastify";
import { prisma } from "@kinextion/database";

/** Great-circle distance in km — plenty accurate at city scale. */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Real-world fitness groups near the user — run clubs, studios, classes.
 *
 * Deliberately separate from /api/community: that's Kinextion's own weekly
 * rooms. This is a directory of external organisations, hand-verified rather
 * than generated — see jobs/seed-nearby-groups.ts for sourcing. Only Dallas is
 * seeded today; `city` exists so a second city is a seed addition, not a
 * schema change.
 */
export async function nearbyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  app.get<{
    Querystring: { city?: string; category?: string; lat?: string; lng?: string };
  }>("/groups", async (request) => {
    const city = request.query.city?.trim() || "Dallas";
    const category = request.query.category?.trim();
    const userLat = request.query.lat ? parseFloat(request.query.lat) : null;
    const userLng = request.query.lng ? parseFloat(request.query.lng) : null;

    const groups = await prisma.nearbyGroup.findMany({
      where: { city, ...(category ? { category } : {}) },
      orderBy: { name: "asc" },
    });

    const withDistance = groups.map((g) => ({
      ...g,
      distanceKm:
        userLat !== null && userLng !== null && Number.isFinite(userLat) && Number.isFinite(userLng)
          ? Math.round(distanceKm(userLat, userLng, g.lat, g.lng) * 10) / 10
          : null,
    }));

    withDistance.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    return { success: true, data: withDistance };
  });
}
