import { test, expect } from 'bun:test';

import type { ProbeFn } from '../../core/contract/types';
import type { ProbeResult } from '../../core/driver/interfaces';
import type { Target } from '../../core/engine/interfaces';
import type { CorsRuleSpec } from './define-cors-rule';

import { InconclusiveReason, Rule, Verdict } from '../../core/contract/enums';
import { TerminationCause } from '../../core/driver/enums';
import { WHATWG_FETCH } from '../../standards/constants';
import { LocatorKind, ReqLevel } from '../../standards/enums';
import { defineCorsRule } from './define-cors-rule';

const TARGET: Target = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const result = (raw: string, termination = TerminationCause.Fin): ProbeResult => ({ response: bytes(raw), termination });
const okHead = 'HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\n\r\n';

const probeSequence = (results: readonly ProbeResult[]): ProbeFn => {
  let call = 0;
  return async () => Promise.resolve(results[call++]!);
};

const spec = (over: Partial<CorsRuleSpec>): CorsRuleSpec => ({
  id: Rule.AccessControlAllowOriginGrammar,
  normative: [{ doc: WHATWG_FETCH, locator: { kind: LocatorKind.Anchor, value: 'x' }, req: ReqLevel.Must }],
  probes: [{ origin: 'https://o.test' }],
  judge: () => ({ verdict: Verdict.Pass }),
  ...over,
});

const run = async (over: Partial<CorsRuleSpec>, results: readonly ProbeResult[]) =>
  defineCorsRule(spec(over)).run({ probe: probeSequence(results), target: TARGET });

test('returns the judge verdict when every head parses', async () => {
  const out = await run({ judge: () => ({ verdict: Verdict.Fail }) }, [result(okHead)]);
  expect(out.verdict).toBe(Verdict.Fail);
});

test('carries the rule id onto the result', async () => {
  const out = await run({ id: Rule.NullOrigin }, [result(okHead)]);
  expect(out.ruleId).toBe(Rule.NullOrigin);
});

test('is a connectivity inconclusive when the target is unreachable', async () => {
  const out = await run({}, [result('', TerminationCause.Unreachable)]);
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.ConnectionRefused);
});

test('is a timeout inconclusive when an unparseable exchange timed out', async () => {
  const out = await run({}, [result('', TerminationCause.Timeout)]);
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.Timeout);
});

test('is a malformed-response inconclusive when the head does not parse', async () => {
  const out = await run({}, [result('not a status line at all')]);
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.MalformedResponse);
});

test('still judges a fully-parsed head even if the connection then timed out (headers suffice)', async () => {
  let judged = false;
  const out = await run(
    {
      judge: () => {
        judged = true;
        return { verdict: Verdict.Pass };
      },
    },
    [result(okHead, TerminationCause.Timeout)],
  );
  expect(judged).toBe(true);
  expect(out.verdict).toBe(Verdict.Pass);
});

test('never hands a transport failure to the judge', async () => {
  let judged = false;
  await run(
    {
      judge: () => {
        judged = true;
        return { verdict: Verdict.Pass };
      },
    },
    [result('', TerminationCause.Unreachable)],
  );
  expect(judged).toBe(false);
});

test('sends one probe per spec entry in order', async () => {
  const sent: string[] = [];
  const probe: ProbeFn = async b => {
    sent.push(new TextDecoder().decode(b));
    return Promise.resolve(result(okHead));
  };
  await defineCorsRule(spec({ probes: [{ origin: 'https://a.test' }, { origin: 'https://b.test' }] })).run({
    probe,
    target: TARGET,
  });
  expect(sent[0]).toContain('Origin: https://a.test');
  expect(sent[1]).toContain('Origin: https://b.test');
});

test('attaches the judge-selected probe as evidence', async () => {
  const out = await run(
    {
      probes: [{ origin: 'https://a.test' }, { origin: 'https://b.test' }],
      judge: () => ({ verdict: Verdict.Fail, evidenceIndex: 1 }),
    },
    [result(okHead), result(okHead)],
  );
  expect(new TextDecoder().decode(out.evidence!.request)).toContain('Origin: https://b.test');
});
