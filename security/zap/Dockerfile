# App image for the ZAP scan harness. Build from the repository root, from a git archive so that no
# node_modules or .env file enters the context:
#   docker build -f security/zap/Dockerfile .
# No variable from the production configuration is set here: the run script supplies the run-time environment.
FROM node:22-bookworm@sha256:7702d8aa4d5910871692af4480eb3ba86f23047a6417a44d857d06c95d060d3f

WORKDIR /app
COPY . .

RUN corepack enable
RUN pnpm install --frozen-lockfile

# The Docker VM has 4 GB, so the heap cap applies to this step only. The database URLs are build-time
# placeholders naming the internal database host; nothing real, and the build opens no connection.
# The payment, language-model and object-storage variables are build-time stubs too: those clients are
# constructed at import, so the build's page-data step throws without a value. They are not keys, and the
# build opens no connection with them.
RUN NODE_OPTIONS=--max-old-space-size=2560 \
    DATABASE_URL=postgresql://svzap:svzap@sv-zap-db:5432/svzap \
    DIRECT_URL=postgresql://svzap:svzap@sv-zap-db:5432/svzap \
    STRIPE_SECRET_KEY=stub-build-only STRIPE_BASIC_PRICE_ID=stub-build-only STRIPE_PRO_PRICE_ID=stub-build-only \
    ANTHROPIC_API_KEY=stub-build-only AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=stub-build-only \
    AWS_SECRET_ACCESS_KEY=stub-build-only AWS_S3_BUCKET_NAME=stub-build-only \
    pnpm build

EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--port", "3000"]
