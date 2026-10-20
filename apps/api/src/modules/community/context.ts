/**
 * What Altheo and Kairo know about someone's community.
 *
 * This is the merge that makes Kinextion one app: the coach who knows your
 * habits also knows your room opens Thursday, and the listener who helps you
 * think knows what the question is.
 *
 * It is also the narrowest possible view of it. Everything here is
 * participation — which community, whether you've spoken, when the room
 * closes — plus the week's question, which every member already sees. Nothing
 * anyone said in a room passes through here, ever: no response, no transcript,
 * no comment, no reaction, and no other member's name. Reflection, not
 * surveillance. tests/community-privacy.test.ts holds the line.
 */

import { COMMUNITY_TIME_ZONE, stageFor, weekKeyFor, zonedParts } from "@kinextion/shared";
import type { UserContext } from "@kinextion/ai-core";
import type { CommunityDeps } from "./service.js";

type CommunityContext = NonNullable<UserContext["community"]>;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Sunday evening" — a deadline a guide can say out loud, in community time. */
function describeDeadline(at: Date): string {
  const parts = zonedParts(at, COMMUNITY_TIME_ZONE);
  const weekday = WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
  const partOfDay = parts.hour < 12 ? "morning" : parts.hour < 17 ? "afternoon" : "evening";
  return `${weekday} ${partOfDay}`;
}

export async function communityContextFor(
  deps: CommunityDeps,
  userId: string,
  topicId?: string
): Promise<CommunityContext | undefined> {
  const now = deps.clock.now();
  const weekKey = weekKeyFor(now);
  const mine = await deps.store.listMyCommunities(userId);
  if (mine.length === 0) return undefined;

  const lines: string[] = [];
  const choice = await deps.store.findActiveChoice(userId, weekKey);
  const active = choice?.communityId ? mine.find((m) => m.community.id === choice.communityId) : undefined;

  lines.push(
    mine.length === 1
      ? `They're part of one community: ${mine[0].community.name}.`
      : `They're part of ${mine.length} communities: ${mine.map((m) => m.community.name).join(", ")}.`
  );

  if (active) {
    const cycle = await deps.store.findCycleFor(active.community.id, weekKey);
    const stage = cycle ? stageFor(cycle, now) : null;
    lines.push(`This week they're sitting with ${active.community.name}.`);

    if (cycle && stage === "open") {
      const topic = await deps.store.findTopicForCycle(cycle.id);
      const response = topic ? await deps.store.findResponseFor(topic.id, userId) : null;
      lines.push(
        response?.status === "submitted"
          ? `They've shared their response, so their community's room is open to them. It closes ${describeDeadline(cycle.closesAt)}.`
          : `They haven't shared their own response yet, so the room stays closed to them until they do. It closes ${describeDeadline(cycle.closesAt)}. Don't nag; mention it only if it's relevant.`
      );
    } else if (stage === "gathering" || stage === "voting") {
      lines.push("Their community is choosing this week's question.");
    }
  } else if (choice && choice.communityId === null) {
    lines.push(
      "They've chosen to sit this week out. That's a normal, allowed choice and costs them nothing — don't treat it as a lapse."
    );
  }

  const context: CommunityContext = { lines };

  if (topicId) {
    // Membership is checked here: a topic id alone never opens a question up.
    const topic = await deps.store.findTopic(topicId);
    const cycle = topic ? await deps.store.findCycle(topic.cycleId) : null;
    const community = cycle ? await deps.store.findCommunity(cycle.communityId) : null;
    const membership = community ? await deps.store.findMembership(community.id, userId) : null;
    if (topic && community && membership && membership.leftAt === null) {
      context.thinkingAbout = { communityName: community.name, topicText: topic.text };
    }
  }

  return context;
}
