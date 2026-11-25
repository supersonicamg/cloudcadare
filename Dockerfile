# Image for Dokploy (or any Docker host). Steps and settings: plan/17-deploy-dokploy.md.
# One Dockerfile for both apps: build arg APP=academy (default) or APP=console.
# No secrets are needed at build time; every environment variable is read when the container runs.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS build
ARG APP=academy
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# The pnpm version comes from "packageManager" in package.json.
RUN corepack enable
# Download dependencies first, so this layer is reused until the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm --filter "@educore/${APP}" build && mkdir -p "apps/${APP}/public"

FROM base AS runner
ARG APP=academy
ENV APP=${APP} NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
# The standalone output holds the server and only the node_modules it uses; static files are copied beside it.
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build --chown=node:node /repo/apps/${APP}/public ./apps/${APP}/public
USER node
EXPOSE 3000
CMD ["sh", "-c", "exec node apps/$APP/server.js"]
