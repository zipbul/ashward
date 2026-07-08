import type { StatusLine } from './decode/interfaces';
import type { TerminationCause } from '../core/driver/enums';

export interface FramingObservation {
  readonly statusLine: StatusLine | null;
  readonly termination: TerminationCause;
}
