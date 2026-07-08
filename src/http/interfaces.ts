import type { TerminationCause } from '../core/driver/enums';
import type { StatusLine } from './decode/interfaces';

export interface FramingObservation {
  readonly statusLine: StatusLine | null;
  readonly termination: TerminationCause;
}
