/**
 * Community over HTTP: the real server, the real auth hook and error
 * handling, an in-memory store and a manual clock.
 *
 * The anonymity sweep at the bottom is the reason this file exists. Admission
 * is anonymous because people must be able to object without damaging a
 * friendship — so no response, from any community route, to any caller, may
 * carry who voted, how they voted, the tally, or the machinery that would let
 * someone infer those. It drives every read route through a full admission
 * (including a redraw) as every kind of caller, and fails on any forbidden
 * key or any other person's internal id.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test/test";
process.env.CLERK_SECRET_KEY = "sk_test_x";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-encryption-key-for-route-tests";

/** Who the next request is from. The Clerk id doubles as the internal user id. */
let caller: string | null = null;

vi.mock("@clerk/fastify", () => ({
  clerkPlugin: async () => {},
  getAuth: () => ({ userId: caller }),
  clerkClient: { users: { getUser: async () => ({ emailAddresses: [] }) } },
}));

vi.mock("@kinextion/database", () => ({
  Prisma: { DbNull: null },
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { clerkId: string } }) => ({
        id: where.clerkId,
        clerkId: where.clerkId,
        email: `${where.clerkId}@example.com`,
      }),
    },
  },
}));

const { PANEL_TIMEOUT_HOURS, seededRng } = await import("@kinextion/shared");
const { ManualClock } = await import("../src/modules/community/clock.js");
const service = {
  ...(await import("../src/modules/community/service.js")),
  ...(await import("../src/modules/community/maintenance.js")),
};
const { MemoryCommunityStore } = await import("./support/memory-community-store.js");
const { buildApp } = await import("../src/server.js");

const store = new MemoryCommunityStore();
const clock = new ManualClock("2026-09-14T17:00:00Z");
const deps = { store, clock, rng: seededRng(11) };

let app: Awaited<ReturnType<typeof buildApp>>["app"];

