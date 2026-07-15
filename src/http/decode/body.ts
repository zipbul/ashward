import type { ResponseHead } from './interfaces';

import { CONTENT_LENGTH, TRANSFER_ENCODING } from '../../normative/header-names';
import { TerminationCause } from '../../transport/tcp/enums';
import { CR, LF } from './constants';
import { fieldValues } from './fields';

interface DecodedBodyShape {
  readonly content: Uint8Array;
  readonly complete: boolean;
}

const INCOMPLETE: DecodedBodyShape = { content: new Uint8Array(0), complete: false };

/** Transfer-Encoding's codings, in order, folded across repeated field lines into one comma
 *  list first (RFC 9112 §6.1). Empty when the field is absent. */
function transferCodings(head: ResponseHead): readonly string[] {
  return fieldValues(head, TRANSFER_ENCODING)
    .flatMap(value => value.split(','))
    .map(coding => coding.trim())
    .filter(coding => coding.length > 0);
}

/** RFC 9112 §6.1: chunked applies iff it is the LAST coding in Transfer-Encoding. */
function isChunked(codings: readonly string[]): boolean {
  const last = codings[codings.length - 1];
  return last?.toLowerCase() === 'chunked';
}

type ContentLengthResult =
  | { readonly kind: 'absent' }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'value'; readonly length: number };

/**
 * RFC 9112 §6.3: every Content-Length field value must be a non-negative integer, and repeated
 * fields must all agree — disagreement makes the message length ambiguous, which MUST NOT be
 * silently resolved by reading to EOF. A single invalid value is simply treated as absent.
 */
function contentLength(head: ResponseHead): ContentLengthResult {
  const values = fieldValues(head, CONTENT_LENGTH);
  if (values.length === 0) {
    return { kind: 'absent' };
  }

  const lengths = new Set<number>();
  for (const value of values) {
    if (!/^\d+$/.test(value)) {
      return { kind: 'absent' };
    }
    const length = Number(value);
    if (!Number.isSafeInteger(length)) {
      return { kind: 'absent' };
    }
    lengths.add(length);
  }

  return lengths.size === 1 ? { kind: 'value', length: [...lengths][0]! } : { kind: 'ambiguous' };
}

/** Find the CRLF (or bare LF) terminating a line starting at `start`. Returns the index of
 *  the byte just past the terminator, or null when the buffer runs out first. */
function lineEnd(raw: Uint8Array, start: number): { textEnd: number; next: number } | null {
  const lf = raw.indexOf(LF, start);
  if (lf === -1) {
    return null;
  }
  const textEnd = lf > start && raw[lf - 1] === CR ? lf - 1 : lf;
  return { textEnd, next: lf + 1 };
}

function decodeChunked(raw: Uint8Array, bodyOffset: number): DecodedBodyShape {
  const chunks: Uint8Array[] = [];
  let offset = bodyOffset;

  for (;;) {
    const sizeLine = lineEnd(raw, offset);
    if (sizeLine === null) {
      return { content: concat(chunks), complete: false };
    }

    const sizeText = new TextDecoder().decode(raw.subarray(offset, sizeLine.textEnd)).split(';', 1)[0]?.trim();
    if (sizeText === undefined || !/^[0-9a-fA-F]+$/.test(sizeText)) {
      return { content: concat(chunks), complete: false };
    }

    const size = Number.parseInt(sizeText, 16);
    if (!Number.isSafeInteger(size)) {
      return { content: concat(chunks), complete: false };
    }
    if (size === 0) {
      return { content: concat(chunks), complete: skipTrailer(raw, sizeLine.next) };
    }

    const dataStart = sizeLine.next;
    const dataEnd = dataStart + size;
    if (dataEnd + 1 > raw.length) {
      return { content: concat(chunks, raw.subarray(dataStart, raw.length)), complete: false };
    }
    chunks.push(raw.subarray(dataStart, dataEnd));

    const afterData = lineEnd(raw, dataEnd);
    if (afterData === null || afterData.textEnd !== dataEnd) {
      return { content: concat(chunks), complete: false };
    }
    offset = afterData.next;
  }
}

/** Consume and discard the optional trailer section (header lines terminated by an empty
 *  line) after the terminating 0-chunk. Returns whether the trailer was fully available. */
function skipTrailer(raw: Uint8Array, start: number): boolean {
  let offset = start;
  for (;;) {
    const line = lineEnd(raw, offset);
    if (line === null) {
      return false;
    }
    if (line.textEnd === offset) {
      return true; // empty line: trailer section ends here
    }
    offset = line.next;
  }
}

function concat(chunks: Uint8Array[], tail?: Uint8Array): Uint8Array {
  const all = tail === undefined ? chunks : [...chunks, tail];
  const total = all.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of all) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** RFC 9112 §2.2: a recipient MAY ignore at least one empty line (CRLF, or bare LF) that precedes
 *  what it reads as the next message on the connection. That tolerance is a close-delimited-framing
 *  artifact ONLY — it never applies to a Content-Length- or chunked-framed body, whose bytes are
 *  real content by definition of the framing itself (RFC 9112 §6.3). Strips at most one; a genuine
 *  close-delimited body never opens on it. */
function stripLeadingEmptyLine(content: Uint8Array): Uint8Array {
  if (content.length >= 2 && content[0] === CR && content[1] === LF) {
    return content.subarray(2);
  }
  if (content.length >= 1 && content[0] === LF) {
    return content.subarray(1);
  }
  return content;
}

export type DecodedBody = DecodedBodyShape;

/**
 * Recover the decoded message content — what a client would treat as the body — plus
 * whether the message completed, per RFC 9112 §6.3 transfer-framing precedence: chunked
 * Transfer-Encoding, then (only when Transfer-Encoding is absent or itself close-delimited)
 * Content-Length, then close-delimited. This layer only removes TRANSFER framing; content-coding
 * (gzip, etc.) is a separate concern.
 *
 * `termination` is how the transport ended the exchange (absent when unknown, e.g. in a unit
 * test that only cares about framing). It matters only for a close-delimited body: chunked and
 * Content-Length-framed bodies always compute completeness from the bytes themselves, but a
 * close-delimited body is "complete" only when the peer actually closed cleanly (a clean FIN) —
 * an RST or timeout mid-body must not be reported as a complete message.
 */
export function decodeBody(raw: Uint8Array, head: ResponseHead, termination?: TerminationCause): DecodedBody {
  const { bodyOffset } = head;
  if (bodyOffset === undefined) {
    return INCOMPLETE;
  }

  const codings = transferCodings(head);

  if (isChunked(codings)) {
    return decodeChunked(raw, bodyOffset);
  }

  // RFC 9112 §6.3: Transfer-Encoding present with a non-chunked last coding makes the message
  // close-delimited outright — Content-Length (if also present) MUST be ignored.
  if (codings.length === 0) {
    const length = contentLength(head);
    if (length.kind === 'value') {
      const available = raw.length - bodyOffset;
      const has = Math.min(length.length, Math.max(available, 0));
      return { content: raw.subarray(bodyOffset, bodyOffset + has), complete: available >= length.length };
    }
    if (length.kind === 'ambiguous') {
      return { content: new Uint8Array(0), complete: false };
    }
  }

  const complete = termination === undefined || termination === TerminationCause.Fin;
  return { content: stripLeadingEmptyLine(raw.subarray(bodyOffset)), complete };
}
