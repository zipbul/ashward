import type { ResponseHead } from '../../http/decode/interfaces';

import { fieldValues } from '../../http/decode/fields';
import { VARY } from '../../normative/header-names';
import { WILDCARD } from '../../normative/literals';

/** True when the response's `Vary` field varies on `Origin` (case-insensitive) or on everything
 *  (`*`). The differential Vary rules (§7.1/§7.2) ask this of each probe's response. */
export function varyHasOrigin(head: ResponseHead): boolean {
  for (const value of fieldValues(head, VARY)) {
    for (const element of value.split(',')) {
      const token = element.trim().toLowerCase();
      if (token === 'origin' || token === WILDCARD) {
        return true;
      }
    }
  }
  return false;
}
