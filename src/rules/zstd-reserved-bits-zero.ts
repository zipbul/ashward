import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ACCEPT_ENCODING } from '../normative/header-names';
import { zstdAllReservedBitsZero } from '../normative/zstd';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { gateOutermostCoding } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

const ACCEPTED_ZSTD_CODINGS = ['zstd'];

/**
 * §5.4 — a zstd Frame_Header_Descriptor's Unused bit and Reserved bit (RFC 8878
 * §3.1.1.1.1.3/§3.1.1.1.1.4) must be zero. Judged only when `zstd` is the OUTERMOST (last)
 * `Content-Encoding` token; a distinct clause id from the window MUST NOT rule (`zstd-window-
 * within-http-cap`) — this is the §5.4 Unmarked reserved-bits limb. RFC 8878 §3.1 permits
 * concatenated frames, so every frame's descriptor is checked, not just the first.
 */
export const zstdReservedBitsZero = defineResponseRule({
  id: Rule.ZstdReservedBitsZero,
  probes: [{ headers: [{ name: ACCEPT_ENCODING, value: 'zstd' }] }],
  normative: refsFor(CompressionClauseId.ZstdReservedBitsZero),
  judge(exchanges) {
    const gate = gateOutermostCoding(exchanges, ACCEPTED_ZSTD_CODINGS);
    if (!('content' in gate)) {
      return gate;
    }
    const reservedZero = zstdAllReservedBitsZero(gate.content);
    if (reservedZero === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.OutOfScope };
    }
    return reservedZero ? { verdict: Verdict.Pass } : { verdict: Verdict.Warn };
  },
});
