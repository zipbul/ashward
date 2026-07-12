import type { InconclusiveReason, SkipReason } from './enums';

/** Every non-pass/fail verdict carries a typed reason — the two vocabularies never mix. */
export type ClauseReason = InconclusiveReason | SkipReason;
