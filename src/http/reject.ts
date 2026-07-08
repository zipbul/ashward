import type { FramingObservation } from './interfaces';

import { TerminationCause } from '../core/driver/enums';
import { FramingOutcome } from './enums';

/**
 * Precise, wire-observable criteria — deliberately explicit so a conformant server that
 * rejects with 400 vs 501 vs a connection close all count as Rejected, and a server that
 * returns a normal 2xx to the ambiguous frame is unambiguously Accepted.
 */
export function classifyFramingOutcome(observation: FramingObservation): FramingOutcome {
  const { statusLine, termination } = observation;

  if (statusLine !== null) {
    const code = statusLine.statusCode;
    if (code >= 200 && code <= 399) {
      return FramingOutcome.Accepted;
    }
    if (code >= 400 && code <= 599) {
      return FramingOutcome.Rejected;
    }
    return FramingOutcome.Inconclusive; // 1xx interim, or an unclassifiable out-of-range status
  }

  // No parseable response: a timeout tells us nothing; a clean/aborted close without a
  // valid response is a refusal.
  if (termination === TerminationCause.Timeout) {
    return FramingOutcome.Inconclusive;
  }
  return FramingOutcome.Rejected;
}
