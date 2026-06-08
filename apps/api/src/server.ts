import Fastify from "fastify";
import cors from "@fastify/cors";
import { userRoutes } from "./modules/users/routes.js";
import { habitRoutes } from "./modules/habits/routes.js";
import { moodRoutes } from "./modules/mood/routes.js";
import { chatRoutes } from "./modules/ai/routes.js";
import { scoreRoutes } from "./modules/score/routes.js";

const PORT = parseInt(process.env.API_PORT || "3001", 10);
const HOST = process.env.API_HOST || "0.0.0.0";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(cors, {
    origin: process.env.NODE_ENV === "production"
      ? ["https://kinextion.com"]
      : true,
    credentials: true,
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // API routes
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(habitRoutes, { prefix: "/api/habits" });
  await app.register(moodRoutes, { prefix: "/api/mood" });
  await app.register(chatRoutes, { prefix: "/api/chat" });
  await app.register(scoreRoutes, { prefix: "/api/score" });

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Kinextion API running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };
