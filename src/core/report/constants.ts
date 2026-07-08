import type { ReportPolicy } from './interfaces';

import { Verdict } from '../contract/enums';
import { InconclusiveHandling } from './enums';

/** Fail only on hard failures; treat warnings and inconclusive results as non-blocking. */
export const DEFAULT_POLICY: ReportPolicy = {
  failOn: Verdict.Fail,
  inconclusive: InconclusiveHandling.Ignore,
};
