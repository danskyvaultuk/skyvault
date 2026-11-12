// Proves the signed-in pages were served to a signed-in session. For every page in an expected list the HAR must hold
// a GET of that path whose request carried a Cookie header, answered with the expected status (and, for a 3xx, the
// expected Location path), and no GET of it may have been sent to the sign-in page: not by a Location, and not by a
// redirect in a 2xx body (a meta refresh, or a NEXT_REDIRECT digest). Hosts are never compared.
//   node page-proof.mjs --list <expected list file> --identity <customer|admin> <har file | ->
// The list is JSON: { "<identity>": [ { "path": "/x", "status": 200 }, { "path": "/y", "status": 307, "location": "/z" } ] }.
// Prints one line per listed path, pass or fail. Exit 0 pass, 1 fail (first stderr line names the first failing
// path and why), 2 usage error.
import { readFileSync } from 'node:fs';

function usage() {
  console.error('usage: page-proof.mjs --list <expected list file> --identity <customer|admin> <har file | ->');
  process.exit(2);
}

let listPath;
let identity;
let harPath;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--list' && listPath === undefined && i + 1 < argv.length) listPath = argv[++i];
  else if (argv[i] === '--identity' && identity === undefined && i + 1 < argv.length) identity = argv[++i];
  else if (!argv[i].startsWith('--') && harPath === undefined) harPath = argv[i];
  else usage();
}
if (listPath === undefined || harPath === undefined || (identity !== 'customer' && identity !== 'admin')) usage();

function unreadable(what, error) {
  console.error(`page-proof: failed (unreadable ${what}: ${error.message})`);
  process.exit(1);
}

let expected;
try {
  expected = JSON.parse(readFileSync(listPath, 'utf8'))[identity];
  if (!Array.isArray(expected) || expected.length === 0) throw new Error(`no list for ${identity}`);
  for (const item of expected) {
    const redirects = item.status >= 300 && item.status < 400;
    if (typeof item.path !== 'string' || !Number.isInteger(item.status) || redirects !== (typeof item.location === 'string')) {
      throw new Error(`malformed entry ${JSON.stringify(item)}`);
    }
  }
} catch (error) {
  unreadable('list', error);
}

let entries;
try {
  entries = JSON.parse(readFileSync(harPath === '-' ? 0 : harPath, 'utf8')).log.entries;
  if (!Array.isArray(entries)) throw new Error('the HAR has no entry list');
} catch (error) {
  unreadable('har', error);
}

function pathOf(url, base) {
  try {
    return new URL(url, base).pathname;
  } catch {
    return null;
  }
}

function isSignInPath(pathname) {
  return pathname === '/login' || (pathname !== null && pathname.startsWith('/login/'));
}

function headerValue(headers, name) {
  if (!Array.isArray(headers)) return undefined;
  const found = headers.find((h) => String(h.name).toLowerCase() === name);
  return found === undefined ? undefined : String(found.value);
}

function hasCookie(entry) {
  const value = headerValue(entry.request.headers, 'cookie');
  return value !== undefined && value.length > 0;
}

const isRedirect = (status) => status >= 300 && status < 400;

function locationPath(entry) {
  const value = headerValue(entry.response.headers, 'location');
  return value === undefined ? null : pathOf(value, entry.request.url);
}

function bodyText(entry) {
  const content = entry.response.content;
  if (content === undefined || typeof content.text !== 'string') return undefined;
  return content.encoding === 'base64' ? Buffer.from(content.text, 'base64').toString('utf8') : content.text;
}

// Every redirect target the body plants: a meta refresh's url=, a NEXT_REDIRECT digest's url.
function bodyRedirectTargets(text) {
  const targets = [];
  for (const tag of text.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/http-equiv\s*=\s*["']?refresh/i.test(tag)) continue;
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const url = content === null ? null : /url\s*=\s*['"]?([^'"\s]+)/i.exec(content[1] ?? content[2]);
    if (url !== null) targets.push(url[1]);
  }
  for (const m of text.matchAll(/NEXT_REDIRECT;[^;]*;([^;"'\\\s<>]+)/g)) targets.push(m[1]);
  return targets;
}

function refusedSignedOut(entry) {
  const status = entry.response.status;
  if (isRedirect(status)) return isSignInPath(locationPath(entry));
  if (status >= 200 && status < 300) {
    const text = bodyText(entry);
    return text !== undefined && bodyRedirectTargets(text).some((t) => isSignInPath(pathOf(t, entry.request.url)));
  }
  return false;
}

function isMet(entry, item) {
  if (!hasCookie(entry) || entry.response.status !== item.status) return false;
  return !isRedirect(item.status) || locationPath(entry) === item.location;
}

function judge(item) {
  const matches = entries.filter((e) => {
    try {
      return e.request.method === 'GET' && pathOf(e.request.url) === item.path;
    } catch {
      return false;
    }
  });
  const met = matches.find((e) => isMet(e, item));
  const withCookie = matches.filter(hasCookie);
  const shown = met ?? withCookie[0] ?? matches[0];
  let reason = null;
  if (matches.some(refusedSignedOut)) reason = 'signed-out redirect';
  else if (met === undefined) {
    if (matches.length === 0) reason = 'absent';
    else if (withCookie.length === 0) reason = 'no cookie';
    else if (!withCookie.some((e) => e.response.status === item.status)) reason = 'status';
    else reason = 'location';
  }
  let observed = 'absent';
  let body = 'n/a';
  if (shown !== undefined) {
    const status = shown.response.status;
    observed = String(status);
    if (isRedirect(status) && locationPath(shown) !== null) observed += ` ${locationPath(shown)}`;
    if (status >= 200 && status < 300) body = bodyText(shown) ? 'yes' : 'no';
  }
  const want = isRedirect(item.status) ? `${item.status} ${item.location}` : String(item.status);
  console.log(`${item.path} expected ${want} observed ${observed} body=${body} ${reason === null ? 'pass' : 'FAIL'}`);
  return reason;
}

let failure = null;
for (const item of expected) {
  const reason = judge(item);
  if (reason !== null && failure === null) failure = `page-proof: failed ${item.path} (${reason})`;
}
if (failure !== null) {
  console.error(failure);
  process.exit(1);
}
