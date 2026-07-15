import { Rule, SkipReason, Verdict } from '../core/contract/enums';
import { IF_NONE_MATCH } from '../normative/header-names';
import { WILDCARD } from '../normative/literals';
import { ConditionalClauseId } from '../standards/catalog/conditional-request';
import { refsFor } from './kit/clause-refs';
import { defineConditionalRule } from './kit/conditional-rule';

/** A fixed, unlikely-to-exist request-target suffix — deterministic across runs so the two discover
 *  probes and the later conditional/re-confirm probes all address the SAME (almost certainly
 *  nonexistent) resource, per PLAN §5's "custom discover = GET {path}/<random>". */
const RANDOM_PATH_SUFFIX = '/ashward-c14-b7f2b6a4-does-not-exist';

/** A success, a 304, or a 412 — the shape a precondition-evaluating origin would answer with. */
function isPreconditionShaped(status: number): boolean {
  return (status >= 200 && status <= 299) || status === 304 || status === 412;
}

/** Neither a success, a 304, nor a 412 — the "the normal-request-check response was not 2xx and not
 *  412" gate §3.2 conditions on (PLAN §5's `S ∉ {2xx, 304, 412}`). */
function isEligibleErrorStatus(status: number): boolean {
  return !isPreconditionShaped(status);
}

/**
 * C14 — §3.2 MUST: when the unconditional response would not have been 2xx or 412 (e.g. a 404), all
 * received preconditions are ignored. Custom discover: two GETs at a fixed, effectively-random path
 * must agree on a stable error status S outside `{2xx, 304, 412}`. The conditional probe adds
 * `If-None-Match: *`; the judge (pass-2) Passes iff the status is unchanged (S), and re-discovers
 * before Failing on a precondition-shaped outcome (2xx/304/412) — a status drift is
 * `Skip(EndpointUnstable)`, never a false Fail.
 */
export const conditionalIgnoredOnErrorStatus = defineConditionalRule({
  id: Rule.ConditionalIgnoredOnErrorStatus,
  normative: refsFor(ConditionalClauseId.ConditionalIgnoredOnErrorStatus),
  guard: 'existence',
  discoverProbes: [
    { headers: [], pathSuffix: RANDOM_PATH_SUFFIX },
    { headers: [], pathSuffix: RANDOM_PATH_SUFFIX },
  ],
  expectedBaselineStatus: isEligibleErrorStatus,
  gate() {
    return null;
  },
  build() {
    return [{ headers: [{ name: IF_NONE_MATCH, value: WILDCARD }], pathSuffix: RANDOM_PATH_SUFFIX }];
  },
  judge(discovered, probed) {
    const baseline = discovered[0]?.status;
    const outcome = probed[0]?.status;
    if (outcome === baseline) {
      return { verdict: Verdict.Pass };
    }
    if (outcome !== undefined && isPreconditionShaped(outcome)) {
      return { verdict: Verdict.Fail };
    }
    return { verdict: Verdict.Skip, reason: SkipReason.EndpointUnstable };
  },
});
