import type { CorsCheckInput } from './interfaces';

import { CREDENTIALS_TRUE, WILDCARD } from './constants';
import { CorsCheckOutcome, CredentialsMode } from './enums';

/**
 * Fetch's "CORS check", step for step — the oracle ashward embeds so no browser is needed.
 * Given what the origin answered and what the probe asked, this is exactly what a browser
 * would decide about letting the requesting origin read the response.
 *
 * Note the wildcard is only a wildcard when credentials are not included, and that the
 * comparison in step 4 is over bytes, not over parsed URLs.
 */
export function corsCheck(input: CorsCheckInput): CorsCheckOutcome {
  const includesCredentials = input.credentialsMode === CredentialsMode.Include;

  if (input.allowOrigin === null) {
    return CorsCheckOutcome.Failure;
  }
  if (!includesCredentials && input.allowOrigin === WILDCARD) {
    return CorsCheckOutcome.Success;
  }
  if (input.allowOrigin !== input.requestOrigin) {
    return CorsCheckOutcome.Failure;
  }
  if (!includesCredentials) {
    return CorsCheckOutcome.Success;
  }
  if (input.allowCredentials === CREDENTIALS_TRUE) {
    return CorsCheckOutcome.Success;
  }
  return CorsCheckOutcome.Failure;
}

/** Fetch requires a preflight response to have an ok status (2xx) before its headers are read. */
export function isOkStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 299;
}
