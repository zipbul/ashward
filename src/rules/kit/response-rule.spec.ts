import { test, expect } from 'bun:test';

import type { HttpTarget, ProbeFn } from '../../http/context';
import type { ProbeResult } from '../../transport/tcp/interfaces';
import type { ResponseRuleSpec } from './response-rule';

import { InconclusiveReason, Rule, Verdict } from '../../core/contract/enums';
import { WHATWG_FETCH } from '../../standards/documents';
import { LocatorKind, ReqLevel } from '../../standards/enums';
import { replayExchanges } from '../../testkit/replay';
import { TerminationCause } from '../../transport/tcp/enums';
import { defineResponseRule } from './response-rule';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const result = (raw: string, termination = TerminationCause.Fin): ProbeResult => ({ response: bytes(raw), termination });

const probeSequence = (results: readonly ProbeResult[]): ProbeFn => {
  let call = 0;
  return async () => Promise.resolve(results[call++]!);
};

const spec = (over: Partial<ResponseRuleSpec>): ResponseRuleSpec => ({
  id: Rule.AccessControlAllowOriginGrammar,
  normative: [{ doc: WHATWG_FETCH, locator: { kind: LocatorKind.Anchor, value: 'x' }, req: ReqLevel.Must }],
  probes: [{ headers: [] }],
  judge: () => ({ verdict: Verdict.Pass }),
  ...over,
});

const run = async (over: Partial<ResponseRuleSpec>, results: readonly ProbeResult[]) =>
  defineResponseRule(spec(over)).run({ probe: probeSequence(results), target: TARGET });

test('hands the judge the decoded head, content, and completeness', async () => {
  let seen: unknown;
  const probe = replayExchanges({ head: 'HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\n', body: 'hello' });
  await defineResponseRule(
    spec({
      judge: exchanges => {
        seen = exchanges;
        return { verdict: Verdict.Pass };
      },
    }),
  ).run({ probe, target: TARGET });

  expect(seen).toEqual([
    {
      head: {
        statusLine: { httpVersion: 'HTTP/1.1', statusCode: 200, reasonPhrase: 'OK' },
        fields: [{ name: 'Content-Length', value: '5' }],
        bodyOffset: 38,
      },
      content: bytes('hello'),
      complete: true,
    },
  ]);
});

test('returns the judge verdict when every exchange decodes', async () => {
  const out = await run({ judge: () => ({ verdict: Verdict.Fail }) }, [result('HTTP/1.1 200 OK\r\n\r\n')]);
  expect(out.verdict).toBe(Verdict.Fail);
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

test('lets a judge mark an incomplete body inconclusive itself', async () => {
  const probe = replayExchanges({ head: 'HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n', body: 'short', complete: false });
  const out = await defineResponseRule(
    spec({
      judge: () => ({ verdict: Verdict.Inconclusive, reason: InconclusiveReason.IncompleteMessage }),
    }),
  ).run({ probe, target: TARGET });
  expect(out.verdict).toBe(Verdict.Inconclusive);
  expect(out.reason).toBe(InconclusiveReason.IncompleteMessage);
});

test('gives the judge exchanges[0].complete === false for a short body', async () => {
  const probe = replayExchanges({ head: 'HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n', body: 'short', complete: false });
  let seenComplete: boolean | undefined;
  await defineResponseRule(
    spec({
      judge: exchanges => {
        seenComplete = exchanges[0]!.complete;
        return { verdict: Verdict.Pass };
      },
    }),
  ).run({ probe, target: TARGET });
  expect(seenComplete).toBe(false);
});

test('attaches the judge-selected probe as evidence', async () => {
  const out = await run(
    {
      probes: [{ headers: [] }, { headers: [{ name: 'Accept-Encoding', value: 'gzip' }] }],
      judge: () => ({ verdict: Verdict.Fail, evidenceIndex: 1 }),
    },
    [result('HTTP/1.1 200 OK\r\n\r\n'), result('HTTP/1.1 200 OK\r\n\r\n')],
  );
  expect(new TextDecoder().decode(out.evidence!.request)).toContain('Accept-Encoding: gzip');
});
