import { createServer, type Socket } from 'node:net';

import type { RawOrigin } from './interfaces';

/**
 * A raw TCP origin that replies with a fixed response regardless of the request framing.
 * It models both halves of the acceptance bar: a permissive/vulnerable origin (canned 2xx,
 * i.e. it "accepted" a malformed frame) and a conformant one (canned 4xx / connection close).
 */
export async function startRawOrigin(cannedResponse: string): Promise<RawOrigin> {
  const server = createServer((socket: Socket) => {
    socket.on('data', () => {
      socket.end(cannedResponse);
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('ashward testkit: expected a bound TCP address'));
        return;
      }
      resolve({
        port: address.port,
        close: async () =>
          new Promise(done => {
            server.close(() => {
              done();
            });
          }),
      });
    });
  });
}
