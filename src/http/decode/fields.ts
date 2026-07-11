import type { ResponseHead } from './interfaces';

/** Every value sent under this field name, in wire order. Names match case-insensitively
 *  (RFC 9110 §5.1); values are returned untouched so a rule can judge their exact bytes. */
export function fieldValues(head: ResponseHead, name: string): readonly string[] {
  const wanted = name.toLowerCase();
  return head.fields.filter(field => field.name.toLowerCase() === wanted).map(field => field.value);
}

/**
 * The single value sent under this field name, or null when it was absent **or** repeated.
 * Collapsing "absent" and "repeated" is deliberate for callers that only act on an
 * unambiguous single value; the rules that judge repetition itself use `fieldValues`.
 */
export function singleFieldValue(head: ResponseHead, name: string): string | null {
  const values = fieldValues(head, name);
  const [only] = values;
  return values.length === 1 && only !== undefined ? only : null;
}
