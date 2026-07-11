import { test, expect } from 'bun:test';
import { EventEmitter } from 'node:events';

import type { ProbeInput, ProbeSocket } from './interfaces';
import type { Connector } from './types';

import { TerminationCause } from './enums';
import { probe } from './socket-probe';

/** A controllable socket: the probe attaches listeners synchronously, then the test emits. */
class FakeSocket extends EventEmitter implements ProbeSocket {
  written: Uint8Array | null = null;
  destroyed = false;
  timeoutMs = 0;

  setTimeout(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
  }

  write(data: Uint8Array): void {
    this.written = data;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

const INPUT: ProbeInput = {
  host: '127.0.0.1',
  port: 1,
  bytes: new TextEncoder().encode('GET / HTTP/1.1\r\nHost: t\r\n\r\n'),
  timeoutMs: 500,
};

const connectorFor =
  (socket: FakeSocket): Connector =>
  () =>
    socket;

const errno = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code });

test('writes the request bytes once connected', () => {
  const socket = new FakeSocket();
  void probe(INPUT, connectorFor(socket));
  socket.emit('connect');
  expect(socket.written).toBe(INPUT.bytes);
});

test('arms the socket timeout with the configured budget', () => {
  const socket = new FakeSocket();
  void probe(INPUT, connectorFor(socket));
  expect(socket.timeoutMs).toBe(500);
});

test('captures the full response bytes received before FIN', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('data', Buffer.from('HTTP/1.1 400 Bad Request\r\n\r\n'));
  socket.emit('end');
  const result = await promise;
  expect(new TextDecoder().decode(result.response)).toBe('HTTP/1.1 400 Bad Request\r\n\r\n');
});

test('reports fin termination on a clean half-close', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('end');
  expect((await promise).termination).toBe(TerminationCause.Fin);
});

test('accumulates a response delivered across multiple chunks', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('data', Buffer.from('HTTP/1.1 200 OK\r\n'));
  socket.emit('data', Buffer.from('Content-Length: 0\r\n\r\n'));
  socket.emit('end');
  expect(new TextDecoder().decode((await promise).response)).toBe('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
});

test('reports timeout termination when the socket times out', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('timeout');
  expect((await promise).termination).toBe(TerminationCause.Timeout);
});

test('returns an empty response on timeout with no bytes received', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('timeout');
  expect((await promise).response.length).toBe(0);
});

test('reports rst termination on ECONNRESET', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('error', errno('ECONNRESET'));
  expect((await promise).termination).toBe(TerminationCause.Rst);
});

test('reports rst termination on EPIPE', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('error', errno('EPIPE'));
  expect((await promise).termination).toBe(TerminationCause.Rst);
});

test('reports unreachable termination on ECONNREFUSED (a dead server is inconclusive, not a throw)', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('error', errno('ECONNREFUSED'));
  expect((await promise).termination).toBe(TerminationCause.Unreachable);
});

test('reports unreachable termination on a DNS failure (ENOTFOUND) — a typo host must not crash', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('error', errno('ENOTFOUND'));
  expect((await promise).termination).toBe(TerminationCause.Unreachable);
});

test('reports unreachable termination on any other transport error (host unreachable) — never rejects', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('error', errno('EHOSTUNREACH'));
  expect((await promise).termination).toBe(TerminationCause.Unreachable);
});

test('returns an empty response on an unreachable connection', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('error', errno('ECONNREFUSED'));
  expect((await promise).response.length).toBe(0);
});

test('destroys the socket once settled', async () => {
  const socket = new FakeSocket();
  const promise = probe(INPUT, connectorFor(socket));
  socket.emit('end');
  await promise;
  expect(socket.destroyed).toBe(true);
});
