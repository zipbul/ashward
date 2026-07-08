import { StandardsBody } from './enums';
import type { RfcDocument } from './interfaces';

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
