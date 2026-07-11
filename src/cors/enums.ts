/** A request's credentials mode, as Fetch defines it. Only `Include` changes the CORS check. */
export enum CredentialsMode {
  Omit = 'omit',
  SameOrigin = 'same-origin',
  Include = 'include',
}

/** The two outcomes of Fetch's CORS check — a browser either grants the read or does not. */
export enum CorsCheckOutcome {
  Success = 'success',
  Failure = 'failure',
}
