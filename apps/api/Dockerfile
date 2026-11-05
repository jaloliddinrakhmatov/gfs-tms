# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @gfs/api...
COPY apps/api apps/api
RUN pnpm --filter @gfs/api exec prisma generate && pnpm --filter @gfs/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://localhost:4000/api/health || exit 1
# Apply pending migrations, then start the server
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main"]
