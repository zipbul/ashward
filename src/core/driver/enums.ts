/** How the peer ended the exchange. Never collapsed into a single `closed` flag —
 *  the cause is verdict-determining (a timeout is inconclusive, an RST is not). */
export enum TerminationCause {
  Fin = 'fin',
  Rst = 'rst',
  Timeout = 'timeout',
  /** The exchange could not be completed at the transport level — refused (ECONNREFUSED), DNS
   *  failure (ENOTFOUND/EAI_AGAIN), host/net unreachable, connect timeout, etc. Surfaced as a
   *  result rather than a throw so a dead / misconfigured target becomes an inconclusive verdict
   *  the fail-closed policy can block on, instead of crashing out of ashward(). Distinct from Rst,
   *  which is an established peer resetting the frame (a genuine refusal of the request). */
  Unreachable = 'unreachable',
}
