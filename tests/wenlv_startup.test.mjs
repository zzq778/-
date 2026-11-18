import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ATTRACTIONS } from '../src/wenlv/attractions.mjs';
import { ROUTES } from '../src/wenlv/routes.mjs';
import { CALENDAR } from '../src/wenlv/calendar.mjs';
import { ENTRIES } from '../src/wenlv/entries.mjs';
import { validateAttraction, validateRoute, validateEvent, validateEntry } from '../src/wenlv/schema.mjs';

const tables = [
  [ATTRACTIONS, validateAttraction],
  [ROUTES, validateRoute],
  [CALENDAR, validateEvent],
  [ENTRIES, validateEntry]
];

test('all knowledge entries pass structural and future-date validation before deployment', () => {
  for (const [rows, validate] of tables) {
    for (const row of rows) assert.deepEqual(validate(row), [], row.id);
  }
});

test('all knowledge validators still reject dates from the future', () => {
  for (const [rows, validate] of tables) {
    assert.ok(validate({...rows[0], verifiedAt:'2999-01-01'}).includes('verifiedAt 不能晚于今天'));
  }
});

test('mobile Worker imports even when initialization clock is frozen before verifiedAt', () => {
  const url = new URL('../src/mobile-worker.mjs', import.meta.url).href;
  const script = [
    'const RealDate = Date;',
    'globalThis.Date = class extends RealDate {',
    '  constructor(...args) { super(...(args.length ? args : [0])); }',
    '  static now() { return 0; }',
    '};',
    'const worker = await import(' + JSON.stringify(url) + ');',
    'if (typeof worker.default.fetch !== "function") throw Error("missing worker handler");'
  ].join('\n');
  execFileSync(process.execPath, ['--input-type=module', '--eval', script], {timeout:10000});
});
