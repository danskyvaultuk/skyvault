// Self-test for slim-report.mjs. It writes a synthetic report in the shape of the traditional-json template
// into a scratch directory inside the git directory, runs the slimmer on it and checks the output shape.
// Exits 0 only when every assertion holds. Prints one line per check.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const slimPath = join(here, 'slim-report.mjs');
const failures = [];

function check(label, ok) {
  console.log(`${label} ${ok ? 'ok' : 'FAIL'}`);
  if (!ok) failures.push(label);
}

function gitDir() {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: here, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error('selftest-slim: not inside a git work tree');
    process.exit(2);
  }
  return join(here, result.stdout.trim());
}

const scratch = join(gitDir(), 'selftest-slim-scratch');
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

// Neutral marker text for the fields the slimmer must drop. It is assembled from fragments, so the literal
// never sits in this file, and the assertions below look for it in the output only.
const bodyMarker = ['body', 'marker', 'alpha'].join('-');
const extraMarker = ['extra', 'marker', 'beta'].join('-');
const taggedTags = [{ tag: 'OWASP_2021_A05', link: 'https://example.test/a05' }, { tag: 'CWE-693', link: 'https://example.test/693' }];

function instance(n, withBodies) {
  const base = {
    uri: `http://sv-zap-app:3000/api/item-${n}`,
    method: n % 2 === 0 ? 'POST' : 'GET',
    param: `param-${n}`,
    attack: `attack-${extraMarker}`,
    evidence: `evidence-${extraMarker}`,
    otherinfo: `info-${extraMarker}`,
  };
  if (withBodies) {
    base.requestheader = `request-header-${bodyMarker}`;
    base.requestbody = `request-body-${bodyMarker}`;
    base.responseheader = `response-header-${bodyMarker}`;
    base.responsebody = `response-body-${bodyMarker}`;
  }
  return base;
}

function alert(pluginid, name, instanceCount, tags, withBodies) {
  const found = { pluginid, alertRef: pluginid, alert: name, name, riskcode: '2', confidence: '2' };
  found.riskdesc = 'Medium (High)';
  found.desc = `description-${extraMarker}`;
  found.instances = Array.from({ length: instanceCount }, (_, i) => instance(i + 1, withBodies));
  found.count = String(instanceCount);
  found.solution = `solution-${extraMarker}`;
  found.otherinfo = `alert-info-${extraMarker}`;
  found.reference = `reference-${extraMarker}`;
  found.cweid = '693';
  found.wascid = '15';
  found.sourceid = '3';
  if (tags) found.tags = tags;
  return found;
}

const rawReport = {
  '@programName': 'ZAP',
  '@version': 'selftest',
  site: [
    { '@name': 'http://sv-zap-app:3000', '@host': 'sv-zap-app', alerts: [alert('10001', 'First rule', 7, taggedTags, true), alert('10002', 'Second rule', 2, taggedTags, false)] },
    { '@name': 'http://other-site.example.test', '@host': 'other-site.example.test', alerts: [alert('10003', 'Third rule', 1, null, false)] },
  ],
};
const rawPath = join(scratch, 'raw.json');
const outPath = join(scratch, 'slim.json');
writeFileSync(rawPath, JSON.stringify(rawReport));

// The fixture must hold what the slimmer is meant to drop, or the checks below would pass on nothing.
const rawText = readFileSync(rawPath, 'utf8');
check('fixture holds body fields to drop', rawText.includes(bodyMarker) && rawText.includes('responsebody'));
check('fixture holds extra alert fields to drop', rawText.includes(extraMarker) && rawText.includes('"solution"') && rawText.includes('"desc"'));
check('fixture holds an alert with seven instances', rawReport.site[0].alerts[0].instances.length === 7);

const run = spawnSync(process.execPath, [slimPath, rawPath, 'unauth-baseline', outPath], { encoding: 'utf8' });
check('slim-report exits 0', run.status === 0);

let slim = null;
try {
  slim = JSON.parse(readFileSync(outPath, 'utf8'));
} catch {
  slim = null;
}
check('output parses as JSON', slim !== null);

const sameKeys = (value, keys) => Boolean(value) && typeof value === 'object' && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

if (slim) {
  check('top level holds exactly mode and alerts', sameKeys(slim, ['mode', 'alerts']));
  check('mode is the mode given', slim.mode === 'unauth-baseline');
  const alerts = Array.isArray(slim.alerts) ? slim.alerts : [];
  check('alerts from both sites are kept', alerts.length === 3 && ['10001', '10002', '10003'].every((id) => alerts.some((a) => a.pluginid === id)));
  check(
    'each alert holds exactly the F5 fields',
    alerts.length > 0 && alerts.every((a) => sameKeys(a, ['pluginid', 'alert', 'riskdesc', 'cweid', 'tags', 'count', 'instances'])),
  );
  check(
    'each instance holds exactly uri and method',
    alerts.every((a) => Array.isArray(a.instances) && a.instances.length > 0 && a.instances.every((i) => sameKeys(i, ['uri', 'method']))),
  );
  check('no alert has more than five instances', alerts.every((a) => a.instances.length <= 5));
  const seven = alerts.find((a) => a.pluginid === '10001');
  check('the seven-instance alert keeps five instances', Boolean(seven) && seven.instances.length === 5);
  check('the seven-instance alert keeps its count of 7', Boolean(seven) && Number(seven.count) === 7);
  check(
    'the kept instances are the first five, uri and method intact',
    Boolean(seven) &&
      seven.instances.every((i, n) => i.uri === `http://sv-zap-app:3000/api/item-${n + 1}` && i.method === ((n + 1) % 2 === 0 ? 'POST' : 'GET')),
  );
  const second = alerts.find((a) => a.pluginid === '10002');
  check('an alert under the cap keeps all its instances', Boolean(second) && second.instances.length === 2);
  check('tags are preserved', Boolean(seven) && JSON.stringify(seven.tags) === JSON.stringify(taggedTags));
  const first = alerts.find((a) => a.pluginid === '10001');
  check('alert, riskdesc and cweid are preserved', Boolean(first) && first.alert === 'First rule' && first.riskdesc === 'Medium (High)' && first.cweid === '693');
  const outText = readFileSync(outPath, 'utf8');
  check('no request or response body text reaches the output', !outText.includes(bodyMarker) && !outText.includes('responsebody') && !outText.includes('requestbody'));
  check('no dropped alert field reaches the output', !outText.includes(extraMarker) && !outText.includes('"solution"') && !outText.includes('"desc"'));
}

const noArgs = spawnSync(process.execPath, [slimPath], { encoding: 'utf8' });
check('slim-report with no arguments exits non-zero', noArgs.status !== 0);

rmSync(scratch, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`selftest-slim: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('selftest-slim: all checks passed');
