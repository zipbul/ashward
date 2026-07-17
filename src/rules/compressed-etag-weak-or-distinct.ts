import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCEPT_ENCODING, ETAG } from '../normative/header-names';
import { CompressionClauseId } from '../standards/catalog/compression';
import { refsFor } from './kit/clause-refs';
import { isCompressed } from './kit/content-encoding';
import { defineResponseRule } from './kit/response-rule';

interface EntityTag {
  readonly weak: boolean;
  readonly opaque: string;
}

/**
 * RFC 9110 §8.8.3 entity-tag grammar: `entity-tag = [ weak ] opaque-tag`,
 * `weak = %s"W/"` (case-sensitive), `opaque-tag = DQUOTE *etagc DQUOTE`,
 * `etagc = %x21 / %x23-7E / obs-text`. Returns null for anything that does not conform — an
 * unquoted value (`v1`) or an unquoted weak-prefixed value (`W/v1`) is malformed, not a valid
 * strong or weak tag, and must never be compared as either.
 */
function parseEntityTag(raw: string): EntityTag | null {
  const weak = raw.startsWith('W/');
  const rest = weak ? raw.slice(2) : raw;

  if (rest.length < 2 || !rest.startsWith('"') || !rest.endsWith('"')) {
    return null;
  }

  const opaque = rest.slice(1, -1);
  for (let i = 0; i < opaque.length; i++) {
    const code = opaque.codePointAt(i);
    if (code === undefined || !(code === 0x21 || (code >= 0x23 && code <= 0x7e) || code >= 0x80)) {
      return null;
    }
  }

  return { weak, opaque };
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
    // A malformed ETag (unquoted, or an unquoted/lowercase weak prefix) is an ETag-grammar
    // concern — out of scope (§8 non-goal). Only compare when BOTH sides parse as a valid
    // entity-tag; comparing a malformed value as if it were a valid strong/weak tag risks a
    // false verdict either way.
    const aEntityTag = parseEntityTag(aTag);
    const bTag = singleFieldValue(b.head, ETAG);
    const bEntityTag = bTag === null ? null : parseEntityTag(bTag);
    if (aEntityTag === null || bEntityTag === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.OutOfScope };
    }
    const shared = aEntityTag.opaque === bEntityTag.opaque;
    const bothStrong = !aEntityTag.weak && !bEntityTag.weak;
    return shared && bothStrong ? { verdict: Verdict.Fail } : { verdict: Verdict.Pass };
  },
});
