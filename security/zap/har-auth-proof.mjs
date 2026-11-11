// Proves ZAP's own traffic carried the session cookie: the HAR must hold a GET of exactly /api/properties that
// was answered 200 (unauthenticated, the middleware answers 307).
//   node har-auth-proof.mjs <har file>   ("-" reads the HAR from standard input)
// Prints "GET /api/properties 200" and exits 0 on proof; exits 1 when the HAR is unreadable or holds none.
import { readFileSync } from 'node:fs';

const harPath = process.argv[2];
if (!harPath || process.argv.length > 3) {
  console.error('usage: har-auth-proof.mjs <har file>');
  process.exit(2);
}

let entries;
try {
  entries = JSON.parse(readFileSync(harPath === '-' ? 0 : harPath, 'utf8')).log.entries;
} catch (error) {
  console.error(`har-auth-proof: cannot read entries from ${harPath}: ${error.message}`);
  process.exit(1);
}
if (!Array.isArray(entries)) {
  console.error('har-auth-proof: the HAR has no entry list');
  process.exit(1);
}

function isProof(entry) {
  try {
    return entry.request.method === 'GET' && new URL(entry.request.url).pathname === '/api/properties' && entry.response.status === 200;
  } catch {
    return false;
  }
}

if (!entries.some(isProof)) {
  console.error('har-auth-proof: no GET /api/properties answered 200 in the HAR');
  process.exit(1);
}
console.log('GET /api/properties 200');
