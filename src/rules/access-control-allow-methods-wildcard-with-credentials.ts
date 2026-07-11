import { Rule } from '../core/contract/enums';
import { ACCESS_CONTROL_ALLOW_METHODS } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { defineWildcardWithCredentialsRule } from './kit/wildcard-with-credentials';

/** §3.7 — `Access-Control-Allow-Methods: *` with `Access-Control-Allow-Credentials: true` is invalid:
 *  under credentials `*` is a literal method name, so the preflight is a network error. */
export const accessControlAllowMethodsWildcardWithCredentials = defineWildcardWithCredentialsRule({
  id: Rule.AccessControlAllowMethodsWildcardWithCredentials,
  header: ACCESS_CONTROL_ALLOW_METHODS,
  probes: [{ kind: 'preflight', origin: PROBE_ORIGIN, requestMethod: 'DELETE' }],
  clauses: [FetchClauseId.CredentialedNoWildcard],
});
