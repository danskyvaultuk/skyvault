#!/bin/sh
# ZAP scan harness: build the app image, run the app and a throwaway database on an internal Docker network
# (no published port, no egress), and clean everything up by name on exit.
#   sh security/zap/run.sh [--remove-images]
# SV_ZAP_DEADLINE_MINS (default 170) bounds the whole run: at the deadline the script is sent TERM and cleans up.
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
SV_ZAP_DEADLINE_MINS="${SV_ZAP_DEADLINE_MINS:-170}"
SV_ZAP_MODES="unauth-baseline unauth-active customer-baseline customer-active admin-baseline admin-active"
SV_ZAP_SPIDER_CAP_MINS=3
SV_ZAP_PASSIVE_CAP_MINS=5
SV_ZAP_ACTIVE_CAP_MINS=20
SV_ZAP_TIMER=""
SV_ZAP_STOP_REASON="not reached"
SV_ZAP_MISSING=0
SV_COOKIE_NAME=""
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
  if [ -n "$SV_ZAP_TIMER" ]; then kill "$SV_ZAP_TIMER" >/dev/null 2>&1 || true; fi
  if write_venue && [ "$status" -eq 0 ] && [ "$SV_ZAP_MISSING" -gt 0 ]; then status=1; fi
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
  docker buildx inspect sv-zap-builder >/dev/null 2>&1 || docker buildx create --name "$SV_ZAP_BUILDER" --driver docker-container
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

# A background timer sends TERM to this script at the overall deadline, so the trap still cleans up by name.
# It is killed on a normal exit by cleanup.
start_deadline() {
  parent=$$
  deadline=$(( $(date +%s) + SV_ZAP_DEADLINE_MINS * 60 ))
  (
    while [ "$(date +%s)" -lt "$deadline" ]; do sleep 5; done
    echo "run.sh: overall deadline of $SV_ZAP_DEADLINE_MINS minutes reached" >&2
    kill -TERM "$parent"
  ) >/dev/null 2>&1 &
  SV_ZAP_TIMER=$!
}

# ZAP runs as one long-lived container; each mode is a docker exec of the Automation Framework in it.
start_zap() {
  sv_run -d --name "$SV_ZAP_ZAP" --entrypoint sleep zaproxy/zap-stable $(( SV_ZAP_DEADLINE_MINS * 60 + 600 ))
  docker exec "$SV_ZAP_ZAP" mkdir -p /zap/wrk/out /zap/wrk/plans
  docker exec "$SV_ZAP_ZAP" zap.sh -cmd -silent -version 2>/dev/null | tail -n 1 >"$SV_ZAP_OUT/zap-version.txt"
}

# scan <mode>: copy the plan in, run it on a fresh session, record start, duration, exit code, a memory sample
# and whether a cap was reached, then copy the report (and any HAR) out. A ZAP exit other than 0 or 2 (2 is the
# Automation Framework's "warnings") or a missing report stops the run, so the trap cleans up.
scan() {
  mode="$1"
  docker cp "security/zap/plans/$mode.yaml" "$SV_ZAP_ZAP:/zap/wrk/plans/$mode.yaml"
  started=$(date +%s)
  rc=0
  if [ "$mode" = "${mode#unauth}" ]; then
    cookie="$(session_cookie "${mode%%-*}")"
    # ZAP 2.17.0 does not expand ${SV_SESSION_COOKIE} in a replacer rule, so the plan is rendered with the real
    # cookie inside the ZAP container (value from the environment, never argv; nothing lands on the host's disk).
    docker cp security/zap/render-plan.sh "$SV_ZAP_ZAP:/zap/wrk/render-plan.sh"
    docker exec "$SV_ZAP_ZAP" mkdir -p /zap/wrk/rendered
    SV_SESSION_COOKIE="$cookie" docker exec -e SV_SESSION_COOKIE "$SV_ZAP_ZAP" \
      sh /zap/wrk/render-plan.sh "/zap/wrk/plans/$mode.yaml" "/zap/wrk/rendered/$mode.yaml" \
      || { echo "run.sh: could not render the $mode plan with the session cookie" >&2; exit 1; }
    if docker exec "$SV_ZAP_ZAP" grep -qF '${SV_SESSION_COOKIE}' "/zap/wrk/rendered/$mode.yaml"; then
      echo "run.sh: the rendered $mode plan still holds the literal cookie token" >&2
      exit 1
    fi
    docker exec "$SV_ZAP_ZAP" \
      zap.sh -cmd -silent -newsession "/zap/wrk/session-$mode" -autorun "/zap/wrk/rendered/$mode.yaml" \
      >"$SV_ZAP_OUT/zap-$mode.log" 2>&1 &
  else
    docker exec "$SV_ZAP_ZAP" \
      zap.sh -cmd -silent -newsession "/zap/wrk/session-$mode" -autorun "/zap/wrk/plans/$mode.yaml" \
      >"$SV_ZAP_OUT/zap-$mode.log" 2>&1 &
  fi
  zap_pid=$!
  # One memory sample while the mode is running. Backgrounded and waited on, so a TERM is not held up by it.
  sleep 45 &
  nap=$!
  wait "$nap" || true
  if kill -0 "$zap_pid" 2>/dev/null; then
    docker stats --no-stream --format '{{json .}}' "$SV_ZAP_ZAP" "$SV_ZAP_APP" "$SV_ZAP_DB" >"$SV_ZAP_OUT/stats-$mode.jsonl" 2>/dev/null || true
  fi
  wait "$zap_pid" || rc=$?
  seconds=$(( $(date +%s) - started ))
  produced=no
  if docker cp "$SV_ZAP_ZAP:/zap/wrk/out/report-$mode.json" "$SV_ZAP_OUT/report-$mode.json" 2>/dev/null; then produced=yes; fi
  docker cp "$SV_ZAP_ZAP:/zap/wrk/out/history-$mode.har" "$SV_ZAP_OUT/history-$mode.har" 2>/dev/null || true
  # Positive control for the authenticated baselines: ZAP's own traffic must have been answered as the identity.
  proof=n/a
  case "$mode" in
    customer-baseline|admin-baseline)
      proof=failed
      if [ -f "$SV_ZAP_OUT/history-$mode.har" ] \
        && proof_line="$(sv_run --rm -i "$SV_ZAP_IMAGE" node security/zap/har-auth-proof.mjs - <"$SV_ZAP_OUT/history-$mode.har")"; then
        proof="$proof_line"
      fi ;;
  esac
  cap=no
  # Whether a job reached its cap is read from the job's own "time taken" line (security/zap/cap-reached.awk).
  if [ -f "$SV_ZAP_OUT/zap-$mode.log" ]; then
    cap="$(awk -v spider=$(( SV_ZAP_SPIDER_CAP_MINS * 60 )) -v passive=$(( SV_ZAP_PASSIVE_CAP_MINS * 60 )) \
      -v active=$(( SV_ZAP_ACTIVE_CAP_MINS * 60 )) -f security/zap/cap-reached.awk "$SV_ZAP_OUT/zap-$mode.log")"
  fi
  if [ "$mode" != "${mode%-active}" ] && [ "$seconds" -ge $(( SV_ZAP_ACTIVE_CAP_MINS * 60 )) ]; then cap=yes; fi
  printf '{ "mode": "%s", "startedEpoch": %s, "durationSeconds": %s, "zapExit": %s, "reportProduced": "%s", "capReached": "%s", "authProof": "%s" }\n' \
    "$mode" "$started" "$seconds" "$rc" "$produced" "$cap" "$proof" >"$SV_ZAP_OUT/mode-$mode.json"
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ]; then
    SV_ZAP_STOP_REASON="$mode: ZAP exited $rc"
    echo "run.sh: $SV_ZAP_STOP_REASON; the remaining steps are skipped" >&2
    return 1
  fi
  if [ "$proof" = failed ]; then
    SV_ZAP_STOP_REASON="$mode: ZAP traffic for ${mode%-baseline} was not authenticated"
    echo "run.sh: $SV_ZAP_STOP_REASON; the remaining steps are skipped" >&2
    return 1
  fi
  if [ "$produced" != yes ]; then
    SV_ZAP_STOP_REASON="$mode: no report produced"
    echo "run.sh: $SV_ZAP_STOP_REASON; the remaining steps are skipped" >&2
    return 1
  fi
}

