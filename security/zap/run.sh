#!/bin/sh
# ZAP scan harness: build the app image, run the app and a throwaway database on an internal Docker network
# (no published port, no egress), and clean everything up by name on exit.
#   sh security/zap/run.sh [--remove-images]
# Needs docker, openssl and the OS only. Run it from the repository root (a git archive of the commit).
set -eu

SV_ZAP_NET=sv-zap-net
SV_ZAP_DB=sv-zap-db
SV_ZAP_VOLUME=sv-zap-pgdata
SV_ZAP_APP=sv-zap-app
SV_ZAP_ZAP=sv-zap-zap
SV_ZAP_IMAGE=sv-zap-app:local
SV_ZAP_BUILDER=sv-zap-builder
SV_ZAP_OUT="${SV_ZAP_OUT:-security/zap/out}"
SV_ZAP_BUILDKIT_IMAGE=moby/buildkit:buildx-stable-1
SV_ZAP_IMAGES="node:22-bookworm zaproxy/zap-stable postgres:16"
SV_ZAP_DB_URL="postgresql://svzap:svzap@${SV_ZAP_DB}:5432/svzap"

REMOVE_IMAGES=0
for arg in "$@"; do
  case "$arg" in
    --remove-images) REMOVE_IMAGES=1 ;;
    *) echo "run.sh: unknown option $arg" >&2; exit 2 ;;
  esac
done

# The only container launcher: every container the run starts carries the internal network.
sv_run() { docker run --network "$SV_ZAP_NET" "$@"; }

cleanup() {
  status=$?
  trap - EXIT INT TERM
  for name in "$SV_ZAP_ZAP" "$SV_ZAP_APP" "$SV_ZAP_DB"; do
    docker rm -f -v "$name" >/dev/null 2>&1 || true
  done
  docker volume rm "$SV_ZAP_VOLUME" >/dev/null 2>&1 || true
  docker network rm "$SV_ZAP_NET" >/dev/null 2>&1 || true
  docker buildx rm sv-zap-builder >/dev/null 2>&1 || true
  if [ "$REMOVE_IMAGES" -eq 1 ]; then
    for image in "$SV_ZAP_IMAGE" "$SV_ZAP_BUILDKIT_IMAGE" $SV_ZAP_IMAGES; do
      docker rmi "$image" >/dev/null 2>&1 || true
    done
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

pull_images() {
  # On the default network: the internal network has no egress.
  for image in $SV_ZAP_IMAGES; do
    docker pull "$image"
  done
}

build_image() {
  # A dedicated builder, removed by cleanup with its state and cache. It needs egress for the npm registry and
  # fonts, so the build is not on the internal network. The default builder is never touched.
  docker buildx create --name "$SV_ZAP_BUILDER" --driver docker-container
  docker buildx build --builder "$SV_ZAP_BUILDER" --load -t "$SV_ZAP_IMAGE" -f security/zap/Dockerfile .
}

create_network() {
  docker network create --internal "$SV_ZAP_NET"
}

start_db() {
  docker volume create "$SV_ZAP_VOLUME"
  sv_run -d --name "$SV_ZAP_DB" \
    -v "$SV_ZAP_VOLUME":/var/lib/postgresql/data \
    -e POSTGRES_USER=svzap \
    -e POSTGRES_PASSWORD=svzap \
    -e POSTGRES_DB=svzap \
    postgres:16
  tries=0
  until docker exec "$SV_ZAP_DB" pg_isready -U svzap >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -gt 60 ]; then echo "run.sh: database not ready" >&2; return 1; fi
    sleep 2
  done
}

migrate() {
  sv_run --rm \
    -e DATABASE_URL="$SV_ZAP_DB_URL" \
    -e DIRECT_URL="$SV_ZAP_DB_URL" \
    -e CHECKPOINT_DISABLE=1 \
    "$SV_ZAP_IMAGE" node node_modules/prisma/build/index.js migrate deploy
}

