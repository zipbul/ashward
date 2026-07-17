import { test, expect } from 'bun:test';

import type { HttpTarget } from '../../http/context';

import { InconclusiveReason, Rule, SkipReason, Verdict } from '../../core/contract/enums';
import { replay, res } from '../../testkit/replay';
import { defineConditionalRule, differentialJudge } from './conditional-rule';

/**
 * These tests drive `defineConditionalRule`'s own shared discover/gate/build/judge/RE-DISCOVER
 * control flow directly, through small synthetic rule specs — branches no real C1-C14 rule's own
 * probe/judge shape happens to exercise (a real rule's judge, discover set, or build never produces
 * some of these shapes). `id`/`normative` below are carrier values only: the kit itself never reads
 * or branches on either, it only threads them through onto the returned `ClauseResult`.
 */
const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const VALIDATOR_RULE_ID = Rule.IfNoneMatchNotModified;
const EXISTENCE_RULE_ID = Rule.ConditionalIgnoredOnErrorStatus;

// differentialJudge's own third outcome (PLAN §2f / the function's doc): probe 0 (the disqualifying
// condition) DOES land on the trigger, but probe 1 (the STANDARD's own contrast case) lands on
// neither the trigger NOR an ok status — too ambiguous a signal to settle on either the Pass shape
// (contrast wasn't ok) or the unconditional-trigger shape (contrast wasn't the trigger either).
test('differentialJudge skips as endpoint-unstable when the contrast probe lands on neither the trigger nor an ok status', async () => {
  const rule = defineConditionalRule({
    id: VALIDATOR_RULE_ID,
    normative: [],
    guard: 'validator',
    validatorHeaders: [],
    build: () => [{ headers: [] }, { headers: [] }],
    judge: (_discovered, probed) => differentialJudge({ trigger: 304, disqualify: Verdict.Fail }, probed),
  });

  const out = await rule.run({ probe: replay(res('200 OK'), res('304 Not Modified'), res('403 Forbidden')), target: TARGET });

  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

// A boundary discoverProbes of length 0 (the existence guard's own baseline-agreement check, PLAN
// §2f/§5, has nothing to agree on at all): existenceStable's spread-destructure sees no baseline to
// check, so the guard fails closed rather than crashing, and the kit's own evidence lookup has no
// request/result at all to attach either — a rule misconfigured this way must never silently pass.
test('an existence-guard rule with zero discover probes skips as endpoint-unstable with no evidence to attach', async () => {
  const rule = defineConditionalRule({
    id: EXISTENCE_RULE_ID,
    normative: [],
    guard: 'existence',
    discoverProbes: [],
    expectedBaselineStatus: () => true,
    build: () => [],
    judge: () => ({ verdict: Verdict.Pass }),
  });

  const out = await rule.run({ probe: replay(), target: TARGET });

  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
  expect(out.evidence).toBeUndefined();
});

// A transport-level failure (here: an unparseable head) on the discover probe itself must be
// reported Inconclusive, with evidence at the failing probe — never silently treated as any other
// verdict, and never crash gate/build, which never even run.
test('a transport failure on the discover probe itself is reported inconclusive, not swallowed', async () => {
  const rule = defineConditionalRule({
    id: VALIDATOR_RULE_ID,
    normative: [],
    guard: 'validator',
    validatorHeaders: [],
    build: () => [{ headers: [] }],
    judge: () => ({ verdict: Verdict.Pass }),
  });

  const out = await rule.run({ probe: replay('not a valid http response'), target: TARGET });

  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.MalformedResponse);
  expect(out.evidence).toBeDefined();
});

// The same transport-failure discipline applies to the CONDITIONAL probe batch (`build`'s own
// probes), distinct from the discover batch above — a clean discover must not mask a broken
// conditional probe.
test('a transport failure on the conditional probe (after a clean discover) is reported inconclusive', async () => {
  const rule = defineConditionalRule({
    id: VALIDATOR_RULE_ID,
    normative: [],
    guard: 'validator',
    validatorHeaders: [],
    build: () => [{ headers: [] }],
    judge: () => ({ verdict: Verdict.Pass }),
  });

  const out = await rule.run({ probe: replay(res('200 OK'), 'not a valid http response'), target: TARGET });

  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.MalformedResponse);
  expect(out.evidence).toBeDefined();
});

// PLAN §2f step 4's FIRST check: a 5xx among the freshly-probed exchanges downgrades a tentative
// Fail/Warn to Skip(EndpointUnstable) WITHOUT ever attempting the RE-DISCOVER round-trip — an origin
// blipping mid-probe is not itself evidence of a conformance defect.
test('a 5xx on the conditional probe downgrades a tentative Fail to skip, without ever re-discovering', async () => {
  const rule = defineConditionalRule({
    id: VALIDATOR_RULE_ID,
    normative: [],
    guard: 'validator',
    validatorHeaders: [],
    build: () => [{ headers: [] }],
    judge: () => ({ verdict: Verdict.Fail }),
  });

  // Exactly 2 responses: discover + the single conditional probe (build() above). A third response
  // being consumed would mean the kit wrongly attempted a RE-DISCOVER despite the 5xx.
  const out = await rule.run({ probe: replay(res('200 OK'), res('503 Service Unavailable')), target: TARGET });

  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});

// PLAN §2f step 4's SECOND check: once no 5xx is in hand, the kit re-sends the SAME discover
// probe(s). A transport failure on THAT round-trip is its own Inconclusive, exactly like any other
// batch — never re-interpreted as the tentative Fail standing or as Skip(EndpointUnstable).
test('a transport failure on the RE-DISCOVER round-trip is reported inconclusive', async () => {
  const rule = defineConditionalRule({
    id: VALIDATOR_RULE_ID,
    normative: [],
    guard: 'validator',
    validatorHeaders: [],
    build: () => [{ headers: [] }],
    judge: () => ({ verdict: Verdict.Fail }),
  });

  const out = await rule.run({
    probe: replay(res('200 OK'), res('200 OK'), 'not a valid http response'),
    target: TARGET,
  });

  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.MalformedResponse);
});

// validatorStable's own status-identity check (distinct from its per-header drift check): even with
// an empty validatorHeaders set — nothing to compare by value — a RE-DISCOVER baseline reporting a
// DIFFERENT status than the original discover is itself disqualifying drift; the tentative Fail must
// never stand on a baseline that has already moved on.
test('a RE-DISCOVER baseline whose status itself drifted from the original discover skips, never lets the Fail stand', async () => {
  const rule = defineConditionalRule({
    id: VALIDATOR_RULE_ID,
    normative: [],
    guard: 'validator',
    validatorHeaders: [],
    build: () => [{ headers: [] }],
    judge: () => ({ verdict: Verdict.Fail }),
  });

  const out = await rule.run({
    probe: replay(res('200 OK'), res('200 OK'), res('404 Not Found')),
    target: TARGET,
  });

  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.EndpointUnstable);
});
