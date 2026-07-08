import { createServer, type Socket } from 'node:net';
import type { RawOrigin } from './interfaces';

/**
 * A raw TCP origin that replies with a fixed response regardless of the request framing.
 * It models both halves of the acceptance bar: a permissive/vulnerable origin (canned 2xx,
 * i.e. it "accepted" a malformed frame) and a conformant one (canned 4xx / connection close).
 */
export function startRawOrigin(cannedResponse: string): Promise<RawOrigin> {
  const server = createServer((socket: Socket) => {
    socket.on('data', () => socket.end(cannedResponse));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
