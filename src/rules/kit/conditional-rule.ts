import type { ClauseResult, Evidence, RuleDef } from '../../core/contract/interfaces';
import type { ClauseReason } from '../../core/contract/types';
import type { HttpRuleContext, HttpTarget } from '../../http/context';
import type { HeaderField, ResponseHead } from '../../http/decode/interfaces';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { ProbeResult } from '../../transport/tcp/interfaces';

import { InconclusiveReason, Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { decodeBody } from '../../http/decode/body';
import { CR, LF } from '../../http/decode/constants';
import { singleFieldValue } from '../../http/decode/fields';
import { parseResponseHead } from '../../http/decode/head-parse';
import { craftRequest } from '../../http/encode/request';
import { TerminationCause } from '../../transport/tcp/enums';
import { authorityFor } from './craft-probe';

/** ashward never mutates the target it probes (PLAN §0): a conditional-request probe can only ever
 *  be one of the three safe methods, so an unsafe-method probe is unrepresentable at the type level. */
type SafeMethod = 'GET' | 'HEAD' | 'OPTIONS';

/** What one conditional probe asks: the safe method (defaults GET) plus the request headers it
 *  carries — typically one or more `If-*` preconditions. */
interface ConditionalProbeSpec {
  readonly method?: SafeMethod;
  readonly headers: readonly HeaderField[];
  /** Appended verbatim to `target.path` for this probe only (e.g. C14's `{path}/<random>` discover
   *  probe) — a rule's `discover`/`build` never sees the resolved target, only `discovered`
   *  exchanges, so a per-probe path variation is expressed this way instead of a full override. */
  readonly pathSuffix?: string;
}

/** One fully-decoded exchange in the discover/probe/reconfirm sequence — status pulled out
 *  alongside the head purely for judge/gate convenience (it is also `head.statusLine.statusCode`). */
interface ConditionalExchange {
  readonly status: number;
  readonly head: ResponseHead;
  readonly content: Uint8Array;
  readonly complete: boolean;
}

/** A rule's tentative decision over the discovered baseline(s) and the conditional exchange(s). Only
 *  `Fail`/`Warn` are "disqualifying" — the kit gates those behind a stability re-confirmation (PLAN
 *  §2f step 4) before letting them stand; `Pass`/`Skip`/`Inconclusive` are returned as-is. */
interface ConditionalJudgment {
  readonly verdict: Verdict;
  readonly reason?: ClauseReason;
}

type ConditionalGuard = 'validator' | 'existence';

interface ConditionalRuleSpec {
  readonly id: Rule;
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** Which stability guard re-confirms a disqualifying verdict (PLAN §2f):
   *  - `'validator'` (C1, C3-C12): the rule's own `gate`/`judge` read the validator header(s) off
   *    `discovered`/`probed` directly (via `headerOf`) — `guard` only selects which pre-`gate`
   *    baseline check applies (none, for validator) and documents the rule's shape.
   *  - `'existence'` (C2, C13, C14): the discover probes (≥2, sent here as `discoverProbes`) must
   *    agree on `expectedBaselineStatus` before `gate`/`build` run at all. */
  readonly guard: ConditionalGuard;
  /** The discover probe(s) sent before `gate`/`build` run. Default: one safe `GET target.path`. The
   *  existence guard's rules (C2/C13/C14) supply ≥2 probes here so the "×2 baseline" agreement is
   *  itself part of discovery, per PLAN §2f/§5. */
  readonly discoverProbes?: readonly ConditionalProbeSpec[];
  /** Validator-guard rules may record the response header name(s) their `gate`/`judge` key off, for
   *  documentation; the kit itself no longer reads this (see `guard`'s doc). */
  readonly validatorHeaders?: readonly string[];
  /** Existence-guard only: the baseline status predicate every discover exchange must agree on —
   *  e.g. "is 200" (C2), "is not 304/412" (C13), "is not 2xx/304/412" (C14). Required when
   *  `guard: 'existence'`. */
  readonly expectedBaselineStatus?: (status: number) => boolean;
  /** An extra stability check beyond the guard's default, consulted only when a tentative `Fail`/
   *  `Warn` from `judge` has already survived the `hasServerError` check — over the SAME `discovered`/
   *  `probed` exchanges the judge saw (never a fresh round-trip). Returning `false` downgrades the
   *  disqualifying verdict to `Skip(EndpointUnstable)`. */
  readonly extraStabilityCheck?: (discovered: readonly ConditionalExchange[], probed: readonly ConditionalExchange[]) => boolean;
  /** Whether the discovered baseline(s) qualify the rule to proceed at all — return a `SkipReason`
   *  to bail out immediately (e.g. `NoValidator`, `NotApplicable`), or `null` to proceed to `build`. */
  gate(discovered: readonly ConditionalExchange[]): SkipReason | null;
  /** The conditional probe(s) to send, built from the discovered baseline(s). */
  build(discovered: readonly ConditionalExchange[]): readonly ConditionalProbeSpec[];
  /** Pure: the rule's tentative verdict from the discovered baseline(s) and the conditional
   *  exchange(s) — never itself responsible for the stability guard, which the kit applies around it. */
  judge(discovered: readonly ConditionalExchange[], probed: readonly ConditionalExchange[]): ConditionalJudgment;
}

/** The single value of `name` on `exchange`'s head, or `null` when `exchange` is undefined, the
 *  header is absent, or it was repeated — the same collapsing `singleFieldValue` already applies,
 *  lifted to tolerate a possibly-missing `discovered[n]` under `noUncheckedIndexedAccess`. Every
 *  rule's `gate`/`build`/`extraStabilityCheck` reads a discovered header through this, never a
 *  hand-rolled `discovered[0]?.head ?? {...}` fallback. */
function headerOf(exchange: ConditionalExchange | undefined, name: string): string | null {
  return exchange === undefined ? null : singleFieldValue(exchange.head, name);
}

function craftConditionalProbe(target: HttpTarget, spec: ConditionalProbeSpec): Uint8Array {
  const host = authorityFor(target);
  const path = `${target.path}${spec.pathSuffix ?? ''}`;
  return craftRequest({ method: spec.method ?? 'GET', target: path, host, headers: spec.headers });
}

type BatchOutcome =
  | { readonly ok: true; readonly exchanges: readonly ConditionalExchange[] }
  | { readonly ok: false; readonly reason: InconclusiveReason; readonly index: number };

interface Batch {
  readonly requests: readonly Uint8Array[];
  readonly probed: readonly ProbeResult[];
  readonly outcome: BatchOutcome;
}

/** Send one ordered set of conditional probes over the caller's context, head-parsing and body-
 *  decoding every response (reusing the §2a decoder) before any rule code sees it — transport
 *  trouble (an unreachable peer, an unparseable head) never reaches a rule's gate/build/judge. */
async function sendBatch(context: HttpRuleContext, specs: readonly ConditionalProbeSpec[]): Promise<Batch> {
  const requests = specs.map(spec => craftConditionalProbe(context.target, spec));
  const probed: ProbeResult[] = [];
  for (const request of requests) {
    probed.push(await context.probe(request));
  }

  const exchanges: ConditionalExchange[] = [];
  for (const [index, result] of probed.entries()) {
    if (result.termination === TerminationCause.Unreachable) {
      return { requests, probed, outcome: { ok: false, reason: InconclusiveReason.ConnectionRefused, index } };
    }
    const head = parseResponseHead(result.response);
    if (head === null) {
      const reason =
        result.termination === TerminationCause.Timeout ? InconclusiveReason.Timeout : InconclusiveReason.MalformedResponse;
      return { requests, probed, outcome: { ok: false, reason, index } };
    }
    const { content, complete } = decodeBody(result.response, head, result.termination);
    exchanges.push({ status: head.statusLine.statusCode, head, content: stripLeadingEmptyLine(content), complete });
  }
  return { requests, probed, outcome: { ok: true, exchanges } };
}

function withEvidence(evidence: Evidence | undefined): { evidence?: Evidence } {
  return evidence !== undefined ? { evidence } : {};
}

function evidenceFor(batch: Batch, index: number): Evidence | undefined {
  const request = batch.requests[index];
  const result = batch.probed[index];
  if (request === undefined || result === undefined) {
    return undefined;
  }
  return { request, response: result.response, outcome: result.termination };
}

function lastEvidence(batch: Batch): Evidence | undefined {
  return evidenceFor(batch, batch.requests.length - 1);
}

function inconclusiveFrom(spec: ConditionalRuleSpec, batch: Batch, outcome: Extract<BatchOutcome, { ok: false }>): ClauseResult {
  return {
    ruleId: spec.id,
    verdict: Verdict.Inconclusive,
    reason: outcome.reason,
    ...withEvidence(evidenceFor(batch, outcome.index)),
  };
}

/** RFC 9112 §2.2: a recipient MAY ignore at least one empty line (CRLF, or bare LF) that precedes
 *  what it reads as the next message on the connection — here, a close-delimited (no Content-Length,
 *  no Transfer-Encoding) body that is a single leading blank line is that tolerated empty line, not
 *  real content, so it never counts toward a rule's own "the response carried content" judgment
 *  (e.g. C12's `not-modified-no-content`). Strips at most one; a genuine body never opens on it. */
function stripLeadingEmptyLine(content: Uint8Array): Uint8Array {
  if (content.length >= 2 && content[0] === CR && content[1] === LF) {
    return content.subarray(2);
  }
  if (content.length >= 1 && content[0] === LF) {
    return content.subarray(1);
  }
  return content;
}

function hasServerError(exchanges: readonly ConditionalExchange[]): boolean {
  return exchanges.some(exchange => exchange.status >= 500 && exchange.status <= 599);
}

/** Default existence-guard stability check: every exchange in the set reports the identical status,
 *  and that status satisfies the rule's `expectedBaselineStatus` predicate. Used both for the
 *  pre-`gate` baseline-agreement check (the discover exchanges alone) and, where a rule composes it
 *  itself, any other agreement check over exchanges already in hand. */
function existenceStable(expected: (status: number) => boolean, exchanges: readonly ConditionalExchange[]): boolean {
  const [first, ...rest] = exchanges;
  if (first === undefined) {
    return false;
  }
  return expected(first.status) && rest.every(exchange => exchange.status === first.status);
}

/**
 * Build a discover-then-conditional rule (PLAN §2f): discover the baseline(s), gate on whether the
 * rule applies at all, build the conditional probe(s) from the discovered baseline, and judge. A
 * `Pass`/`Skip`/`Inconclusive` tentative judgment is returned as-is. A disqualifying `Fail`/`Warn`
 * tentative judgment stands unless the exchanges already in hand — the discover baseline(s) and the
 * conditional probe(s), never an extra live round-trip spent re-querying the origin — show a 5xx
 * anywhere in the sequence, in which case it downgrades to `Skip(EndpointUnstable)` (the guard never
 * itself produces a Fail or Warn). The existence guard's baseline-agreement check (`discoverProbes`
 * agreeing on `expectedBaselineStatus`) still runs before `gate`/`build`, per PLAN §2f/§5.
 */
export function defineConditionalRule(spec: ConditionalRuleSpec): RuleDef<HttpRuleContext> {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext): Promise<ClauseResult> {
      const discoverSpecs = spec.discoverProbes ?? [{ method: 'GET' as const, headers: [] }];
      const discoverBatch = await sendBatch(context, discoverSpecs);
      if (!discoverBatch.outcome.ok) {
        return inconclusiveFrom(spec, discoverBatch, discoverBatch.outcome);
      }
      const discovered = discoverBatch.outcome.exchanges;

      if (hasServerError(discovered)) {
        return {
          ruleId: spec.id,
          verdict: Verdict.Skip,
          reason: SkipReason.EndpointUnstable,
          ...withEvidence(lastEvidence(discoverBatch)),
        };
      }
      if (spec.guard === 'existence' && !existenceStable(spec.expectedBaselineStatus ?? (() => true), discovered)) {
        return {
          ruleId: spec.id,
          verdict: Verdict.Skip,
          reason: SkipReason.EndpointUnstable,
          ...withEvidence(lastEvidence(discoverBatch)),
        };
      }

      const gateReason = spec.gate(discovered);
      if (gateReason !== null) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: gateReason, ...withEvidence(lastEvidence(discoverBatch)) };
      }

      const probeSpecs = spec.build(discovered);
      const probeBatch = await sendBatch(context, probeSpecs);
      if (!probeBatch.outcome.ok) {
        return inconclusiveFrom(spec, probeBatch, probeBatch.outcome);
      }
      const probed = probeBatch.outcome.exchanges;

      const tentative = spec.judge(discovered, probed);
      const finalEvidence = withEvidence(lastEvidence(probeBatch));

      const settled = {
        ruleId: spec.id,
        verdict: tentative.verdict,
        ...(tentative.reason !== undefined ? { reason: tentative.reason } : {}),
        ...finalEvidence,
      };
      if (tentative.verdict !== Verdict.Fail && tentative.verdict !== Verdict.Warn) {
        return settled;
      }

      // A disqualifying verdict: it stands unless the exchanges already fetched (never a fresh
      // round-trip) show a 5xx anywhere — the guard's own agreement check on the discover
      // baseline(s) already ran, above, before `gate`/`build`.
      if (hasServerError(discovered) || hasServerError(probed)) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable, ...finalEvidence };
      }
      if (spec.extraStabilityCheck !== undefined && !spec.extraStabilityCheck(discovered, probed)) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable, ...finalEvidence };
      }
      return settled;
    },
  };
}

export { headerOf };
export type { ConditionalExchange, ConditionalGuard, ConditionalJudgment, ConditionalProbeSpec, ConditionalRuleSpec, SafeMethod };
