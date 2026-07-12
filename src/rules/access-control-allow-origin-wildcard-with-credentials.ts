import { Rule } from '../core/contract/enums';
import { ACCESS_CONTROL_ALLOW_ORIGIN } from '../normative/header-names';
import { FetchClauseId } from '../standards/catalog/fetch';
import { PROBE_ORIGIN } from './kit/probe-fixtures';
import { defineWildcardWithCredentialsRule } from './kit/wildcard-with-credentials';

/** §2.2 — `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true` is
 *  a self-contradiction: `*` is not a wildcard when credentials are included, so the grant never
 *  applies. Observable in the response alone. */
export const accessControlAllowOriginWildcardWithCredentials = defineWildcardWithCredentialsRule({
  id: Rule.AccessControlAllowOriginWildcardWithCredentials,
  header: ACCESS_CONTROL_ALLOW_ORIGIN,
  probes: [{ origin: PROBE_ORIGIN }],
  clauses: [FetchClauseId.AllowOriginMatchesRequest],
});
