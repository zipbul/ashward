import { Rule } from '../../../core/contract/enums';
import { RFC9110, RFC9112 } from '../../../standards/constants';
import { LocatorKind, ReqLevel } from '../../../standards/enums';
import { defineFramingRule } from './framing-rule';

/**
 * RFC 9112 §6.3: a message with two divergent Content-Length values is unrecoverably
 * ambiguous and MUST be rejected. We send exactly that and judge whether the origin
 * refused it (conformant) or processed it (the parser discrepancy behind CL.TE smuggling).
 */
const REQUEST = new TextEncoder().encode(
  'POST / HTTP/1.1\r\n' + 'Host: ashward.test\r\n' + 'Content-Length: 6\r\n' + 'Content-Length: 5\r\n' + '\r\n' + 'HELLO\n',
);

export const duplicateContentLength = defineFramingRule({
  id: Rule.DuplicateContentLength,
  request: REQUEST,
  normative: [
    { doc: RFC9112, locator: { kind: LocatorKind.Section, value: '6.3' }, req: ReqLevel.Must },
    { doc: RFC9110, locator: { kind: LocatorKind.Section, value: '5.3' }, req: ReqLevel.Must },
  ],
  tags: { cwe: ['CWE-444'] },
});
