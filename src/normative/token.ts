import type { Citation } from '../standards/interfaces';

import { RFC9110 } from '../standards/documents';
import { LocatorKind } from '../standards/enums';

/** RFC 9110 §5.6.2 `token = 1*tchar`. Method names and field names are both tokens. */
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function isToken(value: string): boolean {
  return TOKEN.test(value);
}

/** The production this atom renders as executable code — provenance verified by the spec. */
export const TOKEN_CITATION: Citation = {
  doc: RFC9110,
  locator: { kind: LocatorKind.Section, value: '5.6.2' },
};
