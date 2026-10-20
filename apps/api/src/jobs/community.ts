/**
 * Community maintenance entrypoint.
 *
 *   pnpm --filter @kinextion/api community --dry-run
 *   pnpm --filter @kinextion/api community
 *
 * Intended to run hourly. Handles everything that happens because time
 * passed rather than because someone acted — admission panels that went
 * quiet, forming communities that never formed — and, as later phases land,
 * the weekly cycle. Idempotent, so an overlapping run is harmless. Exits
 * non-zero on failure so a scheduler notices.
 */

import { prisma } from "@kinextion/database";
import { createCommunityDeps } from "../modules/community/deps.js";
import { runMaintenance } from "../modules/community/maintenance.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const started = Date.now();
  // The real wiring: Claude for topic synthesis, R2 for purging media.
  const report = await runMaintenance(createCommunityDeps(), { dryRun });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(JSON.stringify({ ...report, durationSeconds: Number(seconds) }, null, 2));

  if (report.errors.length > 0) {
    console.error(`Community maintenance finished with ${report.errors.length} error(s).`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Community maintenance failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
