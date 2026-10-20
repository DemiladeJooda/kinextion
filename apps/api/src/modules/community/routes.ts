import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodType } from "zod";
import {
  admissionVoteSchema,
  chestProposalSchema,
  commentSchema,
  communityGoalSchema,
  reactionSchema,
  reportSchema,
  submitResponseSchema,
  completeUploadSchema,
  createUploadSchema,
  ballotVoteSchema,
  topicSuggestionSchema,
  chooseActiveCommunitySchema,
  createCommunitySchema,
  fastTrackSchema,
  joinRequestSchema,
} from "@kinextion/shared";
import { chooseActiveCommunity, getMyWeek } from "./cycles.js";
import { callChestVote, getChest, proposeProject } from "./chest.js";
import { getCommunityGoal, setCommunityGoal } from "./goals.js";
import { createCommunityDeps } from "./deps.js";
import { getMyStanding } from "./integrity.js";
import { CommunityError } from "./errors.js";
import { completeUpload, createUpload, playOwnUpload } from "./media.js";
import { getTopic, submitResponse, withdrawResponse } from "./responses.js";
import { getCommunityHistory, getTopicResult } from "./settle.js";
import {
  addComment,
  deleteComment,
  getRoom,
  listComments,
  playResponse,
  reactToResponse,
  reportContent,
  setCommentLike,
} from "./room.js";
import {
  getBallot,
  listCommunityBallots,
  mySuggestions,
  proposeClosure,
  submitSuggestion,
  voteOnBallot,
} from "./topics.js";
import {
  acceptInvite,
  castAdmissionVote,
  createCommunity,
  createInvite,
  fastTrackAdmission,
  getCommunity,
  leaveCommunity,
  listFastTrackCandidates,
  listMyAdmissionSeats,
  listMyCommunities,
  myJoinRequest,
  previewInvite,
  requestToJoin,
  type CommunityDeps,
} from "./service.js";

export interface CommunityRouteOptions {
  /** Tests pass an in-memory store and a manual clock; production uses the defaults. */
  deps?: CommunityDeps;
  /**
   * Registers /dev/* — a movable clock and on-demand maintenance. The server
   * only sets this outside production, and only with COMMUNITY_DEV_TOOLS=1.
   */
  devTools?: boolean;
}

/** Writes that someone could use to spam other people. */
const SOCIAL_WRITE_LIMIT = { rateLimit: { max: 20, timeWindow: "1 minute" } };

