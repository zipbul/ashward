import { test, expect } from 'bun:test';

import { Rule, Verdict } from '../core/contract/enums';
import { startRawOrigin } from '../testkit/origin/raw-origin';
import { ashward } from './ashward';

test('reports not-ok against an origin that accepts duplicate Content-Length', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  try {
    const report = await ashward(`http://127.0.0.1:${origin.port}`);
    expect(report.ok()).toBe(false);
  } finally {
    await origin.close();
  }
});

test('reports ok against an origin that rejects duplicate Content-Length', async () => {
  const origin = await startRawOrigin('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  try {
    const report = await ashward(`http://127.0.0.1:${origin.port}`);
    expect(report.ok()).toBe(true);
  } finally {
    await origin.close();
  }
});

test('surfaces the duplicate-content-length verdict in the results', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  try {
    const report = await ashward(`http://127.0.0.1:${origin.port}`);
    const clause = report.results.find(r => r.ruleId === Rule.DuplicateContentLength);
    expect(clause?.verdict).toBe(Verdict.Fail);
  } finally {
    await origin.close();
  }
});
