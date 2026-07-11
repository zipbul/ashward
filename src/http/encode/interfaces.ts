import type { HeaderField } from '../decode/interfaces';

/** A well-formed request to craft. Unlike the framing rules — which hand the driver bytes that
 *  are malformed on purpose — standards above the parser need a *valid* message whose headers
 *  carry the probe. */
export interface RequestSpec {
  readonly method: string;
  readonly target: string;
  readonly host: string;
  readonly headers: readonly HeaderField[];
}
