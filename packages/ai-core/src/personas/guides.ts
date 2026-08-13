/**
 * Guide registry — the single source of truth for who the guides are.
 *
 * ⚠️ id vs. display name
 * The *id* (`altheo`) is the persisted contract: it is written to
 * `Conversation.persona` in the database, used in mobile deep links
 * (`/chat/altheo`), and sent as the `guide` field on the chat API. Changing it
 * is a data migration.
 *
 * The *display name* ("Althea") is presentation only and lives here alone, so
 * renaming the character is a one-line change that propagates into the system
 * prompts, the web UI, and the app.
 */

export const GUIDE_IDS = ["altheo", "kairo"] as const;
export type GuideId = (typeof GUIDE_IDS)[number];

/** Where the conversation is happening. Controls response length and format. */
export type ChatSurface = "web" | "app";

export interface GuideMeta {
  readonly id: GuideId;
  /** Presentation name. Rename here and it changes everywhere. */
  readonly name: string;
  readonly role: string;
  readonly tagline: string;
  /** Brand colour, shared by web and mobile. */
  readonly color: string;
  readonly emoji: string;
}

export const GUIDES: Record<GuideId, GuideMeta> = {
  altheo: {
    id: "altheo",
    name: "Althea",
    role: "The Coach",
    tagline: "Reads your body. Adapts your plan.",
    color: "#00C47A",
    emoji: "⚡",
  },
  kairo: {
    id: "kairo",
    name: "Kairo",
    role: "The Listener",
    tagline: "Reads your patterns. Understands your why.",
    color: "#A855F7",
    emoji: "🌊",
  },
};

/**
 * Accepts anything a client might send and narrows it to a real guide id.
 *
 * Tolerates the legacy `althea` spelling (the marketing site shipped with the
 * display name as the id) and the generic `kinextion` value, so older clients
 * keep working after this consolidation. Returns `null` for anything else —
 * callers decide whether that is a 400 or a fallback to the default.
 */
export function resolveGuideId(raw: unknown): GuideId | null {
  if (typeof raw !== "string") return null;
  switch (raw.trim().toLowerCase()) {
    case "altheo":
    case "althea":
    case "coach":
      return "altheo";
    case "kairo":
    case "listener":
      return "kairo";
    default:
      return null;
  }
}

export const DEFAULT_GUIDE: GuideId = "kairo";
