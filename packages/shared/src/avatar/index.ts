/**
 * Your avatar: what it can do and how it's described to the image model.
 *
 * Every activity has two poses, so the app can loop between them.
 *
 * One rule applies to everything here: the avatar always keeps the person's
 * real body. Nothing generates a slimmer, more muscular or "after" version of
 * someone. Before and after compares real scans only.
 */

import { z } from "zod";

export interface AvatarActivity {
  id: string;
  label: string;
  /** Matches a habit or workout name to this activity. */
  keywords: readonly string[];
  start: string;
  end: string;
}

export const AVATAR_ACTIVITIES: readonly AvatarActivity[] = [
  { id: "arms", label: "Arms", keywords: ["arm", "curl", "bicep", "tricep"], start: "standing in a gym holding dumbbells at their sides with arms straight", end: "in the same spot curling the dumbbells up to their shoulders" },
  { id: "legs", label: "Legs", keywords: ["leg", "squat", "lunge"], start: "standing tall in a gym, about to squat", end: "in the same spot at the bottom of a bodyweight squat" },
  { id: "back", label: "Back & chest", keywords: ["back", "chest", "push-up", "pushup", "pull", "bench"], start: "at the top of a push-up on a gym floor with arms straight", end: "in the same spot at the bottom of a push-up" },
  { id: "core", label: "Core", keywords: ["core", "abs", "plank"], start: "holding a forearm plank on a mat, looking forward", end: "on the same mat in a side plank" },
  { id: "run", label: "Running", keywords: ["run", "jog", "cardio", "treadmill"], start: "running on a tree-lined path, left foot forward", end: "running on the same path, right foot forward" },
  { id: "walk", label: "Walking", keywords: ["walk", "step", "hike"], start: "walking along a quiet evening street, left foot forward", end: "walking along the same street, right foot forward" },
  { id: "stretch", label: "Stretching", keywords: ["stretch", "mobility", "yoga", "flexib"], start: "standing on a mat with arms reaching overhead", end: "on the same mat folding forward, reaching for their toes" },
  { id: "read", label: "Reading", keywords: ["read", "book", "study", "page"], start: "sitting in a comfortable chair reading a book by a warm lamp", end: "in the same chair turning a page, with a small smile" },
  { id: "meditate", label: "Being still", keywords: ["meditat", "breath", "pray", "mindful", "calm"], start: "sitting cross-legged on a cushion in a calm room with eyes open", end: "in the same position with eyes closed, shoulders dropped" },
  { id: "journal", label: "Journaling", keywords: ["journal", "write", "gratitude"], start: "sitting at a table writing in a notebook", end: "at the same table pausing to think, pen lifted" },
  { id: "water", label: "Drinking water", keywords: ["water", "hydrat", "drink"], start: "in a bright kitchen holding a full glass of water", end: "in the same kitchen drinking from the glass" },
  { id: "sleep", label: "Winding down", keywords: ["sleep", "bed", "wind down", "lights out"], start: "sitting on the edge of a bed in comfortable pyjamas, reaching for the lamp", end: "in the same bed under the covers, lamp off, eyes closed" },
];

export const AVATAR_MOODS = [
  { id: "calm", label: "Calm", direction: "a relaxed, neutral, calm expression" },
  { id: "happy", label: "Happy", direction: "a warm, genuine, open smile" },
  { id: "sad", label: "Low", direction: "a quiet, slightly sad expression" },
] as const;

export type AvatarMoodId = (typeof AVATAR_MOODS)[number]["id"];

/** The closest activity to a habit or workout's name. */
export function activityFor(name: string): AvatarActivity | null {
  const lower = name.toLowerCase();
  return AVATAR_ACTIVITIES.find((a) => a.keywords.some((k) => lower.includes(k))) ?? null;
}

const MAX_B64 = 4_500_000;
const photo = z.string().min(1000).max(MAX_B64);

export const avatarRequestSchema = z.discriminatedUnion("kind", [
  /** Face from the front and each side, then the whole body. */
  z.object({ kind: z.literal("base"), consent: z.literal(true), images: z.array(photo).min(2).max(5) }),
  z.object({ kind: z.literal("mood"), consent: z.literal(true), mood: z.enum(["calm", "happy", "sad"]), avatar: photo, face: photo }),
  z.object({ kind: z.literal("scene"), consent: z.literal(true), activity: z.string().max(30), frame: z.enum(["start", "end"]), avatar: photo }),
]);

export type AvatarRequest = z.infer<typeof avatarRequestSchema>;

const LOOK = "A near-photorealistic high-end 3D digital double, the quality of a modern AAA game character, clearly a digital avatar and not a photograph.";
const KEEP = "Keep exactly this person's face, skin tone, hair, facial hair, age and true body shape and size. Do not make them slimmer, more muscular, younger or more conventionally attractive. Always fully and modestly clothed.";

export function avatarPrompt(request: AvatarRequest): string | null {
  if (request.kind === "base") {
    return `The reference photos all show one person. ${LOOK} ${KEEP} Full body from head to toe, standing relaxed, facing the camera, arms at their sides. Plain dark athletic T-shirt, long shorts and trainers. Soft studio light on a plain deep navy background.`;
  }
  if (request.kind === "mood") {
    const mood = AVATAR_MOODS.find((m) => m.id === request.mood);
    return mood ? `The first image is a digital avatar. The second is a photo of the same person, for reference on how their face looks with this expression. Make a head-and-shoulders portrait of the same avatar with ${mood.direction}. ${LOOK} ${KEEP} Plain deep navy background.` : null;
  }
  const activity = AVATAR_ACTIVITIES.find((a) => a.id === request.activity);
  if (!activity) return null;
  return `This image is a digital avatar of a person. Show the same avatar ${request.frame === "start" ? activity.start : activity.end}. ${LOOK} ${KEEP} Same face and same clothing style, or clothing that suits the activity. Whole body visible in the frame, with the camera position and background kept simple and steady.`;
}
