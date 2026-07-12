import { test, expect } from 'bun:test';

import type { ProbeFn } from '../http/context';

import { Verdict } from '../core/contract/enums';
import { startRawOrigin } from '../testkit/origin/raw-origin';
import { probe as sendProbe } from '../transport/tcp/socket-probe';
import { clTeConflict } from './cl-te-conflict';

const TARGET = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const boundProbe =
  (port: number): ProbeFn =>
  async bytes =>
    sendProbe({ host: '127.0.0.1', port, bytes, timeoutMs: 500 });

test('warns on a permissive origin that accepts a CL+TE request over a real socket', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  try {
    const result = await clTeConflict.run({ probe: boundProbe(origin.port), target: TARGET });
    expect(result.verdict).toBe(Verdict.Warn);
  } finally {
    await origin.close();
  }
});

test('clears a conformant origin that rejects a CL+TE request with 400', async () => {
  const origin = await startRawOrigin('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  try {
    const result = await clTeConflict.run({ probe: boundProbe(origin.port), target: TARGET });
    expect(result.verdict).toBe(Verdict.Pass);
  } finally {
    await origin.close();
  }
});
