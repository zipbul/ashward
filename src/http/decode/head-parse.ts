import type { HeaderField, ResponseHead } from './interfaces';

import { CR, LF } from './constants';
import { parseStatusLine } from './head-lex';

/** Split the head into raw lines, stopping at the first empty line (the head/body boundary). */
function headLines(response: Uint8Array): string[] {
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
      break; // empty line: head ends here
    }

    lines.push(new TextDecoder().decode(response.subarray(start, lineEnd)));
    start = end + 1;
  }

  return lines;
}

/** Strip only the optional whitespace RFC 9112 §5.1 allows around a field value — SP (0x20) and
 *  HTAB (0x09). NOT JS `.trim()`, which also eats Unicode spaces/newlines: a byte-exact rule (e.g.
 *  Access-Control-Allow-Credentials must be `true`) must not have a leading U+00A0 silently removed
 *  so the value looks conformant when the server did not generate the exact bytes. */
function trimOws(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && (value[start] === ' ' || value[start] === '\t')) {
    start += 1;
  }
  while (end > start && (value[end - 1] === ' ' || value[end - 1] === '\t')) {
    end -= 1;
  }
  return value.slice(start, end);
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

  const fields: HeaderField[] = [];
  for (const line of headLines(response).slice(1)) {
    const colon = line.indexOf(':');
    if (colon <= 0) {
      continue; // no field name, or an obs-fold continuation — not a field line
    }
    fields.push({ name: line.slice(0, colon), value: trimOws(line.slice(colon + 1)) });
  }

  return { statusLine, fields };
}
