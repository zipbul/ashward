import type { Target } from '../core/engine/interfaces';

import { DEFAULT_TIMEOUT_MS, HTTP_PORT, HTTPS_PORT } from './constants';

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Resolve a URL string into a connect Target. Pure and total except for the two documented
 * throws: an unparseable URL (from URL itself) and an unsupported scheme.
 */
export function resolveTarget(url: string): Target {
  const parsed = new URL(url); // throws TypeError on an unparseable URL

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`ashward: unsupported protocol "${parsed.protocol}" (expected http or https)`);
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? HTTPS_PORT : HTTP_PORT;

  return { host: parsed.hostname, port, timeoutMs: DEFAULT_TIMEOUT_MS };
}
