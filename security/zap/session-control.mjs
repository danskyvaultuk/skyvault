// Session positive control: GET /api/auth/session with the minted cookie and, for a control, once without it.
//   node session-control.mjs --identity <customer|admin> --phase <before|after>
//   node session-control.mjs --probe --user <customerA|customerB|admin>
// The cookie ("<name>=<token>") comes from SV_SESSION_COOKIE and is sent as a request header. A control writes
// session-control-<identity>-<phase>.json (into SV_ZAP_OUT_DIR, default the working directory) and prints the same
// JSON; it holds the cookie name only, never its value and never response headers. It exits non-zero when the
// with-cookie body does not name the seeded user's id and role. --probe sends only the with-cookie request, writes
// nothing and prints nothing, and exits 0 only when the body names the given user's id and role.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEED } from './seed.mjs';

const BASE_URL = process.env.SV_ZAP_APP_URL ?? 'http://sv-zap-app:3000';
const IDENTITY_USERS = { customer: 'customerA', admin: 'admin' };

function usage() {
  console.error('usage: session-control.mjs --identity <customer|admin> --phase <before|after> | --probe --user <key>');
  process.exit(2);
}

function parseArgs(argv) {
  const options = { probe: false };
  for (let i = 0; i < argv.length; ) {
    if (argv[i] === '--probe') {
      options.probe = true;
      i += 1;
      continue;
    }
    const name = argv[i];
    const value = argv[i + 1];
    if (!['--identity', '--phase', '--user'].includes(name) || !value) usage();
    options[name.slice(2)] = value;
    i += 2;
  }
  return options;
}

async function getSession(cookie) {
  try {
    const response = cookie ? await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie } }) : await fetch(`${BASE_URL}/api/auth/session`);
    const text = await response.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body };
  } catch (error) {
    return { status: null, body: `request failed: ${error.cause?.code ?? error.message}` };
  }
}

function namesUser(body, user) {
  return Boolean(body) && typeof body === 'object' && body.user?.id === user.id && body.user?.role === user.role;
}

const options = parseArgs(process.argv.slice(2));
const cookie = process.env.SV_SESSION_COOKIE;
if (!cookie) {
  console.error('session-control: SV_SESSION_COOKIE is not set');
  process.exit(2);
}

if (options.probe) {
  const user = SEED.users[options.user];
  if (!user) usage();
  const result = await getSession(cookie);
  process.exit(namesUser(result.body, user) ? 0 : 1);
}

const userKey = IDENTITY_USERS[options.identity];
if (!userKey || !['before', 'after'].includes(options.phase)) usage();
const user = SEED.users[userKey];

const withCookie = await getSession(cookie);
const withoutCookie = await getSession(null);
const record = {
  identity: options.identity,
  phase: options.phase,
  cookieName: cookie.split('=')[0],
  withCookie,
  withoutCookie,
};
const json = `${JSON.stringify(record, null, 2)}\n`;
writeFileSync(join(process.env.SV_ZAP_OUT_DIR ?? '.', `session-control-${options.identity}-${options.phase}.json`), json);
process.stdout.write(json);
process.exit(namesUser(withCookie.body, user) ? 0 : 1);
