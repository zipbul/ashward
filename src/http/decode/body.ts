import type { ResponseHead } from './interfaces';

import { CR, LF } from './constants';
import { fieldValues, singleFieldValue } from './fields';

interface DecodedBodyShape {
  readonly content: Uint8Array;
  readonly complete: boolean;
}

const INCOMPLETE: DecodedBodyShape = { content: new Uint8Array(0), complete: false };

/** RFC 9112 §6.1: chunked applies iff it is the LAST coding in Transfer-Encoding. A
 *  Transfer-Encoding split across multiple field lines is folded into one comma list first. */
function isChunked(head: ResponseHead): boolean {
  const codings = fieldValues(head, 'Transfer-Encoding')
    .flatMap(value => value.split(','))
    .map(coding => coding.trim())
    .filter(coding => coding.length > 0);
  const last = codings[codings.length - 1];
  return last?.toLowerCase() === 'chunked';
}

/** A non-negative integer Content-Length (RFC 9112 §6.3), or null when absent/invalid. */
function contentLength(head: ResponseHead): number | null {
  const value = singleFieldValue(head, 'Content-Length');
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : null;
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

export type DecodedBody = DecodedBodyShape;

/**
 * Recover the decoded message content — what a client would treat as the body — plus
 * whether the message completed, per RFC 9112 §6-7 transfer-framing precedence:
 * chunked Transfer-Encoding, then Content-Length, then close-delimited. This layer only
 * removes TRANSFER framing; content-coding (gzip, etc.) is a separate concern.
 */
export function decodeBody(raw: Uint8Array, head: ResponseHead): DecodedBody {
  const { bodyOffset } = head;
  if (bodyOffset === undefined) {
    return INCOMPLETE;
  }

  if (isChunked(head)) {
    return decodeChunked(raw, bodyOffset);
  }

  const length = contentLength(head);
  if (length !== null) {
    const available = raw.length - bodyOffset;
    const has = Math.min(length, Math.max(available, 0));
    return { content: raw.subarray(bodyOffset, bodyOffset + has), complete: available >= length };
  }

  return { content: raw.subarray(bodyOffset), complete: true };
}
