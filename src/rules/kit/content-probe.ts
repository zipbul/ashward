import type { HttpTarget } from '../../http/context';
import type { HeaderField } from '../../http/decode/interfaces';

import { craftRequest } from '../../http/encode/request';
import { authorityFor } from './craft-probe';

/** What a content probe asks: a set of request headers to negotiate/condition the response on
 *  (e.g. Accept-Encoding, Range, If-None-Match). Never carries `Origin` — a content probe is a
 *  same-origin-shaped request; it is not a CORS probe. */
interface ContentProbeOptions {
  readonly headers: readonly HeaderField[];
}

/**
 * Craft a well-formed, safe GET at `target.path` carrying the caller's request headers. Reuses
 * `craftRequest` (which adds `Host` + `Connection: close` and CR/LF-guards every field), so a
 * content probe can never smuggle a second header or omit the authority a vhost needs.
 */
export function craftContentProbe(target: HttpTarget, options: ContentProbeOptions): Uint8Array {
  const host = authorityFor(target);
  return craftRequest({ method: 'GET', target: target.path, host, headers: options.headers });
}

export type { ContentProbeOptions };
