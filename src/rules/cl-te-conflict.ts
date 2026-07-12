import { Rule, Verdict } from '../core/contract/enums';
import { RFC9112 } from '../standards/documents';
import { LocatorKind, ReqLevel } from '../standards/enums';
import { defineFramingRule } from './kit/framing-rule';

/**
 * RFC 9112 §6.1: when both Content-Length and Transfer-Encoding are present the Transfer-Encoding
 * overrides, and such a message "ought to be handled as an error" — a SHOULD, not a hard MUST-reject
 * for a final recipient. A self-consistent origin that prefers TE and answers 2xx is defensible, so
 * processing it is a Warn (a smuggling risk to surface), not a Fail. We send the ambiguous frame with
 * the caller's Host and judge whether the origin refused it.
 */
const craft = (host: string, path: string): Uint8Array =>
  new TextEncoder().encode(
    `POST ${path} HTTP/1.1\r\nHost: ${host}\r\nContent-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n`,
  );

export const clTeConflict = defineFramingRule({
  id: Rule.ClTeConflict,
  request: craft,
  onAccepted: Verdict.Warn,
  normative: [{ doc: RFC9112, locator: { kind: LocatorKind.Section, value: '6.1' }, req: ReqLevel.Should }],
  tags: { cwe: ['CWE-444'] },
});
