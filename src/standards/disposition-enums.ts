/**
 * How a rule reaches a sound verdict from raw response bytes — declared per rule so the roster
 * can never smuggle in an intent-bound MUST as if it were blackbox-observable.
 */
export enum TestabilityBasis {
  /** The response header value alone decides it: a self-contradiction or a grammar violation. */
  DirectObservation = 'direct-observation',
  /** Two probes reveal intent the server did not state (e.g. an answer that moves with Origin). */
  DifferentialIntentRevelation = 'differential-intent-revelation',
  /** Judged only when the header is present; its absence is a conformant denial → Skip. */
  ConditionalFormat = 'conditional-format',
}

/** The blocking weight a rule's failure carries, mapped from the clause's RFC 2119 requirement level. */
export enum Severity {
  Fail = 'fail',
  Warn = 'warn',
  Info = 'info',
}
