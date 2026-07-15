import type { RuleDef } from '../core/contract/interfaces';
import type { Report } from '../core/report/interfaces';
import type { HttpRuleContext, HttpTarget, ProbeFn, ReflectConfig } from './context';

import { runRules } from '../core/engine/run';
import { probe as sendProbe } from '../transport/tcp/socket-probe';

/** Bind the default TCP byte-probe to an HTTP target. The one place the HTTP domain names its
 *  transport; swapping in TLS later is a different binder, not a core change. */
function bindHttpProbe(target: HttpTarget): ProbeFn {
  return async bytes => sendProbe({ host: target.host, port: target.port, bytes, timeoutMs: target.timeoutMs });
}

/** Run HTTP-domain rules against a target over the default TCP transport, into a Report. `reflect`
 *  is optional and undefined by default — only threaded through when a caller opts a route into the
 *  query-parser reflection contract (see `HttpRuleContext.reflect`). */
export async function runHttp(
  target: HttpTarget,
  rules: readonly RuleDef<HttpRuleContext>[],
  reflect?: ReflectConfig,
): Promise<Report> {
  return runRules<HttpRuleContext>(
    { probe: bindHttpProbe(target), target, ...(reflect !== undefined ? { reflect } : {}) },
    rules,
  );
}
