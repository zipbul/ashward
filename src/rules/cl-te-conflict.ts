import { Rule } from '../core/contract/enums';
import { RFC9112 } from '../standards/documents';
import { LocatorKind, ReqLevel } from '../standards/enums';
import { defineFramingRule } from './kit/framing-rule';

/**
 * RFC 9112 §6.1: when both Content-Length and Transfer-Encoding are present the framing is
 * ambiguous — a likely request-smuggling attempt — and MUST be treated as an error. We send
 * exactly such a message and judge whether the origin refused it.
 */
const REQUEST = new TextEncoder().encode(
  'POST / HTTP/1.1\r\n' +
    'Host: ashward.test\r\n' +
    'Content-Length: 6\r\n' +
    'Transfer-Encoding: chunked\r\n' +
    '\r\n' +
    '0\r\n' +
    '\r\n',
);

export const clTeConflict = defineFramingRule({
  id: Rule.ClTeConflict,
  request: REQUEST,
  normative: [{ doc: RFC9112, locator: { kind: LocatorKind.Section, value: '6.1' }, req: ReqLevel.Must }],
  tags: { cwe: ['CWE-444'] },
});
