import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const swSource = fs.readFileSync('terminal/sw.js', 'utf8');
const appSource = fs.readFileSync('terminal/pro.js', 'utf8');
const patchErrors = [];
const context = vm.createContext({
  console: {
    error: (...args) => patchErrors.push(args.map(String).join(' ')),
    warn: () => {},
    log: () => {},
  },
  self: {
    addEventListener: () => {},
    skipWaiting: () => {},
    location: { origin: 'http://127.0.0.1:8097' },
    clients: { claim: async () => {} },
  },
  caches: {},
  fetch: globalThis.fetch,
  Headers: globalThis.Headers,
  Response: globalThis.Response,
  URL: globalThis.URL,
  Promise,
  setTimeout,
  clearTimeout,
});

vm.runInContext(`${swSource}\nthis.__patchProSource = patchProSource;`, context, {
  filename: 'terminal/sw.js',
});
assert.equal(typeof context.__patchProSource, 'function');

const transformed = context.__patchProSource(appSource);
assert.deepEqual(patchErrors, [], `missing integration replacements:\n${patchErrors.join('\n')}`);
assert.ok(transformed.includes('drawingAwaitSecond:false'));
assert.ok(transformed.includes('function recordL1Cycle'));
assert.ok(transformed.includes("if(c.exitMode!=='target'&&c.reclaimPrice)"));
assert.ok(transformed.includes("event.type==='l1_cycle_closed'"));
assert.ok(transformed.includes('Луч: коснись начала, потом направления'));
assert.ok(transformed.includes('Линейка: коснись начала, потом конца'));
assert.ok(!transformed.includes("text:p.source==='manual'?'GALKA':'V-low'"));

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'galka-final-transform-'));
const transformedPath = path.join(directory, 'pro-transformed.mjs');
fs.writeFileSync(transformedPath, transformed);
execFileSync(process.execPath, ['--check', transformedPath], { stdio: 'pipe' });

console.log('Final SW transform: all replacements applied and transformed pro.js syntax is valid');
