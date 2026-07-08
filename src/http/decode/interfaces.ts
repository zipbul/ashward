export interface StatusLine {
  readonly httpVersion: string;
  readonly statusCode: number;
  readonly reasonPhrase: string;
}
