export interface StatusLine {
  readonly httpVersion: string;
  readonly statusCode: number;
  readonly reasonPhrase: string;
}

/** One field line exactly as it appeared on the wire — the name is never lower-cased and
 *  repeated names are never merged, because "did the server send two of these?" is itself
 *  a judgment some rules must make. */
export interface HeaderField {
  readonly name: string;
  readonly value: string;
}

export interface ResponseHead {
  readonly statusLine: StatusLine;
  readonly fields: readonly HeaderField[];
}
