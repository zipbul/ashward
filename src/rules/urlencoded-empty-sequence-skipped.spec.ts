import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { urlencodedEmptySequenceSkipped } from './urlencoded-empty-sequence-skipped';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/echo', timeoutMs: 500 };
const head = (status: string): string => `HTTP/1.1 ${status}\r\nContent-Type: application/json\r\n\r\n`;

test('passes when the echo skips the empty sequence between && and emits exactly two pairs', async () => {
  const out = await urlencodedEmptySequenceSkipped.run({
    probe: replay(
      `${head('200 OK')}${JSON.stringify([
        ['a', '1'],
        ['b', '2'],
      ])}`,
    ),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('fails when the echo emits a spurious empty pair for the skipped sequence', async () => {
  const out = await urlencodedEmptySequenceSkipped.run({
    probe: replay(
      `${head('200 OK')}${JSON.stringify([
        ['a', '1'],
        ['', ''],
        ['b', '2'],
      ])}`,
    ),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Fail);
});

test('is skipped as endpoint-not-reflecting on a non-2xx response', async () => {
  const out = await urlencodedEmptySequenceSkipped.run({
    probe: replay(
      `${head('500 Internal Server Error')}${JSON.stringify([
        ['a', '1'],
        ['b', '2'],
      ])}`,
    ),
    target: TARGET,
    reflect: { mode: 'form' },
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointNotReflecting);
});
