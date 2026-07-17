import type { RuleDef } from '../../core/contract/interfaces';
import type { HttpRuleContext } from '../../http/context';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';

import { InconclusiveReason, Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { parseResponseHead } from '../../http/decode/head-parse';
import { craftRequest } from '../../http/encode/request';
import { isServerError } from '../../normative/ok-status';
import { TerminationCause } from '../../transport/tcp/enums';
import { appendRawQuery, authorityFor } from './craft-probe';
import { classifyExchange } from './probe-run';

interface QueryStatusHeuristicSpec {
  readonly id: Rule;
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** The hostile query vector's raw octets (appended verbatim after `?`). */
  readonly rawQuery: string;
}

function isControlStable(statusCode: number): boolean {
  return (statusCode >= 200 && statusCode <= 299) || (statusCode >= 300 && statusCode <= 399);
}

/**
 * PLAN §4a — a control-guarded 5xx-status robustness heuristic, shared by Q1-Q4. A 5xx doesn't
 * prove the *parser* threw, so this is a heuristic (Warn), never a MUST-Fail. Sends a stable
 * control `?a=1` first: control status not 2xx/3xx → Skip(EndpointUnstable). Otherwise sends the
 * hostile `?<rawQuery>` vector: a 5xx response is the heuristic signal firing (Warn); anything else
 * (2xx/3xx/4xx) → Pass (no signal). Both probes reuse the reflect-rule's query-appending discipline
 * (`craftRequest` CR/LF-guards the composed target) but never touch `context.reflect` — this kit
 * runs against ANY endpoint, opted-in or not.
 */
export function defineQueryStatusHeuristic(spec: QueryStatusHeuristicSpec): RuleDef<HttpRuleContext> {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext) {
      const host = authorityFor(context.target);

      let controlRequest: Uint8Array;
      let hostileRequest: Uint8Array;
      try {
        controlRequest = craftRequest({ method: 'GET', target: appendRawQuery(context.target.path, 'a=1'), host, headers: [] });
        hostileRequest = craftRequest({
          method: 'GET',
          target: appendRawQuery(context.target.path, spec.rawQuery),
          host,
          headers: [],
        });
      } catch {
        return { ruleId: spec.id, verdict: Verdict.Inconclusive, reason: InconclusiveReason.DriverError };
      }

      const controlResult = await context.probe(controlRequest);
      const controlEvidence = { request: controlRequest, response: controlResult.response, outcome: controlResult.termination };
      if (controlResult.termination === TerminationCause.Unreachable) {
        return {
          ruleId: spec.id,
          verdict: Verdict.Inconclusive,
          reason: InconclusiveReason.ConnectionRefused,
          evidence: controlEvidence,
        };
      }
      const controlHead = parseResponseHead(controlResult.response);
      if (controlHead === null || !isControlStable(controlHead.statusLine.statusCode)) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable, evidence: controlEvidence };
      }

      const hostileResult = await context.probe(hostileRequest);
      const hostileEvidence = { request: hostileRequest, response: hostileResult.response, outcome: hostileResult.termination };
      const hostileClassified = classifyExchange(hostileResult);
      if (!hostileClassified.ok) {
        return { ruleId: spec.id, verdict: Verdict.Inconclusive, reason: hostileClassified.reason, evidence: hostileEvidence };
      }

      return isServerError(hostileClassified.head.statusLine.statusCode)
        ? { ruleId: spec.id, verdict: Verdict.Warn, evidence: hostileEvidence }
        : { ruleId: spec.id, verdict: Verdict.Pass, evidence: hostileEvidence };
    },
  };
}
