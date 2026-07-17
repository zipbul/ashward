import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineQueryStatusHeuristic } from './kit/query-status-probe';

/**
 * Q4 — robustness heuristic (CWE-1321), relatesTo §2.3 (first-equals-splits; a concrete clause). A
 * control-guarded hostile query carrying a prototype-pollution-shaped key (`__proto__[x]=1`) that
 * yields a 5xx suggests an unguarded object-merge parser extension — not a MUST-Fail.
 */
export const prototypePollutionNoCrash = defineQueryStatusHeuristic({
  id: Rule.PrototypePollutionNoCrash,
  tags: { cwe: ['CWE-1321'] },
  rawQuery: '__proto__[x]=1',
  normative: refsFor(UrlencodedClauseId.FirstEqualsSplits),
});
