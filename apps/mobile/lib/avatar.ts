/**
 * Ready Player Me avatar — a stylized, face-matched 3D avatar, not a body
 * scan. (Real body-shape scanning exists as a vendor product, 3DLOOK/
 * FitXpress, starting at $1,000+/month with its own native camera SDK — a
 * deliberate, separate decision, not what this wires up.)
 *
 * The "demo" subdomain below works with no Ready Player Me account at all —
 * fine for building and testing. Before shipping to real users, swap it for
 * a free subdomain from https://studio.readyplayer.me (one dashboard field,
 * no code change) so avatars land under Kinextion's own namespace rather
 * than the shared public demo one.
 */

export const RPM_SUBDOMAIN = "demo";

export function avatarCreatorUrl(): string {
  return `https://${RPM_SUBDOMAIN}.readyplayer.me/avatar?frameApi&source=kinextion&bodyType=fullbody&quickStart`;
}

/** `pose`/`expression`/`camera` match Ready Player Me's 2D render API. */
export function avatarImageUrl(
  avatarId: string,
  options: { pose?: string; expression?: string; camera?: "fullbody" | "portrait" } = {}
): string {
  const params = new URLSearchParams(options as Record<string, string>).toString();
  const base = `https://models.readyplayer.me/${avatarId}.png`;
  return params ? `${base}?${params}` : base;
}

export interface RpmEvent {
  source?: string;
  eventName?: string;
  data?: { avatarId?: string; id?: string; assetId?: string };
}

export function parseRpmEvent(raw: string): RpmEvent | null {
  try {
    const event = JSON.parse(raw) as RpmEvent;
    return event?.source === "readyplayerme" ? event : null;
  } catch {
    return null;
  }
}

/** Posted once the WebView loads, so Ready Player Me starts sending events. */
export const RPM_SUBSCRIBE_MESSAGE = JSON.stringify({
  target: "readyplayerme",
  type: "subscribe",
  eventName: "v1.**",
});
