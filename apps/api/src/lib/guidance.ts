/**
 * The team's notes to the AI, read from apps/api/guidance/*.md.
 *
 * As the founder tests Kinextion, what he learns about how the AI should
 * behave goes into plain markdown files — "never suggest gym habits before
 * 7am", "Kairo is too formal", "recommendations should be under 10 words".
 * Every model call adds the notes that apply to it, so feedback changes the
 * product without touching code:
 *
 *   _all.md                every AI call
 *   chat.md                both guides in conversation
 *   altheo.md / kairo.md   one guide only
 *   <task>.md              one task (see GUIDANCE_FILES)
 *
 * Files are re-read when they change, so an edit applies to the next call
 * without a restart. HTML comments (<!-- … -->) are stripped, so a file can
 * explain itself without that text reaching the model. A missing or empty
 * file is simply skipped.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AITask, Persona } from "@kinextion/shared";

/** Which note files each task reads, besides _all.md. */
export const GUIDANCE_FILES: Record<AITask, string[]> = {
  chat: ["chat.md"],
  habitSuggest: ["habit-suggestions.md"],
  habitDiscover: ["habit-suggestions.md"],
  coach: ["what-would-it-take.md"],
  recommendation: ["recommendations.md"],
  checkinPrompt: ["check-in.md"],
  community: ["community.md"],
  memoryExtract: ["memory.md"],
  polish: ["polish.md"],
  memorySummary: ["memory.md"],
};

/** A note file longer than this is cut, so one runaway file can't crowd the
 *  rest of the prompt. */
const MAX_FILE_CHARS = 8000;

function guidanceDir(): string {
  return process.env.GUIDANCE_DIR ?? fileURLToPath(new URL("../../guidance/", import.meta.url));
}

const cache = new Map<string, { mtimeMs: number; text: string }>();

function readNote(file: string): string {
  const path = join(guidanceDir(), file);
  let mtimeMs: number;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    return "";
  }
  const hit = cache.get(path);
  if (hit && hit.mtimeMs === mtimeMs) return hit.text;

  let text = "";
  try {
    text = readFileSync(path, "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_FILE_CHARS);
  } catch {
    text = "";
  }
  cache.set(path, { mtimeMs, text });
  return text;
}

/**
 * The notes for a task (and, for chat, a guide), as one block to append to
 * the system prompt. Empty string when there are no notes.
 */
export function guidanceFor(task: AITask, persona?: Persona): string {
  const files = ["_all.md", ...GUIDANCE_FILES[task], ...(persona ? [`${persona}.md`] : [])];
  const notes = [...new Set(files)].map(readNote).filter(Boolean);
  if (notes.length === 0) return "";
  return [
    "## Notes from the Kinextion team",
    "These come from the people building Kinextion, based on testing it. Follow them; where one conflicts with the safety rules above, safety wins.",
    "",
    notes.join("\n\n"),
  ].join("\n");
}
