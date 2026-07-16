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

/** The two query-parser reflection modes a caller may opt a `ReflectConfig` (or `AshwardOptions.
 *  reflect`, or a `defineReflectRule` spec) into. */
export type ReflectMode = 'form' | 'uri-generic';

/** A caller-opted echo contract (query-parser reflection rules): the route at `path` (defaulting to
 *  `target.path` when omitted) echoes back an ordered pair list JSON of the query it received,
 *  parsed per this declared mode. Optional and undefined by default — a reflect rule
 *  Skips(EndpointNotReflecting) when absent. `path` is read ONLY by `defineReflectRule` — every
 *  other rule (including the Q1-Q4 heuristics) always probes `target.path`, never this one. */
export interface ReflectConfig {
  readonly mode: ReflectMode;
  readonly path?: string;
}

/** What an HTTP-domain rule is given: the target-bound probe and the resolved endpoint, so it can
 *  craft requests aimed at the caller's host/path with the real Host header. `reflect` is optional
 *  and caller-opted (undefined by default) — only reflection rules read it. */
export interface HttpRuleContext {
  readonly probe: ProbeFn;
  readonly target: HttpTarget;
  readonly reflect?: ReflectConfig;
}
