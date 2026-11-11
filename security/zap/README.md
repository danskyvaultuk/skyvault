# ZAP scan harness

A reproducible OWASP ZAP scan of this application, run against a throwaway copy of it on an internal Docker
network. Everything lives under `security/zap/`; nothing under `src/`, `prisma/` or the root configuration is read
or changed by it, and it adds no `package.json` script.

## What it does

`run.sh` runs one sequence:

1. Pulls three images by tag (the Node image, the ZAP image and Postgres) and builds the application image from
   the checked-out source with a dedicated, named builder.
2. Creates an internal Docker network (no published port, no egress), starts a throwaway Postgres on it, applies
   the migrations, and starts the application.
3. Seeds placeholder data (fixed ids, example addresses, no real data) with `seed.mjs`. The seed deletes and
   recreates its own rows, so running it again restores the same state after any scan.
4. Runs six ZAP Automation Framework plans from `plans/`, one per mode: `unauth-baseline`, `unauth-active`,
   `customer-baseline`, `customer-active`, `admin-baseline`, `admin-active`, in that order. A baseline plan spiders
   and waits for the passive scanner. An active plan does the same and then runs ZAP's default active scan policy.
   Each plan first requests the application's API routes once, with placeholder ids, so ZAP knows them. Every spider,
   passive wait and active scan has a time cap in the plan (3, 5 and 20 minutes), and the whole run has an overall
   deadline.
5. For the customer and admin modes, signs a session cookie with a secret generated for this run and generated
   nowhere else, and supplies it to ZAP through its process environment. No cookie or token is ever written to a
   committed file. Before and after each identity's plans, `session-control.mjs` checks that the session endpoint
   answers for that identity and, without the cookie, does not. Between the unauthenticated and authenticated
   modes it also issues a fixed set of cross-account requests with `a01-requests.mjs` and records the status
   codes.
6. Writes `venue.json` (ZAP version, image digests, and per mode its start, duration, ZAP exit code, a memory
   sample and whether a cap was reached) and copies the raw reports out of the ZAP container.
7. Removes, by name, the containers, the Postgres volume, the network and the builder it created, whatever the
   outcome. With `--remove-images` it also removes the images it pulled or built.

A mode that produced no report is recorded as "not run" with a reason, never as a pass or a count, and the run
exits non-zero.

## What it does not do

- It does not scan any deployed instance, any other host or anything outside its own network.
- It does not fix anything. Findings are recorded, not changed.
- It does not install anything on the machine it runs on.
- It does not set the variables the application reads for its social sign-in, its public application URL, its
  hosting-platform URL or its two journey switches (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_APP_URL`,
  `VERCEL_PROJECT_PRODUCTION_URL`, `NEXT_PUBLIC_SKYVAULT_DRONE_JOURNEY`, `NEXT_PUBLIC_SKYVAULT_ROOFER_JOURNEY`).
  The script leaves them unset by omitting them, so the scanned instance runs in its default configuration.
  Every other credential the application needs is a stub value with no real key shape.

## Prerequisites

Docker (a working daemon), `openssl`, and a POSIX `sh`. Run it from the repository root, on a clean export of the
commit to scan (for example the output of `git archive`), so only tracked files are in the build context.

## Running it

    sh security/zap/run.sh                    # run, clean up containers, volume, network and builder
    sh security/zap/run.sh --remove-images    # also remove the images it pulled or built
    SV_ZAP_DEADLINE_MINS=120 sh security/zap/run.sh

`SV_ZAP_DEADLINE_MINS` (default 170) is the overall deadline in minutes. At the deadline the script is sent a
termination signal and its cleanup runs. `SV_ZAP_OUT` overrides the output directory.

## Raw output

Raw output lands in `security/zap/out/`, which is git-ignored: the per-mode ZAP reports (`report-<mode>.json`), the
Automation Framework logs, the HAR of the unauthenticated baseline (`history-unauth-baseline.har`), the session
control and cross-account request records, and `venue.json`.

Raw output can hold request and response text, so it must be redacted before it is shared or committed:

    node security/zap/redact.mjs check <path>...     # exits non-zero when a pattern matches, printing ids only
    node security/zap/redact.mjs redact <in> <out>   # replaces each match with [REDACTED:<pattern id>]

The public pattern list is `patterns.public.json`. An optional private list, one literal per line, is passed with
`--private <file>`; the tool never prints it and it is never committed.

Two helpers shrink the raw output for the record:

    node security/zap/slim-report.mjs <raw report> <mode> <out>   # keeps pluginid, alert, riskdesc, cweid, tags,
                                                                  # count and at most five instance URIs per alert
    node security/zap/gated-status.mjs <har file>                 # status code of each journey-gated path
    node security/zap/har-auth-proof.mjs <har file>               # GET /api/properties answered 200 (authenticated baselines)

## Self-tests

`selftest-redact.mjs`, `selftest-mint.mjs` and `selftest-slim.mjs` build their fixtures at run time in a scratch
directory inside the git directory and remove it afterwards. They are named `selftest-*` so the project's test
runner does not collect them. `selftest-cap.mjs` and `selftest-auth-proof.mjs` assemble their synthetic logs and HARs in memory: the first feeds `cap-reached.awk`, which run.sh uses to read whether a job reached its cap; the second feeds `har-auth-proof.mjs`, the positive control that the customer and admin baselines' own ZAP traffic carried the session cookie (recorded as `authProof` in the mode record; a failure stops the run before that identity's active mode).
