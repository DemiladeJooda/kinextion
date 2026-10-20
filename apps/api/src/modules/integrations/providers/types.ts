export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  externalUserId: string | null;
  scopes: string[];
}

export interface WearableMetricInput {
  /** e.g. "steps" | "sleep_duration" | "sleep_score" | "hrv" | "resting_heart_rate" | "workout" */
  metricType: string;
  /** YYYY-MM-DD */
  date: string;
  value: number;
  unit?: string;
  raw?: Record<string, unknown>;
}

export interface ProviderAdapter {
  id: string;
  /** False when this provider's client id/secret haven't been set — the
   * integration is built, just not switched on for lack of credentials. */
  isConfigured(): boolean;
  getAuthorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refresh(refreshToken: string): Promise<OAuthTokens>;
  fetchMetrics(accessToken: string, since: Date): Promise<WearableMetricInput[]>;
}
