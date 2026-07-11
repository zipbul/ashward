import type { Rule } from '../../../core/contract/enums';
import type { RuleContext, ClauseResult, RuleDef } from '../../../core/contract/interfaces';
import type { NormativeRef, Taxonomy } from '../../../standards/interfaces';

import { Verdict, InconclusiveReason } from '../../../core/contract/enums';
import { TerminationCause } from '../../../core/driver/enums';
import { parseStatusLine } from '../../../http/decode/head-lex';
import { FramingOutcome } from '../../../http/enums';
import { classifyFramingOutcome } from '../../../http/reject';

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
export function defineFramingRule(spec: FramingRuleSpec): RuleDef {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: RuleContext): Promise<ClauseResult> {
      const probed = await context.probe(spec.request);
      const statusLine = parseStatusLine(probed.response);
      const outcome = classifyFramingOutcome({ statusLine, termination: probed.termination });

      const evidence = {
        request: spec.request,
        response: probed.response,
        termination: probed.termination,
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
        reason:
          probed.termination === TerminationCause.Timeout ? InconclusiveReason.Timeout : InconclusiveReason.AmbiguousFraming,
        evidence,
      };
    },
  };
}
