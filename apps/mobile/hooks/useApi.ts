/**
 * Binds the signed-in user's Clerk session token to the data API service
 * functions, so screens call `api.listHabits()` instead of threading a token
 * through every call site.
 */

import { useMemo } from "react";
import { useAuth } from "@clerk/clerk-expo";
import * as api from "../services";
import { DEMO_MODE } from "../lib/demo/session";
import { demoApi } from "../lib/demo/api";

export type Api = ReturnType<typeof useLiveApi>;

/** Demo mode swaps in sample data; the flag is fixed at build time. */
export const useApi: () => Api = DEMO_MODE ? () => demoApi : useLiveApi;

function useLiveApi() {
  const { getToken } = useAuth();

  return useMemo(() => {
    const withToken = async <T>(
      fn: (token: string | null) => Promise<T>,
    ): Promise<T> => {
      const token = await getToken();
      return fn(token);
    };

    return {
      getMyProfile: () => withToken(api.getMyProfile),
      completeOnboarding: (input: api.OnboardingInput) =>
        withToken((token) => api.completeOnboarding(token, input)),
      updateProfile: (input: api.UpdateProfileInput) =>
        withToken((token) => api.updateProfile(token, input)),
      getDataSummary: () => withToken(api.getDataSummary),
      deleteAccount: () => withToken(api.deleteAccount),

      listHabits: (includeArchived?: boolean) =>
        withToken((token) => api.listHabits(token, includeArchived)),
      createHabit: (input: api.CreateHabitInput) =>
        withToken((token) => api.createHabit(token, input)),
      updateHabit: (id: string, input: api.UpdateHabitInput) =>
        withToken((token) => api.updateHabit(token, id, input)),
      archiveHabit: (id: string) =>
        withToken((token) => api.archiveHabit(token, id)),
      restoreHabit: (id: string) =>
        withToken((token) => api.restoreHabit(token, id)),
      undoChatAction: (undo: Record<string, unknown>) =>
        withToken((token) => api.undoChatAction(token, undo)),
      logHabit: (input: api.LogHabitInput) =>
        withToken((token) => api.logHabit(token, input)),
      reflectOnMiss: (
        habitId: string,
        input: { missedOn: string; answer?: string; skipped?: boolean },
      ) => withToken((token) => api.reflectOnMiss(token, habitId, input)),
      applyReflection: (id: string) =>
        withToken((token) => api.applyReflection(token, id)),
      listReflections: () => withToken(api.listReflections),
      precommit: (habitId: string, input: { forDate: string; text: string }) =>
        withToken((token) => api.precommit(token, habitId, input)),
      listPrecommitments: () => withToken(api.listPrecommitments),
      submitAutomaticity: (habitId: string, items: number[]) =>
        withToken((token) => api.submitAutomaticity(token, habitId, items)),
      listAutomaticity: () => withToken(api.listAutomaticity),
      listHabitLogs: (range?: { from?: string; to?: string }) =>
        withToken((token) => api.listHabitLogs(token, range)),

      suggestHabits: (input?: { focus?: string; count?: number }) =>
        withToken((token) => api.suggestHabits(token, input)),
      discoverHabits: (turns: api.DiscoverTurn[]) =>
        withToken((token) => api.discoverHabits(token, turns)),

      logWorkout: (input: api.LogWorkoutInput) =>
        withToken((token) => api.logWorkout(token, input)),
      listWorkouts: (limit?: number) =>
        withToken((token) => api.listWorkouts(token, limit)),

      createMoodEntry: (input: api.CreateMoodEntryInput) =>
        withToken((token) => api.createMoodEntry(token, input)),
      listMoodEntries: (limit?: number) =>
        withToken((token) => api.listMoodEntries(token, limit)),
      getLatestMood: () => withToken(api.getLatestMood),

      getTodayCheckIn: () => withToken(api.getTodayCheckIn),
      submitCheckIn: (input: api.CheckInInput) =>
        withToken((token) => api.submitCheckIn(token, input)),
      getCheckInPrompt: () => withToken(api.getCheckInPrompt),

      getTodayRecommendation: () => withToken(api.getTodayRecommendation),
      requestRecommendation: (options?: { refresh?: boolean }) =>
        withToken((token) => api.requestRecommendation(token, options)),
      chooseRecommendation: (id: string, option: "primary" | "alternative") =>
        withToken((token) => api.chooseRecommendation(token, id, option)),
      sendRecommendationFeedback: (
        id: string,
        outcome: "acted" | "dismissed",
      ) =>
        withToken((token) =>
          api.sendRecommendationFeedback(token, id, outcome),
        ),
      listRecommendations: (limit?: number) =>
        withToken((token) => api.listRecommendations(token, limit)),

      getTodayScore: () => withToken(api.getTodayScore),
      getScoreHistory: (days?: number) =>
        withToken((token) => api.getScoreHistory(token, days)),
      getPeriodScore: () => withToken(api.getPeriodScore),
      getNearbyGroups: (params?: Parameters<typeof api.getNearbyGroups>[1]) =>
        withToken((token) => api.getNearbyGroups(token, params)),

      listIntegrations: () => withToken(api.listIntegrations),
      startConnect: (provider: api.IntegrationProvider) =>
        withToken((token) => api.startConnect(token, provider)),
      disconnectIntegration: (provider: api.IntegrationProvider) =>
        withToken((token) => api.disconnectIntegration(token, provider)),
      syncIntegration: (provider: api.IntegrationProvider) =>
        withToken((token) => api.syncIntegration(token, provider)),
      listMetrics: (filter?: { type?: string; from?: string; to?: string }) =>
        withToken((token) => api.listMetrics(token, filter)),
      listPatterns: () => withToken(api.listPatterns),

      getTherapistConsent: () => withToken(api.getTherapistConsent),
      updateTherapistConsent: (categories: api.TherapistCategories) =>
        withToken((token) => api.updateTherapistConsent(token, categories)),
      revokeTherapistConsent: () => withToken(api.revokeTherapistConsent),
      generateTherapistReport: (days?: number) =>
        withToken((token) => api.generateTherapistReport(token, days)),
      listTherapistReports: () => withToken(api.listTherapistReports),
      getTherapistReport: (id: string) =>
        withToken((token) => api.getTherapistReport(token, id)),

      // ── Community ──────────────────────────────────────────────────────────
      getDiscover: (seed: string) =>
        withToken((token) => api.getDiscover(token, seed)),
      getDiscoverResponse: (responseId: string, seed: string) =>
        withToken((token) => api.getDiscoverResponse(token, responseId, seed)),
      getMyWeek: () => withToken(api.getMyWeek),
      chooseActiveCommunity: (weekKey: string, communityId: string | null) =>
        withToken((token) =>
          api.chooseActiveCommunity(token, weekKey, communityId),
        ),
      listMyCommunities: () => withToken(api.listMyCommunities),
      getCommunity: (id: string) =>
        withToken((token) => api.getCommunity(token, id)),
      getCommunityHistory: (id: string) =>
        withToken((token) => api.getCommunityHistory(token, id)),
      getChest: (id: string) => withToken((token) => api.getChest(token, id)),
      getCommunityGoal: (id: string) =>
        withToken((token) => api.getCommunityGoal(token, id)),
      setCommunityGoal: (id: string, input: api.CommunityGoalInput) =>
        withToken((token) => api.setCommunityGoal(token, id, input)),
      listMyAdmissionSeats: () => withToken(api.listMyAdmissionSeats),
      castAdmissionVote: (
        joinRequestId: string,
        verdict: api.AdmissionVerdict,
      ) =>
        withToken((token) =>
          api.castAdmissionVote(token, joinRequestId, verdict),
        ),

      suggestTopic: (cycleId: string, text: string) =>
        withToken((token) => api.suggestTopic(token, cycleId, text)),
      getMySuggestions: (cycleId: string) =>
        withToken((token) => api.getMySuggestions(token, cycleId)),
      getBallot: (ballotId: string) =>
        withToken((token) => api.getBallot(token, ballotId)),
      voteOnBallot: (ballotId: string, optionId: string) =>
        withToken((token) => api.voteOnBallot(token, ballotId, optionId)),

      getTopic: (topicId: string) =>
        withToken((token) => api.getTopic(token, topicId)),
      getRoom: (topicId: string) =>
        withToken((token) => api.getRoom(token, topicId)),
      getTopicResult: (topicId: string) =>
        withToken((token) => api.getTopicResult(token, topicId)),
      getResponsePlayback: (responseId: string) =>
        withToken((token) => api.getResponsePlayback(token, responseId)),
      reactToResponse: (responseId: string, verdict: api.ReactionVerdict) =>
        withToken((token) => api.reactToResponse(token, responseId, verdict)),
      listComments: (responseId: string) =>
        withToken((token) => api.listComments(token, responseId)),
      addComment: (
        responseId: string,
        input: { body: string; parentId?: string },
      ) => withToken((token) => api.addComment(token, responseId, input)),
      likeComment: (commentId: string, liked: boolean) =>
        withToken((token) => api.likeComment(token, commentId, liked)),
      reportResponse: (
        responseId: string,
        input: { reason: string; note?: string },
      ) => withToken((token) => api.reportResponse(token, responseId, input)),
      withdrawResponse: (responseId: string) =>
        withToken((token) => api.withdrawResponse(token, responseId)),
      getMyStanding: () => withToken(api.getMyStanding),

      uploadRecording: (
        recording: api.LocalRecording,
        onProgress?: (fraction: number) => void,
      ) =>
        withToken((token) => api.uploadRecording(token, recording, onProgress)),
      submitResponse: (
        topicId: string,
        input: {
          mediaId: string;
          visibility: "community" | "public_after_close";
        },
      ) => withToken((token) => api.submitResponse(token, topicId, input)),
    };
  }, [getToken]);
}