start_app() {
  # Variables of the production configuration that must stay unset are omitted here, never passed empty.
  sv_run -d --name "$SV_ZAP_APP" \
    -e DATABASE_URL="$SV_ZAP_DB_URL" \
    -e DIRECT_URL="$SV_ZAP_DB_URL" \
    -e AUTH_SECRET="$AUTH_SECRET" \
    -e AUTH_URL=http://sv-zap-app:3000 \
    -e RESEND_API_KEY= \
    -e AUTH_RESEND_KEY=stub-not-a-key \
    -e RESEND_FROM_EMAIL=noreply@example.test \
    -e SKYVAULT_ADMIN_EMAIL=admin@example.test \
    -e ANTHROPIC_API_KEY=stub-not-a-key \
    -e AWS_REGION=eu-west-2 \
    -e AWS_ACCESS_KEY_ID=stub-not-a-key \
    -e AWS_SECRET_ACCESS_KEY=stub-not-a-key \
    -e AWS_S3_BUCKET_NAME=placeholder-bucket \
    -e STRIPE_SECRET_KEY=stub-not-a-key \
    -e STRIPE_WEBHOOK_SECRET=stub-not-a-key \
    -e STRIPE_BASIC_PRICE_ID=stub-not-a-key \
    -e STRIPE_PRO_PRICE_ID=stub-not-a-key \
    -e CHECKPOINT_DISABLE=1 \
    "$SV_ZAP_IMAGE"
}

wait_for_app() {
  tries=0
  until docker exec "$SV_ZAP_APP" node -e "fetch('http://localhost:3000/api/auth/session').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -gt 60 ]; then echo "run.sh: app not ready" >&2; return 1; fi
    sleep 2
  done
}

# Runs one of the harness scripts in the app image on the internal network, with the throwaway database.
seed() {
  sv_run --rm \
    -e DATABASE_URL="$SV_ZAP_DB_URL" \
    -e DIRECT_URL="$SV_ZAP_DB_URL" \
    -e CHECKPOINT_DISABLE=1 \
    "$SV_ZAP_IMAGE" node security/zap/seed.mjs
}

# mint <seed user> <cookie name>: prints "<cookie name>=<token>", signed with this run's AUTH_SECRET.
mint() {
  sv_run --rm -e AUTH_SECRET="$AUTH_SECRET" "$SV_ZAP_IMAGE" \
    node security/zap/mint-session.mjs --user "$1" --cookie-name "$2"
}

# probe <cookie> <seed user>: exit 0 only when the session endpoint names that user's id and role.
probe() {
  sv_run --rm -e SV_SESSION_COOKIE="$1" "$SV_ZAP_IMAGE" node security/zap/session-control.mjs --probe --user "$2"
}

# The cookie name is settled once, before the A01 requests and before any authenticated plan: the first name
# that opens customer A's session is used by every later mint. When neither does, the run stops.
settle_cookie() {
  for name in authjs.session-token __Secure-authjs.session-token; do
    if cookie="$(mint customerA "$name")" && probe "$cookie" customerA; then
      SV_COOKIE_NAME="$name"
      echo "run.sh: session cookie name settled as $SV_COOKIE_NAME"
      return 0
    fi
  done
  echo "run.sh: neither cookie name opens a session; no A01 request and no authenticated plan will run" >&2
  return 1
}

# session_cookie <customer|admin>: the settled-name cookie for that identity's seeded user.
session_cookie() {
  case "$1" in
    customer) mint customerA "$SV_COOKIE_NAME" ;;
    admin) mint admin "$SV_COOKIE_NAME" ;;
    *) echo "run.sh: unknown identity $1" >&2; return 2 ;;
  esac
}

# session_control <customer|admin> <before|after>: GET /api/auth/session with and without the identity's cookie.
session_control() {
  cookie="$(session_cookie "$1")"
  sv_run --rm -e SV_SESSION_COOKIE="$cookie" "$SV_ZAP_IMAGE" \
    node security/zap/session-control.mjs --identity "$1" --phase "$2" >"$SV_ZAP_OUT/session-control-$1-$2.json"
}

# a01: the cross-account requests. A non-zero exit (a customer-A GET that was not 2xx) stops the run.
a01() {
  cookie_a="$(mint customerA "$SV_COOKIE_NAME")"
  cookie_b="$(mint customerB "$SV_COOKIE_NAME")"
  sv_run --rm -e SV_COOKIE_CUSTOMER_A="$cookie_a" -e SV_COOKIE_CUSTOMER_B="$cookie_b" "$SV_ZAP_IMAGE" \
    node security/zap/a01-requests.mjs >"$SV_ZAP_OUT/a01-requests.json"
}

# The throwaway signing secret exists only in this shell variable, for this run.
AUTH_SECRET="$(openssl rand -base64 32)"
mkdir -p "$SV_ZAP_OUT"

pull_images
build_image
create_network
start_db
migrate
start_app
wait_for_app
