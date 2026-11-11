// Self-test for mint-session.mjs. The signing secret is generated at run time and lives only in this process's
// environment. Exits 0 only when every assertion holds. Prints one line per check.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from 'next-auth/jwt';
import { SEED } from './seed.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const mintPath = join(here, 'mint-session.mjs');
const secret = randomBytes(32).toString('base64');
const cookieName = 'selftest-cookie-name';
const failures = [];

function check(label, ok) {
  console.log(`${label} ${ok ? 'ok' : 'FAIL'}`);
  if (!ok) failures.push(label);
}

function runMint(args) {
  const env = { ...process.env, AUTH_SECRET: secret };
  return spawnSync(process.execPath, [mintPath, ...args], { env, encoding: 'utf8' });
}

const minted = runMint(['--user', 'customerA', '--cookie-name', cookieName]);
check('mint exits 0 with a cookie name', minted.status === 0);

const line = minted.stdout.trim();
const prefix = `${cookieName}=`;
check('stdout is <cookie name>=<token> and nothing else', line.startsWith(prefix) && !line.includes('\n'));
const token = line.slice(prefix.length);

const want = SEED.users.customerA;
let claims = null;
try {
  claims = await decode({ token, secret, salt: cookieName });
} catch {
  claims = null;
}
check('token decodes with salt equal to the cookie name', claims !== null);
if (claims) {
  for (const key of ['email', 'name', 'picture', 'role']) {
    check(`claim ${key} equals the seed entry`, claims[key] === want[key]);
  }
  check('claim sub equals the seed user id', claims.sub === want.id);
  check('claim id equals the seed user id', claims.id === want.id);
}

let other = 'unset';
try {
  other = await decode({ token, secret, salt: `${cookieName}-other` });
} catch {
  other = null;
}
check('token does not decode under another salt', !other);

const noName = runMint(['--user', 'customerA']);
check('mint without --cookie-name exits non-zero', noName.status !== 0 && noName.stdout.trim() === '');

if (failures.length > 0) {
  console.error(`selftest-mint: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('selftest-mint: all checks passed');
