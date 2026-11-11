// Redactor and check over one public pattern list (patterns.public.json) and an optional private file of
// literals that may not be committed. Node built-ins only.
//
//   node redact.mjs check  [--patterns <file>] [--private <file>] <path>...
//   node redact.mjs redact [--patterns <file>] [--private <file>] <in> <out>
//
// check exits 1 on any match, 0 on none, 2 on a usage error or an empty input list. Its output is one line per
// match, "<pattern id> <file>:<line>", never the matched text. A private literal is reported as private-<line>
// (its line number in the private file), matched case-insensitively. redact replaces each match with
// [REDACTED:<pattern id>].
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function usage(message) {
  console.error(`redact: ${message}`);
  console.error('usage: redact.mjs check|redact [--patterns <file>] [--private <file>] <path>...');
  process.exit(2);
}

function parseArgs(argv) {
  const options = { patterns: join(here, 'patterns.public.json'), private: null };
  const operands = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--patterns' || token === '--private') {
      const value = argv[i + 1];
      if (!value) usage(`${token} needs a value`);
      options[token.slice(2)] = value;
      i += 1;
    } else if (token.startsWith('--')) {
      usage(`unknown option ${token}`);
    } else {
      operands.push(token);
    }
  }
  return { options, operands };
}

function readFile(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    return usage(`cannot read ${file}: ${error.code}`);
  }
}

function escapeLiteral(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadMatchers(options) {
  let entries;
  try {
    entries = JSON.parse(readFile(options.patterns));
  } catch (error) {
    return usage(`${options.patterns} is not JSON`);
  }
  if (!Array.isArray(entries)) usage(`${options.patterns} is not a JSON array`);
  const matchers = entries.map((entry) => {
    try {
      const flags = (entry.flags || '').replace(/g/g, '');
      return { id: entry.id, regex: new RegExp(entry.regex, `${flags}g`) };
    } catch (error) {
      return usage(`bad pattern ${entry && entry.id}`);
    }
  });
  if (options.private) {
    readFile(options.private).split('\n').forEach((line, index) => {
      const literal = line.replace(/\r$/, '');
      if (literal === '') return;
      matchers.push({ id: `private-${index + 1}`, regex: new RegExp(escapeLiteral(literal), 'gi') });
    });
  }
  return matchers;
}

function walk(path) {
  let info;
  try {
    info = statSync(path);
  } catch (error) {
    return usage(`cannot read ${path}: ${error.code}`);
  }
  if (!info.isDirectory()) return [path];
  return readdirSync(path).sort().flatMap((name) => walk(join(path, name)));
}

function checkText(matchers, file, text) {
  const hits = [];
  text.split('\n').forEach((line, index) => {
    for (const { id, regex } of matchers) {
      regex.lastIndex = 0;
      for (const match of line.matchAll(regex)) {
        if (match[0] !== '') hits.push(`${id} ${file}:${index + 1}`);
      }
    }
  });
  return hits;
}

function redactText(matchers, text) {
  return text
    .split('\n')
    .map((line) => {
      let out = line;
      for (const { id, regex } of matchers) {
        regex.lastIndex = 0;
        out = out.replace(regex, (found) => (found === '' ? found : `[REDACTED:${id}]`));
      }
      return out;
    })
    .join('\n');
}

function check(matchers, operands) {
  const files = operands.flatMap(walk);
  if (files.length === 0) usage('no input files');
  let hits = 0;
  for (const file of files) {
    for (const line of checkText(matchers, file, readFile(file))) {
      console.log(line);
      hits += 1;
    }
  }
  return hits > 0 ? 1 : 0;
}

function redact(matchers, operands) {
  if (operands.length !== 2) usage('redact takes an input path and an output path');
  const [input, output] = operands;
  for (const file of walk(input)) {
    const target = statSync(input).isDirectory() ? join(output, file.slice(input.length)) : output;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, redactText(matchers, readFile(file)));
  }
  return 0;
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== 'check' && command !== 'redact') usage('the command is check or redact');
  const { options, operands } = parseArgs(rest);
  const matchers = loadMatchers(options);
  process.exit(command === 'check' ? check(matchers, operands) : redact(matchers, operands));
}

main();
