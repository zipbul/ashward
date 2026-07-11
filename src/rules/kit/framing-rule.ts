import type { Rule } from '../../core/contract/enums';
import type { ClauseResult, RuleDef } from '../../core/contract/interfaces';
import type { HttpRuleContext } from '../../http/context';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';

import { Verdict, InconclusiveReason } from '../../core/contract/enums';
import { parseStatusLine } from '../../http/decode/head-lex';
import { FramingOutcome } from '../../http/enums';
import { classifyFramingOutcome } from '../../http/reject';
import { TerminationCause } from '../../transport/tcp/enums';

/** Map how the exchange ended to the typed reason an inconclusive verdict carries. */
function inconclusiveReasonFor(termination: TerminationCause): InconclusiveReason {
  if (termination === TerminationCause.Timeout) {
    return InconclusiveReason.Timeout;
  }
  if (termination === TerminationCause.Unreachable) {
    return InconclusiveReason.ConnectionRefused;
  }
  return InconclusiveReason.AmbiguousFraming;
}

export interface FramingRuleSpec {
  readonly id: Rule;
  /** The deliberately malformed/ambiguous request whose rejection this rule requires. */
  readonly request: Uint8Array;
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
}

/**
 * Build a framing rule: send one crafted request and judge whether the origin refused it
 * (Pass), processed it (Fail — the parser discrepancy), or gave nothing to conclude on.
 * The judgment is shared; rules differ only in the bytes they send and what they cite.
 */
export function defineFramingRule(spec: FramingRuleSpec): RuleDef<HttpRuleContext> {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext): Promise<ClauseResult> {
      const probed = await context.probe(spec.request);
      const statusLine = parseStatusLine(probed.response);
      const outcome = classifyFramingOutcome({ statusLine, termination: probed.termination });

      const evidence = {
        request: spec.request,
        response: probed.response,
        outcome: probed.termination,
      };

      if (outcome === FramingOutcome.Rejected) {
        return { ruleId: spec.id, verdict: Verdict.Pass, evidence };
      }
      if (outcome === FramingOutcome.Accepted) {
        return { ruleId: spec.id, verdict: Verdict.Fail, evidence };
      }
      return {
        ruleId: spec.id,
        verdict: Verdict.Inconclusive,
        reason: inconclusiveReasonFor(probed.termination),
        evidence,
      };
    },
  };
}
