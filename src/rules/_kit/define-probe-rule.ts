import type { ClauseResult, Evidence, RuleContext, RuleDef } from '../../core/contract/interfaces';
import type { ClauseReason } from '../../core/contract/types';
import type { ProbeResult } from '../../core/driver/interfaces';
import type { ResponseHead } from '../../http/decode/interfaces';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { ProbeSpec } from './craft-probe';

import { InconclusiveReason, Verdict } from '../../core/contract/enums';
import { TerminationCause } from '../../core/driver/enums';
import { parseResponseHead } from '../../http/decode/head-parse';
import { craftProbe } from './craft-probe';

/** A rule's decision over the parsed response heads. `evidenceIndex` names which probe decided it,
 *  so a multi-probe rule attaches the exchange a reader actually needs to see (defaults to 0). */
interface Judgment {
  readonly verdict: Verdict;
  readonly reason?: ClauseReason;
  readonly evidenceIndex?: number;
}

interface ProbeRuleSpec {
  readonly id: RuleDef['id'];
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** The well-formed probes this rule sends, in order, each over its own connection. */
  readonly probes: readonly ProbeSpec[];
  /** Pure: every head is parsed before the judge sees it, so it never handles transport failure. */
  judge(heads: readonly ResponseHead[]): Judgment;
}

function withEvidence(evidence: Evidence | undefined): { evidence?: Evidence } {
  return evidence !== undefined ? { evidence } : {};
}

/**
 * Build a probe rule: craft the rule's well-formed probes against the caller's target, send them,
 * parse every response head, and hand the heads to a pure judge. Transport trouble never reaches
 * the judge — an unreachable peer is a connectivity-inconclusive, an unparseable head is a
 * malformed-response inconclusive — so a rule only ever reasons about headers a browser would see.
 */
export function defineProbeRule(spec: ProbeRuleSpec): RuleDef {
  const evidenceAt = (requests: readonly Uint8Array[], probed: readonly ProbeResult[], index: number): Evidence | undefined => {
    const result = probed[index];
    const request = requests[index];
    if (result === undefined || request === undefined) {
      return undefined;
    }
    return { request, response: result.response, termination: result.termination };
  };

  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: RuleContext): Promise<ClauseResult> {
      let requests: readonly Uint8Array[];
      try {
        requests = spec.probes.map(options => craftProbe(context.target, options));
      } catch {
        // A probe could not even be crafted (e.g. a CR/LF-bearing value the serializer refuses):
        // that is a driver-side setup failure, never a throw out of ashward() — surface it as a
        // connectivity-class inconclusive the fail-closed policy blocks on.
        return { ruleId: spec.id, verdict: Verdict.Inconclusive, reason: InconclusiveReason.DriverError };
      }
      const probed: ProbeResult[] = [];
      for (const request of requests) {
        probed.push(await context.probe(request));
      }

      const heads: ResponseHead[] = [];
      for (const [index, result] of probed.entries()) {
        if (result.termination === TerminationCause.Unreachable) {
          return {
            ruleId: spec.id,
            verdict: Verdict.Inconclusive,
            reason: InconclusiveReason.ConnectionRefused,
            ...withEvidence(evidenceAt(requests, probed, index)),
          };
        }
        const head = parseResponseHead(result.response);
        if (head === null) {
          return {
            ruleId: spec.id,
            verdict: Verdict.Inconclusive,
            reason:
              result.termination === TerminationCause.Timeout ? InconclusiveReason.Timeout : InconclusiveReason.MalformedResponse,
            ...withEvidence(evidenceAt(requests, probed, index)),
          };
        }
        heads.push(head);
      }

      const judgment = spec.judge(heads);
      return {
        ruleId: spec.id,
        verdict: judgment.verdict,
        ...(judgment.reason !== undefined ? { reason: judgment.reason } : {}),
        ...withEvidence(evidenceAt(requests, probed, judgment.evidenceIndex ?? 0)),
      };
    },
  };
}

export type { Judgment, ProbeRuleSpec };
