/**
 * Retention job entrypoint.
 *
 *   pnpm --filter @kinextion/api retention --dry-run
 *   pnpm --filter @kinextion/api retention
 *
 * Intended to run nightly. Exits non-zero if any step reported an error, so a
 * scheduler notices a failing pass rather than silently skipping cleanup.
 */

import { runRetention } from "../lib/memory/retention.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const started = Date.now();
  const report = await runRetention({ dryRun });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    JSON.stringify({ ...report, durationSeconds: Number(seconds) }, null, 2)
  );

  if (report.errors.length > 0) {
    console.error(`Retention finished with ${report.errors.length} error(s).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Retention job failed:", err);
  process.exit(1);
});
