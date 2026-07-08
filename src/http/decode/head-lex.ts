import { CR, LF } from './constants';
import type { StatusLine } from './interfaces';

/**
 * Lex the response status-line without normalizing. Reads only the first line
 * (terminated by LF, tolerating a preceding CR or a bare LF), and returns null when
 * it is not a recognizable `HTTP-version SP 3DIGIT SP [reason]`. Whether a bare LF or
 * an odd status is itself a violation is a rule's judgment, not this lexer's.
 */
export function parseStatusLine(response: Uint8Array): StatusLine | null {
  if (response.length === 0) return null;

  let lineEnd = response.indexOf(LF);
  if (lineEnd === -1) lineEnd = response.length;
  if (lineEnd > 0 && response[lineEnd - 1] === CR) lineEnd -= 1;

  const line = new TextDecoder().decode(response.subarray(0, lineEnd));

  const firstSp = line.indexOf(' ');
  if (firstSp === -1) return null;

  const httpVersion = line.slice(0, firstSp);
  if (!httpVersion.startsWith('HTTP/')) return null;

  const rest = line.slice(firstSp + 1);
  const secondSp = rest.indexOf(' ');
  const codeStr = secondSp === -1 ? rest : rest.slice(0, secondSp);
  if (!/^\d{3}$/.test(codeStr)) return null;

  const reasonPhrase = secondSp === -1 ? '' : rest.slice(secondSp + 1);
  return { httpVersion, statusCode: Number(codeStr), reasonPhrase };
}
