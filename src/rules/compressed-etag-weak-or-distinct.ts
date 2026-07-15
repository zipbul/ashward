import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCEPT_ENCODING, ETAG } from '../normative/header-names';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { isCompressed } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

/** The entity-tag's opaque value, stripped of a properly-cased weak prefix (`W/`). */
function opaquePart(tag: string): string {
  return tag.startsWith('W/') ? tag.slice(2) : tag;
}

/**
 * §4.2 — an entity-tag that fails strong-validator characteristics (shared with the uncoded
 * representation) MUST be marked weak (`W/`); a coded representation's strong tag SHOULD differ
 * from the uncoded one. Two probes: A `Accept-Encoding: gzip`, B `Accept-Encoding: identity`. A's
 * ETag sharing B's opaque value while NOT weak-marked is the MUST violation.
 */
export const compressedEtagWeakOrDistinct = defineResponseRule({
  id: Rule.CompressedEtagWeakOrDistinct,
  probes: [{ headers: [{ name: ACCEPT_ENCODING, value: 'gzip' }] }, { headers: [{ name: ACCEPT_ENCODING, value: 'identity' }] }],
  normative: refsFor(CompressionClauseId.CompressedEtagWeakMarking),
  judge(exchanges) {
    const [a, b] = exchanges;
    if (a === undefined || b === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotApplicable };
    }
    const aTag = singleFieldValue(a.head, ETAG);
    if (aTag === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotApplicable };
    }
    if (!isCompressed(a.head)) {
      return { verdict: Verdict.Skip, reason: SkipReason.NotCompressed };
    }
    if (isCompressed(b.head)) {
      return { verdict: Verdict.Skip, reason: SkipReason.SameRepresentation };
    }
    // A malformed (lowercase) weak prefix is an ETag-grammar concern — out of scope (§8 non-goal).
    if (aTag.startsWith('w/')) {
      return { verdict: Verdict.Skip, reason: SkipReason.OutOfScope };
    }
    const weak = aTag.startsWith('W/');
    const bTag = singleFieldValue(b.head, ETAG);
    const shared = bTag !== null && opaquePart(aTag) === opaquePart(bTag);
    return shared && !weak ? { verdict: Verdict.Fail } : { verdict: Verdict.Pass };
  },
});
