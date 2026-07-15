import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineQueryStatusHeuristic } from './kit/query-status-probe';

/**
 * Q3 — robustness heuristic (CWE-20), relatesTo §1.6 (nul-byte-handling; the whole clause is
 * untestable — this heuristic relates to it without dispositioning it). A control-guarded hostile
 * query carrying a percent-encoded NUL byte (`%00`) that yields a 5xx suggests unvalidated input
 * reaching a C-string-bounded or similarly NUL-sensitive code path — not a MUST-Fail.
 */
export const nulByteNoHardFail = defineQueryStatusHeuristic({
  id: Rule.NulByteNoHardFail,
  tags: { cwe: ['CWE-20'] },
  rawQuery: 'a=%00',
  normative: refsFor(UrlencodedClauseId.NulByteHandling),
});
