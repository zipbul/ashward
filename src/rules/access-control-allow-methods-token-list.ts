import { Rule } from '../core/contract/enums';
import { ACCESS_CONTROL_ALLOW_METHODS } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { defineTokenListRule } from './kit/token-list';

/** §1.5 / §3.2 — `Access-Control-Allow-Methods` is a `#method` list: each element is a token and no
 *  empty list elements. A malformed value makes the preflight a network error. */
export const accessControlAllowMethodsTokenList = defineTokenListRule({
  id: Rule.AccessControlAllowMethodsTokenList,
  header: ACCESS_CONTROL_ALLOW_METHODS,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'DELETE' }],
  clauses: [FetchClauseId.ListHeaderTokenGrammar, FetchClauseId.PreflightListHeadersParseable],
});
