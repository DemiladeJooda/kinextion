/**
 * Camera-analysis client.
 *
 * Frames are captured on-device, sent to the app's own `/api/vision` route,
 * and dropped. Nothing is written to the filesystem and nothing is retained
 * server-side — the same reason the chat route exists rather than calling
 * Anthropic from the bundle applies doubly to images.
 */

import { fetch as expoFetch } from "expo/fetch";
import type { CameraView } from "expo-camera";

import { apiBaseUrl, ChatError } from "./api";

export type VisionMode = "referee" | "form" | "environment";

// ─── Response shapes ──────────────────────────────────────────────────────────
export interface RefereeCall {
  kind: "point" | "fault" | "let" | "none";
  side: "you" | "them" | null;
  text: string;
  confidence: number;
  /** What was visible in the frame that led here. Shown under the call. */
  observed: string[];
  /** Why this call and not the nearest alternative. */
  reasoning: string;
}

export interface RefereeResult {
  framing: string | null;
  call: RefereeCall;
}

export interface FormCheckpoint {
  name: string;
  /** 0–10. The `observed` line has to justify it on its own. */
  score: number;
  verdict: "good" | "watch" | "fix";
  observed: string;
  why: string;
  fix: string | null;
}

export interface FormResult {
  personVisible: boolean;
  framing: string | null;
  phase: string;
  checkpoints: FormCheckpoint[];
  cue: string;
  cueOk: boolean;
  confidence: number;
}

export interface EnvChange {
  action: string;
  impact: "high" | "medium" | "low";
  why: string;
  seconds: number;
}

export interface EnvResult {
  roomVisible: boolean;
  framing: string | null;
  reading: {
    brightness: string;
    colourTemp: string;
    daylight: string;
    screens: string;
    clutter: string;
  };
  fitScore: number;
  fitWhy: string;
  changes: EnvChange[];
  confidence: number;
}

interface ResultByMode {
  referee: RefereeResult;
  form: FormResult;
  environment: EnvResult;
}

/**
 * Grab a still from a live camera and analyse it.
 *
 * `quality` is deliberately low: the model reads position, light, and
 * alignment perfectly well at this size, and a 1MB upload on a phone hotspot
 * between reps is not a trade worth making.
 */
export async function analyseFrame<M extends VisionMode>({
  camera,
  mode,
  state,
  signal,
}: {
  camera: CameraView;
  mode: M;
  state: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<ResultByMode[M]> {
  let base64: string | undefined;

  try {
    const shot = await camera.takePictureAsync({
      base64: true,
      quality: 0.45,
      imageType: "jpg",
      // `skipProcessing` is deliberately left off. It's faster, but it leaves
      // EXIF orientation unresolved — and a sideways frame would have the model
      // judging squat depth or a baseline against the wrong axis.
      shutterSound: false,
    });
    base64 = shot?.base64 ?? undefined;
  } catch {
    throw new ChatError("Couldn't capture a frame from the camera.", "capture_failed");
  }

  if (!base64) {
    throw new ChatError("The camera returned an empty frame.", "capture_empty");
  }

  return analyseImage({ image: base64, mode, state, signal });
}

/** The network half, split out so it can be exercised without a live camera. */
export async function analyseImage<M extends VisionMode>({
  image,
  mode,
  state,
  signal,
}: {
  image: string;
  mode: M;
  state: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<ResultByMode[M]> {
  let res: Response;

  try {
    res = (await expoFetch(`${apiBaseUrl()}/api/vision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, image, state }),
      signal,
    })) as unknown as Response;
  } catch {
    if (signal?.aborted) throw new ChatError("Cancelled.", "aborted");
    throw new ChatError("Couldn't reach Kinextion. Check your connection.", "network");
  }

  const body = (await res.json().catch(() => null)) as
    | (ResultByMode[M] & { error?: string; code?: string })
    | null;

  if (!res.ok || !body) {
    throw new ChatError(
      body?.error ?? "Couldn't analyse that frame. Try again.",
      body?.code ?? String(res.status)
    );
  }

  return body;
}

/** Human-readable confidence, for the badge under a call. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return "Clear";
  if (confidence >= 0.55) return "Likely";
  return "Unsure";
}
