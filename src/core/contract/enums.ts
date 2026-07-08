export enum Verdict {
  Pass = 'pass',
  Fail = 'fail',
  Warn = 'warn',
  Skip = 'skip',
  Inconclusive = 'inconclusive',
}

/** Why a check could not reach a pass/fail — always typed, never a silent bucket. */
export enum InconclusiveReason {
  Timeout = 'timeout',
  ConnectionRefused = 'connection-refused',
  AmbiguousFraming = 'ambiguous-framing',
  DriverError = 'driver-error',
}

/**
 * Public, permanent rule identity. Member value is the stable slug — it is what appears in
 * reports, baselines, and canonical JSON, so it must never change once shipped. Storage
 * folder is a separate, movable axis; this identity is not.
 */
export enum Rule {
  DuplicateContentLength = 'http.framing.duplicate-content-length',
  ClTeConflict = 'http.framing.cl-te-conflict',
}
