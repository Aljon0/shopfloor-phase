# ShopFloor API. Build context is the repository root (see docker-compose.yml).
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# Install with the lockfile first so this layer is cached until dependencies change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
# The API workspace and the shared package are enough; the web workspace is not needed here.
RUN npm ci --workspace apps/api --workspace packages/shared --include-workspace-root=false --include=dev

COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start. A failed migration stops the container so it is never half-upgraded silently.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npm run start"]
