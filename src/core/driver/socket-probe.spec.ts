import { test, expect, beforeEach, afterEach } from 'bun:test';
import { createServer, type Server, type Socket } from 'node:net';
import { probe } from './socket-probe';
import { TerminationCause } from './enums';

/**
 * A controlled raw TCP server is the driver's real outside-world collaborator.
 * Each test wires a fresh handler that decides how the peer behaves on the wire.
 */
let server: Server;
let port: number;

function listen(onConn: (socket: Socket) => void): Promise<void> {
  server = createServer(onConn);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      resolve();
    });
  });
}

beforeEach(() => {
  // fresh handle per test; the listen() call in each test installs the behavior
});

afterEach(() => {
  server?.close();
});

const REQUEST = new TextEncoder().encode('GET / HTTP/1.1\r\nHost: t\r\n\r\n');

test('captures the full response bytes the peer sends before FIN', async () => {
  await listen((socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });

  const result = await probe({ host: '127.0.0.1', port, bytes: REQUEST, timeoutMs: 500 });

  expect(new TextDecoder().decode(result.response)).toBe(
    'HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n',
  );
});

test('reports fin termination when the peer half-closes cleanly', async () => {
  await listen((socket) => {
    socket.end('HTTP/1.1 200 OK\r\n\r\n');
  });

  const result = await probe({ host: '127.0.0.1', port, bytes: REQUEST, timeoutMs: 500 });

  expect(result.termination).toBe(TerminationCause.Fin);
});

// SKIP: Bun's node:net resetAndDestroy() emits a clean FIN (verified: 'end', hadError=false),
// not a TCP RST, so an in-process fixture can't trigger the ECONNRESET path. The 'rst' branch
// stays in the driver for real peers (proxies do send RSTs). Follow-up: cover it with a raw
// SO_LINGER=0 socket source or an integration fixture once one exists.
test.skip('reports rst termination when the peer aborts the connection', async () => {
  await listen((socket) => {
    socket.resetAndDestroy();
  });

  const result = await probe({ host: '127.0.0.1', port, bytes: REQUEST, timeoutMs: 500 });

  expect(result.termination).toBe(TerminationCause.Rst);
});

test('reports timeout termination when the peer never responds', async () => {
  await listen(() => {
    // accept and hang: never write, never close
  });

  const result = await probe({ host: '127.0.0.1', port, bytes: REQUEST, timeoutMs: 100 });

  expect(result.termination).toBe(TerminationCause.Timeout);
});

test('returns empty response when the peer times out without sending bytes', async () => {
  await listen(() => {
    // hang
  });

  const result = await probe({ host: '127.0.0.1', port, bytes: REQUEST, timeoutMs: 100 });

  expect(result.response.length).toBe(0);
});

test('accumulates a response delivered across multiple chunks', async () => {
  await listen((socket) => {
    socket.write('HTTP/1.1 200 OK\r\n');
    setTimeout(() => socket.end('Content-Length: 0\r\n\r\n'), 10);
  });

  const result = await probe({ host: '127.0.0.1', port, bytes: REQUEST, timeoutMs: 500 });

  expect(new TextDecoder().decode(result.response)).toBe('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
});

test('rejects when the connection is refused', async () => {
  // Bind then immediately release a port so nothing is listening on it.
  const throwaway = createServer();
  const deadPort = await new Promise<number>((resolve) => {
    throwaway.listen(0, '127.0.0.1', () => {
      const p = (throwaway.address() as { port: number }).port;
      throwaway.close(() => resolve(p));
    });
  });
  // A no-op listen() so afterEach has a server to close.
  await listen(() => {});

  await expect(
    probe({ host: '127.0.0.1', port: deadPort, bytes: REQUEST, timeoutMs: 300 }),
  ).rejects.toThrow();
});
