import type { ProbeResult } from '../driver/interfaces';

/** A target-bound probe the engine hands to a rule: send request bytes, get the raw result. */
export type ProbeFn = (bytes: Uint8Array) => Promise<ProbeResult>;
