export {
  ALTHEO_SYSTEM_PROMPT,
  ALTHEO_GREETING,
} from "./altheo.js";

export {
  KAIRO_SYSTEM_PROMPT,
  KAIRO_GREETING,
} from "./kairo.js";

import { ALTHEO_SYSTEM_PROMPT, ALTHEO_GREETING } from "./altheo.js";
import { KAIRO_SYSTEM_PROMPT, KAIRO_GREETING } from "./kairo.js";
import type { Persona } from "@kinextion/shared";

export function getSystemPrompt(persona: Persona): string {
  return persona === "altheo" ? ALTHEO_SYSTEM_PROMPT : KAIRO_SYSTEM_PROMPT;
}

export function getGreeting(persona: Persona): string {
  return persona === "altheo" ? ALTHEO_GREETING : KAIRO_GREETING;
}
