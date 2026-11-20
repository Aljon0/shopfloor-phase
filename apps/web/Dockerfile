# ShopFloor web. Build context is the repository root (see docker-compose.yml).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace apps/web --workspace packages/shared --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/web apps/web
# The Docker build always talks to the real API (same origin, /api). Fonts are bundled, so no internet is needed at runtime.
ENV VITE_DATA_SOURCE=api
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
