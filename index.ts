/**
 * ashward — a test-support library that probes a running origin server and verifies it conforms to
 * international standards (WHATWG Fetch CORS, RFC 9110/9111/9112, WHATWG URL, WICG PNA) and security
 * requirements, from inside any test runner.
 *
 *   import { ashward, assertConformance, cors } from 'ashward';
 *
 *   const report = await ashward('http://localhost:3000/api'); // all built-in rules
 *   assertConformance(report);                                 // throws on any blocking result
 *   // or scope it: await ashward('http://localhost:3000/api', cors)
 *   // or inspect:  report.ok(), report.results
 */

// The entry and the runner-agnostic gate.
export { ashward } from './src/api/ashward';
export { assertConformance } from './src/core/assert/assert-conformance';
export { AshwardError } from './src/core/assert/ashward-error';
export { formatFailures } from './src/core/assert/pretty-print';

// Presets (named rule selections) + the full built-in set.
export { cors } from './src/presets/cors';
export { framing } from './src/presets/framing';
export { BUILTIN_RULES } from './src/rules/constants';

// Verdict / reason vocabularies and the frozen rule roster, for inspecting results.
export { InconclusiveReason, Rule, SkipReason, Verdict } from './src/core/contract/enums';
export { InconclusiveHandling } from './src/core/report/enums';

export type { ClauseResult, Evidence, RuleDef } from './src/core/contract/interfaces';
export type { ClauseReason } from './src/core/contract/types';
export type { Report, ReportPolicy } from './src/core/report/interfaces';
export type { HttpRuleContext, HttpTarget, ProbeFn } from './src/http/context';
