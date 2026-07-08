import type { ClauseResult } from '../contract/interfaces';

import { formatFailures } from './pretty-print';

/** Thrown by assertConformance when results block under the policy. Runner-agnostic: any
 *  test runner surfaces a thrown Error, and the per-clause detail rides on .results. */
export class AshwardError extends Error {
  readonly results: readonly ClauseResult[];

  constructor(blocking: readonly ClauseResult[]) {
    super(formatFailures(blocking));
    this.name = 'AshwardError';
    this.results = blocking;
  }
}
