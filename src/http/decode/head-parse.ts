import type { HeaderField, ResponseHead } from './interfaces';

import { CR, LF } from './constants';
import { parseStatusLine } from './head-lex';
import { trimOws } from './ows';

interface HeadLines {
  readonly lines: string[];
  /** Index just past the head-terminating empty line's LF, or undefined when the response
   *  ends before that terminator arrives (an incomplete head). */
  readonly bodyOffset: number | undefined;
}

/** Split the head into raw lines, stopping at the first empty line (the head/body boundary). */
function headLines(response: Uint8Array): HeadLines {
  const lines: string[] = [];
  let start = 0;

  while (start < response.length) {
    let end = response.indexOf(LF, start);
    if (end === -1) {
      end = response.length;
    }

    let lineEnd = end;
    if (lineEnd > start && response[lineEnd - 1] === CR) {
      lineEnd -= 1;
    }
    if (lineEnd === start) {
      return { lines, bodyOffset: end < response.length ? end + 1 : undefined };
    }

    lines.push(new TextDecoder().decode(response.subarray(start, lineEnd)));
    start = end + 1;
  }

  return { lines, bodyOffset: undefined };
}

/**
 * Parse the response head: status-line plus every field line, without normalizing. Only the
 * optional whitespace around a field value is stripped (RFC 9112 §5.1); names keep their case
 * and duplicates are preserved in order. Returns null when there is no parseable status-line —
 * a malformed head is a fact for a rule to judge, not something to repair here.
 */
export function parseResponseHead(response: Uint8Array): ResponseHead | null {
  const statusLine = parseStatusLine(response);
  if (statusLine === null) {
    return null;
  }

  const { lines, bodyOffset } = headLines(response);
  const fields: HeaderField[] = [];
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':');
    if (colon <= 0) {
      continue; // no field name, or an obs-fold continuation — not a field line
    }
    fields.push({ name: line.slice(0, colon), value: trimOws(line.slice(colon + 1)) });
  }

  return bodyOffset === undefined ? { statusLine, fields } : { statusLine, fields, bodyOffset };
}
