/**
 * Development seed for the community layer.
 *
 *   pnpm --filter @kinextion/api community:seed
 *
 * Creates eight fixture users, founds an active community through the real
 * service (invites and all — so seeding exercises the same code users do),
 * and leaves a ninth user with a pending join request in front of the panel.
 * Safe to re-run: users are upserted and an existing seed community is left
 * alone.
 *
 * Refuses to run in production. Fixture names are deliberately obviously
 * fixtures — nothing here should ever read like a real group.
 */

import { prisma } from "@kinextion/database";
import { FOUNDING_QUORUM } from "@kinextion/shared";
import { cryptoRng, systemClock } from "../modules/community/clock.js";
import { PrismaCommunityStore } from "../modules/community/prisma-store.js";
import {
  acceptInvite,
  createCommunity,
  createInvite,
  requestToJoin,
  type CommunityDeps,
} from "../modules/community/service.js";

const SEED_SLUG = "seed-community";
const MEMBER_COUNT = 8;

async function seedUser(n: number) {
  const user = await prisma.user.upsert({
    where: { clerkId: `seed_community_${n}` },
    create: { clerkId: `seed_community_${n}`, email: `seed-community-${n}@kinextion.test` },
    update: {},
  });
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, displayName: `Seed Member ${n}` },
    update: {},
  });
  return user;
}

/**
 * `--join you@example.com` drops your own account into the seed community, so
 * the app has something real to show when you sign in. Sign in once first, so
 * the account exists. Safe to re-run.
 */
async function joinYou(deps: CommunityDeps, communityId: string): Promise<string | null> {
  const flag = process.argv.indexOf("--join");
  const email = flag >= 0 ? process.argv[flag + 1] : undefined;
  if (!email) return null;

  const you = await prisma.user.findUnique({ where: { email } });
  if (!you) {
    // An account row is created the first time an authenticated request reaches
    // this API — signing in to Clerk alone doesn't do it.
    const others = await prisma.user.findMany({
      where: { NOT: { email: { startsWith: "seed-community-" } } },
      select: { email: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    throw new Error(
      [
        `No account here with the email ${email}.`,
        "",
        "An account is created the first time the app or website calls this API while",
        "you're signed in — signing in to Clerk on its own isn't enough. With the API",
        "running, open http://localhost:3000/dashboard signed in (or launch the phone",
        "app), then run this again.",
        "",
        others.length
          ? `Accounts that do exist: ${others.map((u) => u.email).join(", ")}`
          : "There are no accounts in this database yet.",
      ].join("\n")
    );
  }
  await deps.store.upsertMembership({
    communityId,
    userId: you.id,
    // Steward, so the steward-only paths can be exercised too.
    role: "steward",
    at: deps.clock.now(),
  });
  console.log(`Added ${email} to the seed community as a steward.`);
  return you.id;
}

/**
 * `--applicant` adds a fresh fixture member asking to join, which draws a new
 * panel from whoever is in the community *now*. Run it after `--join` and the
 * vote lands in front of you — the seed's original applicant was judged by a
 * panel drawn before your account existed.
 */
async function addApplicant(deps: CommunityDeps, communityId: string): Promise<void> {
  if (!process.argv.includes("--applicant")) return;

  const taken = await prisma.user.count({ where: { clerkId: { startsWith: "seed_community_" } } });
  const applicant = await seedUser(taken + 1);
  await requestToJoin(deps, applicant.id, communityId, "Seeded applicant — vote on me.");
  // Admission voting has no screen in the app or website yet — it lives on
  // GET /api/community/admissions/pending and POST .../admissions/:id/vote.
  console.log(
    `Seed Member ${taken + 1} is asking to join.\n` +
      "There's no admission screen in the clients yet, so that vote is API-only for now."
  );
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed fixture users into a production database.");
  }

  const deps: CommunityDeps = {
    store: new PrismaCommunityStore(),
    clock: systemClock,
    rng: cryptoRng,
  };

  const existing = await prisma.community.findUnique({ where: { slug: SEED_SLUG } });
  if (existing) {
    console.log(`Seed community already exists (${existing.id}, ${existing.status}).`);
    await joinYou(deps, existing.id);
    await addApplicant(deps, existing.id);
    return;
  }

  const users = [];
  for (let n = 1; n <= MEMBER_COUNT + 1; n++) users.push(await seedUser(n));
  const [founder, ...rest] = users;
  const founders = rest.slice(0, MEMBER_COUNT - 1);
  const applicant = rest[MEMBER_COUNT - 1];

  const { community } = await createCommunity(deps, founder.id, {
    name: "Seed Community",
    description: "Development fixture. Not a real group.",
  });
  // Pin the slug so re-runs can find it.
  await prisma.community.update({ where: { id: community.id }, data: { slug: SEED_SLUG } });

  // Every invite goes out while the community is still forming — once it
  // activates, no new invites can be created.
  const tokens = [];
  for (const _ of founders) tokens.push((await createInvite(deps, founder.id, community.id)).token);

  let activated = false;
  for (const [i, member] of founders.entries()) {
    const result = await acceptInvite(deps, member.id, tokens[i]);
    activated ||= result.activated;
  }

  await requestToJoin(deps, applicant.id, community.id, "Seeded applicant waiting on the panel.");

  const joined = await joinYou(deps, community.id);
  await addApplicant(deps, community.id);

  console.log(
    JSON.stringify(
      {
        communityId: community.id,
        slug: SEED_SLUG,
        members: MEMBER_COUNT,
        activated,
        quorum: FOUNDING_QUORUM,
        pendingApplicant: applicant.id,
        joinedYouAs: joined,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("Community seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
