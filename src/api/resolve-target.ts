import type { Target } from '../core/engine/interfaces';

import { DEFAULT_TIMEOUT_MS, HTTP_PORT } from './constants';

/**
 * Resolve a URL string into a connect Target. Pure and total except for the documented throws:
 * an unparseable URL (from URL itself), a non-http scheme, and — deliberately — https. The driver
 * is a plain TCP socket with no TLS, so an https URL would send cleartext into a TLS listener and
 * read handshake bytes back; under the fail-closed default that surfaces as a false-red on every
 * probe. Rejecting it up front as a setup error is the honest behaviour until TLS lands.
 */
export function resolveTarget(url: string): Target {
  const parsed = new URL(url); // throws TypeError on an unparseable URL

  if (parsed.protocol === 'https:') {
    throw new Error('ashward: https targets are not supported yet (the driver has no TLS); use http');
  }
  if (parsed.protocol !== 'http:') {
    throw new Error(`ashward: unsupported protocol "${parsed.protocol}" (expected http)`);
  }

  const port = parsed.port ? Number(parsed.port) : HTTP_PORT;

  return { host: parsed.hostname, port, timeoutMs: DEFAULT_TIMEOUT_MS };
}
