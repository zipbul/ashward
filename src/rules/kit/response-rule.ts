import type { ClauseResult, Evidence, RuleDef } from '../../core/contract/interfaces';
import type { ClauseReason } from '../../core/contract/types';
import type { HttpRuleContext } from '../../http/context';
import type { HeaderField, ResponseHead } from '../../http/decode/interfaces';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { ProbeResult } from '../../transport/tcp/interfaces';

import { InconclusiveReason, Verdict } from '../../core/contract/enums';
import { decodeBody } from '../../http/decode/body';
import { parseResponseHead } from '../../http/decode/head-parse';
import { TerminationCause } from '../../transport/tcp/enums';
import { craftContentProbe } from './content-probe';

/** What a content probe asks: the request headers it carries (e.g. Accept-Encoding, Range,
 *  If-None-Match). Distinct from the CORS `ProbeSpec` in craft-probe.ts — a response-rule probe
 *  never carries `Origin`. */
interface ProbeSpec {
  readonly headers: readonly HeaderField[];
}

/** One probe's fully-decoded exchange: the parsed head, the transfer-decoded content, and
 *  whether the message completed — everything a judge needs without touching raw bytes. */
interface ResponseExchange {
  readonly head: ResponseHead;
  readonly content: Uint8Array;
  readonly complete: boolean;
}

/** A rule's decision over the decoded exchanges. `evidenceIndex` names which probe decided it
 *  (defaults to 0), same discipline as `defineHttpResponseRule`. */
interface Judgment {
  readonly verdict: Verdict;
  readonly reason?: ClauseReason;
  readonly evidenceIndex?: number;
}

interface ResponseRuleSpec {
  readonly id: RuleDef<HttpRuleContext>['id'];
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** The well-formed probes this rule sends, in order, each over its own connection. */
  readonly probes: readonly ProbeSpec[];
  /** Pure: every exchange is head-parsed and body-decoded before the judge sees it, so it never
   *  handles transport failure. A judge that wants to treat an incomplete body as inconclusive
   *  returns `{verdict: Verdict.Inconclusive, reason: InconclusiveReason.IncompleteMessage}` —
   *  this kit only passes that reason through; it never decides incompleteness itself. */
  judge(exchanges: readonly ResponseExchange[]): Judgment;
}

function withEvidence(evidence: Evidence | undefined): { evidence?: Evidence } {
  return evidence !== undefined ? { evidence } : {};
}

/**
 * Build a body-bearing HTTP-response rule: craft the rule's well-formed probes against the
 * caller's target, send them, parse every response head and decode its content, and hand the
 * decoded exchanges to a pure judge. Transport trouble never reaches the judge — an unreachable
 * peer is a connectivity-inconclusive, an unparseable head is a malformed-response inconclusive —
 * mirroring `defineHttpResponseRule`'s discipline, with the decoded body attached alongside the head.
 */
export function defineResponseRule(spec: ResponseRuleSpec): RuleDef<HttpRuleContext> {
  const evidenceAt = (requests: readonly Uint8Array[], probed: readonly ProbeResult[], index: number): Evidence | undefined => {
    const result = probed[index];
    const request = requests[index];
    if (result === undefined || request === undefined) {
      return undefined;
    }
    return { request, response: result.response, outcome: result.termination };
  };

  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext): Promise<ClauseResult> {
      let requests: readonly Uint8Array[];
      try {
        requests = spec.probes.map(options => craftContentProbe(context.target, options));
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

      const exchanges: ResponseExchange[] = [];
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
        const { content, complete } = decodeBody(result.response, head);
        exchanges.push({ head, content, complete });
      }

      const judgment = spec.judge(exchanges);
      return {
        ruleId: spec.id,
        verdict: judgment.verdict,
        ...(judgment.reason !== undefined ? { reason: judgment.reason } : {}),
        ...withEvidence(evidenceAt(requests, probed, judgment.evidenceIndex ?? 0)),
      };
    },
  };
}

export type { Judgment, ProbeSpec, ResponseExchange, ResponseRuleSpec };
