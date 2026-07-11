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

/** What an HTTP-domain rule is given: the target-bound probe and the resolved endpoint, so it can
 *  craft requests aimed at the caller's host/path with the real Host header. */
export interface HttpRuleContext {
  readonly probe: ProbeFn;
  readonly target: HttpTarget;
}
