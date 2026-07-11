import type { Target } from '../../core/engine/interfaces';
import type { HeaderField } from '../../http/decode/interfaces';

import { ACCESS_CONTROL_REQUEST_HEADERS, ACCESS_CONTROL_REQUEST_METHOD, ORIGIN } from '../../cors/constants';
import { craftRequest } from '../../http/encode/request';

/** A simple cross-origin request carrying an Origin. Never a preflight — so it can never carry the
 *  preflight-only Access-Control-Request-* headers, which would be a spec-wrong probe. */
interface SimpleProbe {
  readonly kind?: 'simple';
  readonly origin: string;
  /** Defaults to GET. */
  readonly method?: string;
}

/** A CORS preflight (OPTIONS) previewing a method and, optionally, header names. `requestMethod` is
 *  required by the type, so a preflight can never be sent without the method it is previewing. */
interface PreflightProbe {
  readonly kind: 'preflight';
  readonly origin: string;
  readonly requestMethod: string;
  readonly requestHeaders?: readonly string[];
}

/** What a CORS probe asks. A discriminated union so a spec-wrong probe (OPTIONS with no
 *  Access-Control-Request-Method, or those preflight headers on a simple GET) is unrepresentable.
 *  Note there is no `credentialed` option: the CORS check runs on the actual request's credentials
 *  mode, which a server cannot observe (Fetch), so ashward never branches a probe on cookies —
 *  credential rules are judged from response self-contradiction instead. */
type CorsProbe = SimpleProbe | PreflightProbe;

/** The `Host` authority for the target: `host`, or `host:port` for a non-default port, with an
 *  IPv6 literal bracketed. Sending only the bare host would misroute a vhost/port-scoped origin. */
function authorityFor(target: Target): string {
  const host = target.host.includes(':') && !target.host.startsWith('[') ? `[${target.host}]` : target.host;
  return target.port === 80 ? host : `${host}:${target.port}`;
}

/**
 * Craft a well-formed CORS probe aimed at the caller's resource: the request line targets
 * `target.path`, `Host` is the target authority, and an `Origin` header carries the forged origin.
 * Never sends a `Cookie`. `craftRequest` rejects any CR/LF in these fields, so a forged origin or
 * header value cannot inject a second header or a Cookie.
 */
export function corsRequest(target: Target, probe: CorsProbe): Uint8Array {
  const host = authorityFor(target);
  const headers: HeaderField[] = [{ name: ORIGIN, value: probe.origin }];

  if (probe.kind === 'preflight') {
    headers.push({ name: ACCESS_CONTROL_REQUEST_METHOD, value: probe.requestMethod });
    if (probe.requestHeaders !== undefined && probe.requestHeaders.length > 0) {
      headers.push({ name: ACCESS_CONTROL_REQUEST_HEADERS, value: probe.requestHeaders.join(', ') });
    }
    return craftRequest({ method: 'OPTIONS', target: target.path, host, headers });
  }

  return craftRequest({ method: probe.method ?? 'GET', target: target.path, host, headers });
}

export type { CorsProbe, PreflightProbe, SimpleProbe };
