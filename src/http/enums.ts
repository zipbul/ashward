/**
 * What a server did with a deliberately ambiguous/malformed framing request.
 * - Rejected: refused it (4xx/5xx, or closed without serving a valid response) — conformant.
 * - Accepted: processed it as valid (2xx/3xx) — the parser-discrepancy the tool catches.
 * - Inconclusive: could not tell (timed out, or a non-final/unclassifiable status).
 */
export enum FramingOutcome {
  Rejected = 'rejected',
  Accepted = 'accepted',
  Inconclusive = 'inconclusive',
}
