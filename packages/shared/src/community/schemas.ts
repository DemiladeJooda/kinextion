import { z } from "zod";
import { ADMISSION_VERDICTS } from "./admission.js";

// ─── Founding ────────────────────────────────────────────────────

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2, "Give the community a name").max(60),
  description: z.string().trim().max(280).optional(),
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

// ─── Admission ───────────────────────────────────────────────────

export const joinRequestSchema = z.object({
  /** Optional context for the panel — "I played Tuesdays at Reverchon." */
  note: z.string().trim().max(280).optional(),
});

export type JoinRequestInput = z.infer<typeof joinRequestSchema>;

export const admissionVoteSchema = z.object({
  verdict: z.enum(ADMISSION_VERDICTS),
});

export type AdmissionVoteInput = z.infer<typeof admissionVoteSchema>;

/**
 * Steward fast-track, only in communities past STEWARD_FAST_TRACK_ROSTER.
 * Proof, not judgement: what external evidence shows this person belongs.
 */
export const fastTrackSchema = z.object({
  proof: z.string().trim().min(10, "Describe the proof this person belongs").max(280),
});

export type FastTrackInput = z.infer<typeof fastTrackSchema>;

// ─── Topics & ballots ────────────────────────────────────────────

export const topicSuggestionSchema = z.object({
  /** What's been on your mind — private, and never shown with your name. */
  text: z.string().trim().min(5, "Say a little more").max(280),
});

export type TopicSuggestionInput = z.infer<typeof topicSuggestionSchema>;

export const ballotVoteSchema = z.object({
  optionId: z.string().min(1),
});

export type BallotVoteInput = z.infer<typeof ballotVoteSchema>;

// ─── Media ───────────────────────────────────────────────────────

export const createUploadSchema = z.object({
  kind: z.enum(["video", "audio"]),
  mimeType: z.string().min(3).max(100),
  /** Declared by the recorder; checked again against the room's rules at submission. */
  durationSec: z.number().int().min(1).max(60 * 60),
  bytes: z.number().int().min(1),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export const completeUploadSchema = z.object({
  /** sha256 of the file, hex — computed on the device. */
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "contentHash must be a sha256 hex digest")
    .optional(),
  /**
   * Share of the recording above the silence threshold, 0–1, from the
   * recorder's metering. Lets the API refuse a silent upload without ever
   * downloading it.
   */
  signalRatio: z.number().min(0).max(1).optional(),
});

export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

// ─── Responses ───────────────────────────────────────────────────

export const submitResponseSchema = z.object({
  mediaId: z.string().min(1),
  /**
   * Community only, or public once the week's conversation has closed.
   * Nothing is ever public while the room is open.
   */
  visibility: z.enum(["community", "public_after_close"]),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;

// ─── The room ────────────────────────────────────────────────────

export const REACTION_VERDICTS = ["agree", "mixed", "disagree"] as const;
export type ReactionVerdict = (typeof REACTION_VERDICTS)[number];

export const reactionSchema = z.object({
  verdict: z.enum(REACTION_VERDICTS),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(1000),
  /** Reply to a top-level comment. Replies can't be replied to. */
  parentId: z.string().min(1).optional(),
});

export type CommentInput = z.infer<typeof commentSchema>;

export const REPORT_REASONS = [
  "not_genuine",
  "harassment",
  "hate",
  "sexual",
  "self_harm",
  "ai_generated",
  "other",
] as const;

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(500).optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;

// ─── Chest ───────────────────────────────────────────────────────

// ─── Goals ───────────────────────────────────────────────────────

export const communityGoalSchema = z.object({
  title: z.string().trim().min(3, "Give the goal a short name").max(80),
  targetWeeks: z.number().int().min(1).max(52),
  rewardLabel: z.string().trim().min(3, "Say what the reward is").max(80),
});

export type CommunityGoalInput = z.infer<typeof communityGoalSchema>;

export const chestProposalSchema = z.object({
  title: z.string().trim().min(3, "Give the project a short name").max(80),
  description: z.string().trim().max(500).optional(),
});

export type ChestProposalInput = z.infer<typeof chestProposalSchema>;

// ─── The week ────────────────────────────────────────────────────

export const chooseActiveCommunitySchema = z.object({
  weekKey: z.string().regex(/^\d{4}-W\d{2}$/, "Not a valid week"),
  /** null sits the week out. */
  communityId: z.string().min(1).nullable(),
});

export type ChooseActiveCommunityInput = z.infer<typeof chooseActiveCommunitySchema>;

/** Dev tools only — never registered in production. */
export const devClockSchema = z
  .object({
    advanceHours: z.number().min(0).max(24 * 60).optional(),
    to: z.string().datetime().optional(),
  })
  .refine((v) => v.advanceHours !== undefined || v.to !== undefined, {
    message: "Give advanceHours or to",
  });
