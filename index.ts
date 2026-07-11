/**
 * ashward — a test-support library that probes a running origin server and verifies it conforms to
 * international standards (WHATWG Fetch CORS, RFC 9110/9111/9112, WHATWG URL, WICG PNA) and security
 * requirements, from inside any test runner.
 *
 *   import { ashward, assertConformance } from 'ashward';
 *
 *   const report = await ashward('http://localhost:3000/api'); // runs every shipped rule
 *   assertConformance(report);                                 // throws on any blocking result
 *
 * The package ships RULES; selecting which to run is yours. Filter `ALL_RULES`, or hand-pick the
 * individual rules from the `rules` namespace, and pass them to ashward():
 *
 *   import { ashward, ALL_RULES, rules, Rule } from 'ashward';
 *   await ashward(url, ALL_RULES.filter(r => r.id !== Rule.AccessControlAllowPrivateNetworkLiteralTrue));
 *   await ashward(url, [rules.accessControlAllowOriginGrammar, rules.originReflection]);
 */

// The entry and the runner-agnostic gate.
export { ashward } from './src/api/ashward';
export { assertConformance } from './src/core/assert/assert-conformance';
export { AshwardError } from './src/core/assert/ashward-error';
export { formatFailures } from './src/core/assert/pretty-print';

// Every shipped rule (a flat registry to filter) + each rule by name for explicit composition.
export { ALL_RULES } from './src/rules/all';
export * as rules from './src/rules/all';

// Verdict / reason vocabularies and the frozen rule roster, for referencing and inspecting results.
export { InconclusiveReason, Rule, SkipReason, Verdict } from './src/core/contract/enums';
export { InconclusiveHandling } from './src/core/report/enums';

export type { ClauseResult, Evidence, RuleDef } from './src/core/contract/interfaces';
export type { ClauseReason } from './src/core/contract/types';
export type { Report, ReportPolicy } from './src/core/report/interfaces';
export type { HttpRuleContext, HttpTarget, ProbeFn } from './src/http/context';
