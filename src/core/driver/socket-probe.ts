import { connect } from 'node:net';

import type { ProbeInput, ProbeResult } from './interfaces';

import { TerminationCause } from './enums';

/**
 * The dumb byte probe: one connection, write the exact request bytes, read the raw
 * response until the peer terminates, and classify how it terminated. It never frames,
 * decodes, or normalizes — interpretation is the rules' job over these raw bytes.
 */
export async function probe(input: ProbeInput): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const socket = connect({ host: input.host, port: input.port });

    const finish = (termination: TerminationCause): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve({ response: Buffer.concat(chunks), termination });
    };

    socket.setTimeout(input.timeoutMs);
    socket.on('connect', () => socket.write(input.bytes));
    socket.on('data', (chunk: Buffer) => chunks.push(chunk));
    socket.on('end', () => {
      finish(TerminationCause.Fin);
    });
    socket.on('timeout', () => {
      finish(TerminationCause.Timeout);
    });
    socket.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        finish(TerminationCause.Rst);
        return;
      }
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(err);
      }
    });
  });
}
