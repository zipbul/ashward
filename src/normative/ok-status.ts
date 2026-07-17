/** Fetch reads a preflight response's headers only when it carries an ok status (200–299). */
export function isOkStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 299;
}

/** True for a 5xx (server error) status. */
export function isServerError(statusCode: number): boolean {
  return statusCode >= 500 && statusCode <= 599;
}
