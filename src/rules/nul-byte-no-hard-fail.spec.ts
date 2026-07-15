import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { nulByteNoHardFail } from './nul-byte-no-hard-fail';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };

test('warns when the hostile NUL-byte vector 5xxs after a stable control', async () => {
  const out = await nulByteNoHardFail.run({
    probe: replay('HTTP/1.1 200 OK\r\n\r\n', 'HTTP/1.1 500 Internal Server Error\r\n\r\n'),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Warn);
});

test('passes when the hostile vector is handled without a 5xx (2xx)', async () => {
  const out = await nulByteNoHardFail.run({
    probe: replay('HTTP/1.1 200 OK\r\n\r\n', 'HTTP/1.1 200 OK\r\n\r\n'),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('passes when the hostile vector is handled without a 5xx (4xx)', async () => {
  const out = await nulByteNoHardFail.run({
    probe: replay('HTTP/1.1 200 OK\r\n\r\n', 'HTTP/1.1 400 Bad Request\r\n\r\n'),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as endpoint-unstable when the control itself is not 2xx/3xx', async () => {
  const out = await nulByteNoHardFail.run({
    probe: replay('HTTP/1.1 500 Internal Server Error\r\n\r\n'),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is tagged with CWE-20', () => {
  expect(nulByteNoHardFail.tags?.cwe).toEqual(['CWE-20']);
});
