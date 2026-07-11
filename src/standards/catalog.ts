import type { Catalog, Clause, Disposition, Heuristic } from './catalog-types';
import type { NormativeRef } from './interfaces';

import { fetchCatalog } from './catalog/fetch';
import { rfc9112Catalog } from './catalog/rfc9112';

/**
 * The composed standards catalog. Each entry is one standard's self-contained account (clauses,
 * dispositions, heuristics, snapshot); adding a standard is adding a module here — never editing a
 * shared global enum, table, or snapshot. The composition-level invariants (global id uniqueness,
 * clause↔rule bijection) are checked in catalog.spec.ts.
 */
const CATALOGS: readonly Catalog[] = [fetchCatalog, rfc9112Catalog];

const ALL_CLAUSES: readonly Clause[] = CATALOGS.flatMap(catalog => catalog.clauses);
const ALL_DISPOSITIONS: readonly Disposition[] = CATALOGS.flatMap(catalog => catalog.dispositions);
const ALL_HEURISTICS: readonly Heuristic[] = CATALOGS.flatMap(catalog => catalog.heuristics);

const NORMATIVE_BY_CLAUSE = new Map<string, readonly NormativeRef[]>(ALL_CLAUSES.map(clause => [clause.id, clause.normative]));

/** The normative citations registered for a clause id across all catalogs (empty if unknown). */
function normativeFor(clauseId: string): readonly NormativeRef[] {
  return NORMATIVE_BY_CLAUSE.get(clauseId) ?? [];
}

export { ALL_CLAUSES, ALL_DISPOSITIONS, ALL_HEURISTICS, CATALOGS, normativeFor };