beforeAll(async () => {
  ({ app } = await buildApp({ communityDeps: deps }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function call(as: string | null, method: string, url: string, payload?: unknown) {
  caller = as;
  const res = await app.inject({
    method: method as "GET",
    url: `/api/community${url}`,
    ...(payload !== undefined ? { payload: payload as object } : {}),
  });
  return { status: res.statusCode, body: res.json() };
}

/** Found a 12-member community through the service; returns its id. */
async function foundTwelve(prefix: string) {
  const founder = `${prefix}1`;
  const { community } = await service.createCommunity(deps, founder, { name: `${prefix} Community` });
  const tokens = [];
  for (let n = 2; n <= 12; n++) tokens.push((await service.createInvite(deps, founder, community.id)).token);
  for (let n = 2; n <= 12; n++) await service.acceptInvite(deps, `${prefix}${n}`, tokens[n - 2]);
  return community.id;
}

// ─── Envelope & errors ───────────────────────────────────────────

describe("responses", () => {
  it("wraps success in the standard envelope", async () => {
    const res = await call("env1", "POST", "/communities", { name: "Envelope Test" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.community).toMatchObject({ name: "Envelope Test", status: "forming" });
  });

  it("rejects invalid input with a stable code", async () => {
    const res = await call("env1", "POST", "/communities", { name: "x" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "INVALID" });
  });

  it("carries a machine-readable code on refusals", async () => {
    const res = await call("env1", "POST", "/admissions/nope/vote", { verdict: "belongs" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: "Admission request not found", code: "NOT_FOUND" });
  });

  it("still hides internals when something unexpected breaks", async () => {
    const original = store.listMyCommunities.bind(store);
    store.listMyCommunities = async () => {
      throw new Error("relation \"CommunityMembership\" does not exist");
    };
    const res = await call("env1", "GET", "/communities");
    store.listMyCommunities = original;

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "Something went wrong on our end." });
  });

  it("keeps the dev clock off unless it's asked for", async () => {
    const res = await app.inject({ method: "GET", url: "/api/community/dev/clock" });
    expect(res.statusCode).toBe(404);
  });

  it("answers 404, not 403, for a forming community you aren't in", async () => {
    const { community } = await service.createCommunity(deps, "hidden1", { name: "Hidden Forming" });
    const res = await call("stranger", "GET", `/communities/${community.id}`);
    expect(res.status).toBe(404);
  });
});

describe("the dev clock", () => {
  it("moves time and runs maintenance, without a session", async () => {
    const { app: devApp } = await buildApp({ communityDeps: deps, communityDevTools: true });
    await devApp.ready();
    caller = null;

    const before = await devApp.inject({ method: "GET", url: "/api/community/dev/clock" });
    expect(before.statusCode).toBe(200);
    expect(before.json().data.adjustable).toBe(true);

    const moved = await devApp.inject({
      method: "POST",
      url: "/api/community/dev/clock",
      payload: { advanceHours: 24 },
    });
    expect(moved.statusCode).toBe(200);
    expect(new Date(moved.json().data.now).getTime()).toBeGreaterThan(
      new Date(before.json().data.now).getTime()
    );
    expect(moved.json().data.report.errors).toEqual([]);
    await devApp.close();
  });
});

// ─── Anonymity ───────────────────────────────────────────────────

/** Keys that would reveal a vote, a voter, a tally, or the panel machinery. */
const FORBIDDEN_KEYS = new Set([
  "userId",
  "voterId",
  "voter",
  "voters",
  "verdict",
  "verdicts",
  "votes",
  "seat",
  "seats",
  "panel",
  "panelMode",
  "panelSize",
  "minBelongs",
  "maxObjections",
  "belongs",
  "objections",
  "tally",
  "round",
  "deadlineAt",
  "decidedBy",
  "fastTrackProof",
  "tokenHash",
  "expiredAt",
]);

function findLeaks(value: unknown, peopleIds: Set<string>, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findLeaks(v, peopleIds, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(FORBIDDEN_KEYS.has(k) ? [`${path}.${k}`] : []),
      ...findLeaks(v, peopleIds, `${path}.${k}`),
    ]);
  }
  if (typeof value === "string" && peopleIds.has(value)) return [`${path} = ${value}`];
  return [];
}

describe("admission anonymity", () => {
  it("never reveals who voted, how, or how many — to anyone, at any point", async () => {
    const communityId = await foundTwelve("anon");
    const members = Array.from({ length: 12 }, (_, i) => `anon${i + 1}`);
    const people = new Set([...members, "applicant", "outsider"]);
    const responses: Array<{ label: string; status: number; body: unknown }> = [];

    // The founder/steward, two members who vote, one who stays silent. Every
    // member sees the same shapes, so four cover all of them — and keep the
    // sweep under the API-wide rate limit, which buckets by IP in tests.
    const readers = ["anon1", "anon2", "anon4", "anon9"];

    async function readEverything(stage: string) {
      const reads: Array<[string, string, string]> = [
        ["applicant", "GET", `/communities/${communityId}`],
        ["applicant", "GET", `/communities/${communityId}/join-requests/mine`],
        ["applicant", "GET", "/communities"],
        ["applicant", "GET", "/admissions/pending"],
        ["outsider", "GET", `/communities/${communityId}`],
        ...readers.flatMap(
          (m): Array<[string, string, string]> => [
            [m, "GET", `/communities/${communityId}`],
            [m, "GET", "/communities"],
            [m, "GET", "/admissions/pending"],
          ]
        ),
        ["anon1", "GET", `/communities/${communityId}/fast-track`],
      ];
      for (const [who, method, url] of reads) {
        const { status, body } = await call(who, method, url);
        responses.push({ label: `${stage} · ${who} ${method} ${url}`, status, body });
      }
    }

    const requested = await call("applicant", "POST", `/communities/${communityId}/join-requests`, {
      note: "We played Tuesdays",
    });
    expect(requested.status).toBe(201);
    responses.push({ label: "request", ...requested });
    await readEverything("pending");

    const joinRequestId = (await call("anon2", "GET", "/admissions/pending")).body.data[0].joinRequestId;

    // Two votes, then silence past the deadline: the panel is redrawn.
    for (const m of ["anon2", "anon3"]) {
      const vote = await call(m, "POST", `/admissions/${joinRequestId}/vote`, { verdict: "belongs" });
      expect(vote.body).toEqual({ success: true, data: { recorded: true } });
      responses.push({ label: `vote · ${m}`, ...vote });
    }
    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    await service.runMaintenance(deps);
    await readEverything("redrawn");

    // One more recognition, and the second deadline admits.
    const third = await call("anon4", "POST", `/admissions/${joinRequestId}/vote`, { verdict: "belongs" });
    responses.push({ label: "vote · anon4", ...third });
    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    await service.runMaintenance(deps);
    await readEverything("decided");

    // A sweep of error pages proves nothing — every read must have been served.
    const unserved = responses.filter((r) => r.status >= 429).map((r) => `${r.label} → ${r.status}`);
    expect(unserved).toEqual([]);

    const leaks = responses.flatMap(({ label, body }) =>
      findLeaks(body, people).map((leak) => `${label}: ${leak}`)
    );
    expect(leaks).toEqual([]);

    // And the outcome did actually happen, so the sweep wasn't vacuous.
    const final = await call("applicant", "GET", `/communities/${communityId}`);
    expect(final.body.data.membership).toMatchObject({ role: "member" });
  });

  it("shows the applicant an identical view before and after a redraw", async () => {
    const communityId = await foundTwelve("redraw");
    await call("quiet-applicant", "POST", `/communities/${communityId}/join-requests`, {});

    const before = await call("quiet-applicant", "GET", `/communities/${communityId}/join-requests/mine`);
    clock.advanceHours(PANEL_TIMEOUT_HOURS);
    const report = await service.runMaintenance(deps);
    expect(report.admissions.redrawn).toBeGreaterThan(0);
    const after = await call("quiet-applicant", "GET", `/communities/${communityId}/join-requests/mine`);

    expect(after.body).toEqual(before.body);
  });

  it("answers a vote with the same two words whatever the vote does", async () => {
    const communityId = await foundTwelve("same");
    await call("same-applicant", "POST", `/communities/${communityId}/join-requests`, {});
    const id = (await call("same2", "GET", "/admissions/pending")).body.data[0].joinRequestId;

    const harmless = await call("same2", "POST", `/admissions/${id}/vote`, { verdict: "belongs" });
    const decisive = await call("same3", "POST", `/admissions/${id}/vote`, { verdict: "objects" });
    expect(harmless.body).toEqual(decisive.body);
  });
});
