import { test, expect } from 'bun:test';

import type { ProbeFn } from '../../../core/contract/types';

import { Verdict } from '../../../core/contract/enums';
import { probe as sendProbe } from '../../../core/driver/socket-probe';
import { startRawOrigin } from '../../../testkit/origin/raw-origin';
import { duplicateContentLength } from './duplicate-content-length';

const boundProbe =
  (port: number): ProbeFn =>
  async bytes =>
    sendProbe({ host: '127.0.0.1', port, bytes, timeoutMs: 500 });

test('flags a permissive origin that accepts duplicate Content-Length over a real socket', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  try {
    const result = await duplicateContentLength.run({ probe: boundProbe(origin.port) });
    expect(result.verdict).toBe(Verdict.Fail);
  } finally {
    await origin.close();
  }
});

test('clears a conformant origin that rejects duplicate Content-Length with 400', async () => {
  const origin = await startRawOrigin('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  try {
    const result = await duplicateContentLength.run({ probe: boundProbe(origin.port) });
    expect(result.verdict).toBe(Verdict.Pass);
  } finally {
    await origin.close();
  }
});
