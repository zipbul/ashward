import { probe as sendProbe } from '../driver/socket-probe';
import { buildReport } from '../report/report';
import type { ProbeFn } from '../contract/types';
import type { RuleDef } from '../contract/interfaces';
import type { Report } from '../report/interfaces';
import type { Target } from './interfaces';

/** Run every rule against one shared probe and assemble the results into a Report. */
export async function runRulesWithProbe(probe: ProbeFn, rules: readonly RuleDef[]): Promise<Report> {
  const results = await Promise.all(rules.map((rule) => rule.run({ probe })));
  return buildReport(results);
}

/** Bind a probe to the target and run the rules against it. */
export function runRules(target: Target, rules: readonly RuleDef[]): Promise<Report> {
  const probe: ProbeFn = (bytes) =>
    sendProbe({ host: target.host, port: target.port, bytes, timeoutMs: target.timeoutMs });
  return runRulesWithProbe(probe, rules);
}
