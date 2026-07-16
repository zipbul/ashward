/** True for a strong (non-`W/`-prefixed) entity-tag value. */
export function isStrongEtag(value: string): boolean {
  return !value.startsWith('W/');
}
