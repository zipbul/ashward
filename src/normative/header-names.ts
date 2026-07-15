/** Response header names the CORS protocol (WHATWG Fetch) defines. Compared case-insensitively on
 *  lookup, so these hold the canonical spelling only — stable vocabulary, near-zero churn. */
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

/** The redirect target a §5.1 rule inspects for userinfo credentials (RFC 9110 §10.2.2). */
export const LOCATION = 'Location';

/** WICG Private Network Access header names (non-standard draft). ACRPN previews the private-network
 *  access on a preflight; ACAPN grants it; the ID/Name pair identifies the device when granted. */
export const ACCESS_CONTROL_REQUEST_PRIVATE_NETWORK = 'Access-Control-Request-Private-Network';
export const ACCESS_CONTROL_ALLOW_PRIVATE_NETWORK = 'Access-Control-Allow-Private-Network';
export const PRIVATE_NETWORK_ACCESS_ID = 'Private-Network-Access-ID';
export const PRIVATE_NETWORK_ACCESS_NAME = 'Private-Network-Access-Name';

/** Compression (RFC 9110 §8.4/§8.8/§12.5.5). `Accept-Encoding` is a request header; the rest are
 *  response headers a compression rule reads or negotiates on. */
export const CONTENT_ENCODING = 'Content-Encoding';
export const ACCEPT_ENCODING = 'Accept-Encoding';
export const ETAG = 'ETag';
export const CACHE_CONTROL = 'Cache-Control';

/** HTTP/1.1 message-framing fields (RFC 9112 §6). */
export const CONTENT_LENGTH = 'Content-Length';
export const TRANSFER_ENCODING = 'Transfer-Encoding';

/** Conditional-request fields (RFC 9110 §13 · §8.8). `ETag` and `Cache-Control` are declared above
 *  (compression already cites them); the rest are new for the conditional-request domain. Request
 *  fields (`If-*`) and response fields (validators + the 304-required-header set) share one list —
 *  they are never confused because a rule crafts requests and reads responses through distinct code
 *  paths. */
export const IF_MATCH = 'If-Match';
export const IF_NONE_MATCH = 'If-None-Match';
export const IF_MODIFIED_SINCE = 'If-Modified-Since';
export const IF_UNMODIFIED_SINCE = 'If-Unmodified-Since';
export const LAST_MODIFIED = 'Last-Modified';
export const DATE = 'Date';
export const EXPIRES = 'Expires';
export const CONTENT_LOCATION = 'Content-Location';
