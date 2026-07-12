import type { Rule } from '../../core/contract/enums';
import type { RuleDef } from '../../core/contract/interfaces';
import type { HttpRuleContext } from '../../http/context';
import type { FetchClauseId } from '../../standards/catalog/fetch';
import type { ProbeSpec } from './craft-probe';

import { SkipReason, Verdict } from '../../core/contract/enums';
import { fieldValues } from '../../http/decode/fields';
import { hasEmptyListElement, splitFieldList } from '../../normative/field-list';
import { isToken } from '../../normative/token';
import { refsFor } from './clause-refs';
import { defineHttpResponseRule } from './http-response-rule';

interface TokenListSpec {
  readonly id: Rule;
  /** The list header (ACAM / ACAH / ACEH) whose elements must be tokens with no empty members. */
  readonly header: string;
  readonly probes: readonly ProbeSpec[];
  readonly clauses: readonly FetchClauseId[];
}

/**
 * §1.5 — ACAM/ACAH/ACEH are `#`-list headers: each element is a `token = 1*tchar` and a sender MUST
 * NOT generate empty list elements. Duplicate field lines are read joined by 0x2C 0x20, so the
 * effective value is judged. An entirely empty value is the legal zero-element list (Pass); a
 * leading/trailing/double comma is an empty element (Fail); any non-token element fails. `*` is a
 * valid tchar, so a bare `*` passes here — the wildcard-with-credentials rule judges that concern.
 */
export function defineTokenListRule(spec: TokenListSpec): RuleDef<HttpRuleContext> {
  return defineHttpResponseRule({
    id: spec.id,
    normative: refsFor(...spec.clauses),
    probes: spec.probes,
    judge(heads) {
      const [head] = heads;
      if (head === undefined) {
        return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
      }
      const values = fieldValues(head, spec.header);
      if (values.length === 0) {
        return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
      }
      const combined = values.join(', ');
      if (combined.trim().length === 0) {
        return { verdict: Verdict.Pass };
      }
      if (hasEmptyListElement(combined)) {
        return { verdict: Verdict.Fail };
      }
      return splitFieldList(combined).every(isToken) ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
    },
  });
}
