# Kinextion API. Build from the repository root:
#
#   docker build -f apps/api/Dockerfile -t kinextion-api .
#
# Works on any container host (Railway, Render, Fly, ECS). The server listens
# on API_PORT (default 3001) and needs the environment in DEPLOYMENT.md.

FROM node:20-slim AS build
# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# Install only what the API and its workspace packages need, cached by lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY packages/ai-core/package.json packages/ai-core/
RUN pnpm install --frozen-lockfile --filter "@kinextion/api..."

COPY tsconfig.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @kinextion/database generate && pnpm --filter @kinextion/api build

FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
