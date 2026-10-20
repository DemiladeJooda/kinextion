import type { TopicGenerator } from "@kinextion/ai-core";
import { generateStructured } from "../ai/services/ai-service.js";

/**
 * The production model call behind Kairo's topic synthesis. A forced tool
 * call, so the answer is always the structured options and never prose.
 */
export const generateTopicsWithClaude: TopicGenerator = ({ system, user, schema }) =>
  generateStructured({
    system,
    messages: [{ role: "user", content: user }],
    toolName: "propose_topics",
    toolDescription: "Propose this week's topic options for the community to vote on.",
    inputSchema: schema,
  });
