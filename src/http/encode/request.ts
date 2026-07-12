import type { RequestSpec } from './interfaces';

/** A CR or LF in any request-line / header field would split the request (header injection /
 *  request smuggling from ashward's own side). Reject it at the serialization boundary so no
 *  caller — a probe crafter, a future rule — can emit a malformed frame by accident. */
function assertNoCrlf(where: string, value: string): void {
  if (value.includes('\r') || value.includes('\n')) {
    throw new Error(`ashward: refusing to craft a request with CR/LF in ${where}: ${JSON.stringify(value)}`);
  }
}

/**
 * Serialize a well-formed HTTP/1.1 request. `Connection: close` is always sent: the probe reads
 * until the peer terminates, so without it a keep-alive origin would hold the socket open and
 * every exchange would cost a full timeout. Every interpolated part is CR/LF-checked first.
 */
export function craftRequest(spec: RequestSpec): Uint8Array {
  assertNoCrlf('method', spec.method);
  assertNoCrlf('request-target', spec.target);
  assertNoCrlf('Host', spec.host);
  for (const field of spec.headers) {
    assertNoCrlf('a header name', field.name);
    assertNoCrlf(`the ${field.name} value`, field.value);
  }

  const lines = [
    `${spec.method} ${spec.target} HTTP/1.1`,
    `Host: ${spec.host}`,
    ...spec.headers.map(field => `${field.name}: ${field.value}`),
    'Connection: close',
  ];
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n\r\n`);
}
