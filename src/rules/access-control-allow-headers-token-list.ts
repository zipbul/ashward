import { Rule } from '../core/contract/enums';
import { ACCESS_CONTROL_ALLOW_HEADERS } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { defineTokenListRule } from './kit/token-list';

/** §1.5 / §3.2 — `Access-Control-Allow-Headers` is a `#field-name` list: each element is a token and
 *  no empty list elements. A malformed value makes the preflight a network error. */
export const accessControlAllowHeadersTokenList = defineTokenListRule({
  id: Rule.AccessControlAllowHeadersTokenList,
  header: ACCESS_CONTROL_ALLOW_HEADERS,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'GET', requestHeaders: ['x-ashward-probe'] }],
  clauses: [FetchClauseId.ListHeaderTokenGrammar, FetchClauseId.PreflightListHeadersParseable],
});
