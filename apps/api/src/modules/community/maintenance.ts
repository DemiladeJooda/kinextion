/**
 * Everything in the community layer that happens because time passed rather
 * than because someone acted.
 *
 * Run hourly by jobs/community.ts, and on demand by the dev clock route. Each
 * step is idempotent and ordered so a later step can rely on an earlier one.
 * Running it twice at the same instant does nothing the second time. A dry run
 * reports what's due and writes nothing.
 *
 * One community's failure never stops another's week: each step catches per
 * step, records what went wrong, and carries on. The job exits non-zero when
 * anything failed, so a scheduler notices, and the next pass retries — every
 * step is safe to repeat.
 */

import { ensureCycles } from "./cycles.js";
import { purgeDueMedia } from "./media.js";
import { runAdmissionMaintenance, type AdmissionMaintenanceReport, type CommunityDeps } from "./service.js";
import { expirePublicResponses, settleDueCycles } from "./settle.js";
import { decideDueBallots, synthesizeDueCycles } from "./topics.js";

export interface MaintenanceReport extends AdmissionMaintenanceReport {
  dryRun: boolean;
  cycles: { created: number };
  topics: { ballotsCreated: number; ballotsDecided: number };
  settlement: { cyclesSettled: number; publicExpired: number };
  media: { purged: number; failed: number };
  /** "step: message" for every failure. Empty on a clean pass. */
  errors: string[];
}

export async function runMaintenance(
  deps: CommunityDeps,
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<MaintenanceReport> {
  const report: MaintenanceReport = {
    dryRun,
    admissions: { checked: 0, admitted: 0, denied: 0, redrawn: 0 },
    forming: { checked: 0, activated: 0, archived: 0 },
    cycles: { created: 0 },
    topics: { ballotsCreated: 0, ballotsDecided: 0 },
    settlement: { cyclesSettled: 0, publicExpired: 0 },
    media: { purged: 0, failed: 0 },
    errors: [],
  };

  async function step<T>(name: string, run: () => Promise<T>, apply: (value: T) => void) {
    try {
      apply(await run());
    } catch (err) {
      report.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await step("admissions", () => runAdmissionMaintenance(deps, { dryRun }), (r) => {
    report.admissions = r.admissions;
    report.forming = r.forming;
  });
  if (dryRun) return report;

  const errorsFrom = (name: string) => (message: string) => report.errors.push(`${name}: ${message}`);

  // Closures first: a community that has voted to close shouldn't get another week's ballot.
  await step("closures", () => decideDueBallots(deps, ["closure"], errorsFrom("closures")), (n) => {
    report.topics.ballotsDecided += n;
  });
  // After admission and closures, so cycles go only to communities still active.
  await step("cycles", () => ensureCycles(deps), (n) => (report.cycles.created = n));
  // Synthesis before topic decisions: if the job was down through a whole
  // voting window, the ballot is built and decided in the same pass, and the
  // room still opens with a question.
  await step("synthesis", () => synthesizeDueCycles(deps, errorsFrom("synthesis")), (n) => {
    report.topics.ballotsCreated = n;
  });
  await step("topics", () => decideDueBallots(deps, ["topic", "chest_project"], errorsFrom("topics")), (n) => {
    report.topics.ballotsDecided += n;
  });
  // Snapshot, publish and forget closed weeks, then retire expired public responses.
  await step("settlement", () => settleDueCycles(deps, errorsFrom("settlement")), (n) => {
    report.settlement.cyclesSettled = n;
  });
  await step("expiry", () => expirePublicResponses(deps), (n) => (report.settlement.publicExpired = n));
  // Last: every step above may have scheduled media for deletion.
  await step("media", () => purgeDueMedia(deps), (r) => (report.media = r));

  return report;
}
