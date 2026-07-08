import type { TerminationCause } from './enums';

export interface ProbeInput {
  readonly host: string;
  readonly port: number;
  /** Exact request bytes, malformed allowed. The driver never frames or normalizes. */
  readonly bytes: Uint8Array;
  /** Upper bound on waiting for the peer; on elapse the exchange ends as a timeout. */
  readonly timeoutMs: number;
}

export interface ProbeResult {
  /** Raw response bytes captured until termination. Empty when the peer sent nothing. */
  readonly response: Uint8Array;
  readonly termination: TerminationCause;
}

/** The minimal socket surface the probe drives — satisfied by node's net.Socket and by a
 *  test fake, so termination branches (including RST) are deterministically coverable. */
export interface ProbeSocket {
  setTimeout(timeoutMs: number): void;
  write(data: Uint8Array): void;
  destroy(): void;
  on(event: 'connect', listener: () => void): void;
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'timeout', listener: () => void): void;
  on(event: 'error', listener: (error: NodeJS.ErrnoException) => void): void;
}
