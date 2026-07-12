import { connect } from 'node:net';

import type { ProbeInput, ProbeResult } from './interfaces';
import type { Connector } from './types';

import { TerminationCause } from './enums';

const nodeConnector: Connector = endpoint => connect(endpoint);

/**
 * The dumb byte probe: one connection, write the exact request bytes, read the raw response until
 * the peer terminates, and classify how it terminated. It never frames, decodes, or normalizes —
 * interpretation is the rules' job over these raw bytes. It also never rejects: a transport failure
 * (refused, DNS, unreachable, …) resolves as an Unreachable termination so a dead / misconfigured
 * target becomes an inconclusive verdict, never a throw out of ashward().
 */
export async function probe(input: ProbeInput, connector: Connector = nodeConnector): Promise<ProbeResult> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    let settled = false;
    const socket = connector({ host: input.host, port: input.port });

    const finish = (termination: TerminationCause): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve({ response: Buffer.concat(chunks), termination });
    };

    socket.setTimeout(input.timeoutMs);
    socket.on('connect', () => {
      socket.write(input.bytes);
    });
    socket.on('data', chunk => {
      chunks.push(chunk);
    });
    socket.on('end', () => {
      finish(TerminationCause.Fin);
    });
    socket.on('timeout', () => {
      finish(TerminationCause.Timeout);
    });
    socket.on('error', error => {
      // An established peer resetting the frame is a genuine refusal (Rst); anything else — refused,
      // DNS failure, host/net unreachable, connect error — is a failure to reach the target.
      finish(error.code === 'ECONNRESET' || error.code === 'EPIPE' ? TerminationCause.Rst : TerminationCause.Unreachable);
    });
  });
}
