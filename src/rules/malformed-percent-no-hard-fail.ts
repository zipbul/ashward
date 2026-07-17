import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineQueryStatusHeuristic } from './kit/query-status-probe';

/**
 * Q1 — robustness heuristic (CWE-20), relatesTo §2.6 (malformed-percent-preserved). A control-guarded
 * hostile query carrying a malformed percent-escape (`%zz`) that yields a 5xx suggests unvalidated
 * input reaching an unguarded decoder — not a MUST-Fail (a 5xx doesn't prove the *parser* threw).
 */
export const malformedPercentNoHardFail = defineQueryStatusHeuristic({
  id: Rule.MalformedPercentNoHardFail,
  tags: { cwe: ['CWE-20'] },
  rawQuery: 'a=%zz',
  normative: refsFor(UrlencodedClauseId.MalformedPercentPreserved),
});
