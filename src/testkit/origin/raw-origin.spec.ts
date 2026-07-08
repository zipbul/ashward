import { test, expect } from 'bun:test';
import { connect } from 'node:net';
import { startRawOrigin } from './raw-origin';

/** Read a full response from the raw origin over a real socket. */
function fetchRaw(port: number, request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = connect({ host: '127.0.0.1', port }, () => socket.write(request));
    socket.on('data', (chunk: Buffer) => chunks.push(chunk));
    socket.on('end', () => resolve(Buffer.concat(chunks).toString()));
    socket.on('error', reject);
  });
}

test('serves the canned response regardless of the request', async () => {
  const origin = await startRawOrigin('HTTP/1.1 418 I am a teapot\r\n\r\n');
  try {
    const response = await fetchRaw(origin.port, 'GET / HTTP/1.1\r\nHost: t\r\n\r\n');
    expect(response).toBe('HTTP/1.1 418 I am a teapot\r\n\r\n');
  } finally {
    await origin.close();
  }
});

test('close resolves and frees the port', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\n\r\n');
  await expect(origin.close()).resolves.toBeUndefined();
});
