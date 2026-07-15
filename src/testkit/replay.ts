import type { ProbeFn } from '../http/context';

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
