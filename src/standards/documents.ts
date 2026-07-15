import type { LivingDocument, RfcDocument } from './interfaces';

import { DocumentStatus, StandardsBody } from './enums';

/** HTTP/1.1 messaging & framing (obsoletes RFC 7230). */
export const RFC9112 = {
  body: StandardsBody.IETF,
  number: 9112,
  code: 'RFC 9112',
  title: 'HTTP/1.1',
  url: 'https://www.rfc-editor.org/rfc/rfc9112',
  obsoletes: ['RFC 7230'],
} as const satisfies RfcDocument;

/** HTTP Semantics — version-independent (obsoletes RFC 7230/7231…). */
export const RFC9110 = {
  body: StandardsBody.IETF,
  number: 9110,
  code: 'RFC 9110',
  title: 'HTTP Semantics',
  url: 'https://www.rfc-editor.org/rfc/rfc9110',
  obsoletes: ['RFC 7230', 'RFC 7231'],
} as const satisfies RfcDocument;

/** HTTP Caching — defines delta-seconds, cited by Access-Control-Max-Age. */
export const RFC9111 = {
  body: StandardsBody.IETF,
  number: 9111,
  code: 'RFC 9111',
  title: 'HTTP Caching',
  url: 'https://www.rfc-editor.org/rfc/rfc9111',
  obsoletes: ['RFC 7234'],
} as const satisfies RfcDocument;

/** WHATWG Fetch — defines the CORS protocol AND (via #origin-header) the origin serialization
 *  that supplants RFC 6454. Living: cited by anchor, never by version. */
export const WHATWG_FETCH: LivingDocument = {
  body: StandardsBody.WHATWG,
  code: 'WHATWG Fetch',
  title: 'Fetch Living Standard',
  url: 'https://fetch.spec.whatwg.org/',
  status: DocumentStatus.Living,
};

/** WHATWG URL — the host/origin serialization algorithm Fetch defers to. */
export const WHATWG_URL: LivingDocument = {
  body: StandardsBody.WHATWG,
  code: 'WHATWG URL',
  title: 'URL Living Standard',
  url: 'https://url.spec.whatwg.org/',
  status: DocumentStatus.Living,
};

/** WICG Private Network Access — a non-standard draft CG report (snapshot 2024-09-26). Its
 *  draft status is carried here, on the document, not as a per-rule flag. */
export const WICG_PNA: LivingDocument = {
  body: StandardsBody.WICG,
  code: 'WICG PNA',
  title: 'Private Network Access',
  url: 'https://wicg.github.io/private-network-access/',
  status: DocumentStatus.Draft,
};

/** Digest Fields — defines the Content-Digest/Repr-Digest integrity fields cited by compression's
 *  §2.2 (encoding invalidates a pre-encoding-computed digest). */
export const RFC9530 = {
  body: StandardsBody.IETF,
  number: 9530,
  code: 'RFC 9530',
  title: 'Digest Fields',
  url: 'https://www.rfc-editor.org/rfc/rfc9530',
} as const satisfies RfcDocument;

/** ZLIB Compressed Data Format — the wrapper HTTP's `deflate` coding uses (RFC 9110 §8.4.1.2). */
export const RFC1950 = {
  body: StandardsBody.IETF,
  number: 1950,
  code: 'RFC 1950',
  title: 'ZLIB Compressed Data Format Specification version 3.3',
  url: 'https://www.rfc-editor.org/rfc/rfc1950',
} as const satisfies RfcDocument;

/** GZIP File Format Specification — HTTP's `gzip` coding (RFC 9110 §8.4.1.3). */
export const RFC1952 = {
  body: StandardsBody.IETF,
  number: 1952,
  code: 'RFC 1952',
  title: 'GZIP file format specification version 4.3',
  url: 'https://www.rfc-editor.org/rfc/rfc1952',
} as const satisfies RfcDocument;

/** Zstandard Compression Format — HTTP's `zstd` coding. */
export const RFC8878 = {
  body: StandardsBody.IETF,
  number: 8878,
  code: 'RFC 8878',
  title: 'Zstandard Compression and the application/zstd Media Type',
  url: 'https://www.rfc-editor.org/rfc/rfc8878',
} as const satisfies RfcDocument;

/** Guidelines for Use of Zstandard Compression for HTTP — the 8 MiB window cap over `zstd`. */
export const RFC9659 = {
  body: StandardsBody.IETF,
  number: 9659,
  code: 'RFC 9659',
  title: 'Guidelines for Use of Zstandard Compression for HTTP',
  url: 'https://www.rfc-editor.org/rfc/rfc9659',
} as const satisfies RfcDocument;

/** URI: Generic Syntax — the generic (non-form) query component query-parser rules test against. */
export const RFC3986 = {
  body: StandardsBody.IETF,
  number: 3986,
  code: 'RFC 3986',
  title: 'Uniform Resource Identifier (URI): Generic Syntax',
  url: 'https://www.rfc-editor.org/rfc/rfc3986',
} as const satisfies RfcDocument;
