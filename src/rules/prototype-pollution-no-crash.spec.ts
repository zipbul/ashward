import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { prototypePollutionNoCrash } from './prototype-pollution-no-crash';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };

test('warns when the prototype-pollution-shaped vector 5xxs after a stable control', async () => {
  const out = await prototypePollutionNoCrash.run({
    probe: replay('HTTP/1.1 200 OK\r\n\r\n', 'HTTP/1.1 500 Internal Server Error\r\n\r\n'),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Warn);
});

test('passes when the hostile vector is handled without a 5xx', async () => {
  const out = await prototypePollutionNoCrash.run({
    probe: replay('HTTP/1.1 200 OK\r\n\r\n', 'HTTP/1.1 200 OK\r\n\r\n'),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Pass);
});

test('is skipped as endpoint-unstable when the control itself is not 2xx/3xx', async () => {
  const out = await prototypePollutionNoCrash.run({
    probe: replay('HTTP/1.1 500 Internal Server Error\r\n\r\n'),
    target: TARGET,
  });
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

test('is tagged with CWE-1321', () => {
  expect(prototypePollutionNoCrash.tags?.cwe).toEqual(['CWE-1321']);
});
