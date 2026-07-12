import { Rule } from '../core/contract/enums';
import { ACCESS_CONTROL_EXPOSE_HEADERS } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { defineTokenListRule } from './kit/token-list';

/** §1.5 — `Access-Control-Expose-Headers` is a `#field-name` list: each element is a token and no
 *  empty list elements. Judged on the actual (non-preflight) response where it applies. */
export const accessControlExposeHeadersTokenList = defineTokenListRule({
  id: Rule.AccessControlExposeHeadersTokenList,
  header: ACCESS_CONTROL_EXPOSE_HEADERS,
  probes: [{ origin: PROBE_ORIGIN }],
  clauses: [FetchClauseId.ListHeaderTokenGrammar],
});
