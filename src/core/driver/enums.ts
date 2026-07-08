/** How the peer ended the exchange. Never collapsed into a single `closed` flag —
 *  the cause is verdict-determining (a timeout is inconclusive, an RST is not). */
export enum TerminationCause {
  Fin = 'fin',
  Rst = 'rst',
  Timeout = 'timeout',
}
