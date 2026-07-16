import type { ClauseResult, RuleDef } from '../../core/contract/interfaces';
import type { HttpRuleContext } from '../../http/context';
import type { ResponseHead } from '../../http/decode/interfaces';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { ProbeSpec } from './craft-probe';
import type { Judgment } from './probe-run';

import { craftProbe } from './craft-probe';
import { judgmentResult, runProbes } from './probe-run';

interface HttpResponseRuleSpec {
  readonly id: RuleDef<HttpRuleContext>['id'];
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** The well-formed probes this rule sends, in order, each over its own connection. */
  readonly probes: readonly ProbeSpec[];
  /** Pure: every head is parsed before the judge sees it, so it never handles transport failure. */
  judge(heads: readonly ResponseHead[]): Judgment;
}

/**
 * Build an HTTP-response rule: craft the rule's well-formed probes against the caller's target, send
 * them, parse every response head, and hand the heads to a pure judge. Transport trouble never
 * reaches the judge — an unreachable peer is a connectivity-inconclusive, an unparseable head is a
 * malformed-response inconclusive — so a rule only ever reasons about headers a browser would see.
 * A thin wrapper over the shared `runProbes`/`judgmentResult` core (see `probe-run.ts`): its `build`
 * step is just the identity — a head IS the exchange this kit hands the judge.
 */
export function defineHttpResponseRule(spec: HttpResponseRuleSpec): RuleDef<HttpRuleContext> {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext): Promise<ClauseResult> {
      const outcome = await runProbes(spec.id, context.target, context.probe, spec.probes, craftProbe, head => head);
      if (!outcome.ok) {
        return outcome.result;
      }
      return judgmentResult(spec.id, spec.judge(outcome.exchanges), outcome.evidenceAt);
    },
  };
}

export type { Judgment, HttpResponseRuleSpec };
