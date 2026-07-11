import type { Citation } from '../standards/interfaces';

import { WHATWG_FETCH } from '../standards/documents';
import { LocatorKind } from '../standards/enums';

/** Fetch reads a preflight response's headers only when it carries an ok status (200–299). */
export function isOkStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 299;
}

export const OK_STATUS_CITATION: Citation = {
  doc: WHATWG_FETCH,
  locator: { kind: LocatorKind.Anchor, value: 'ok-status' },
};
