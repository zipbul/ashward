import type { ClauseResult } from '../contract/interfaces';
import type { Report, ReportPolicy } from './interfaces';

import { DEFAULT_POLICY } from './constants';
import { resolveOk } from './ok-policy';

/** Wrap raw clause results as an immutable Report whose ok() is a policy view, not a stored flag. */
export function buildReport(results: readonly ClauseResult[]): Report {
  return {
    results,
    ok(policy?: Partial<ReportPolicy>): boolean {
      return resolveOk(results, { ...DEFAULT_POLICY, ...policy });
    },
  };
}
