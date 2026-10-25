/**
 * What the guides cost, from the real database. Read-only.
 *
 *   pnpm --filter @kinextion/api ai:costs          # last 28 days
 *   pnpm --filter @kinextion/api ai:costs -- 90    # last 90 days
 *
 * Dollars and counts only. Costs are list price, so they track the
 * Anthropic invoice closely but not to the cent.
 */

import { prisma } from "@kinextion/database";
import { loadAICostMetrics } from "../src/lib/ai-cost-metrics.js";

const m = await loadAICostMetrics(Number(process.argv[2] ?? 28));

const $ = (x: number | null) => (x === null ? "—" : `$${x < 1 ? x.toFixed(4) : x.toFixed(2)}`);
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

console.log(`
AI costs — last ${m.window.days} days, ${m.calls} call${m.calls === 1 ? "" : "s"}

  Spent                           ${$(m.totalUsd)}   (≈ ${$(m.projectedMonthlyUsd)} a month at this rate)
  Active users                    ${m.activeUsers}   (${m.aiUsers} used a guide)

  Per active user, per month      ${$(m.monthly.perActiveUserUsd)}
  Per guide user, per month       ${$(m.monthly.perAIUserUsd)}   median ${$(m.monthly.medianAIUserUsd)} · p90 ${$(m.monthly.p90AIUserUsd)} · heaviest ${$(m.monthly.heaviestAIUserUsd)}
  Charged to no one (community)   ${$(m.unattributed.usd)}   (${m.unattributed.calls} calls)
  Input read from cache           ${pct(m.cacheReadShare)}

  By task
${m.byTask.map((t) => `    ${t.task.padEnd(16)} ${$(t.usd).padStart(10)}  ${pct(t.share).padStart(4)}  ${String(t.calls).padStart(6)} calls  ${$(t.avgCallUsd)} each`).join("\n") || "    —"}

  By model
${m.byModel.map((x) => `    ${x.model.padEnd(20)} ${$(x.usd).padStart(10)}  ${String(x.calls).padStart(6)} calls`).join("\n") || "    —"}
`);
await prisma.$disconnect();
