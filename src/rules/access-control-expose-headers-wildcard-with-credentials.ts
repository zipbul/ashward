import { Rule } from '../core/contract/enums';
import { ACCESS_CONTROL_EXPOSE_HEADERS } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { defineWildcardWithCredentialsRule } from './kit/wildcard-with-credentials';

/** §3.7 — `Access-Control-Expose-Headers: *` with `Access-Control-Allow-Credentials: true` is invalid:
 *  under credentials `*` is a literal name, so it silently exposes nothing. */
export const accessControlExposeHeadersWildcardWithCredentials = defineWildcardWithCredentialsRule({
  id: Rule.AccessControlExposeHeadersWildcardWithCredentials,
  header: ACCESS_CONTROL_EXPOSE_HEADERS,
  probes: [{ origin: PROBE_ORIGIN }],
  clauses: [FetchClauseId.CredentialedNoWildcard],
});
