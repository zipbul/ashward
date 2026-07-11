import type { RuleDef } from '../contract/interfaces';
import type { ProbeFn } from '../contract/types';
import type { Report } from '../report/interfaces';
import type { Target } from './interfaces';

import { probe as sendProbe } from '../driver/socket-probe';
import { buildReport } from '../report/report';

/** Run every rule against one shared probe + target and assemble the results into a Report. */
export async function runRulesWithProbe(probe: ProbeFn, target: Target, rules: readonly RuleDef[]): Promise<Report> {
  const results = await Promise.all(rules.map(async rule => rule.run({ probe, target })));
  return buildReport(results);
}

/** Bind a probe to the target and run the rules against it. */
export async function runRules(target: Target, rules: readonly RuleDef[]): Promise<Report> {
  const probe: ProbeFn = async bytes => sendProbe({ host: target.host, port: target.port, bytes, timeoutMs: target.timeoutMs });
  return runRulesWithProbe(probe, target, rules);
}
