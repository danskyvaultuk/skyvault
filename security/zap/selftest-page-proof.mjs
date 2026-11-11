// Self-test for page-proof.mjs: a HAR proves the signed-in pages were served to a signed-in session only when every
// listed page has a cookie-bearing GET with its expected status (and Location), and no GET of it was sent to the
// sign-in page, by Location or by a redirect in the body. Fixture HARs are assembled at run time and fed on stdin;
// each case's expected list is written to a scratch directory inside the git directory and removed at the end.
//   node selftest-page-proof.mjs [--proof <file>]   (default page-proof.mjs beside this file)
// Exits 0 only when every assertion holds. Prints one line per check.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let proof = join(here, 'page-proof.mjs');
if (args.length === 2 && args[0] === '--proof') proof = resolve(args[1]);
else if (args.length !== 0) {
  console.error('usage: selftest-page-proof.mjs [--proof <file>]');
  process.exit(2);
}

const gitDir = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: here, encoding: 'utf8' }).stdout.trim();
if (!gitDir) {
  console.error('selftest-page-proof: not inside a git work tree');
  process.exit(2);
}
const scratch = join(gitDir, 'sv-pp-selftest');
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

const failures = [];
function check(label, ok) {
  console.log(`${label} ${ok ? 'ok' : 'FAIL'}`);
  if (!ok) failures.push(label);
}

const ORIGIN = 'http://sv-zap-app:3000';
const COOKIE = [{ name: 'cookie', value: 'sid=fixture1' }];

const list = (...items) => ({ customer: items });
const LIST_PASS = list(
  { path: '/alpha', status: 200 },
  { path: '/bravo', status: 307, location: '/charlie' },
  { path: '/delta', status: 404 },
);
const LIST_ALPHA = list({ path: '/alpha', status: 200 });
const LIST_BRAVO = list({ path: '/bravo', status: 307, location: '/charlie' });

// entry(path, status, { location, locName, body, base64, cookie }) builds one HAR entry.
function entry(path, status, opts = {}) {
  const headers = [];
  if (opts.location !== undefined) headers.push({ name: opts.locName ?? 'Location', value: opts.location });
  const content = { mimeType: 'text/html', size: 0 };
  if (opts.body !== undefined) {
    content.text = opts.base64 ? Buffer.from(opts.body).toString('base64') : opts.body;
    if (opts.base64) content.encoding = 'base64';
  }
  return {
    request: { method: opts.method ?? 'GET', url: `${ORIGIN}${path}`, headers: opts.cookie === false ? [] : COOKIE },
    response: { status, headers, content },
  };
}

// A fixture is { har, planted }: planted lists the body markup the case plants, which hygiene may remove.
const fixture = (entries, planted = []) => ({ har: { log: { entries } }, planted });
const page = (inner) => `<html><body><p>neutral page</p>${inner}</body></html>`;
const refresh = (target) => `<meta http-equiv="refresh" content="0;url=${target}">`;
const digest = (target) => `<template data-dgst="NEXT_REDIRECT;replace;${target};307;"></template>`;

const cases = [];
const add = (label, listObj, fx, expectStatus, reason) => cases.push({ label, listObj, fx, expectStatus, reason });

add('pass: a HAR meeting its list (absolute Location, lower-case names)', LIST_PASS, fixture([
  entry('/alpha', 200, { body: page('') }),
  entry('/bravo', 307, { location: `${ORIGIN}/charlie`, locName: 'location' }),
  entry('/delta', 404),
  entry('/unlisted', 200),
]), 0);

// Sign-in refusals in the second-entry shape, and their controls with only the redirect target changed.
const signIn = [
  ['relative Location with a query', (t) => `${t}?callbackUrl=%2Fbravo`],
  ['absolute Location with a query', (t) => `${ORIGIN}${t}?callbackUrl=%2Fbravo`],
  ['Location with no query', (t) => t],
];
for (const [name, build] of signIn) {
  const second = (target) => fixture([
    entry('/bravo', 307, { location: '/charlie' }),
    entry('/bravo', 307, { location: build(target) }),
  ]);
  add(`sign-in refusal, second entry, ${name}`, LIST_BRAVO, second('/login'), 1, 'signed-out redirect');
  add(`control, second entry, ${name}, target changed`, LIST_BRAVO, second('/elsewhere'), 0);
}

