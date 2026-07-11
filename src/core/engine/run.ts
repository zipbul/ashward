import type { RuleDef } from '../contract/interfaces';
import type { Report } from '../report/interfaces';

import { buildReport } from '../report/report';

/**
 * Run every rule against one shared context and assemble the results into a Report. Fully neutral:
 * `Ctx` is whatever the domain built (an HTTP probe + endpoint today), so the engine knows nothing
 * about transports — the domain wires its context and hands it in.
 */
export async function runRules<Ctx>(context: Ctx, rules: readonly RuleDef<Ctx>[]): Promise<Report> {
  const results = await Promise.all(rules.map(async rule => rule.run(context)));
  return buildReport(results);
}
