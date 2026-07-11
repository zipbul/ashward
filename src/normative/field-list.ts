import type { Citation } from '../standards/interfaces';

import { RFC9110 } from '../standards/documents';
import { LocatorKind } from '../standards/enums';

/**
 * Split a comma-separated field value into its elements (RFC 9110 §5.6.1 `#rule`), trimming the
 * optional whitespace around each. Empty elements are dropped, so `GET,, POST` yields two methods.
 * Whether an empty element was present is itself a violation some rules judge — ask
 * {@link hasEmptyListElement} BEFORE this drops the evidence.
 */
export function splitFieldList(value: string): readonly string[] {
  return value
    .split(',')
    .map(element => element.trim())
    .filter(element => element.length > 0);
}

/**
 * True when the value carries an empty list element — a leading/trailing comma or `,,` (RFC 9110
 * §5.6.1: "a sender MUST NOT generate empty list elements"). Judged on the raw value, since
 * {@link splitFieldList} silently drops the very elements this detects.
 */
export function hasEmptyListElement(value: string): boolean {
  return value.split(',').some(element => element.trim().length === 0);
}

export const FIELD_LIST_CITATION: Citation = {
  doc: RFC9110,
  locator: { kind: LocatorKind.Section, value: '5.6.1' },
};
