# Build context: repository root. Railway: set RAILWAY_DOCKERFILE_PATH=apps/scas-worker/Dockerfile.
FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@f2f/scas-worker..."
RUN pnpm --filter @f2f/scas-worker run build
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "apps/scas-worker/dist/main.cjs", "serve"]
