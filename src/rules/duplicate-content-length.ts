import { Rule, Verdict } from '../core/contract/enums';
import { RFC9110, RFC9112 } from '../standards/documents';
import { LocatorKind, ReqLevel } from '../standards/enums';
import { defineFramingRule } from './kit/framing-rule';

/**
 * RFC 9112 §6.3: a message with two divergent Content-Length values is unrecoverably ambiguous and
 * the recipient MUST treat it as an error. We send exactly that (with the caller's Host, so it
 * reaches the origin's parser rather than Host validation) and judge whether the origin refused it
 * (conformant) or processed it (Fail — the parser discrepancy behind CL.TE smuggling).
 */
const craft = (host: string, path: string): Uint8Array =>
  new TextEncoder().encode(`POST ${path} HTTP/1.1\r\nHost: ${host}\r\nContent-Length: 6\r\nContent-Length: 5\r\n\r\nHELLO\n`);

export const duplicateContentLength = defineFramingRule({
  id: Rule.DuplicateContentLength,
  request: craft,
  onAccepted: Verdict.Fail,
  normative: [
    { doc: RFC9112, locator: { kind: LocatorKind.Section, value: '6.3' }, req: ReqLevel.Must },
    { doc: RFC9110, locator: { kind: LocatorKind.Section, value: '5.3' }, req: ReqLevel.Must },
  ],
  tags: { cwe: ['CWE-444'] },
});
