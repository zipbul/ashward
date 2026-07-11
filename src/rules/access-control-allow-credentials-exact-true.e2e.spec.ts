import { test, expect } from 'bun:test';

import type { ProbeFn } from '../core/contract/types';
import type { Target } from '../core/engine/interfaces';

import { Verdict } from '../core/contract/enums';
import { probe as sendProbe } from '../core/driver/socket-probe';
import { startRawOrigin } from '../testkit/origin/raw-origin';
import { accessControlAllowCredentialsExactTrue } from './access-control-allow-credentials-exact-true';

const context = (port: number): { probe: ProbeFn; target: Target } => ({
  probe: async bytes => sendProbe({ host: '127.0.0.1', port, bytes, timeoutMs: 500 }),
  target: { host: '127.0.0.1', port, path: '/', timeoutMs: 500 },
});

test('flags a broken origin that sends a non-true Access-Control-Allow-Credentials over a real socket', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nAccess-Control-Allow-Credentials: True\r\nConnection: close\r\n\r\n');
  try {
    expect((await accessControlAllowCredentialsExactTrue.run(context(origin.port))).verdict).toBe(Verdict.Fail);
  } finally {
    await origin.close();
  }
});

test('clears an origin that sends the exact bytes true', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nAccess-Control-Allow-Credentials: true\r\nConnection: close\r\n\r\n');
  try {
    expect((await accessControlAllowCredentialsExactTrue.run(context(origin.port))).verdict).toBe(Verdict.Pass);
  } finally {
    await origin.close();
  }
});
