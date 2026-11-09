/**
 * Making someone's avatar.
 *
 * Photos come in, an image goes back, and neither is kept here. The finished
 * avatar lives on the person's own phone. Photos are only passed to the image
 * model for that one request.
 */

import type { FastifyInstance } from "fastify";
import { avatarPrompt, avatarRequestSchema, type AvatarRequest } from "@kinextion/shared";

/** Seven phone photos as base64 fit well under this. */
const BODY_LIMIT = 26 * 1024 * 1024;

function referencesOf(request: AvatarRequest): string[] {
  if (request.kind === "base") return request.images;
  if (request.kind === "mood") return [request.avatar, request.face];
  return [request.avatar];
}

function toBlob(base64: string): Blob {
  return new Blob([new Uint8Array(Buffer.from(base64, "base64"))], { type: "image/jpeg" });
}

export async function avatarRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requireAuth);

  app.post(
    "/generate",
    {
      bodyLimit: BODY_LIMIT,
      config: { rateLimit: { max: 40, timeWindow: "1 hour", keyGenerator: (request) => request.headers.authorization ?? request.ip } },
    },
    async (request, reply) => {
      const parsed = avatarRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ success: false, error: "Those photos didn't come through. Try again?" });

      const key = process.env.OPENAI_API_KEY;
      if (!key) return reply.status(501).send({ success: false, error: "Avatars aren't set up yet." });

      const prompt = avatarPrompt(parsed.data);
      if (!prompt) return reply.status(400).send({ success: false, error: "We don't have that one yet." });

      const form = new FormData();
      form.append("model", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2");
      form.append("prompt", prompt);
      form.append("size", parsed.data.kind === "mood" ? "1024x1024" : "1024x1536");
      form.append("quality", parsed.data.kind === "base" ? "high" : "medium");
      form.append("output_format", "jpeg");
      referencesOf(parsed.data).forEach((image, i) => form.append("image[]", toBlob(image), `ref-${i}.jpg`));

      try {
        const res = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        });
        const body = (await res.json()) as { data?: { b64_json?: string }[]; error?: { code?: string; message?: string } };
        const image = body.data?.[0]?.b64_json;

        if (!res.ok || !image) {
          request.log.warn({ status: res.status, code: body.error?.code }, "avatar generation refused or failed");
          const blocked = body.error?.code === "moderation_blocked";
          return reply.status(blocked ? 422 : 502).send({
            success: false,
            error: blocked ? "That one wouldn't generate. Try a clearer photo in everyday clothes." : "Couldn't make that just now. Try again in a moment.",
          });
        }
        return { success: true, data: { image } };
      } catch (err) {
        request.log.warn({ err }, "avatar generation failed");
        return reply.status(502).send({ success: false, error: "Couldn't make that just now. Try again in a moment." });
      }
    }
  );
}
