import type { NormativeRef } from '../../standards/interfaces';

import { normativeFor } from '../../standards/catalog';

/**
 * The normative citations for the given clauses, flattened and de-duplicated by (doc, locator) — so
 * a rule enforcing a clause cites exactly what the catalog (catalog.spec-checked) records, never a
 * hand-retyped list that could drift. Clause ids come from each catalog module's own id enum.
 */
export function refsFor(...clauseIds: readonly string[]): readonly NormativeRef[] {
  const seen = new Set<string>();
  const out: NormativeRef[] = [];
  for (const id of clauseIds) {
    for (const ref of normativeFor(id)) {
      const key = `${ref.doc.code}|${ref.locator.kind}|${ref.locator.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(ref);
      }
    }
  }
  return out;
}
