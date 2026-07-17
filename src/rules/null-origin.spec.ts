import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { Verdict } from '../core/contract/enums';
import { head, replay } from '../testkit/replay';
import { nullOrigin } from './null-origin';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const run = async (fields: string) => nullOrigin.run({ probe: replay(head(fields)), target: TARGET });

test('fails a credentialed null grant', async () => {
  const out = await run('Access-Control-Allow-Origin: null\r\nAccess-Control-Allow-Credentials: true');
  expect(out.verdict).toBe(Verdict.Fail);
});

test('warns a bare null grant without credentials', async () => {
  expect((await run('Access-Control-Allow-Origin: null')).verdict).toBe(Verdict.Warn);
});

test('passes a grant to a real origin (not null)', async () => {
  expect((await run('Access-Control-Allow-Origin: https://app.example')).verdict).toBe(Verdict.Pass);
});

test('is tagged with CWE-942', () => {
  expect(nullOrigin.tags?.cwe).toEqual(['CWE-942']);
});
