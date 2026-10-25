import type { TopicGenerator } from "@kinextion/ai-core";
import { generateStructured } from "../ai/services/ai-service.js";
import { asAIUser } from "../../lib/ai-usage.js";

/**
 * The production model call behind Kairo's topic synthesis. A forced tool
 * call, so the answer is always the structured options and never prose.
 * The whole community's work, so it's charged to no one in particular, even
 * when a member's request happens to trigger it.
 */
export const generateTopicsWithClaude: TopicGenerator = ({ system, user, schema }) =>
  asAIUser(null, () =>
    generateStructured({
      task: "community",
      system,
      messages: [{ role: "user", content: user }],
      toolName: "propose_topics",
      toolDescription: "Propose this week's topic options for the community to vote on.",
      inputSchema: schema,
    })
  );
