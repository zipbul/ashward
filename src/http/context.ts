import type { ProbeResult } from '../transport/tcp/interfaces';

/** A target-bound probe the HTTP runner hands to a rule: send request bytes, get the raw wire
 *  result. One implementation of the byte exchange (TCP today); a rule never dials anything itself. */
export type ProbeFn = (bytes: Uint8Array) => Promise<ProbeResult>;

/** The HTTP endpoint under test: a TCP `host:port` plus the request-target `path`. `path` is
 *  HTTP-specific and lives here, in the HTTP domain, never in a neutral core type. */
export interface HttpTarget {
  readonly host: string;
  readonly port: number;
  readonly path: string;
  readonly timeoutMs: number;
}

/** A caller-opted echo contract (query-parser reflection rules): the route at `target.path` echoes
 *  back an ordered pair list JSON of the query it received, parsed per this declared mode. Optional
 *  and undefined by default — a reflect rule Skips(EndpointNotReflecting) when absent. */
export interface ReflectConfig {
  readonly mode: 'form' | 'uri-generic';
}

/** What an HTTP-domain rule is given: the target-bound probe and the resolved endpoint, so it can
 *  craft requests aimed at the caller's host/path with the real Host header. `reflect` is optional
 *  and caller-opted (undefined by default) — only reflection rules read it. */
export interface HttpRuleContext {
  readonly probe: ProbeFn;
  readonly target: HttpTarget;
  readonly reflect?: ReflectConfig;
}
