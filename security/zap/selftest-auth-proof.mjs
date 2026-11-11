// Self-test for har-auth-proof.mjs: a HAR proves ZAP's own traffic was authenticated only when it holds a GET of
// exactly /api/properties answered 200. Fixture HARs are assembled at run time and fed on stdin.
// Exits 0 only when every assertion holds. Prints one line per check.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const failures = [];

function check(label, ok) {
  console.log(`${label} ${ok ? 'ok' : 'FAIL'}`);
  if (!ok) failures.push(label);
}

const entry = (method, path, status) => ({ request: { method, url: `http://host.invalid:3000${path}` }, response: { status } });
const har = (...entries) => JSON.stringify({ log: { entries } });

function run(text) {
  const result = spawnSync('node', [join(here, 'har-auth-proof.mjs'), '-'], { input: text, encoding: 'utf8' });
  return { status: result.status, out: result.stdout.trim() };
}

const proven = run(har(entry('GET', '/', 200), entry('GET', '/api/properties', 200)));
check('GET /api/properties 200 exits 0 and names the proof', proven.status === 0 && proven.out === 'GET /api/properties 200');
check('only a 307 exits non-zero', run(har(entry('GET', '/api/properties', 307))).status === 1);
check('200 on another path exits non-zero', run(har(entry('GET', '/api/properties/abc', 200), entry('GET', '/api/leads', 200))).status === 1);
check('a POST answered 200 exits non-zero', run(har(entry('POST', '/api/properties', 200))).status === 1);
check('an unreadable HAR exits non-zero', run('not json').status === 1);

if (failures.length > 0) {
  console.error(`selftest-auth-proof: ${failures.length} failed`);
  process.exit(1);
}
console.log('selftest-auth-proof: all checks passed');
