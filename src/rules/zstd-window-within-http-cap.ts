import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { ACCEPT_ENCODING } from '../normative/header-names';
import { zstdWindowSizes } from '../normative/zstd';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { ACCEPTED_ZSTD_CODINGS, gateOutermostCoding } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

/** RFC 9659 §3: a zstd frame over HTTP must not require a Window_Size exceeding 8 MiB. */
const HTTP_ZSTD_WINDOW_CAP = 8 * 1024 * 1024;

/**
 * §5.4 — a `zstd` content-coded response MUST NOT require a decoder window exceeding 8 MiB
 * (RFC 9659 §3). Judged only when `zstd` is the OUTERMOST (last) `Content-Encoding` token; a body
 * that does not parse as a zstd frame at all (bad magic) is out of the window rule's scope — a
 * mislabel is a separate, unshipped format concern (see `zstd-reserved-bits-zero`). RFC 8878 §3.1
 * permits concatenated frames, and the cap applies PER frame, so every frame in the body is
 * checked — one oversized frame fails the rule even behind a conformant first frame.
 */
export const zstdWindowWithinHttpCap = defineResponseRule({
  id: Rule.ZstdWindowWithinHttpCap,
  probes: [{ headers: [{ name: ACCEPT_ENCODING, value: 'zstd' }] }],
  normative: refsFor(CompressionClauseId.ZstdWindowCap),
  judge(exchanges) {
    const gate = gateOutermostCoding(exchanges, ACCEPTED_ZSTD_CODINGS);
    if (!('content' in gate)) {
      return gate;
    }
    const windowSizes = zstdWindowSizes(gate.content);
    if (windowSizes.length === 0) {
      return { verdict: Verdict.Skip, reason: SkipReason.OutOfScope };
    }
    return windowSizes.some(size => size > HTTP_ZSTD_WINDOW_CAP) ? { verdict: Verdict.Fail } : { verdict: Verdict.Pass };
  },
});
