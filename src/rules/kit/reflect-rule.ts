import type { RuleDef } from '../../core/contract/interfaces';
import type { HttpRuleContext } from '../../http/context';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';

import { InconclusiveReason, Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { decodeBody } from '../../http/decode/body';
import { parseResponseHead } from '../../http/decode/head-parse';
import { craftRequest } from '../../http/encode/request';
import { isOkStatus } from '../../normative/ok-status';
import { TerminationCause } from '../../transport/tcp/enums';
import { authorityFor } from './craft-probe';

const bodyDecoder = new TextDecoder('utf-8', { fatal: false });

interface ReflectRuleSpec {
  readonly id: Rule;
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** Which reflection mode this rule exercises — must match `context.reflect.mode` to run at all. */
  readonly mode: 'form' | 'uri-generic';
  /** The exact raw query octets appended (verbatim) to `target.path` — from PLAN §4's tables. */
  readonly rawQuery: string;
  /** The oracle-computed ordered pair list the echo MUST match. */
  readonly expectedPairs: readonly (readonly [string, string])[];
}

/** True iff `value` is a JSON array of 2-element string-array pairs — the only shape a conforming
 *  echo route may return. Anything else (wrong arity, non-string elements, a non-array) is treated
 *  as "not reflecting", never judged. */
function isPairList(value: unknown): value is (readonly [string, string])[] {
  return (
    Array.isArray(value) &&
    value.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string')
  );
}

/**
 * Build a query-parser reflection rule (PLAN §2b/§4b): opt-in only — Skip(EndpointNotReflecting)
 * unless the caller declared `context.reflect.mode` matching this rule's `mode`. When opted in,
 * craft `GET {target.path}?{rawQuery}` (the raw query octets appended verbatim; `craftRequest`
 * still CR/LF-guards the composed target), probe it, and parse the response. A non-2xx status or a
 * body that is not valid JSON representing an ordered pair list is ALWAYS Skip(EndpointNotReflecting)
 * — never a Fail; the route, not the parser, would be at fault. Only a 2xx pair-list echo is judged:
 * Pass iff it deep-equals the oracle `expectedPairs`, Fail otherwise.
 */
export function defineReflectRule(spec: ReflectRuleSpec): RuleDef<HttpRuleContext> {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext) {
      if (context.reflect === undefined || context.reflect.mode !== spec.mode) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointNotReflecting };
      }

      const host = authorityFor(context.target);
      let request: Uint8Array;
      try {
        request = craftRequest({ method: 'GET', target: `${context.target.path}?${spec.rawQuery}`, host, headers: [] });
      } catch {
        // A CR/LF-bearing rawQuery vector could not even be crafted: a driver-side setup failure,
        // never a throw out of ashward() — surface it as a connectivity-class inconclusive.
        return { ruleId: spec.id, verdict: Verdict.Inconclusive, reason: InconclusiveReason.DriverError };
      }

      const result = await context.probe(request);
      const evidence = { request, response: result.response, outcome: result.termination };

      if (result.termination === TerminationCause.Unreachable) {
        return { ruleId: spec.id, verdict: Verdict.Inconclusive, reason: InconclusiveReason.ConnectionRefused, evidence };
      }
      const head = parseResponseHead(result.response);
      if (head === null) {
        return {
          ruleId: spec.id,
          verdict: Verdict.Inconclusive,
          reason:
            result.termination === TerminationCause.Timeout ? InconclusiveReason.Timeout : InconclusiveReason.MalformedResponse,
          evidence,
        };
      }
      if (!isOkStatus(head.statusLine.statusCode)) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointNotReflecting, evidence };
      }

      const { content } = decodeBody(result.response, head);
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyDecoder.decode(content));
      } catch {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointNotReflecting, evidence };
      }
      if (!isPairList(parsed)) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointNotReflecting, evidence };
      }

      const matches = JSON.stringify(parsed) === JSON.stringify(spec.expectedPairs);
      return { ruleId: spec.id, verdict: matches ? Verdict.Pass : Verdict.Fail, evidence };
    },
  };
}

export type { ReflectRuleSpec };
