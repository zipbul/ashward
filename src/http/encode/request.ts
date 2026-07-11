import type { RequestSpec } from './interfaces';

/**
 * Serialize a well-formed HTTP/1.1 request. `Connection: close` is always sent: the probe reads
 * until the peer terminates, so without it a keep-alive origin would hold the socket open and
 * every exchange would cost a full timeout.
 */
export function craftRequest(spec: RequestSpec): Uint8Array {
  const lines = [
    `${spec.method} ${spec.target} HTTP/1.1`,
    `Host: ${spec.host}`,
    ...spec.headers.map(field => `${field.name}: ${field.value}`),
    'Connection: close',
  ];
  return new TextEncoder().encode(`${lines.join('\r\n')}\r\n\r\n`);
}
