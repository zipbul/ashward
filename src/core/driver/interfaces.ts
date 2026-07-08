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
