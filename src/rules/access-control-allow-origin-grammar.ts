import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { singleFieldValue } from '../http/decode/fields';
import { ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { NULL_ORIGIN, WILDCARD } from '../normative/literals';
import { isSerializedOrigin } from '../normative/serialized-origin';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/**
 * §1.1–§1.3 — `Access-Control-Allow-Origin` is generated as `origin-or-null / "*"`: the wildcard, the
 * exact lowercase bytes `null`, or a serialized origin (scheme "://" host [":" port], lowercase, no
 * percent-encoding, IPv6 normalized). A list, a subdomain pattern, a trailing slash/path, `NULL`, or
 * a malformed serialization are all §1 violations. Absent/repeated → Skip (repetition is the single
 * rule's concern).
 */
export const accessControlAllowOriginGrammar = defineHttpResponseRule({
  id: Rule.AccessControlAllowOriginGrammar,
  probes: [{ origin: PROBE_ORIGIN }],
  normative: refsFor(
    FetchClauseId.AllowOriginGrammar,
    FetchClauseId.SerializedOriginShape,
    FetchClauseId.SerializedOriginEncoding,
  ),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const value = singleFieldValue(head, ACCESS_CONTROL_ALLOW_ORIGIN);
    if (value === null) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    if (value === WILDCARD || value === NULL_ORIGIN) {
      return { verdict: Verdict.Pass };
    }
    return isSerializedOrigin(value) ? { verdict: Verdict.Pass } : { verdict: Verdict.Fail };
  },
});
