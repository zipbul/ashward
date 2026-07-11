/** The wildcard, the opaque origin's serialization, and the one credentials value — all literal,
 *  case-sensitive bytes Fetch compares directly (never parsed). `True`/`TRUE`/`1` are NOT `true`;
 *  `NULL` is NOT `null`; a subdomain pattern is NOT `*`. */
export const WILDCARD = '*';
export const NULL_ORIGIN = 'null';
export const CREDENTIALS_TRUE = 'true';
