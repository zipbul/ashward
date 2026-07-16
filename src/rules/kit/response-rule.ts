import type { ClauseResult, RuleDef } from '../../core/contract/interfaces';
import type { HttpRuleContext } from '../../http/context';
import type { ResponseHead } from '../../http/decode/interfaces';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { ContentProbeOptions } from './content-probe';
import type { Judgment } from './probe-run';

import { decodeBody } from '../../http/decode/body';
import { craftContentProbe } from './content-probe';
import { judgmentResult, runProbes } from './probe-run';

/** One probe's fully-decoded exchange: the parsed head, the transfer-decoded content, and
 *  whether the message completed — everything a judge needs without touching raw bytes. */
interface ResponseExchange {
  readonly head: ResponseHead;
  readonly content: Uint8Array;
  readonly complete: boolean;
}

interface ResponseRuleSpec {
  readonly id: RuleDef<HttpRuleContext>['id'];
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** The well-formed probes this rule sends, in order, each over its own connection. */
  readonly probes: readonly ContentProbeOptions[];
  /** Pure: every exchange is head-parsed and body-decoded before the judge sees it, so it never
   *  handles transport failure. A judge that wants to treat an incomplete body as inconclusive
   *  returns `{verdict: Verdict.Inconclusive, reason: InconclusiveReason.IncompleteMessage}` —
   *  this kit only passes that reason through; it never decides incompleteness itself. */
  judge(exchanges: readonly ResponseExchange[]): Judgment;
}

/**
 * Build a body-bearing HTTP-response rule: craft the rule's well-formed probes against the caller's
 * target, send them, parse every response head and decode its content, and hand the decoded
 * exchanges to a pure judge. Transport trouble never reaches the judge — an unreachable peer is a
 * connectivity-inconclusive, an unparseable head is a malformed-response inconclusive — mirroring
 * `defineHttpResponseRule`'s discipline, with the decoded body attached alongside the head. A thin
 * wrapper over the shared `runProbes`/`judgmentResult` core (see `probe-run.ts`): its `build` step
 * additionally decodes the body, which the head-only kit deliberately never does.
 */
export function defineResponseRule(spec: ResponseRuleSpec): RuleDef<HttpRuleContext> {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext): Promise<ClauseResult> {
      const outcome = await runProbes(spec.id, context.target, context.probe, spec.probes, craftContentProbe, (head, result) => {
        const { content, complete } = decodeBody(result.response, head, result.termination);
        return { head, content, complete };
      });
      if (!outcome.ok) {
        return outcome.result;
      }
      return judgmentResult(spec.id, spec.judge(outcome.exchanges), outcome.evidenceAt);
    },
  };
}

export type { Judgment, ResponseExchange, ResponseRuleSpec };
