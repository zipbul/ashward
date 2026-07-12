import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { originReflection } from './origin-reflection';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) => originReflection.run({ probe: replay(head(fields)), target: TARGET });

test('fails a credentialed reflection of the forged origin', async () => {
  const out = await run(`Access-Control-Allow-Origin: ${PROBE_ORIGIN}\r\nAccess-Control-Allow-Credentials: true`);
  expect(out.verdict).toBe(Verdict.Fail);
});

test('warns a bare reflection without credentials (functionally *)', async () => {
  expect((await run(`Access-Control-Allow-Origin: ${PROBE_ORIGIN}`)).verdict).toBe(Verdict.Warn);
});

test('passes a wildcard (not a reflection)', async () => {
  expect((await run('Access-Control-Allow-Origin: *')).verdict).toBe(Verdict.Pass);
});

test('passes when Access-Control-Allow-Origin is absent (nothing reflected)', async () => {
  expect((await run('X-Other: y')).verdict).toBe(Verdict.Pass);
});

test('is tagged with CWE-346 and CWE-942', () => {
  expect(originReflection.tags?.cwe).toEqual(['CWE-346', 'CWE-942']);
});
