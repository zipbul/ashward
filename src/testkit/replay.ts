import type { ProbeFn } from '../http/context';

import { TerminationCause } from '../transport/tcp/enums';

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
