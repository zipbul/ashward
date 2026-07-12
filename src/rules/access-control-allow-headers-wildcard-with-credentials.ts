import { Rule } from '../core/contract/enums';
import { ACCESS_CONTROL_ALLOW_HEADERS } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { defineWildcardWithCredentialsRule } from './kit/wildcard-with-credentials';

/** §3.7 — `Access-Control-Allow-Headers: *` with `Access-Control-Allow-Credentials: true` is invalid:
 *  under credentials `*` is a literal header name, so the preflight is a network error. */
export const accessControlAllowHeadersWildcardWithCredentials = defineWildcardWithCredentialsRule({
  id: Rule.AccessControlAllowHeadersWildcardWithCredentials,
  header: ACCESS_CONTROL_ALLOW_HEADERS,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'GET', requestHeaders: ['x-ashward-probe'] }],
  clauses: [FetchClauseId.CredentialedNoWildcard],
});
