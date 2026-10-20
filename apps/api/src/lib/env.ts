/**
 * Environment validation.
 *
 * Checked once at boot so a missing secret is a startup failure with a clear
 * message, rather than a 500 the first time a user touches the feature that
 * needed it. Production is stricter than development on purpose: a dev
 * machine without Strava credentials should still run.
 */

interface EnvRule {
  name: string;
  /** Why it's needed, shown when it's missing. */
  purpose: string;
  /** Required in every environment, or only in production. */
  productionOnly?: boolean;
}

const REQUIRED: EnvRule[] = [
  { name: "DATABASE_URL", purpose: "Postgres connection" },
  { name: "CLERK_SECRET_KEY", purpose: "verifying user sessions" },
  { name: "CLERK_PUBLISHABLE_KEY", purpose: "Clerk client configuration" },
  { name: "ANTHROPIC_API_KEY", purpose: "the AI guides" },
  {
    name: "INTEGRATIONS_ENCRYPTION_KEY",
    purpose: "encrypting stored OAuth tokens",
  },
  {
    name: "API_PUBLIC_URL",
    purpose: "building OAuth redirect URLs that providers can reach",
    productionOnly: true,
  },
  {
    name: "WEB_ORIGIN",
    purpose: "the CORS allowlist",
    productionOnly: true,
  },
];

/** Keys that would weaken security if left at a development value. */
const PRODUCTION_FORBIDDEN: Array<{ name: string; badPrefix: string; why: string }> = [
  {
    name: "CLERK_SECRET_KEY",
    badPrefix: "sk_test_",
    why: "this is a Clerk test key — production needs a live key",
  },
  {
    name: "CLERK_PUBLISHABLE_KEY",
    badPrefix: "pk_test_",
    why: "this is a Clerk test key — production needs a live key",
  },
];

export interface ValidatedEnv {
  isProduction: boolean;
  port: number;
  host: string;
  /** Origins allowed to call the API with credentials. */
  corsOrigins: string[] | true;
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): ValidatedEnv {
  const isProduction = env.NODE_ENV === "production";
  const problems: string[] = [];

  for (const rule of REQUIRED) {
    if (rule.productionOnly && !isProduction) continue;
    if (!env[rule.name]?.trim()) {
      problems.push(`  ${rule.name} — required for ${rule.purpose}`);
    }
  }

  if (isProduction) {
    for (const rule of PRODUCTION_FORBIDDEN) {
      if (env[rule.name]?.startsWith(rule.badPrefix)) {
        problems.push(`  ${rule.name} — ${rule.why}`);
      }
    }

    const key = env.INTEGRATIONS_ENCRYPTION_KEY ?? "";
    // 32 hex bytes is what the documented generator produces; anything much
    // shorter is a placeholder someone forgot to replace.
    if (key && key.length < 32) {
      problems.push(
        "  INTEGRATIONS_ENCRYPTION_KEY — too short; generate 32 bytes (see .env.example)"
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Cannot start: ${problems.length} environment problem(s).\n\n${problems.join("\n")}\n\n` +
        `See .env.example for the full list.`
    );
  }

  return {
    isProduction,
    port: parseInt(env.API_PORT || "3001", 10),
    host: env.API_HOST || "0.0.0.0",
    corsOrigins: isProduction
      ? (env.WEB_ORIGIN ?? "").split(",").map((o) => o.trim()).filter(Boolean)
      : true,
  };
}
