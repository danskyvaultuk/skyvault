// Prints the status code each journey-gated path answered in the unauth-baseline run.
//   node gated-status.mjs <har file>
// One line per gated path, "<path> <status>", read from the HAR the plan exports. Exits non-zero when the HAR
// cannot be read or any of the 8 paths has no entry in it.
import { readFileSync } from 'node:fs';

const GATED_PATHS = [
  '/api/drone-jobs',
  '/api/drone-jobs/svzap-dronejob-unseeded',
  '/api/stripe/drone-checkout',
  '/api/leads',
  '/api/leads/svzap-lead-s2/claim',
  '/api/roofer/profile',
  '/api/stripe/checkout',
  '/api/stripe/portal',
];

const harPath = process.argv[2];
if (!harPath || process.argv.length > 3) {
  console.error('usage: gated-status.mjs <har file>');
  process.exit(2);
}

let entries;
try {
  entries = JSON.parse(readFileSync(harPath, 'utf8')).log.entries;
} catch (error) {
  console.error(`gated-status: cannot read entries from ${harPath}: ${error.message}`);
  process.exit(1);
}
if (!Array.isArray(entries)) {
  console.error('gated-status: the HAR has no entry list');
  process.exit(1);
}

function pathOf(entry) {
  try {
    return new URL(entry.request.url).pathname;
  } catch {
    return null;
  }
}

let missing = 0;
for (const path of GATED_PATHS) {
  const entry = entries.find((candidate) => pathOf(candidate) === path && candidate.request.method === 'GET');
  if (!entry) {
    console.error(`gated-status: no GET entry for ${path}`);
    missing += 1;
    continue;
  }
  console.log(`${path} ${entry.response.status}`);
}
process.exit(missing === 0 ? 0 : 1);
