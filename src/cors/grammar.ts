/** RFC 9110 §5.6.2 token: 1*tchar. Method names and field names are both tokens. */
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/** RFC 9110 §1.2 delta-seconds: 1*DIGIT. No sign, no fraction, no units. */
const DELTA_SECONDS = /^\d+$/;

/**
 * RFC 6454 §6.2 ASCII serialization of an origin: scheme "://" host [ ":" port ]. Shape only —
 * a path, a trailing slash, userinfo, a query, or whitespace all mean this is not an origin.
 * The canonical form (whether a default port is elided) is not judged here: a server that sends
 * `http://x:80` has written a well-formed origin, it has merely written one no browser will match.
 */
const SERIALIZED_ORIGIN = /^[A-Za-z][A-Za-z0-9+\-.]*:\/\/(?:\[[0-9A-Fa-f:.]+\]|[^/?#@\s:]+)(?::\d+)?$/;

export function isToken(value: string): boolean {
  return TOKEN.test(value);
}

export function isDeltaSeconds(value: string): boolean {
  return DELTA_SECONDS.test(value);
}

export function isSerializedOrigin(value: string): boolean {
  return SERIALIZED_ORIGIN.test(value);
}

/**
 * Split a comma-separated field value into its elements (RFC 9110 §5.6.1 `#rule`), trimming the
 * optional whitespace around each. Empty elements are legal in that grammar and are dropped, so
 * `GET,, POST` yields two methods rather than an apparent syntax error.
 */
export function splitFieldList(value: string): readonly string[] {
  return value
    .split(',')
    .map(element => element.trim())
    .filter(element => element.length > 0);
}
