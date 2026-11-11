// Self-test for redact.mjs. Every planted instance is assembled from fragments at run time and written to a
// scratch directory inside the git directory; nothing planted is ever committed. Exits 0 only when every
// assertion holds. Prints one line per id: "<id> planted=<exit> clean=<exit>".
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const redactPath = join(here, 'redact.mjs');
const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${file}: ${error.code}`);
    return '';
  }
}

function parseArgs(argv) {
  const options = { patterns: join(here, 'patterns.public.json'), private: null };
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    const value = argv[i + 1];
    if ((name !== '--patterns' && name !== '--private') || !value) {
      console.error('usage: selftest-redact.mjs [--patterns <file>] [--private <file>]');
      process.exit(2);
    }
    options[name.slice(2)] = resolve(value);
  }
  return options;
}

function gitDir() {
  const out = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: here, encoding: 'utf8' });
  if (out.status !== 0) {
    console.error('selftest-redact: not inside a git checkout');
    process.exit(2);
  }
  return out.stdout.trim();
}

function runRedact(args) {
  const out = spawnSync(process.execPath, [redactPath, ...args], { encoding: 'utf8' });
  return { status: out.status, text: `${out.stdout}${out.stderr}` };
}

const body = 'Zq7Xk2Lm9Pw4Rt8VAb3Cd5Ef';
const seg = (tag) => `${tag}hbGciOiJIUzI1NiJ9`;

// One generator per public pattern id. Each returns the planted text; fragments never match on their own.
const planters = {
  'cookie-header': () => ['Coo', 'kie: sid=', body].join(''),
  'set-cookie-header': () => ['Set-', 'Coo', 'kie: sid=', body].join(''),
  'bearer-token': () => ['Bear', 'er ', body].join(''),
  jwt: () => [seg('ey' + 'J'), seg('ey' + 'J'), 'c2lnbmF0dXJl'].join('.'),
  jwe: () => [seg('ey' + 'J'), 'a2V5a2V5a2V5', 'aXZpdml2aXZp', 'Y2lwaGVydGV4dA', 'dGFndGFndGFn'].join('.'),
  'home-path-users': () => ['/Us', 'ers/', 'planted'].join(''),
  'home-path-home': () => ['/ho', 'me/', 'planted'].join(''),
  'aws-account-id': () => ['1234', '5678', '9012'].join(''),
  'gbp-amount': () => ['£', '12.50'].join(''),
  'email-not-example-test': () => ['someone', '@', 'y.invalid'].join(''),
  'aws-access-key': () => ['AK', 'IA', 'ABCDEFGHIJKLMNOP'].join(''),
  'stripe-live-key': () => ['sk_', 'live_', 'Zq7Xk2Lm9Pw4'].join(''),
  'stripe-test-key': () => ['sk_', 'test_', 'Zq7Xk2Lm9Pw4'].join(''),
  'stripe-webhook-secret': () => ['whs', 'ec_', 'Zq7Xk2Lm9Pw4'].join(''),
  'anthropic-key': () => ['sk-', 'ant-', 'Zq7Xk2Lm9Pw4'].join(''),
  'resend-key': () => ['re', '_', 'Zq7Xk2Lm9Pw4'].join(''),
};

// Near misses only: a zero exit here proves no over-match.
function cleanFixture() {
  return [
    ['customer-a@', 'example.test'].join(''),
    '12345678901',
    ['a', '12345', '6789012', 'b'].join(''),
    ['/us', 'r/local/bin'].join(''),
    '/zap/wrk/out',
    'GBP 12.50',
    ['sk_', 'live_ and sk_', 'test_ and whs', 'ec_ and sk-', 'ant- and re', '_ and AK', 'IA with no body'].join(''),
    ['a', 're_', 'Zq7Xk2Lm9Pw4'].join(''),
    ['ta', 'sk_', 'test_', 'Zq7Xk2Lm9Pw4Rt8V'].join(''),
    ['ta', 'sk_', 'live_', 'Zq7Xk2Lm9Pw4Rt8V'].join(''),
    ['ta', 'sk-', 'ant-', 'Zq7Xk2Lm9Pw4Rt8V'].join(''),
    ['a', 'whs', 'ec_', 'Zq7Xk2Lm9Pw4Rt8V'].join(''),
    ['x', 'AK', 'IA', 'ABCDEFGHIJKLMNOP'].join(''),
    ['Bear', 'er tokens are checked server side'].join(''),
    ['Bear', 'er short1'].join(''),
    ['Coo', 'kie: a=short'].join(''),
    ['match', 'String: Coo', 'kie'].join(''),
    ['ey', 'J', 'abc.def'].join(''),
  ].join('\n') + '\n';
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const ids = JSON.parse(readFileSync(options.patterns, 'utf8')).map((entry) => entry.id);
  const scratch = join(gitDir(), `zap-selftest-${process.pid}`);
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  try {
    run(options, ids, scratch);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL ${message}`);
    process.exit(1);
  }
}

function run(options, ids, scratch) {
  let privatePath = options.private;
  let privateLiteral = null;
  if (!privatePath) {
    privateLiteral = `qzx${randomBytes(4).toString('hex')}qzx`;
    privatePath = join(scratch, 'private.txt');
    writeFileSync(privatePath, `${privateLiteral}\n`);
  }
  const privateLines = readFileSync(privatePath, 'utf8').split('\n');
  const common = ['--patterns', options.patterns, '--private', privatePath];

  const cleanPath = join(scratch, 'clean.txt');
  writeFileSync(cleanPath, cleanFixture());
  const clean = runRedact(['check', ...common, cleanPath]);
  if (clean.status !== 0) fail(`clean fixture exited ${clean.status}: ${clean.text.trim()}`);

  const planted = [];
  for (const id of ids) {
    if (!planters[id]) {
      fail(`no planted generator for pattern id ${id}`);
      continue;
    }
    planted.push({ id, text: planters[id]() });
  }
  privateLines.forEach((literal, index) => {
    if (literal === '') return;
    planted.push({ id: `private-${index + 1}`, text: `x ${literal.toUpperCase()} y` });
  });

  for (const { id, text } of planted) {
    const file = join(scratch, `planted-${id}.txt`);
    writeFileSync(file, `harmless first line\n${text}\n`);
    const result = runRedact(['check', ...common, file]);
    if (result.status !== 1) fail(`${id}: planted check exited ${result.status}, expected 1`);
    if (!result.text.includes(`${id} ${file}:2`)) fail(`${id}: output does not name the id, file and line 2`);
    if (result.text.includes(text) || result.text.includes(text.trim())) fail(`${id}: output contains the planted text`);
    for (const line of result.text.split('\n').filter((l) => l !== '')) {
      if (!line.startsWith(`${id} `)) fail(`${id}: output names a different pattern: ${line}`);
    }

    const redacted = join(scratch, `redacted-${id}.txt`);
    const done = runRedact(['redact', ...common, file, redacted]);
    if (done.status !== 0) fail(`${id}: redact exited ${done.status}`);
    const after = runRedact(['check', ...common, redacted]);
    if (after.status !== 0) fail(`${id}: check after redact exited ${after.status}`);
    if (!readText(redacted).includes(`[REDACTED:${id}]`)) fail(`${id}: redacted copy lacks the marker`);
    console.log(`${id} planted=${result.status} clean=${clean.status}`);
  }

  const noInput = runRedact(['check', ...common]);
  if (noInput.status !== 2) fail(`check with no input path exited ${noInput.status}, expected 2`);
}

main();
