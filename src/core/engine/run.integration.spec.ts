import { test, expect } from 'bun:test';
import { runRules } from './run';
import { Verdict } from '../contract/enums';
import { BUILTIN_RULES } from '../../rules/constants';
import { startRawOrigin } from '../../testkit/origin/raw-origin';

test('runRules binds a probe to the target and fails on a permissive origin', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  try {
    const report = await runRules(
      { host: '127.0.0.1', port: origin.port, timeoutMs: 500 },
      BUILTIN_RULES,
    );
    expect(report.ok()).toBe(false);
  } finally {
    await origin.close();
  }
});

test('runRules passes a conformant origin that rejects the malformed frame', async () => {
  const origin = await startRawOrigin('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  try {
    const report = await runRules(
      { host: '127.0.0.1', port: origin.port, timeoutMs: 500 },
      BUILTIN_RULES,
    );
    expect(report.results.every((r) => r.verdict === Verdict.Pass)).toBe(true);
  } finally {
    await origin.close();
  }
});
