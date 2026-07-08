import type { ClauseResult } from '../contract/interfaces';

/** Render blocking results as a per-clause message — the same text every runner surfaces. */
export function formatFailures(results: readonly ClauseResult[]): string {
  const header = `ashward: ${results.length} conformance check(s) failed`;
  const lines = results.map(result => {
    const reason = result.reason !== undefined ? ` (${result.reason})` : '';
    return `  ✗ ${result.ruleId} — ${result.verdict}${reason}`;
  });
  return [header, ...lines].join('\n');
}
