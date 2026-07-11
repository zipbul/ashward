/**
 * A serialized origin per Fetch `#origin-header`, which defers to WHATWG URL — so this is implemented
 * against the real URL parser, not a hand-rolled ABNF. A conformant server emits the CANONICAL
 * serialization, so a value is a serialized origin iff parsing it and re-serializing its origin
 * (`URL.origin`) reproduces it byte-for-byte. That single equality enforces §1.1–§1.3 at once:
 *   - lowercased scheme + host, IPv6 normalized/compressed, IPv4 canonical, percent-encoding rejected;
 *   - default port elided (`https://x:443` / `http://x:80` fail — §1.2), port range enforced;
 *   - no trailing slash, path, query, fragment, or userinfo (all change `href` away from `origin`).
 * The wildcard `*` is excluded first: URL would accept `*` as a host code point, but a subdomain
 * pattern is not a serialized origin (§1.1). `null` and `*` as whole ACAO values are handled by the
 * rule, never reaching here.
 */
export function isSerializedOrigin(value: string): boolean {
  if (value.includes('*')) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.origin === value;
}
