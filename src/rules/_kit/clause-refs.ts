import type { ClauseId } from '../../standards/enums';
import type { NormativeRef } from '../../standards/interfaces';

import { CLAUSES } from '../../standards/clauses';

const BY_ID = new Map(CLAUSES.map(clause => [clause.id, clause.normative]));

/**
 * The normative citations for the given clauses, flattened and de-duplicated by (doc, locator) — so
 * a rule enforcing a clause cites exactly what the clause index (disposition.spec-checked) records,
 * never a hand-retyped list that could drift out of step with the catalog.
 */
export function refsFor(...ids: readonly ClauseId[]): readonly NormativeRef[] {
  const seen = new Set<string>();
  const out: NormativeRef[] = [];
  for (const id of ids) {
    for (const ref of BY_ID.get(id) ?? []) {
      const key = `${ref.doc.code}|${ref.locator.kind}|${ref.locator.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ref);
      }
    }
  }
  return out;
}
