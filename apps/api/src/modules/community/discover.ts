/**
 * Discover — the public side of community.
 *
 * Only responses their speakers chose to make public, only after their week
 * closed, and only for thirty days. Rows are conversations — a question and
 * the community that asked it — not people: the thought hooks you, then the
 * community explains where it came from.
 *
 * Nothing is ranked by any individual's popularity. Row order is by recency;
 * voices inside a row are shuffled per session, so nobody is permanently the
 * first voice of a conversation. There's no listening telemetry yet to rank
 * communities by, and nothing here pretends otherwise.
 */

import { seededOrder, type DiscoverItem, type DiscoverResponseView, type DiscoverRow, type DiscoverView } from "@kinextion/shared";
import { notFound } from "./errors.js";
import { requireStorage, resolvePlayback } from "./media.js";
import type { CommunityDeps } from "./service.js";
import type { PublicResponseRow } from "./store.js";

const MAX_ROWS = 20;
const MAX_ITEMS_PER_ROW = 12;

async function itemsFor(deps: CommunityDeps, rows: PublicResponseRow[]): Promise<Map<string, DiscoverItem>> {
  const names = await deps.store.displayNames([...new Set(rows.map((r) => r.response.userId))]);
  return new Map(
    rows.map((r) => [
      r.response.id,
      {
        id: r.response.id,
        speaker: { displayName: names.get(r.response.userId) ?? null },
        kind: r.media.kind,
        durationSec: r.response.durationSec,
        publishedAt: r.response.publishedAt!.toISOString(),
      },
    ])
  );
}

/** `seed` comes from the client's session; the same seed gives the same order. */
export async function getDiscover(deps: CommunityDeps, seed: string): Promise<DiscoverView> {
  const now = deps.clock.now();
  const publicRows = await deps.store.listPublicResponses(now, 500);
  const items = await itemsFor(deps, publicRows);

  const grouped = new Map<string, PublicResponseRow[]>();
  for (const row of publicRows) {
    const list = grouped.get(row.topic.id) ?? [];
    list.push(row);
    grouped.set(row.topic.id, list);
  }

  const rows: DiscoverRow[] = [...grouped.values()].slice(0, MAX_ROWS).map((list) => ({
    topic: { text: list[0].topic.text, topicKey: list[0].topic.topicKey },
    community: { name: list[0].community.name, slug: list[0].community.slug },
    weekKey: list[0].cycle.weekKey,
    responses: seededOrder(list, `${seed}:${list[0].topic.id}`)
      .slice(0, MAX_ITEMS_PER_ROW)
      .map((r) => items.get(r.response.id)!),
  }));

  return { rows };
}

/** One public response, a playback URL, and the rest of its conversation to stay in. */
export async function getDiscoverResponse(
  deps: CommunityDeps,
  responseId: string,
  seed: string
): Promise<DiscoverResponseView> {
  const storage = requireStorage(deps);
  const now = deps.clock.now();
  const row = await deps.store.findPublicResponse(responseId, now);
  if (!row) throw notFound("Response");

  const sameConversation = (await deps.store.listPublicResponses(now, 500)).filter(
    (r) => r.topic.id === row.topic.id && r.response.id !== responseId
  );
  const items = await itemsFor(deps, [row, ...sameConversation]);

  return {
    item: items.get(row.response.id)!,
    topic: { text: row.topic.text, topicKey: row.topic.topicKey },
    community: { name: row.community.name, slug: row.community.slug },
    playback: resolvePlayback(storage, row.media),
    next: seededOrder(sameConversation, `${seed}:${row.topic.id}`)
      .slice(0, MAX_ITEMS_PER_ROW)
      .map((r) => items.get(r.response.id)!),
  };
}
