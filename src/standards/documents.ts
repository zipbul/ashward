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
