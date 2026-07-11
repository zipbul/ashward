import { test, expect } from 'bun:test';

import type { RuleDef } from '../contract/interfaces';

import { Rule, Verdict } from '../contract/enums';
import { runRules } from './run';

interface TestContext {
  readonly tag: string;
}

const CONTEXT: TestContext = { tag: 'x' };

const fakeRule = (verdict: Verdict): RuleDef<TestContext> => ({
  id: Rule.DuplicateContentLength,
  normative: [],
  async run(): Promise<{ ruleId: Rule; verdict: Verdict }> {
    return Promise.resolve({ ruleId: Rule.DuplicateContentLength, verdict });
  },
});

test('collects a result from every rule into the report', async () => {
  const report = await runRules(CONTEXT, [fakeRule(Verdict.Pass), fakeRule(Verdict.Pass)]);
  expect(report.results.length).toBe(2);
});

test('report ok() is false when any rule fails', async () => {
  const report = await runRules(CONTEXT, [fakeRule(Verdict.Pass), fakeRule(Verdict.Fail)]);
  expect(report.ok()).toBe(false);
});

test('produces an empty, ok report when there are no rules', async () => {
  const report = await runRules(CONTEXT, []);
  expect(report.results.length).toBe(0);
  expect(report.ok()).toBe(true);
});

test('hands the same context to every rule', async () => {
  let received: TestContext | undefined;
  const capturingRule: RuleDef<TestContext> = {
    id: Rule.DuplicateContentLength,
    normative: [],
    async run(context: TestContext) {
      received = context;
      return Promise.resolve({ ruleId: Rule.DuplicateContentLength, verdict: Verdict.Pass });
    },
  };
  await runRules(CONTEXT, [capturingRule]);
  expect(received).toBe(CONTEXT);
});
