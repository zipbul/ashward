import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { fieldValues } from '../http/decode/fields';
import { splitFieldList } from '../normative/field-list';
import { ACCESS_CONTROL_ALLOW_METHODS } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { refsFor } from './kit/clause-refs';
import { defineHttpResponseRule } from './kit/http-response-rule';
import { PROBE_ORIGIN } from './kit/probe-fixtures';

/** A real method that Fetch does NOT uppercase-normalize (only DELETE/GET/HEAD/OPTIONS/POST/PUT are),
 *  so the browser's preflight match against ACAM is byte-exact for it. */
const PREVIEWED_METHOD = 'PATCH';

/**
 * §3.4 — `Access-Control-Allow-Methods` method names byte-match the request method. We preview
 * `PATCH`; if ACAM lists it case-insensitively but not byte-exactly (`patch`), the browser's preflight
 * would not find it and would fail — a §3.4 violation. Exact match → Pass; not listed (or `*`) → Skip.
 */
export const accessControlAllowMethodsCase = defineHttpResponseRule({
  id: Rule.AccessControlAllowMethodsCase,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: PREVIEWED_METHOD }],
  normative: refsFor(FetchClauseId.PreflightMethodByteCase),
  judge(heads) {
    const [head] = heads;
    if (head === undefined) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const values = fieldValues(head, ACCESS_CONTROL_ALLOW_METHODS);
    if (values.length === 0) {
      return { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
    }
    const elements = splitFieldList(values.join(', '));
    // A browser's preflight succeeds if ANY element byte-matches the request method, so an exact
    // element passes even alongside a wrong-cased duplicate (`patch, PATCH`). Only a case-insensitive
    // listing with NO exact element is the §3.4 break; not listed at all → the server denies it (Skip).
    if (elements.includes(PREVIEWED_METHOD)) {
      return { verdict: Verdict.Pass };
    }
    const listedInsensitively = elements.some(method => method.toLowerCase() === PREVIEWED_METHOD.toLowerCase());
    return listedInsensitively ? { verdict: Verdict.Fail } : { verdict: Verdict.Skip, reason: SkipReason.HeaderAbsent };
  },
});
