import type { ClauseResult, Evidence, RuleDef } from '../../core/contract/interfaces';
import type { ClauseReason } from '../../core/contract/types';
import type { HttpRuleContext, HttpTarget } from '../../http/context';
import type { HeaderField, ResponseHead } from '../../http/decode/interfaces';
import type { NormativeRef, Taxonomy } from '../../standards/interfaces';
import type { ProbeResult } from '../../transport/tcp/interfaces';

import { InconclusiveReason, Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { decodeBody } from '../../http/decode/body';
import { fieldValues, singleFieldValue } from '../../http/decode/fields';
import { craftRequest } from '../../http/encode/request';
import { isStrongEtag } from '../../normative/etag';
import { ETAG, LAST_MODIFIED } from '../../normative/header-names';
import { parseHttpDate } from '../../normative/http-date';
import { isOkStatus, isServerError } from '../../normative/ok-status';
import { authorityFor } from './craft-probe';
import { classifyExchange, withEvidence } from './probe-run';

/** ashward never mutates the target it probes (PLAN §0): a conditional-request probe can only ever
 *  be one of ashward's three supported safe methods — GET, HEAD, OPTIONS (TRACE is out of scope,
 *  PLAN §8) — so an unsafe-method probe is unrepresentable at the type level. */
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
 *  `Fail`/`Warn` are "disqualifying" — the kit gates those behind a stability RE-DISCOVER (PLAN §2f
 *  step 4) before letting them stand; `Pass`/`Skip`/`Inconclusive` are returned as-is. */
interface ConditionalJudgment {
  readonly verdict: Verdict;
  readonly reason?: ClauseReason;
}

/** Fields every conditional rule spec shares, regardless of which stability guard (PLAN §2f step 4
 *  — a fresh RE-DISCOVER round-trip, never the already-fetched exchanges alone) re-confirms a
 *  disqualifying verdict. */
interface ConditionalRuleSpecBase {
  readonly id: Rule;
  readonly normative: readonly NormativeRef[];
  readonly tags?: Taxonomy;
  /** Whether the discovered baseline(s) qualify the rule to proceed at all — return a `SkipReason`
   *  to bail out immediately (e.g. `NoValidator`, `NotApplicable`), or `null` to proceed to `build`.
   *  Omit entirely when the guard's own baseline-agreement check (e.g. the existence guard's
   *  `expectedBaselineStatus`) is the rule's only prerequisite — the kit defaults to `() => null`. */
  gate?(discovered: readonly ConditionalExchange[]): SkipReason | null;
  /** The conditional probe(s) to send, built from the discovered baseline(s). */
  build(discovered: readonly ConditionalExchange[]): readonly ConditionalProbeSpec[];
  /** Pure: the rule's tentative verdict from the discovered baseline(s) and the conditional
   *  exchange(s) — never itself responsible for the stability guard, which the kit applies around it. */
  judge(discovered: readonly ConditionalExchange[], probed: readonly ConditionalExchange[]): ConditionalJudgment;
}

/** `guard: 'validator'` (C1, C3-C12): the rule's own `gate`/`judge` read the validator header(s)
 *  named in `validatorHeaders` off `discovered`/`probed` directly (via `headerOf`); the kit
 *  re-sends `discoverProbes` and Skips(EndpointUnstable) unless the fresh baseline's status AND
 *  every named validator header are byte-identical to the original discover. This is a two-way
 *  split, not a single set: `validatorHeaders` re-confirms by EXACT VALUE, while any header a rule
 *  also lists in `validatorPresenceHeaders` (e.g. `Date`, which legitimately advances every second
 *  on a live origin) is re-confirmed by PRESENCE only — see `validatorPresenceHeaders`'s doc before
 *  adding a header to either set, and never move a presence-only header into `validatorHeaders`
 *  (that would downgrade an unrelated, genuine Fail to Skip merely because the clock ticked). */
interface ValidatorGuardSpec extends ConditionalRuleSpecBase {
  readonly guard: 'validator';
  /** The discover probe(s) sent before `gate`/`build` run, and again (verbatim) as the RE-DISCOVER
   *  round-trip before a disqualifying `Fail`/`Warn` stands. Default: one safe `GET target.path`. */
  readonly discoverProbes?: readonly ConditionalProbeSpec[];
  /** The response header name(s) `gate`/`judge` key off — the kit reads these to drive the
   *  RE-DISCOVER drift comparison (see this interface's doc): every value sent under each name must
   *  be BYTE-IDENTICAL between discover and re-discover. May be empty, but always present — a
   *  validator-guard rule with nothing to re-confirm still says so explicitly, never by omission.
   *  Do NOT list a header here whose VALUE legitimately varies between requests on a live,
   *  otherwise-unchanged origin (e.g. `Date`) — that belongs in `validatorPresenceHeaders` instead,
   *  or its natural drift would downgrade an unrelated, genuine Fail/Warn to Skip(EndpointUnstable)
   *  on every re-discover. */
  readonly validatorHeaders: readonly string[];
  /** Header name(s) whose RE-DISCOVER drift check is PRESENCE-only, not exact value — e.g. `Date`
   *  (RFC 9110 §6.6.1), which legitimately advances every second on a live origin. A name here is
   *  confirmed merely "still sent, if it was sent at discover time"; its value is never compared.
   *  Without this split, a validator-guard rule that (rightly) depends on `Date`'s PRESENCE for its
   *  own judge logic would have to list `Date` in `validatorHeaders` to get it re-checked at all —
   *  which would then downgrade every disqualifying verdict to Skip(EndpointUnstable) as soon as
   *  the clock ticked between discover and re-discover, even when the actual judged condition
   *  (e.g. a missing `Vary`) hasn't drifted at all. */
  readonly validatorPresenceHeaders?: readonly string[];
}

/** `guard: 'existence'` (C2, C13, C14): the discover probes must agree on `expectedBaselineStatus`
 *  before `gate`/`build` run at all, AND the kit re-sends them after a disqualifying judgment to
 *  confirm the SAME status still holds (drift → Skip). */
interface ExistenceGuardSpec extends ConditionalRuleSpecBase {
  readonly guard: 'existence';
  /** The discover probes (≥2 — the "×2 baseline" agreement is itself part of discovery, per PLAN
   *  §2f/§5) sent before `gate`/`build` run, and again (verbatim) as the RE-DISCOVER round-trip. */
  readonly discoverProbes: readonly ConditionalProbeSpec[];
  /** The baseline status predicate every discover exchange must agree on — e.g. "is 200" (C2), "is
   *  not 304/412" (C13), "is not 2xx/304/412" (C14). */
  readonly expectedBaselineStatus: (status: number) => boolean;
}

type ConditionalRuleSpec = ValidatorGuardSpec | ExistenceGuardSpec;

/** The single value of `name` on `exchange`'s head, or `null` when `exchange` is undefined, the
 *  header is absent, or it was repeated — the same collapsing `singleFieldValue` already applies,
 *  lifted to tolerate a possibly-missing `discovered[n]` under `noUncheckedIndexedAccess`. Every
 *  rule's `gate`/`build`/`judge` reads a discovered header through this, never a hand-rolled
 *  `discovered[0]?.head ?? {...}` fallback. */
function headerOf(exchange: ConditionalExchange | undefined, name: string): string | null {
  return exchange === undefined ? null : singleFieldValue(exchange.head, name);
}

/** The shared two-probe differential judge for every rule whose disqualifying condition is "probe 0
 *  (the disqualifying condition) elicits `trigger`, while probe 1 (the STANDARD's own contrast case)
 *  elicits an ok status" — C1 (ETag match → 304 vs. a never-matching contrast → 2xx), C4 (If-Match
 *  no-match → 412 vs. `If-Match: *` → 2xx), C6 (earlier-than-L → 412 vs. equal-to-L → 2xx), and C7
 *  (IMS == L → 304 vs. a far-past IMS → 2xx). Passes only when probe 0 hits `trigger` AND probe 1 is
 *  ok — a server that answers `trigger` unconditionally (ignoring the probed field's value entirely)
 *  would otherwise false-Pass on probe 0 alone, so that shape instead settles as `disqualify` (Fail
 *  or Warn, per the rule's own MUST/SHOULD severity). When probe 0 doesn't land on `trigger` at all,
 *  an ok status there is itself the disqualifying shape (`disqualify`); anything else is not a
 *  reliable enough signal either way (Skip(EndpointUnstable)). */
function differentialJudge(
  options: { readonly trigger: number; readonly disqualify: Verdict },
  probed: readonly ConditionalExchange[],
): ConditionalJudgment {
  const disqualifying = probed[0]?.status;
  const contrast = probed[1]?.status;
  if (disqualifying === options.trigger) {
    if (contrast !== undefined && isOkStatus(contrast)) {
      return { verdict: Verdict.Pass };
    }
    if (contrast === options.trigger) {
      return { verdict: options.disqualify };
    }
    return { verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable };
  }
  if (disqualifying !== undefined && isOkStatus(disqualifying)) {
    return { verdict: options.disqualify };
  }
  return { verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable };
}

/** The ETag-validator gate shared by every rule whose only prerequisite is a discovered `ETag` (C1,
 *  C4, C11, C12): Skip(NoValidator) unless the discovered baseline is a 200 that sent one. */
function etagValidatorGate(discovered: readonly ConditionalExchange[]): SkipReason | null {
  const [baseline] = discovered;
  if (baseline?.status !== 200) {
    return SkipReason.NoValidator;
  }
  return headerOf(baseline, ETAG) === null ? SkipReason.NoValidator : null;
}

/** The STRONG-ETag-validator gate shared by every rule whose only prerequisite is a discovered
 *  STRONG `ETag` (C3, C5): Skip(NoValidator) unless the discovered baseline is a 200 that sent an
 *  `ETag` at all, then Skip(NotApplicable) — the validator exists, it's just already weak — unless
 *  that `ETag` is strong. */
function strongEtagValidatorGate(discovered: readonly ConditionalExchange[]): SkipReason | null {
  const [baseline] = discovered;
  if (baseline?.status !== 200) {
    return SkipReason.NoValidator;
  }
  const etag = headerOf(baseline, ETAG);
  if (etag === null) {
    return SkipReason.NoValidator;
  }
  return isStrongEtag(etag) ? null : SkipReason.NotApplicable;
}

/** The Last-Modified-validator gate shared by every rule whose only prerequisite is a discovered,
 *  parseable `Last-Modified` (C6, C7, C10): Skip(NoValidator) unless the discovered baseline is a
 *  200 that sent a `Last-Modified` value `parseHttpDate` can actually parse — a malformed value
 *  never qualifies as a validator, matching §1.3/§1.4's own parse requirement. */
function lastModifiedValidatorGate(discovered: readonly ConditionalExchange[]): SkipReason | null {
  const [baseline] = discovered;
  if (baseline?.status !== 200) {
    return SkipReason.NoValidator;
  }
  const lastModified = headerOf(baseline, LAST_MODIFIED);
  if (lastModified === null || parseHttpDate(lastModified) === null) {
    return SkipReason.NoValidator;
  }
  return null;
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
    const classified = classifyExchange(result);
    if (!classified.ok) {
      return { requests, probed, outcome: { ok: false, reason: classified.reason, index } };
    }
    const { content, complete } = decodeBody(result.response, classified.head, result.termination);
    exchanges.push({ status: classified.head.statusLine.statusCode, head: classified.head, content, complete });
  }
  return { requests, probed, outcome: { ok: true, exchanges } };
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

function hasServerError(exchanges: readonly ConditionalExchange[]): boolean {
  return exchanges.some(exchange => isServerError(exchange.status));
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

/** Whether every value sent under `name` (in wire order) is identical between `before` and `after` —
 *  REPEATED-field-aware, unlike a `headerOf`/`singleFieldValue`-based comparison, which collapses
 *  ANY repeated field to `null` on both sides: two exchanges that repeat the same field name with
 *  genuinely different values would then compare `null === null` and read as "unchanged" even
 *  though the field actually drifted. */
function sameFieldValues(before: ConditionalExchange, after: ConditionalExchange, name: string): boolean {
  const beforeValues = fieldValues(before.head, name);
  const afterValues = fieldValues(after.head, name);
  return beforeValues.length === afterValues.length && beforeValues.every((value, index) => value === afterValues[index]);
}

/** Whether `name` was sent at all on `exchange`'s head (any number of times) — presence, not value.
 *  REPEATED-field-aware for the same reason `sameFieldValues` is: a `headerOf`/`singleFieldValue`
 *  read would collapse a repeated field to "absent". */
function fieldPresent(exchange: ConditionalExchange, name: string): boolean {
  return fieldValues(exchange.head, name).length > 0;
}

/** Presence-only RE-DISCOVER agreement for one field: it never disappears — if `before` sent it,
 *  `after` must still send it. `before` NOT sending it is not itself drift (an origin that never
 *  sent the field, e.g. a clockless `Date`, is unaffected either way), and `after` sending it when
 *  `before` didn't is likewise not drift the judge depends on — only "went from sent to unsent"
 *  invalidates a Fail/Warn that was read off the field's presence. */
function fieldPresenceStable(before: ConditionalExchange, after: ConditionalExchange, name: string): boolean {
  return !fieldPresent(before, name) || fieldPresent(after, name);
}

/** Validator-guard RE-DISCOVER agreement: the fresh baseline's status is identical to the original
 *  discover, every `exactNames` header carries the identical value(s) on both (a drift — e.g. the
 *  resource moved on to a new `ETag` — means the judge's tentative Fail/Warn was read off a baseline
 *  that no longer holds), and every `presenceNames` header's presence (never its value — see
 *  `validatorPresenceHeaders`'s doc) hasn't been lost. Compares via `fieldValues` arrays, never
 *  `headerOf`, so a repeated field's drift is caught instead of masked by both sides collapsing to
 *  `null`. */
function validatorStable(
  exactNames: readonly string[],
  presenceNames: readonly string[],
  before: ConditionalExchange | undefined,
  after: ConditionalExchange | undefined,
): boolean {
  if (before === undefined || after === undefined || before.status !== after.status) {
    return false;
  }
  return (
    exactNames.every(name => sameFieldValues(before, after, name)) &&
    presenceNames.every(name => fieldPresenceStable(before, after, name))
  );
}

/**
 * Build a discover-then-conditional rule (PLAN §2f): discover the baseline(s), gate on whether the
 * rule applies at all, build the conditional probe(s) from the discovered baseline, and judge. A
 * `Pass`/`Skip`/`Inconclusive` tentative judgment is returned as-is. A disqualifying `Fail`/`Warn`
 * tentative judgment stands only once TWO checks clear, per PLAN §2f step 4:
 *   1. no exchange already in hand (discover + conditional probes) shows a 5xx;
 *   2. a fresh RE-DISCOVER round-trip — `discoverProbes` sent again, a real live probe, never reread
 *      from the exchanges already in hand — confirms the guard's baseline is unchanged: the SAME
 *      status (and, for the validator guard, the SAME named validator header values). Either check
 *      failing downgrades to `Skip(EndpointUnstable)` — the guard never itself produces a Fail or
 *      Warn. The existence guard's baseline-agreement check (`discoverProbes` agreeing on
 *      `expectedBaselineStatus`) still runs before `gate`/`build`, per PLAN §2f/§5.
 */
export function defineConditionalRule(spec: ConditionalRuleSpec): RuleDef<HttpRuleContext> {
  return {
    id: spec.id,
    normative: spec.normative,
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),

    async run(context: HttpRuleContext): Promise<ClauseResult> {
      const discoverSpecs = spec.discoverProbes ?? [{ headers: [] }];
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
      if (spec.guard === 'existence' && !existenceStable(spec.expectedBaselineStatus, discovered)) {
        return {
          ruleId: spec.id,
          verdict: Verdict.Skip,
          reason: SkipReason.EndpointUnstable,
          ...withEvidence(lastEvidence(discoverBatch)),
        };
      }

      const gateReason = spec.gate === undefined ? null : spec.gate(discovered);
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

      // A disqualifying verdict: first, the freshly probed exchanges must show no 5xx (the
      // discovered baseline was already checked, above, before gate/build ever ran).
      if (hasServerError(probed)) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable, ...finalEvidence };
      }

      // Second — PLAN §2f step 4 — a fresh RE-DISCOVER round-trip: re-send the SAME discover probe(s)
      // live and confirm the guard's baseline still holds before letting the disqualifying verdict
      // stand. A transport failure on the re-discover itself is Inconclusive, same as any other batch.
      const reconfirmBatch = await sendBatch(context, discoverSpecs);
      if (!reconfirmBatch.outcome.ok) {
        return inconclusiveFrom(spec, reconfirmBatch, reconfirmBatch.outcome);
      }
      const reconfirmed = reconfirmBatch.outcome.exchanges;
      const reconfirmEvidence = withEvidence(lastEvidence(reconfirmBatch));
      if (hasServerError(reconfirmed)) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable, ...reconfirmEvidence };
      }

      const stable =
        spec.guard === 'existence'
          ? existenceStable(spec.expectedBaselineStatus, reconfirmed) && reconfirmed[0]?.status === discovered[0]?.status
          : validatorStable(spec.validatorHeaders, spec.validatorPresenceHeaders ?? [], discovered[0], reconfirmed[0]);
      if (!stable) {
        return { ruleId: spec.id, verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable, ...reconfirmEvidence };
      }
      return settled;
    },
  };
}

export { differentialJudge, etagValidatorGate, headerOf, lastModifiedValidatorGate, strongEtagValidatorGate };
export type { ConditionalExchange };