# image_record <image>: the image id and its registry digest when it has one.
image_record() {
  id="$(docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || echo unknown)"
  digest="$(docker image inspect --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$1" 2>/dev/null || true)"
  printf '"%s": { "id": "%s", "repoDigest": "%s" }' "$1" "$id" "${digest:-none}"
}

# write_venue: venue.json records the ZAP version, the image digests and every mode's timing, exit code, memory
# sample and cap. A mode with no report is recorded "not run" with the reason, never as a pass or a count. Sets
# SV_ZAP_MISSING to the number of modes that did not run. Called by cleanup, so it also runs on a stop.
write_venue() {
  [ -d "$SV_ZAP_OUT" ] || return 1
  SV_ZAP_MISSING=0
  zap_version="$(cat "$SV_ZAP_OUT/zap-version.txt" 2>/dev/null || true)"
  {
    printf '{\n  "venue": "operator'"'"'s Mac",\n  "zapVersion": "%s",\n  "images": {\n' "${zap_version:-unknown}"
    sep=""
    for image in "$SV_ZAP_IMAGE" $SV_ZAP_IMAGES; do
      printf '%s    ' "$sep"
      image_record "$image"
      sep=$',\n'
    done
    printf '\n  },\n  "modes": [\n'
    sep=""
    for mode in $SV_ZAP_MODES; do
      if [ -f "$SV_ZAP_OUT/mode-$mode.json" ] && grep -q '"reportProduced": "yes"' "$SV_ZAP_OUT/mode-$mode.json"; then
        samples="$(paste -sd, "$SV_ZAP_OUT/stats-$mode.jsonl" 2>/dev/null || true)"
        printf '%s    { "record": %s, "memorySamples": [%s] }' "$sep" "$(cat "$SV_ZAP_OUT/mode-$mode.json")" "$samples"
      else
        SV_ZAP_MISSING=$((SV_ZAP_MISSING + 1))
        printf '%s    { "mode": "%s", "status": "not run", "reason": "%s" }' "$sep" "$mode" "$SV_ZAP_STOP_REASON"
      fi
      sep=$',\n'
    done
    printf '\n  ]\n}\n'
  } >"$SV_ZAP_OUT/venue.json"
}

# Every top-level step sits below every function definition, so the cleanup trap can call write_venue whenever
# it fires, and the overall deadline covers the pull and the build too.
# The throwaway signing secret exists only in this shell variable, for this run.
AUTH_SECRET="$(openssl rand -base64 32)"
mkdir -p "$SV_ZAP_OUT"
start_deadline
pull_images
build_image
create_network
start_db
migrate
start_app
wait_for_app
start_zap

# The run sequence: a flat block of calls, one per line.
# sequence:begin
seed
scan unauth-baseline
scan unauth-active
settle_cookie
seed
a01
seed
session_control customer before
scan customer-baseline
scan customer-active
session_control customer after
seed
session_control admin before
scan admin-baseline
scan admin-active
session_control admin after
# sequence:end
