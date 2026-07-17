import type { Rule } from '../../core/contract/enums';
import type { ClauseResult, Evidence } from '../../core/contract/interfaces';
import type { ClauseReason } from '../../core/contract/types';
import type { ProbeFn, HttpTarget } from '../../http/context';
import type { ResponseHead } from '../../http/decode/interfaces';
import type { ProbeResult } from '../../transport/tcp/interfaces';

import { InconclusiveReason, Verdict } from '../../core/contract/enums';
import { parseResponseHead } from '../../http/decode/head-parse';
import { TerminationCause } from '../../transport/tcp/enums';

/** One classified probe exchange: `ok: true` with its parsed head, or `ok: false` with the
 *  transport-class inconclusive reason a rule's judge must never see. */
type ExchangeClassification =
  | { readonly ok: true; readonly head: ResponseHead }
  | { readonly ok: false; readonly reason: InconclusiveReason };

/** Either the well-formed exchanges built from every probe (plus an evidence lookup a judgment can
 *  index into), or the ClauseResult a transport failure already settled — a caller checks `.ok`
 *  before ever reaching for `.exchanges`. */
type ProbeRunOutcome<T> =
  | { readonly ok: true; readonly exchanges: readonly T[]; readonly evidenceAt: (index: number) => Evidence | undefined }
  | { readonly ok: false; readonly result: ClauseResult };

/** Present `evidence` on a result object only when defined — `Evidence | undefined` collapses to
 *  either `{evidence}` or `{}`, so a spread never writes an explicit `evidence: undefined` key. */
export function withEvidence(evidence: Evidence | undefined): { evidence?: Evidence } {
  return evidence !== undefined ? { evidence } : {};
}

/** Classify one raw probe result exactly as every response-rule kit has always done: an unreachable
 *  peer is always ConnectionRefused; an unparseable head is Timeout when the transport itself timed
 *  out, else MalformedResponse; anything else parses and is handed on as a head. */
export function classifyExchange(result: ProbeResult): ExchangeClassification {
  if (result.termination === TerminationCause.Unreachable) {
    return { ok: false, reason: InconclusiveReason.ConnectionRefused };
  }
  const head = parseResponseHead(result.response);
  if (head === null) {
    return {
      ok: false,
      reason: result.termination === TerminationCause.Timeout ? InconclusiveReason.Timeout : InconclusiveReason.MalformedResponse,
    };
  }
  return { ok: true, head };
}

/** A rule's decision over its judged exchanges: `evidenceIndex` names which probe decided it,
 *  defaulting to 0 — the same discipline every response-rule kit has always applied. */
export interface Judgment {
  readonly verdict: Verdict;
  readonly reason?: ClauseReason;
  readonly evidenceIndex?: number;
}

/**
 * The shared craft/send/classify skeleton every response-rule kit runs: craft each probe (via the
 * caller's `craft`), then send EVERY one over `probeFn` in order — sending never stops early, even
 * once an earlier probe has already failed — and only then classify each exchange, in that same
 * order. A crafting throw (e.g. a CR/LF-bearing probe value) is a driver-side setup failure — never a
 * throw out of ashward() — surfaced as a connectivity-class inconclusive. The first transport failure
 * found while classifying short-circuits classification itself with the matching inconclusive
 * ClauseResult, evidenced at the failing probe: no exchange at or after that index is ever built or
 * judged. Otherwise every classified head (and its raw ProbeResult, for a caller that needs more than
 * the head — e.g. a body decode) is handed to `build` to produce the exchange type its own judge
 * expects.
 */
export async function runProbes<Options, T>(
  ruleId: Rule,
  target: HttpTarget,
  probeFn: ProbeFn,
  options: readonly Options[],
  craft: (target: HttpTarget, options: Options) => Uint8Array,
  build: (head: ResponseHead, result: ProbeResult) => T,
): Promise<ProbeRunOutcome<T>> {
  let requests: readonly Uint8Array[];
  try {
    requests = options.map(item => craft(target, item));
  } catch {
    return { ok: false, result: { ruleId, verdict: Verdict.Inconclusive, reason: InconclusiveReason.DriverError } };
  }

  const probed: ProbeResult[] = [];
  for (const request of requests) {
    probed.push(await probeFn(request));
  }

  const evidenceAt = (index: number): Evidence | undefined => {
    const result = probed[index];
    const request = requests[index];
    if (result === undefined || request === undefined) {
      return undefined;
    }
    return { request, response: result.response, outcome: result.termination };
  };

  const exchanges: T[] = [];
  for (const [index, result] of probed.entries()) {
    const classified = classifyExchange(result);
    if (!classified.ok) {
      return {
        ok: false,
        result: { ruleId, verdict: Verdict.Inconclusive, reason: classified.reason, ...withEvidence(evidenceAt(index)) },
      };
    }
    exchanges.push(build(classified.head, result));
  }

  return { ok: true, exchanges, evidenceAt };
}

/** Build the final ClauseResult from a judge's tentative `Judgment` and the `evidenceAt` lookup
 *  `runProbes` returned — the last step every response-rule kit shares, attaching evidence at
 *  `judgment.evidenceIndex ?? 0`. */
export function judgmentResult(
  ruleId: Rule,
  judgment: Judgment,
  evidenceAt: (index: number) => Evidence | undefined,
): ClauseResult {
  return {
    ruleId,
    verdict: judgment.verdict,
    ...(judgment.reason !== undefined ? { reason: judgment.reason } : {}),
    ...withEvidence(evidenceAt(judgment.evidenceIndex ?? 0)),
  };
}
