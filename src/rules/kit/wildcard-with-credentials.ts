import type { Rule } from '../../core/contract/enums';
import type { RuleDef } from '../../core/contract/interfaces';
import type { HttpRuleContext } from '../../http/context';
import type { FetchClauseId } from '../../standards/catalog/fetch';
import type { ProbeSpec } from './craft-probe';

import { SkipReason, Verdict } from '../../core/contract/enums';
import { fieldValues, singleFieldValue } from '../../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_CREDENTIALS } from '../../normative/header-names';
import { CREDENTIALS_TRUE, WILDCARD } from '../../normative/literals';
import { refsFor } from './clause-refs';
import { defineHttpResponseRule } from './http-response-rule';

interface WildcardWithCredentialsSpec {
  readonly id: Rule;
  /** The list header whose `*` value contradicts a credentialed grant. */
  readonly header: string;
  readonly probes: readonly ProbeSpec[];
  readonly clauses: readonly FetchClauseId[];
}

/**
 * §2.2 / §3.7 — `*` is only a wildcard when the request's credentials mode is not "include"; a server
 * that answers `<header>: *` AND `Access-Control-Allow-Credentials: true` has written a
 * self-contradiction (Fetch treats `*` as a literal name under credentials, so the grant never
 * applies). That contradiction is visible in the response alone — no cookie needed — so it is a
 * sound blackbox Fail. Absent header → nothing asserted (Skip); `*` without ACAC:true is the
 * conformant public-API shape (Pass). A repeated header collapses to null and is left to the
 * dedicated single/token-list rules (Skip here).
 */
export function defineWildcardWithCredentialsRule(spec: WildcardWithCredentialsSpec): RuleDef<HttpRuleContext> {
  return defineHttpResponseRule({
    id: spec.id,
    normative: refsFor(...spec.clauses),
    probes: spec.probes,
    judge(heads) {
      const [head] = heads;
      if (head === undefined) {
        return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
      }
      const value = singleFieldValue(head, spec.header);
      if (value === null) {
        return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
      }
      // A repeated ACAC collapses to null under singleFieldValue, so read every line: `*` alongside
      // any `true` ACAC (single or duplicated) is the contradiction.
      const credentialed = fieldValues(head, ACCESS_CONTROL_ALLOW_CREDENTIALS).includes(CREDENTIALS_TRUE);
      if (value === WILDCARD && credentialed) {
        return { verdict: Verdict.Fail };
      }
      return { verdict: Verdict.Pass };
    },
  });
}
