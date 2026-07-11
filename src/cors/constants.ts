/** Response header names the CORS protocol defines. Compared case-insensitively on lookup. */
export const ACCESS_CONTROL_ALLOW_ORIGIN = 'Access-Control-Allow-Origin';
export const ACCESS_CONTROL_ALLOW_CREDENTIALS = 'Access-Control-Allow-Credentials';
export const ACCESS_CONTROL_ALLOW_METHODS = 'Access-Control-Allow-Methods';
export const ACCESS_CONTROL_ALLOW_HEADERS = 'Access-Control-Allow-Headers';
export const ACCESS_CONTROL_EXPOSE_HEADERS = 'Access-Control-Expose-Headers';
export const ACCESS_CONTROL_MAX_AGE = 'Access-Control-Max-Age';
export const VARY = 'Vary';

/** Request header names the CORS protocol defines. */
export const ORIGIN = 'Origin';
export const ACCESS_CONTROL_REQUEST_METHOD = 'Access-Control-Request-Method';
export const ACCESS_CONTROL_REQUEST_HEADERS = 'Access-Control-Request-Headers';

/** The wildcard, and the opaque origin's serialization — both are literal, case-sensitive bytes. */
export const WILDCARD = '*';
export const NULL_ORIGIN = 'null';

/** Fetch compares `Access-Control-Allow-Credentials` against these exact bytes, not a boolean. */
export const CREDENTIALS_TRUE = 'true';
