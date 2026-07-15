import type { ResponseHead } from '../../http/decode/interfaces';

import { fieldValues } from '../../http/decode/fields';
import { splitFieldList } from '../../normative/field-list';
import { CONTENT_ENCODING } from '../../normative/header-names';

/** `Content-Encoding`'s content-coding tokens, in applied order (RFC 9110 §8.4), folded across
 *  repeated field lines (RFC 9110 §5.3) and split on the `#`-list comma (RFC 9110 §5.6.1). Empty
 *  when the field is absent — a rule reading this never has to special-case "no field" itself. */
export function contentEncodingTokens(head: ResponseHead): readonly string[] {
  return fieldValues(head, CONTENT_ENCODING).flatMap(value => splitFieldList(value));
}

/** The last (outermost-applied) content-coding token, or null when `Content-Encoding` is absent. */
export function outermostCoding(head: ResponseHead): string | null {
  const tokens = contentEncodingTokens(head);
  return tokens.length === 0 ? null : (tokens[tokens.length - 1] ?? null);
}

/** True when the response carries a real (non-`identity`) content coding — i.e. is actually
 *  compressed, as opposed to merely carrying an empty or `identity`-only `Content-Encoding`. */
export function isCompressed(head: ResponseHead): boolean {
  return contentEncodingTokens(head).some(token => token.toLowerCase() !== 'identity');
}
