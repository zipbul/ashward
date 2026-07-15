import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineQueryStatusHeuristic } from './kit/query-status-probe';

/**
 * Q2 — robustness heuristic (CWE-20), relatesTo §2.5 (utf8-replacement-on-decode). A control-guarded
 * hostile query carrying an invalid UTF-8 percent sequence (`%FF`) that yields a 5xx suggests the
 * decoder does not fail closed to U+FFFD as the parsing algorithm requires — not a MUST-Fail.
 */
export const invalidUtf8NoHardFail = defineQueryStatusHeuristic({
  id: Rule.InvalidUtf8NoHardFail,
  tags: { cwe: ['CWE-20'] },
  rawQuery: 'a=%FF',
  normative: refsFor(UrlencodedClauseId.Utf8ReplacementOnDecode),
});