export async function communityRoutes(app: FastifyInstance, options: CommunityRouteOptions) {
  const deps: CommunityDeps = options.deps ?? createCommunityDeps({ devTools: options.devTools });

  app.addHook("preHandler", app.requireAuth);

  /**
   * Refusals carry a stable `code` alongside the message so clients can branch
   * on the reason. Anything else goes to the server's handler, which hides
   * internals.
   */
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof CommunityError) {
      return reply
        .status(error.statusCode)
        .send({ success: false, error: error.message, code: error.code });
    }
    throw error;
  });

  function parse<T>(schema: ZodType<T>, body: unknown, reply: FastifyReply): T | undefined {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      reply.status(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
        code: "INVALID",
      });
      return undefined;
    }
    return parsed.data;
  }

  // ── Communities ────────────────────────────────────────────────

  app.get("/communities", async (request) => ({
    success: true,
    data: await listMyCommunities(deps, request.userId),
  }));

  app.post("/communities", { config: SOCIAL_WRITE_LIMIT }, async (request, reply) => {
    const input = parse(createCommunitySchema, request.body, reply);
    if (!input) return reply;
    const data = await createCommunity(deps, request.userId, input);
    return reply.status(201).send({ success: true, data });
  });

  app.get<{ Params: { id: string } }>("/communities/:id", async (request) => ({
    success: true,
    data: await getCommunity(deps, request.userId, request.params.id),
  }));

  app.delete<{ Params: { id: string } }>("/communities/:id/membership", async (request) => ({
    success: true,
    data: await leaveCommunity(deps, request.userId, request.params.id),
  }));

  // ── Founding invites ───────────────────────────────────────────

  app.post<{ Params: { id: string } }>(
    "/communities/:id/invites",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const data = await createInvite(deps, request.userId, request.params.id);
      return reply.status(201).send({ success: true, data });
    }
  );

  app.get<{ Params: { token: string } }>("/invites/:token", async (request) => ({
    success: true,
    data: await previewInvite(deps, request.params.token),
  }));

  app.post<{ Params: { token: string } }>(
    "/invites/:token/accept",
    { config: SOCIAL_WRITE_LIMIT },
    async (request) => ({
      success: true,
      data: await acceptInvite(deps, request.userId, request.params.token),
    })
  );

  // ── Admission ──────────────────────────────────────────────────

  app.post<{ Params: { id: string } }>(
    "/communities/:id/join-requests",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const input = parse(joinRequestSchema, request.body, reply);
      if (!input) return reply;
      const data = await requestToJoin(deps, request.userId, request.params.id, input.note);
      return reply.status(201).send({ success: true, data });
    }
  );

  app.get<{ Params: { id: string } }>("/communities/:id/join-requests/mine", async (request) => ({
    success: true,
    data: await myJoinRequest(deps, request.userId, request.params.id),
  }));

  app.get("/admissions/pending", async (request) => ({
    success: true,
    data: await listMyAdmissionSeats(deps, request.userId),
  }));

  app.post<{ Params: { id: string } }>("/admissions/:id/vote", async (request, reply) => {
    const input = parse(admissionVoteSchema, request.body, reply);
    if (!input) return reply;
    return {
      success: true,
      data: await castAdmissionVote(deps, request.userId, request.params.id, input.verdict),
    };
  });

  app.get<{ Params: { id: string } }>("/communities/:id/fast-track", async (request) => ({
    success: true,
    data: await listFastTrackCandidates(deps, request.userId, request.params.id),
  }));

  app.post<{ Params: { id: string } }>("/admissions/:id/fast-track", async (request, reply) => {
    const input = parse(fastTrackSchema, request.body, reply);
    if (!input) return reply;
    return {
      success: true,
      data: await fastTrackAdmission(deps, request.userId, request.params.id, input.proof),
    };
  });

  // ── The week ───────────────────────────────────────────────────

  app.get("/week", async (request) => ({
    success: true,
    data: await getMyWeek(deps, request.userId),
  }));

  app.put("/week/active", async (request, reply) => {
    const input = parse(chooseActiveCommunitySchema, request.body, reply);
    if (!input) return reply;
    return {
      success: true,
      data: await chooseActiveCommunity(deps, request.userId, input.weekKey, input.communityId),
    };
  });

  // ── Topics & ballots ───────────────────────────────────────────

  app.post<{ Params: { id: string } }>(
    "/cycles/:id/suggestions",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const input = parse(topicSuggestionSchema, request.body, reply);
      if (!input) return reply;
      const data = await submitSuggestion(deps, request.userId, request.params.id, input.text);
      return reply.status(201).send({ success: true, data });
    }
  );

  app.get<{ Params: { id: string } }>("/cycles/:id/suggestions/mine", async (request) => ({
    success: true,
    data: await mySuggestions(deps, request.userId, request.params.id),
  }));

  app.get<{ Params: { id: string } }>("/ballots/:id", async (request) => ({
    success: true,
    data: await getBallot(deps, request.userId, request.params.id),
  }));

  app.post<{ Params: { id: string } }>("/ballots/:id/vote", async (request, reply) => {
    const input = parse(ballotVoteSchema, request.body, reply);
    if (!input) return reply;
    return {
      success: true,
      data: await voteOnBallot(deps, request.userId, request.params.id, input.optionId),
    };
  });

  app.get<{ Params: { id: string } }>("/communities/:id/ballots", async (request) => ({
    success: true,
    data: await listCommunityBallots(deps, request.userId, request.params.id),
  }));

  app.post<{ Params: { id: string } }>(
    "/communities/:id/closure",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const data = await proposeClosure(deps, request.userId, request.params.id);
      return reply.status(201).send({ success: true, data });
    }
  );

  // ── Media ──────────────────────────────────────────────────────

  app.post("/media/uploads", { config: SOCIAL_WRITE_LIMIT }, async (request, reply) => {
    const input = parse(createUploadSchema, request.body, reply);
    if (!input) return reply;
    const data = await createUpload(deps, request.userId, input);
    return reply.status(201).send({ success: true, data });
  });

  app.post<{ Params: { id: string } }>("/media/:id/complete", async (request, reply) => {
    const input = parse(completeUploadSchema, request.body, reply);
    if (!input) return reply;
    return { success: true, data: await completeUpload(deps, request.userId, request.params.id, input) };
  });

  app.get<{ Params: { id: string } }>("/media/:id/playback", async (request) => ({
    success: true,
    data: await playOwnUpload(deps, request.userId, request.params.id),
  }));

  // ── Topics, responses & the gate ───────────────────────────────

  app.get<{ Params: { id: string } }>("/topics/:id", async (request) => ({
    success: true,
    data: await getTopic(deps, request.userId, request.params.id),
  }));

  app.post<{ Params: { id: string } }>(
    "/topics/:id/responses",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const input = parse(submitResponseSchema, request.body, reply);
      if (!input) return reply;
      const data = await submitResponse(deps, request.userId, request.params.id, input);
      return reply.status(201).send({ success: true, data });
    }
  );

  app.delete<{ Params: { id: string } }>("/responses/:id", async (request) => ({
    success: true,
    data: await withdrawResponse(deps, request.userId, request.params.id),
  }));

  // ── The reveal & history ───────────────────────────────────────

  app.get<{ Params: { id: string } }>("/topics/:id/result", async (request) => ({
    success: true,
    data: await getTopicResult(deps, request.userId, request.params.id),
  }));

  app.get<{ Params: { id: string } }>("/communities/:id/history", async (request) => ({
    success: true,
    data: await getCommunityHistory(deps, request.userId, request.params.id),
  }));

  // ── The room ───────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>("/topics/:id/room", async (request) => ({
    success: true,
    data: await getRoom(deps, request.userId, request.params.id),
  }));

  app.get<{ Params: { id: string } }>("/responses/:id/playback", async (request) => ({
    success: true,
    data: await playResponse(deps, request.userId, request.params.id),
  }));

  app.put<{ Params: { id: string } }>("/responses/:id/reaction", async (request, reply) => {
    const input = parse(reactionSchema, request.body, reply);
    if (!input) return reply;
    return {
      success: true,
      data: await reactToResponse(deps, request.userId, request.params.id, input.verdict),
    };
  });

  app.get<{ Params: { id: string } }>("/responses/:id/comments", async (request) => ({
    success: true,
    data: await listComments(deps, request.userId, request.params.id),
  }));

  app.post<{ Params: { id: string } }>(
    "/responses/:id/comments",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const input = parse(commentSchema, request.body, reply);
      if (!input) return reply;
      const data = await addComment(deps, request.userId, request.params.id, input);
      return reply.status(201).send({ success: true, data });
    }
  );

  app.put<{ Params: { id: string } }>("/comments/:id/like", async (request) => ({
    success: true,
    data: await setCommentLike(deps, request.userId, request.params.id, true),
  }));

  app.delete<{ Params: { id: string } }>("/comments/:id/like", async (request) => ({
    success: true,
    data: await setCommentLike(deps, request.userId, request.params.id, false),
  }));

  app.delete<{ Params: { id: string } }>("/comments/:id", async (request) => ({
    success: true,
    data: await deleteComment(deps, request.userId, request.params.id),
  }));

  app.post<{ Params: { id: string } }>(
    "/responses/:id/report",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const input = parse(reportSchema, request.body, reply);
      if (!input) return reply;
      const data = await reportContent(deps, request.userId, { responseId: request.params.id }, input);
      return reply.status(201).send({ success: true, data });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/comments/:id/report",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const input = parse(reportSchema, request.body, reply);
      if (!input) return reply;
      const data = await reportContent(deps, request.userId, { commentId: request.params.id }, input);
      return reply.status(201).send({ success: true, data });
    }
  );

  // ── Standing & chest ───────────────────────────────────────────

  app.get("/me/standing", async (request) => ({
    success: true,
    data: await getMyStanding(deps, request.userId),
  }));

  app.get<{ Params: { id: string } }>("/communities/:id/chest", async (request) => ({
    success: true,
    data: await getChest(deps, request.userId, request.params.id),
  }));

  app.post<{ Params: { id: string } }>(
    "/communities/:id/chest/proposals",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const input = parse(chestProposalSchema, request.body, reply);
      if (!input) return reply;
      const data = await proposeProject(deps, request.userId, request.params.id, input);
      return reply.status(201).send({ success: true, data });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/communities/:id/chest/ballot",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const data = await callChestVote(deps, request.userId, request.params.id);
      return reply.status(201).send({ success: true, data });
    }
  );

  // ── Goals ──────────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>("/communities/:id/goal", async (request) => ({
    success: true,
    data: await getCommunityGoal(deps, request.userId, request.params.id),
  }));

  app.post<{ Params: { id: string } }>(
    "/communities/:id/goal",
    { config: SOCIAL_WRITE_LIMIT },
    async (request, reply) => {
      const input = parse(communityGoalSchema, request.body, reply);
      if (!input) return reply;
      const data = await setCommunityGoal(deps, request.userId, request.params.id, input);
      return reply.status(201).send({ success: true, data });
    }
  );
}
