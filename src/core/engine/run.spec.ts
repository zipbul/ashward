import { test, expect } from 'bun:test';
import { runRulesWithProbe } from './run';
import { Rule, Verdict } from '../contract/enums';
import { TerminationCause } from '../driver/enums';
import type { ProbeFn } from '../contract/types';
import type { RuleContext, RuleDef } from '../contract/interfaces';

const stubProbe: ProbeFn = async () => ({ response: new Uint8Array(), termination: TerminationCause.Fin });

const fakeRule = (verdict: Verdict): RuleDef => ({
  id: Rule.DuplicateContentLength,
  normative: [],
  async run(): Promise<{ ruleId: Rule; verdict: Verdict }> {
    return { ruleId: Rule.DuplicateContentLength, verdict };
  },
});

test('collects a result from every rule into the report', async () => {
  const report = await runRulesWithProbe(stubProbe, [fakeRule(Verdict.Pass), fakeRule(Verdict.Pass)]);
  expect(report.results.length).toBe(2);
});

test('report ok() is false when any rule fails', async () => {
  const report = await runRulesWithProbe(stubProbe, [fakeRule(Verdict.Pass), fakeRule(Verdict.Fail)]);
  expect(report.ok()).toBe(false);
});

test('produces an empty, ok report when there are no rules', async () => {
  const report = await runRulesWithProbe(stubProbe, []);
  expect(report.results.length).toBe(0);
  expect(report.ok()).toBe(true);
});

test('hands the provided probe to each rule', async () => {
  let received: ProbeFn | undefined;
  const capturingRule: RuleDef = {
    id: Rule.DuplicateContentLength,
    normative: [],
    async run(context: RuleContext) {
      received = context.probe;
      return { ruleId: Rule.DuplicateContentLength, verdict: Verdict.Pass };
    },
  };
  await runRulesWithProbe(stubProbe, [capturingRule]);
  expect(received).toBe(stubProbe);
});
