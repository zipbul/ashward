import type { Citation } from '../standards/interfaces';

import { RFC9111 } from '../standards/documents';
import { LocatorKind } from '../standards/enums';

/** RFC 9111 §1.2.2 `delta-seconds = 1*DIGIT`. No sign, no fraction, no units. */
const DELTA_SECONDS = /^\d+$/;

export function isDeltaSeconds(value: string): boolean {
  return DELTA_SECONDS.test(value);
}

export const DELTA_SECONDS_CITATION: Citation = {
  doc: RFC9111,
  locator: { kind: LocatorKind.Section, value: '1.2.2' },
};
