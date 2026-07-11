import type { ProbeResult } from '../driver/interfaces';
import type { InconclusiveReason, SkipReason } from './enums';

/** A target-bound probe the engine hands to a rule: send request bytes, get the raw result. */
export type ProbeFn = (bytes: Uint8Array) => Promise<ProbeResult>;

/** Every non-pass/fail verdict carries a typed reason — the two vocabularies never mix. */
export type ClauseReason = InconclusiveReason | SkipReason;
