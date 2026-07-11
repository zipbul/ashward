import type { Citation } from '../standards/interfaces';

import { WHATWG_FETCH } from '../standards/documents';
import { LocatorKind } from '../standards/enums';

/** serialized-scheme: lowercase, letter-led (§1.3 — scheme is lowercase ASCII). */
const SCHEME = /^[a-z][a-z0-9+.-]*$/;
/** reg-name / IPv4 dotted-decimal host: lowercase ASCII, no percent-encoding, no uppercase (§1.3). */
const REG_NAME = /^[a-z0-9._-]+$/;
/** serialized-port: 1*5DIGIT (§1.3). */
const PORT = /^[0-9]{1,5}$/;
/** one IPv6 piece: lowercase hex, no leading zero — a lone `0` is the only zero-led piece (§1.3). */
const IPV6_PIECE = /^(0|[1-9a-f][0-9a-f]{0,3})$/;

/**
 * WHATWG URL / Fetch `#origin-header` IPv6 serialization, the §1.3 constraints made runnable:
 * bracketed, lowercase hex only, no embedded IPv4 (`serialized-ipv6` has no `dec-octet` alternative),
 * no leading zeros, at most one `::`, and `::` must elide TWO OR MORE zero pieces — a full address is
 * 8 pieces, so an explicit-piece count of 7 means `::` stood for a single `0`, which is forbidden.
 */
function isSerializedIpv6(inner: string): boolean {
  if (inner.length === 0 || /[^0-9a-f:]/.test(inner)) {
    return false; // lowercase hex + colons only — rejects uppercase and the embedded-IPv4 dot
  }
  const doubleColons = inner.split('::').length - 1;
  if (doubleColons > 1) {
    return false;
  }
  if (doubleColons === 0) {
    const pieces = inner.split(':');
    return pieces.length === 8 && pieces.every(piece => IPV6_PIECE.test(piece));
  }
  const [left = '', right = ''] = inner.split('::');
  const leftPieces = left.length > 0 ? left.split(':') : [];
  const rightPieces = right.length > 0 ? right.split(':') : [];
  if (leftPieces.length + rightPieces.length > 6) {
    return false; // '::' must compress two or more zero pieces
  }
  return [...leftPieces, ...rightPieces].every(piece => IPV6_PIECE.test(piece));
}

/**
 * A serialized origin per Fetch `#origin-header` (which supplants RFC 6454), enforcing §1.1–§1.3:
 * `scheme "://" host [ ":" port ]` and nothing else — no list (comma), no subdomain wildcard (`*`),
 * no path / trailing-slash / query / fragment / userinfo / whitespace, lowercase scheme+host, no
 * percent-encoding, IPv6 bracketed+normalized, port 1*5DIGIT. A default port is NOT rejected here:
 * `http://x:80` is a well-formed origin that merely fails the §2.2 byte match, not the grammar.
 */
export function isSerializedOrigin(value: string): boolean {
  const schemeEnd = value.indexOf('://');
  if (schemeEnd <= 0 || !SCHEME.test(value.slice(0, schemeEnd))) {
    return false;
  }
  const authority = value.slice(schemeEnd + 3);
  if (authority.length === 0 || /[/?#@\s]/.test(authority)) {
    return false; // an origin is authority-only: reject path, query, fragment, userinfo, whitespace
  }

  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    if (close === -1 || !isSerializedIpv6(authority.slice(1, close))) {
      return false;
    }
    const rest = authority.slice(close + 1);
    return rest.length === 0 || (rest.startsWith(':') && PORT.test(rest.slice(1)));
  }

  const colon = authority.lastIndexOf(':');
  const host = colon === -1 ? authority : authority.slice(0, colon);
  if (!REG_NAME.test(host)) {
    return false;
  }
  return colon === -1 || PORT.test(authority.slice(colon + 1));
}

export const SERIALIZED_ORIGIN_CITATION: Citation = {
  doc: WHATWG_FETCH,
  locator: { kind: LocatorKind.Anchor, value: 'origin-header' },
};
