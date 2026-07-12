import type { TerminationCause } from '../transport/tcp/enums';
import type { StatusLine } from './decode/interfaces';

export interface FramingObservation {
  readonly statusLine: StatusLine | null;
  readonly termination: TerminationCause;
}
