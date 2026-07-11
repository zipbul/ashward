import { test, expect } from 'bun:test';

import { BUILTIN_RULES } from '../../rules/constants';
import { startRawOrigin } from '../../testkit/origin/raw-origin';
import { Verdict } from '../contract/enums';
import { runRules } from './run';

test('runRules binds a probe to the target and fails on a permissive origin', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  try {
    const report = await runRules({ host: '127.0.0.1', port: origin.port, timeoutMs: 500 }, BUILTIN_RULES);
    expect(report.ok()).toBe(false);
  } finally {
    await origin.close();
  }
});

test('runRules does not block on a conformant origin that rejects the malformed frame', async () => {
  // A bare 4xx with no CORS headers: framing rules pass, CORS rules skip (header-absent).
  // Neither blocks, so the report is ok — a conformant origin is never flagged.
  const origin = await startRawOrigin('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  try {
    const report = await runRules({ host: '127.0.0.1', port: origin.port, timeoutMs: 500 }, BUILTIN_RULES);
    expect(report.ok()).toBe(true);
    expect(report.results.some(r => r.verdict === Verdict.Fail)).toBe(false);
  } finally {
    await origin.close();
  }
});
