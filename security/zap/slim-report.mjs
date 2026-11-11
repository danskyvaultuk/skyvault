// Slims one raw ZAP report (traditional-json template) to the shape the scan record keeps.
//   node slim-report.mjs <raw report> <mode> <out>
// Output: { "mode", "alerts": [ { pluginid, alert, riskdesc, cweid, tags, count, instances: [ { uri, method } ] } ] }
// with at most five instances per alert. Every other alert field and every instance field (parameters, attack
// strings, evidence, request and response headers and bodies) is dropped. "count" is the number of instances
// ZAP found, not the number kept. "tags" is copied as the report has it, or null when the report carries none.
import { readFileSync, writeFileSync } from 'node:fs';

const MAX_INSTANCES = 5;

function usage() {
  console.error('usage: slim-report.mjs <raw report> <mode> <out>');
  process.exit(2);
}

function asList(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function slimAlert(alert) {
  const instances = asList(alert.instances);
  const counted = Number(alert.count);
  return {
    pluginid: alert.pluginid,
    alert: alert.alert,
    riskdesc: alert.riskdesc,
    cweid: alert.cweid,
    tags: alert.tags ?? null,
    count: Number.isFinite(counted) ? counted : instances.length,
    instances: instances.slice(0, MAX_INSTANCES).map((instance) => ({ uri: instance.uri, method: instance.method })),
  };
}

const [rawPath, mode, outPath, ...extra] = process.argv.slice(2);
if (!rawPath || !mode || !outPath || extra.length > 0) usage();

let raw;
try {
  raw = JSON.parse(readFileSync(rawPath, 'utf8'));
} catch (error) {
  console.error(`slim-report: cannot read ${rawPath}: ${error.message}`);
  process.exit(1);
}
if (!raw || typeof raw !== 'object' || !('site' in raw)) {
  console.error('slim-report: the report has no site list');
  process.exit(1);
}

const alerts = asList(raw.site).flatMap((site) => asList(site.alerts)).map(slimAlert);
writeFileSync(outPath, `${JSON.stringify({ mode, alerts }, null, 2)}\n`);
