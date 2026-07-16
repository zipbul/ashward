import type { ProbeFn } from '../http/context';
import type { ProbeResult } from '../transport/tcp/interfaces';

import { TerminationCause } from '../transport/tcp/enums';

/** One canned exchange for `replayExchanges`: a response head plus an optional body. `complete`
 *  defaults to true (a clean FIN); set it false to signal the peer dropped the connection before
 *  the message finished — the real decoder still computes completeness from the bytes given
 *  (e.g. a body shorter than Content-Length), this only chooses the termination cause. */
interface CannedExchange {
  readonly head: string;
  readonly body?: string;
  readonly complete?: boolean;
}

/** A raw `HTTP/1.1 {status}` response head, with an optional pre-built field block, for handing to
 *  `replay()` — the canonical single-response fixture the conditional-request rule specs build on. */
export function res(status: string, fields = ''): string {
  return `HTTP/1.1 ${status}\r\n${fields}\r\n\r\n`;
}

/** A raw `HTTP/1.1 200 OK` response head with a caller-built field block, for handing to `replay()`
 *  — the canonical fixture the CORS/token-list rule specs build on. */
export function head(fields: string): string {
  return `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
}

/** A ProbeFn that replays canned response strings in order (repeating the last for any extra call),
 *  each ending in a clean FIN — for driving an HTTP rule's judge in a unit test without a socket. */
export function replay(...responses: readonly string[]): ProbeFn {
  let call = 0;
  return async () => {
    const raw = responses[Math.min(call, responses.length - 1)] ?? '';
    call += 1;
    return Promise.resolve({ response: new TextEncoder().encode(raw), termination: TerminationCause.Fin });
  };
}

/** A ProbeFn that replays one canned response and records the request-line it was sent, so a test
 *  can assert on the EXACT bytes a rule crafted (e.g. the request-target with its raw query),
 *  never just the resulting verdict — a wrong crafted request with a coincidentally-right verdict
 *  would no longer pass. */
export function capturingProbe(rawResponse: string): { probe: ProbeFn; sentLine: () => string; sentRequest: () => Uint8Array } {
  let sent: Uint8Array = new Uint8Array(0);
  const probe: ProbeFn = async bytes => {
    sent = bytes;
    return Promise.resolve({ response: new TextEncoder().encode(rawResponse), termination: TerminationCause.Fin });
  };
  return {
    probe,
    sentLine: () => new TextDecoder().decode(sent).split('\r\n')[0] ?? '',
    sentRequest: () => sent,
  };
}

/** A ProbeFn that replays canned head+body exchanges in order (repeating the last for any extra
 *  call), for driving a body-bearing rule's judge (see response-rule.ts) without a socket. Each
 *  exchange's `.response` is `head + body`; termination is a clean `Fin` unless `complete: false`,
 *  in which case it is `Rst` — the peer reset before the message completed. */
export function replayExchanges(...exchanges: readonly CannedExchange[]): ProbeFn {
  let call = 0;
  return async () => {
    const exchange = exchanges[Math.min(call, exchanges.length - 1)];
    call += 1;
    if (exchange === undefined) {
      return Promise.resolve({ response: new Uint8Array(0), termination: TerminationCause.Fin });
    }
    const raw = exchange.head + (exchange.body ?? '');
    const termination = exchange.complete === false ? TerminationCause.Rst : TerminationCause.Fin;
    return Promise.resolve({ response: new TextEncoder().encode(raw), termination });
  };
}

/** A single Content-Length-framed `HTTP/1.1 200 OK` exchange, byte-assembled from a caller-built
 *  field block and a raw body (the Content-Length is computed from `body`, or overridden via
 *  `opts.contentLength` to build a truncated/oversized-declaration fixture) — for driving a
 *  body-bearing rule's judge (see response-rule.ts) with a single canned `ProbeResult`, without a
 *  socket. `opts.complete: false` signals the peer reset before the message finished (`Rst`); the
 *  real decoder still computes completeness from the bytes given, this only chooses the termination
 *  cause. */
export function exchange(
  headFields: string,
  body: readonly number[],
  opts?: { contentLength?: number; complete?: boolean },
): ProbeResult {
  const bodyBytes = Uint8Array.from(body);
  const cl = opts?.contentLength ?? bodyBytes.length;
  const headStr = `HTTP/1.1 200 OK\r\n${headFields}\r\nContent-Length: ${cl}\r\n\r\n`;
  const headBytes = new TextEncoder().encode(headStr);
  const response = new Uint8Array(headBytes.length + bodyBytes.length);
  response.set(headBytes, 0);
  response.set(bodyBytes, headBytes.length);
  return { response, termination: opts?.complete === false ? TerminationCause.Rst : TerminationCause.Fin };
}
