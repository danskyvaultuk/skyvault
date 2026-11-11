// A01 cross-account requests: customer A's property, survey, image and tag routes, requested as customer B and with
// no cookie, and each GET also as customer A (the positive control). REQUESTS lists them in send order.
// Executed, it sends them with the cookies in SV_COOKIE_CUSTOMER_A / SV_COOKIE_CUSTOMER_B ("<name>=<token>"),
// writes a01-requests.json (method, path, as, status; no body, no cookie) into SV_ZAP_OUT_DIR (default the working
// directory), prints the same JSON, and exits non-zero unless all three customer-A GETs answered 2xx.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SEED } from './seed.mjs';

const PROPERTY = `/api/properties/${SEED.property.id}`;
const SURVEY = `/api/surveys/${SEED.surveys.s1.id}`;
const TAG = `/api/photos/${SEED.surveys.s1.images[0].id}/tag`;

const MUTATIONS = [
  { method: 'PUT', path: PROPERTY, body: { address: '2 Placeholder Street' } },
  { method: 'PATCH', path: SURVEY, body: { notes: 'placeholder note' } },
  { method: 'POST', path: `${SURVEY}/images`, body: { s3Key: 'svzap/placeholder-b.jpg', sizeBytes: 1024 } },
  { method: 'POST', path: `${SURVEY}/images/presign`, body: { filename: 'placeholder.jpg', contentType: 'image/jpeg', sizeBytes: 1024 } },
  { method: 'POST', path: `${SURVEY}/analyse`, body: {} },
  { method: 'POST', path: `${SURVEY}/roofer-request`, body: { consent: true } },
  { method: 'PATCH', path: TAG, body: { roofParts: [] } },
];

export const REQUESTS = [
  ...[PROPERTY, SURVEY, `${SURVEY}/images`].flatMap((path) =>
    ['customerB', 'none', 'customerA'].map((as) => ({ method: 'GET', path, as })),
  ),
  ...MUTATIONS.flatMap((request) => ['customerB', 'none'].map((as) => ({ ...request, as }))),
  ...[TAG, PROPERTY].flatMap((path) => ['none', 'customerB'].map((as) => ({ method: 'DELETE', path, as }))),
];

async function send(request, cookie) {
  const headers = request.body ? { 'content-type': 'application/json' } : {};
  if (cookie) headers.cookie = cookie;
  try {
    const response = await fetch(`${process.env.SV_ZAP_APP_URL ?? 'http://sv-zap-app:3000'}${request.path}`, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
      redirect: 'manual',
    });
    await response.arrayBuffer();
    return response.status;
  } catch {
    return null;
  }
}

async function main() {
  const cookies = {
    customerA: process.env.SV_COOKIE_CUSTOMER_A,
    customerB: process.env.SV_COOKIE_CUSTOMER_B,
    none: undefined,
  };
  if (!cookies.customerA || !cookies.customerB) {
    console.error('a01-requests: SV_COOKIE_CUSTOMER_A and SV_COOKIE_CUSTOMER_B must be set');
    process.exit(2);
  }
  const results = [];
  for (const request of REQUESTS) {
    const status = await send(request, cookies[request.as]);
    results.push({ method: request.method, path: request.path, as: request.as, status });
  }
  const json = `${JSON.stringify(results, null, 2)}\n`;
  writeFileSync(join(process.env.SV_ZAP_OUT_DIR ?? '.', 'a01-requests.json'), json);
  process.stdout.write(json);
  const controls = results.filter((r) => r.method === 'GET' && r.as === 'customerA');
  process.exit(controls.length === 3 && controls.every((r) => r.status >= 200 && r.status < 300) ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
