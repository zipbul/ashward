import type { CredentialsMode } from './enums';

/** The inputs Fetch's CORS check reads: two response headers, and what the request was. */
export interface CorsCheckInput {
  /** `Access-Control-Allow-Origin` as sent, or null when absent or repeated. */
  readonly allowOrigin: string | null;
  /** `Access-Control-Allow-Credentials` as sent, or null when absent or repeated. */
  readonly allowCredentials: string | null;
  /** The serialized origin the probe put on the request. */
  readonly requestOrigin: string;
  readonly credentialsMode: CredentialsMode;
}
