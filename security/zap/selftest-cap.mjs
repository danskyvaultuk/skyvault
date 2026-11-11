// Self-test for cap-reached.awk: whether a job reached its cap is read from the job's own "time taken" line,
// never from the "set maxDuration" lines ZAP echoes into every log. Fixture logs are assembled at run time.
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

function capFor(log) {
  const result = spawnSync(
    'awk',
    ['-v', 'spider=180', '-v', 'passive=300', '-v', 'active=1200', '-f', join(here, 'cap-reached.awk')],
    { input: log, encoding: 'utf8' },
  );
  return result.status === 0 ? result.stdout.trim() : `exit ${result.status}`;
}

const echo = ['Job spider set maxDuration = 3', 'Job passiveScan-wait set maxDuration = 5', 'Job activeScan set maxDuration = 20'];
const lines = (...more) => [...echo, ...more].join('\n') + '\n';

check('config echo with short jobs is no', capFor(lines('Job spider finished, time taken: 00:00:02', 'Job passiveScan-wait finished, time taken: 00:00:11')) === 'no');
check('active scan under its cap is no', capFor(lines('Job activeScan finished, time taken: 00:10:23')) === 'no');
check('active scan past its cap is yes', capFor(lines('Job activeScan finished, time taken: 00:20:01')) === 'yes');
check('spider at its cap is yes', capFor(lines('Job spider finished, time taken: 00:03:00')) === 'yes');
check('spider within five seconds of its cap is yes', capFor(lines('Job spider finished, time taken: 00:02:55')) === 'yes');
check('passive wait just under the margin is no', capFor(lines('Job passiveScan-wait finished, time taken: 00:04:54')) === 'no');
check('a log with no job lines is no', capFor('anything\n') === 'no');

if (failures.length > 0) {
  console.error(`selftest-cap: ${failures.length} failed`);
  process.exit(1);
}
console.log('selftest-cap: all checks passed');
