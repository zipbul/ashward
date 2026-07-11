import type { Rule } from '../../core/contract/enums';
import type { ClauseResult, RuleDef } from '../../core/contract/interfaces';
import type { HttpRuleContext } from '../../http/context';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';

import { InconclusiveReason, Verdict } from '../../core/contract/enums';
import { parseStatusLine } from '../../http/decode/head-lex';
import { FramingOutcome } from '../../http/enums';
import { classifyFramingOutcome } from '../../http/reject';
import { TerminationCause } from '../../transport/tcp/enums';
import { authorityFor } from './craft-probe';

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
  /** Builds the deliberately malformed/ambiguous request for the caller's `Host` authority and
   *  request-target `path` — so the frame reaches the resource-under-test's parser instead of being
   *  turned away by Host or path (404) validation first. */
  readonly request: (host: string, path: string) => Uint8Array;
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** The verdict when the origin PROCESSES the ambiguous frame: Fail for a MUST-reject clause
   *  (divergent Content-Length, RFC 9112 §6.3), Warn for a SHOULD ("ought to be handled as an error",
   *  CL+TE §6.1) where a self-consistent origin is defensible. */
  readonly onAccepted: Verdict.Fail | Verdict.Warn;
}

/**
 * Build a framing rule: send one crafted request (its `Host` taken from the caller's target) and
 * judge whether the origin refused it (Pass), processed it (its `onAccepted` verdict — the parser
 * discrepancy), or gave nothing to conclude on. The judgment is shared; rules differ only in the
 * bytes they send, the severity of acceptance, and what they cite.
 */
export function defineFramingRule(spec: FramingRuleSpec): RuleDef<HttpRuleContext> {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext): Promise<ClauseResult> {
      const request = spec.request(authorityFor(context.target), context.target.path);
      const probed = await context.probe(request);
      const statusLine = parseStatusLine(probed.response);
      const outcome = classifyFramingOutcome({ statusLine, termination: probed.termination });

      const evidence = {
        request,
        response: probed.response,
        outcome: probed.termination,
      };

      if (outcome === FramingOutcome.Rejected) {
        return { ruleId: spec.id, verdict: Verdict.Pass, evidence };
      }
      if (outcome === FramingOutcome.Accepted) {
        return { ruleId: spec.id, verdict: spec.onAccepted, evidence };
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
