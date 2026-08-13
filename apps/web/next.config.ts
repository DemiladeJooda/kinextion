import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// ── Load root monorepo .env so ANTHROPIC_API_KEY etc. reach server code ─────
// Next.js only loads from apps/web/.env* by default; the root .env holds shared
// secrets used by api, web, and mobile. This runs at config-parse time (Node.js)
// using no external dependencies, so it is safe for any environment.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (fs.existsSync(rootEnv)) {
  const lines = fs.readFileSync(rootEnv, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    // Preserve everything after the first `=` (handles DB URLs with embedded `=`)
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["@kinextion/shared", "@kinextion/ui", "@kinextion/ai-core"],
  reactStrictMode: false,
};

export default nextConfig;
