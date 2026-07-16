import { Rule, Verdict } from '../core/contract/enums';
import { ACCEPT_ENCODING } from '../normative/header-names';
import { isZlibWrapped } from '../normative/zlib';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { gateOutermostCoding } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

const ACCEPTED_DEFLATE_CODINGS = ['deflate'];

/**
 * §5.2 — HTTP `deflate` is RFC 1951 deflate carried inside the RFC 1950 zlib wrapper, never raw
 * deflate. Judged only when `deflate` is the OUTERMOST (last) `Content-Encoding` token — a stacked
 * coding on top means these bytes are not the zlib-wrapped stream at all.
 */
export const deflateZlibWrapped = defineResponseRule({
  id: Rule.DeflateZlibWrapped,
  probes: [{ headers: [{ name: ACCEPT_ENCODING, value: 'deflate' }] }],
  normative: refsFor(CompressionClauseId.DeflateZlibWrapped),
  judge(exchanges) {
    const gate = gateOutermostCoding(exchanges, ACCEPTED_DEFLATE_CODINGS);
    if (!('content' in gate)) {
      return gate;
    }
    return isZlibWrapped(gate.content) ? { verdict: Verdict.Pass } : { verdict: Verdict.Warn };
  },
});
