# App image for the ZAP scan harness. Build from the repository root, from a git archive so that no
# node_modules or .env file enters the context:
#   docker build -f security/zap/Dockerfile .
# No variable from the production configuration is set here: the run script supplies the run-time environment.
FROM node:22-bookworm

WORKDIR /app
COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile

# The Docker VM has 4 GB, so the heap cap applies to this step only. The database URLs are build-time
# placeholders naming the internal database host; nothing real, and the build opens no connection.
RUN NODE_OPTIONS=--max-old-space-size=2560 \
    DATABASE_URL=postgresql://svzap:svzap@sv-zap-db:5432/svzap \
    DIRECT_URL=postgresql://svzap:svzap@sv-zap-db:5432/svzap \
    pnpm build

EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--port", "3000"]