// Body refusals: a single 200 entry meeting its status and cookie, so the body alone decides.
const bodies = [
  ['meta refresh', (t) => refresh(`${t}?callbackUrl=%2Falpha`), false],
  ['meta refresh, base64 body', (t) => refresh(`${t}?callbackUrl=%2Falpha`), true],
  ['NEXT_REDIRECT digest', (t) => digest(`${t}?callbackUrl=%2Falpha`), false],
];
for (const [name, build, base64] of bodies) {
  const single = (target) => {
    const planted = page(build(target));
    return fixture([entry('/alpha', 200, { body: planted, base64 })], [planted]);
  };
  add(`body refusal, ${name}`, LIST_ALPHA, single('/login'), 1, 'signed-out redirect');
  add(`control, ${name}, target changed`, LIST_ALPHA, single('/elsewhere'), 0);
}

add('refusal: a listed page absent', LIST_ALPHA, fixture([entry('/other', 200)]), 1, 'absent');
add('refusal: a different status', LIST_ALPHA, fixture([entry('/alpha', 500)]), 1, 'status');
add('refusal: a 3xx with a different Location', LIST_BRAVO, fixture([entry('/bravo', 307, { location: '/elsewhere' })]), 1, 'location');
add('refusal: a matched entry with no Cookie header', LIST_ALPHA, fixture([entry('/alpha', 200, { cookie: false })]), 1, 'no cookie');
add('control: the same entry with its Cookie header', LIST_ALPHA, fixture([entry('/alpha', 200)]), 0);
add('a non-GET entry does not meet a listed page', LIST_ALPHA, fixture([entry('/alpha', 200, { method: 'POST' })]), 1, 'absent');

function run(args, input) {
  const result = spawnSync('node', [proof, ...args], { input, encoding: 'utf8' });
  return { status: result.status, out: result.stdout, err: result.stderr };
}

let n = 0;
for (const c of cases) {
  const listFile = join(scratch, `list-${n++}.json`);
  writeFileSync(listFile, JSON.stringify(c.listObj));
  const r = run(['--list', listFile, '--identity', 'customer', '-'], JSON.stringify(c.fx.har));
  let ok = c.expectStatus === 0 ? r.status === 0 : r.status === 1;
  const first = r.err.split('\n')[0];
  if (c.reason !== undefined) {
    ok = ok && first.startsWith('page-proof: failed /') && first.endsWith(`(${c.reason})`);
    const failedPath = c.listObj.customer[0].path;
    ok = ok && first === `page-proof: failed ${failedPath} (${c.reason})`;
  }
  if (c.expectStatus === 0) {
    const lines = r.out.split('\n').filter((l) => l.length > 0);
    ok = ok && lines.length === c.listObj.customer.length && lines.every((l) => / observed \d{3}( |$)/.test(l));
  }
  check(c.label, ok);
}

// The pass case prints each listed path with its observed status and Location.
{
  const listFile = join(scratch, 'list-pass.json');
  writeFileSync(listFile, JSON.stringify(LIST_PASS));
  const r = run(['--list', listFile, '--identity', 'customer', '-'], JSON.stringify(cases[0].fx.har));
  const lines = r.out.split('\n').filter((l) => l.length > 0);
  check('pass output names each path, its observed status and Location', lines.length === 3
    && lines[0].startsWith('/alpha expected 200 observed 200')
    && lines[1].startsWith('/bravo expected 307 /charlie observed 307 /charlie')
    && lines[2].startsWith('/delta expected 404 observed 404'));
}

// Usage and unreadable input.
{
  const listFile = join(scratch, 'list-usage.json');
  writeFileSync(listFile, JSON.stringify(LIST_ALPHA));
  const har = JSON.stringify(fixture([entry('/alpha', 200)]).har);
  check('no --list exits 2', run(['--identity', 'customer', '-'], har).status === 2);
  check('no --identity exits 2', run(['--list', listFile, '-'], har).status === 2);
  check('an unreadable HAR exits 1', run(['--list', listFile, '--identity', 'customer', '-'], 'not json').status === 1);
}

// Fixture hygiene: with every Location value and the planted body markup removed, no fixture holds the sign-in word.
const word = ['lo', 'gin'].join('');
for (const c of cases) {
  const copy = JSON.parse(JSON.stringify(c.fx.har));
  for (const e of copy.log.entries) {
    for (const h of e.response.headers) if (h.name.toLowerCase() === 'location') h.value = '';
    if (typeof e.response.content.text === 'string') {
      for (const p of c.fx.planted) e.response.content.text = e.response.content.text.split(p).join('');
    }
  }
  check(`hygiene: ${c.label}`, !JSON.stringify(copy).includes(word));
}
check('hygiene: every fixture cookie value is shorter than 16 characters', COOKIE.every((h) => h.value.length < 16));

rmSync(scratch, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`selftest-page-proof: ${failures.length} failed`);
  process.exit(1);
}
console.log('selftest-page-proof: all checks passed');
