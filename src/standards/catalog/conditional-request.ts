import type { Catalog, Clause, Disposition } from '../catalog-types';

import { Rule } from '../../core/contract/enums';
import { Severity } from '../disposition-enums';
import { RFC9110 } from '../documents';
import { ReqLevel } from '../enums';
import { clause, differential, rfc } from './build';

/**
 * A neutral, editorial identity for one conditional-request requirement — the join key between this
 * catalog's clauses, its dispositions, and the rules (C1-C14) that test them. Local to this module
 * (mirrors `CompressionClauseId`/`UrlencodedClauseId`). The `§N` in each comment is the
 * zipbul/conditional-request STANDARDS digest's own numbering (snapshot 2026-07-13) — a human
 * breadcrumb only, never the key. `§5.2.4` and `§5.3.7` each carry two limbs at different (or the
 * same) BCP14 level and are modeled as two clause ids (see PLAN §0.1); `§6.1.2` splits its MUST into
 * a tested field set (C11) and an untestable `Date` sub-limb, per PLAN §5.
 */
enum ConditionalClauseId {
  // §1 — received-validator parsing (§8.8.3 · §5.6.7 · §13.1)
  EntityTagGrammar = 'entity-tag-grammar', // §1.1 Unmarked
  FieldValueGrammar = 'field-value-grammar', // §1.2 Unmarked
  HttpDateFormatsAccepted = 'http-date-formats-accepted', // §1.3 MUST — C8
  TwoDigitYearDisambiguation = 'two-digit-year-disambiguation', // §1.4 MUST
  HttpDateCaseSensitiveUtc = 'http-date-case-sensitive-utc', // §1.5 Unmarked
  WildcardMixingInvalid = 'wildcard-mixing-invalid', // §1.6 Unmarked

  // §2 — comparison functions (§8.8.3.2)
  StrongComparisonDefinition = 'strong-comparison-definition', // §2.1 Unmarked
  WeakComparisonDefinition = 'weak-comparison-definition', // §2.2 Unmarked
  IfMatchStrongComparison = 'if-match-strong-comparison', // §2.3 MUST — C5
  IfNoneMatchWeakComparison = 'if-none-match-weak-comparison', // §2.4 MUST — C3
  ComparisonResultTable = 'comparison-result-table', // §2.5 Unmarked

  // §3 — evaluation gate (§13.2.1)
  EvaluationGateGeneral = 'evaluation-gate-general', // §3.1 MUST
  ConditionalIgnoredOnErrorStatus = 'conditional-ignored-on-error-status', // §3.2 MUST — C14
  ConditionalIgnoredOnNonSelectingMethod = 'conditional-ignored-on-non-selecting-method', // §3.3 MUST — C13

  // §4 — precedence (§13.2.2)
  PrecedenceFullOrder = 'precedence-full-order', // §4.1 MUST
  PrecedenceIfNoneMatchOverIfModifiedSince = 'precedence-if-none-match-over-if-modified-since', // §4.2 MUST — C9
  PrecedenceIfMatchOverIfUnmodifiedSince = 'precedence-if-match-over-if-unmodified-since', // §4.3 MUST — C10

  // §5.1 — If-Match (§13.1.1)
  IfMatchEvaluatePerGate = 'if-match-evaluate-per-gate', // §5.1.1 MUST
  IfMatchEvaluationDefinition = 'if-match-evaluation-definition', // §5.1.2 Unmarked
  IfMatchFalseNotPerformed = 'if-match-false-not-performed', // §5.1.3 MUST NOT — C4

  // §5.2 — If-None-Match (§13.1.2)
  IfNoneMatchEvaluatePerGate = 'if-none-match-evaluate-per-gate', // §5.2.1 MUST
  IfNoneMatchEvaluationDefinition = 'if-none-match-evaluation-definition', // §5.2.2 Unmarked
  IfNoneMatchFalseNotPerformed = 'if-none-match-false-not-performed', // §5.2.3 MUST NOT
  IfNoneMatchFalseResponse = 'if-none-match-false-response', // §5.2.4 MUST (GET/HEAD→304 limb) — C1,C2
  IfNoneMatchFalseResponseOtherMethod = 'if-none-match-false-response-other-method', // §5.2.4 MUST (other-method→412 limb)

  // §5.3 — If-Modified-Since (§13.1.3)
  IgnoreImsWhenInm = 'ignore-ims-when-inm', // §5.3.1 MUST
  IgnoreInvalidIms = 'ignore-invalid-ims', // §5.3.2 MUST
  IgnoreImsNoModDate = 'ignore-ims-no-mod-date', // §5.3.3 MUST
  ImsOriginClock = 'ims-origin-clock', // §5.3.4 MUST
  EvaluateImsShould = 'evaluate-ims-should', // §5.3.5 SHOULD
  ImsEvaluationDefinition = 'ims-evaluation-definition', // §5.3.6 Unmarked
  IfModifiedSinceNotModified = 'if-modified-since-not-modified', // §5.3.7 SHOULD (generate-304 limb) — C7
  IfModifiedSinceShouldNotPerform = 'if-modified-since-should-not-perform', // §5.3.7 SHOULD NOT (perform limb)

  // §5.4 — If-Unmodified-Since (§13.1.4)
  IgnoreIusWhenIm = 'ignore-ius-when-im', // §5.4.1 MUST
  IgnoreInvalidIus = 'ignore-invalid-ius', // §5.4.2 MUST
  IgnoreIusNoModDate = 'ignore-ius-no-mod-date', // §5.4.3 MUST
  IusOriginClock = 'ius-origin-clock', // §5.4.4 MUST
  IusEvaluatePerGate = 'ius-evaluate-per-gate', // §5.4.5 MUST
  IusEvaluationDefinition = 'ius-evaluation-definition', // §5.4.6 Unmarked
  IfUnmodifiedSinceFalseNotPerformed = 'if-unmodified-since-false-not-performed', // §5.4.7 MUST NOT — C6

  // §6.1 — 304 Not Modified (§15.4.5)
  NotModifiedSemantics = 'not-modified-semantics', // §6.1.1 Unmarked
  NotModifiedRequiredHeaders = 'not-modified-required-headers', // §6.1.2 MUST (field set) — C11
  NotModifiedDateHeader = 'not-modified-date-header', // §6.1.2 MUST (Date sub-limb)
  NotModifiedNoExtraMetadata = 'not-modified-no-extra-metadata', // §6.1.3 SHOULD NOT
  NotModifiedNoContent = 'not-modified-no-content', // §6.1.4 Unmarked — C12

  // §6.2 — 412 Precondition Failed (§15.5.13)
  PreconditionFailedSemantics = 'precondition-failed-semantics', // §6.2.1 Unmarked

  // §6.3 — failure response levels (§13.1.1 · §13.1.2 · §13.1.4)
  IfMatchMay412 = 'if-match-may-412', // §6.3.1 MAY
  IfUnmodifiedSinceMay412 = 'if-unmodified-since-may-412', // §6.3.2 MAY
  IfNoneMatchFailureSymmetry = 'if-none-match-failure-symmetry', // §6.3.3 MUST
  StateChangingAlreadyApplied = 'state-changing-already-applied', // §6.3.4 MAY
}

/** The conditional-request clause index — hand-verified against
 *  zipbul/conditional-request STANDARDS.md §1-§6 (snapshot 2026-07-13). */
const CLAUSES: readonly Clause[] = [
  clause(
    ConditionalClauseId.EntityTagGrammar, // §1.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.8.3')],
    'entity-tag grammar: `entity-tag = [ weak ] opaque-tag`, `weak = %s"W/"`, `opaque-tag = DQUOTE *etagc DQUOTE`',
  ),
  clause(
    ConditionalClauseId.FieldValueGrammar, // §1.2
    ReqLevel.Unmarked,
    [rfc(RFC9110, '13.1.1'), rfc(RFC9110, '13.1.2'), rfc(RFC9110, '13.1.3'), rfc(RFC9110, '13.1.4')],
    'field grammar: `If-Match`/`If-None-Match` = "*" / #entity-tag; `If-Modified-Since`/`If-Unmodified-Since` = HTTP-date',
  ),
  clause(
    ConditionalClauseId.HttpDateFormatsAccepted, // §1.3
    ReqLevel.Must,
    [rfc(RFC9110, '5.6.7')],
    'a recipient parsing an HTTP field timestamp accepts all three HTTP-date formats (IMF-fixdate, RFC 850, asctime)',
  ),
  clause(
    ConditionalClauseId.TwoDigitYearDisambiguation, // §1.4
    ReqLevel.Must,
    [rfc(RFC9110, '5.6.7')],
    'an rfc850-date two-digit year that appears more than 50 years in the future is interpreted as the most recent past year sharing those two digits',
  ),
  clause(
    ConditionalClauseId.HttpDateCaseSensitiveUtc, // §1.5
    ReqLevel.Unmarked,
    [rfc(RFC9110, '5.6.7')],
    'HTTP-date is case-sensitive and represents UTC — IMF-fixdate/rfc850-date spell `GMT`, asctime-date is assumed UTC',
  ),
  clause(
    ConditionalClauseId.WildcardMixingInvalid, // §1.6
    ReqLevel.Unmarked,
    [rfc(RFC9110, '13.1.1'), rfc(RFC9110, '13.1.2')],
    'an If-Match/If-None-Match field mixing "*" with another value is not generable per the grammar; recipient handling is left unspecified',
  ),

  clause(
    ConditionalClauseId.StrongComparisonDefinition, // §2.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.8.3.2')],
    'strong comparison: both entity-tags are not weak and their opaque-tags match character-by-character',
  ),
  clause(
    ConditionalClauseId.WeakComparisonDefinition, // §2.2
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.8.3.2')],
    'weak comparison: opaque-tags match character-by-character regardless of either side’s weak marking',
  ),
  clause(
    ConditionalClauseId.IfMatchStrongComparison, // §2.3
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.1')],
    'If-Match entity-tag comparison uses strong comparison',
  ),
  clause(
    ConditionalClauseId.IfNoneMatchWeakComparison, // §2.4
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.2')],
    'If-None-Match entity-tag comparison uses weak comparison',
  ),
  clause(
    ConditionalClauseId.ComparisonResultTable, // §2.5
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.8.3.2')],
    'comparison result table (Table 3): a weakly-marked ETag never passes strong comparison',
  ),

  clause(
    ConditionalClauseId.EvaluationGateGeneral, // §3.1
    ReqLevel.Must,
    [rfc(RFC9110, '13.2.1')],
    'preconditions are evaluated after normal request checks succeed, immediately before content processing or method performance',
  ),
  clause(
    ConditionalClauseId.ConditionalIgnoredOnErrorStatus, // §3.2
    ReqLevel.Must,
    [rfc(RFC9110, '13.2.1')],
    'when the unconditional response would not have been 2xx or 412, all received preconditions are ignored',
  ),
  clause(
    ConditionalClauseId.ConditionalIgnoredOnNonSelectingMethod, // §3.3
    ReqLevel.Must,
    [rfc(RFC9110, '13.2.1')],
    'conditional headers received with a method that does not select/modify a representation (CONNECT, OPTIONS, TRACE, …) are ignored',
  ),

  clause(
    ConditionalClauseId.PrecedenceFullOrder, // §4.1
    ReqLevel.Must,
    [rfc(RFC9110, '13.2.2')],
    'preconditions are evaluated in the single §13.2.2 six-step order',
  ),
  clause(
    ConditionalClauseId.PrecedenceIfNoneMatchOverIfModifiedSince, // §4.2
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.3')],
    'If-Modified-Since is ignored when If-None-Match is present',
  ),
  clause(
    ConditionalClauseId.PrecedenceIfMatchOverIfUnmodifiedSince, // §4.3
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.4')],
    'If-Unmodified-Since is ignored when If-Match is present',
  ),

  clause(
    ConditionalClauseId.IfMatchEvaluatePerGate, // §5.1.1
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.1')],
    'a representation-selecting request carrying If-Match is evaluated per §13.2 before method performance',
  ),
  clause(
    ConditionalClauseId.IfMatchEvaluationDefinition, // §5.1.2
    ReqLevel.Unmarked,
    [rfc(RFC9110, '13.1.1')],
    'If-Match evaluation: "*" is true iff a current representation exists; a tag list is true iff a listed tag matches',
  ),
  clause(
    ConditionalClauseId.IfMatchFalseNotPerformed, // §5.1.3
    ReqLevel.MustNot,
    [rfc(RFC9110, '13.1.1')],
    'the request method is not performed when If-Match evaluates false',
  ),

  clause(
    ConditionalClauseId.IfNoneMatchEvaluatePerGate, // §5.2.1
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.2')],
    'a representation-selecting request carrying If-None-Match is evaluated per §13.2 before method performance',
  ),
  clause(
    ConditionalClauseId.IfNoneMatchEvaluationDefinition, // §5.2.2
    ReqLevel.Unmarked,
    [rfc(RFC9110, '13.1.2')],
    'If-None-Match evaluation: "*" is false iff a current representation exists; a tag list is false iff a listed tag matches',
  ),
  clause(
    ConditionalClauseId.IfNoneMatchFalseNotPerformed, // §5.2.3
    ReqLevel.MustNot,
    [rfc(RFC9110, '13.1.2')],
    'the request method is not performed when If-None-Match evaluates false',
  ),
  clause(
    ConditionalClauseId.IfNoneMatchFalseResponse, // §5.2.4 (GET/HEAD limb)
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.2')],
    'on an If-None-Match false evaluation, a GET/HEAD request is answered 304 (Not Modified)',
  ),
  clause(
    ConditionalClauseId.IfNoneMatchFalseResponseOtherMethod, // §5.2.4 (other-method limb)
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.2')],
    'on an If-None-Match false evaluation, any other request method is answered 412 (Precondition Failed)',
  ),

  clause(
    ConditionalClauseId.IgnoreImsWhenInm, // §5.3.1
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.3')],
    'If-Modified-Since is ignored when the request carries If-None-Match',
  ),
  clause(
    ConditionalClauseId.IgnoreInvalidIms, // §5.3.2
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.3')],
    'If-Modified-Since is ignored when its value is not a valid HTTP-date, has more than one member, or the method is not GET/HEAD',
  ),
  clause(
    ConditionalClauseId.IgnoreImsNoModDate, // §5.3.3
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.3')],
    'If-Modified-Since is ignored when the resource has no available modification date',
  ),
  clause(
    ConditionalClauseId.ImsOriginClock, // §5.3.4
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.3')],
    'the If-Modified-Since timestamp is interpreted against the origin server’s clock',
  ),
  clause(
    ConditionalClauseId.EvaluateImsShould, // §5.3.5
    ReqLevel.Should,
    [rfc(RFC9110, '13.1.3')],
    'a representation-selecting request carrying If-Modified-Since without If-None-Match is evaluated per §13.2 before method performance',
  ),
  clause(
    ConditionalClauseId.ImsEvaluationDefinition, // §5.3.6
    ReqLevel.Unmarked,
    [rfc(RFC9110, '13.1.3')],
    'If-Modified-Since evaluation: false when the selected representation’s last modification date is earlier than or equal to the field date, true otherwise',
  ),
  clause(
    ConditionalClauseId.IfModifiedSinceNotModified, // §5.3.7 (generate-304 limb)
    ReqLevel.Should,
    [rfc(RFC9110, '13.1.3'), rfc(RFC9110, '13.2.2')],
    'on an If-Modified-Since false evaluation, a 304 (Not Modified) carrying only cache-update-useful metadata is generated',
  ),
  clause(
    ConditionalClauseId.IfModifiedSinceShouldNotPerform, // §5.3.7 (perform limb)
    ReqLevel.ShouldNot,
    [rfc(RFC9110, '13.1.3')],
    'on an If-Modified-Since false evaluation, the request method is not performed',
  ),

  clause(
    ConditionalClauseId.IgnoreIusWhenIm, // §5.4.1
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.4')],
    'If-Unmodified-Since is ignored when the request carries If-Match',
  ),
  clause(
    ConditionalClauseId.IgnoreInvalidIus, // §5.4.2
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.4')],
    'If-Unmodified-Since is ignored when its value is not a valid HTTP-date (including a value that looks like a date list)',
  ),
  clause(
    ConditionalClauseId.IgnoreIusNoModDate, // §5.4.3
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.4')],
    'If-Unmodified-Since is ignored when the resource has no available modification date',
  ),
  clause(
    ConditionalClauseId.IusOriginClock, // §5.4.4
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.4')],
    'the If-Unmodified-Since timestamp is interpreted against the origin server’s clock',
  ),
  clause(
    ConditionalClauseId.IusEvaluatePerGate, // §5.4.5
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.4')],
    'a representation-selecting request carrying If-Unmodified-Since without If-Match is evaluated per §13.2 before method performance',
  ),
  clause(
    ConditionalClauseId.IusEvaluationDefinition, // §5.4.6
    ReqLevel.Unmarked,
    [rfc(RFC9110, '13.1.4')],
    'If-Unmodified-Since evaluation: true when the selected representation’s last modification date is earlier than or equal to the field date, false otherwise',
  ),
  clause(
    ConditionalClauseId.IfUnmodifiedSinceFalseNotPerformed, // §5.4.7
    ReqLevel.MustNot,
    [rfc(RFC9110, '13.1.4')],
    'the request method is not performed when If-Unmodified-Since evaluates false',
  ),

  clause(
    ConditionalClauseId.NotModifiedSemantics, // §6.1.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '15.4.5')],
    '304 indicates the conditional GET/HEAD request would have been 200 had the condition not evaluated false',
  ),
  clause(
    ConditionalClauseId.NotModifiedRequiredHeaders, // §6.1.2 (field set)
    ReqLevel.Must,
    [rfc(RFC9110, '15.4.5')],
    'a 304 generates the Content-Location/ETag/Vary and Cache-Control/Expires fields it would have sent on the equivalent 200',
  ),
  clause(
    ConditionalClauseId.NotModifiedDateHeader, // §6.1.2 (Date sub-limb)
    ReqLevel.Must,
    [rfc(RFC9110, '15.4.5')],
    'a 304 generates the Date field it would have sent on the equivalent 200',
  ),
  clause(
    ConditionalClauseId.NotModifiedNoExtraMetadata, // §6.1.3
    ReqLevel.ShouldNot,
    [rfc(RFC9110, '15.4.5')],
    'representation metadata beyond the §6.1.2 set is not generated on a 304, except metadata useful for identifying/updating a previously cached response',
  ),
  clause(
    ConditionalClauseId.NotModifiedNoContent, // §6.1.4
    ReqLevel.Unmarked,
    [rfc(RFC9110, '15.4.5')],
    'a 304 response terminates at the end of the header section — it cannot contain content or trailers',
  ),

  clause(
    ConditionalClauseId.PreconditionFailedSemantics, // §6.2.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '15.5.13')],
    '412 indicates one or more request-header-field preconditions evaluated false at the server',
  ),

  clause(
    ConditionalClauseId.IfMatchMay412, // §6.3.1
    ReqLevel.May,
    [rfc(RFC9110, '13.1.1'), rfc(RFC9110, '13.2.2')],
    'a server may respond 412 to signal a failed If-Match precondition',
  ),
  clause(
    ConditionalClauseId.IfUnmodifiedSinceMay412, // §6.3.2
    ReqLevel.May,
    [rfc(RFC9110, '13.1.4'), rfc(RFC9110, '13.2.2')],
    'a server may respond 412 to signal a failed If-Unmodified-Since precondition',
  ),
  clause(
    ConditionalClauseId.IfNoneMatchFailureSymmetry, // §6.3.3
    ReqLevel.Must,
    [rfc(RFC9110, '13.1.2')],
    'on an If-None-Match false evaluation, GET/HEAD responds 304 and every other method responds 412',
  ),
  clause(
    ConditionalClauseId.StateChangingAlreadyApplied, // §6.3.4
    ReqLevel.May,
    [rfc(RFC9110, '13.1.1'), rfc(RFC9110, '13.1.4')],
    'a server may respond 2xx instead of 412 when a state-changing request appears already applied to the selected representation',
  ),
];

/** The per-clause disposition table: every conditional-request clause resolves to a testing rule
 *  (C1-C14, each with a sound basis and a severity mapped from its RFC 2119 level) and/or a reasoned
 *  untestable residue. */
const DISPOSITIONS: readonly Disposition[] = [
  {
    clause: ConditionalClauseId.EntityTagGrammar,
    rules: [],
    untestable: 'A byte-grammar definition of entity-tag; not itself a checkable server behaviour.',
  },
  {
    clause: ConditionalClauseId.FieldValueGrammar,
    rules: [],
    untestable: 'A field-value grammar definition; not itself a checkable server behaviour (subsumed by the outcome rules).',
  },
  { clause: ConditionalClauseId.HttpDateFormatsAccepted, rules: [differential(Rule.HttpDateFormatsAccepted)] },
  {
    clause: ConditionalClauseId.TwoDigitYearDisambiguation,
    rules: [],
    untestable:
      'The rfc850 50-year century-disambiguation rule sits on a moving, fragile date boundary that would make a probe non-deterministic across time; not soundly fixture-testable.',
  },
  {
    clause: ConditionalClauseId.HttpDateCaseSensitiveUtc,
    rules: [],
    untestable: 'A representational fact about HTTP-date (case, timezone spelling); not itself a checkable server behaviour.',
  },
  {
    clause: ConditionalClauseId.WildcardMixingInvalid,
    rules: [],
    untestable: 'The standard itself states recipient handling of an ungenerable mixed field is unspecified — no MUST to grade.',
  },

  {
    clause: ConditionalClauseId.StrongComparisonDefinition,
    rules: [],
    untestable:
      'Unmarked comparison definition; subsumed by the MUST rules (C3/C5) that mandate which comparison function applies.',
  },
  {
    clause: ConditionalClauseId.WeakComparisonDefinition,
    rules: [],
    untestable:
      'Unmarked comparison definition; subsumed by the MUST rules (C3/C5) that mandate which comparison function applies.',
  },
  { clause: ConditionalClauseId.IfMatchStrongComparison, rules: [differential(Rule.IfMatchStrongComparison)] },
  { clause: ConditionalClauseId.IfNoneMatchWeakComparison, rules: [differential(Rule.IfNoneMatchWeakComparison)] },
  {
    clause: ConditionalClauseId.ComparisonResultTable,
    rules: [],
    untestable: 'Unmarked result table; subsumed by C1/C3/C5, which exercise the table’s outcomes directly.',
  },

  {
    clause: ConditionalClauseId.EvaluationGateGeneral,
    rules: [],
    untestable:
      'The general evaluation-gate MUST is subsumed by the C1-C10 outcome rules; not directly isolable as its own blackbox probe.',
  },
  { clause: ConditionalClauseId.ConditionalIgnoredOnErrorStatus, rules: [differential(Rule.ConditionalIgnoredOnErrorStatus)] },
  {
    clause: ConditionalClauseId.ConditionalIgnoredOnNonSelectingMethod,
    rules: [differential(Rule.ConditionalIgnoredOnNonSelectingMethod)],
  },

  {
    clause: ConditionalClauseId.PrecedenceFullOrder,
    rules: [],
    untestable:
      'The full six-step order is subsumed: steps 1-2 by C4-C6, step 3-4 (and the §4.2/§4.3 precedence) by C1-C3/C7/C9/C10.',
  },
  {
    clause: ConditionalClauseId.PrecedenceIfNoneMatchOverIfModifiedSince,
    rules: [differential(Rule.PrecedenceIfNoneMatchOverIfModifiedSince)],
  },
  {
    clause: ConditionalClauseId.PrecedenceIfMatchOverIfUnmodifiedSince,
    rules: [differential(Rule.PrecedenceIfMatchOverIfUnmodifiedSince)],
  },

  {
    clause: ConditionalClauseId.IfMatchEvaluatePerGate,
    rules: [],
    untestable: 'An "evaluate per §13.2" statement; subsumed by C4/C5/C10, which exercise the resulting outcomes.',
  },
  {
    clause: ConditionalClauseId.IfMatchEvaluationDefinition,
    rules: [],
    untestable: 'Unmarked evaluation definition; subsumed by C4/C5, which exercise the true/false outcomes it defines.',
  },
  { clause: ConditionalClauseId.IfMatchFalseNotPerformed, rules: [differential(Rule.IfMatchFalseNotPerformed)] },

  {
    clause: ConditionalClauseId.IfNoneMatchEvaluatePerGate,
    rules: [],
    untestable: 'An "evaluate per §13.2" statement; subsumed by C1-C3/C9, which exercise the resulting outcomes.',
  },
  {
    clause: ConditionalClauseId.IfNoneMatchEvaluationDefinition,
    rules: [],
    untestable: 'Unmarked evaluation definition; subsumed by C1-C3, which exercise the true/false outcomes it defines.',
  },
  {
    clause: ConditionalClauseId.IfNoneMatchFalseNotPerformed,
    rules: [],
    untestable:
      'The MUST-NOT-perform obligation is subsumed by C1/C2 — the 304 outcome those rules Pass on IS the non-performance.',
  },
  {
    clause: ConditionalClauseId.IfNoneMatchFalseResponse,
    rules: [differential(Rule.IfNoneMatchNotModified), differential(Rule.IfNoneMatchStarNotModified)],
  },
  {
    clause: ConditionalClauseId.IfNoneMatchFalseResponseOtherMethod,
    rules: [],
    untestable:
      'The non-GET/HEAD→412 limb requires sending a non-safe method as the conditional probe, which ashward never does (PLAN §0/§8).',
  },

  {
    clause: ConditionalClauseId.IgnoreImsWhenInm,
    rules: [],
    untestable: 'The ignore-when-INM-present rule is subsumed by C9, which exercises the resulting precedence outcome.',
  },
  {
    clause: ConditionalClauseId.IgnoreInvalidIms,
    rules: [],
    untestable:
      'An internal recipient-parsing decision (invalid-date / multi-member / wrong-method ignore); not blackbox-isolable from a valid-IMS 200 response.',
  },
  {
    clause: ConditionalClauseId.IgnoreImsNoModDate,
    rules: [],
    untestable:
      'Whether a resource has "no available modification date" is server-internal state ashward cannot independently confirm.',
  },
  {
    clause: ConditionalClauseId.ImsOriginClock,
    rules: [],
    untestable:
      'Which clock basis the origin used to interpret the timestamp is internal state, not observable from the response alone.',
  },
  {
    clause: ConditionalClauseId.EvaluateImsShould,
    rules: [],
    untestable: 'The general SHOULD-evaluate obligation is subsumed by C7, which exercises the resulting outcome.',
  },
  {
    clause: ConditionalClauseId.ImsEvaluationDefinition,
    rules: [],
    untestable: 'Unmarked evaluation definition; subsumed by C7, which exercises the true/false outcomes it defines.',
  },
  {
    clause: ConditionalClauseId.IfModifiedSinceNotModified,
    rules: [differential(Rule.IfModifiedSinceNotModified, Severity.Warn)],
  },
  {
    clause: ConditionalClauseId.IfModifiedSinceShouldNotPerform,
    rules: [],
    untestable: 'The SHOULD-NOT-perform limb is subsumed by C7 — the 304 outcome C7 Passes on IS the non-performance.',
  },

  {
    clause: ConditionalClauseId.IgnoreIusWhenIm,
    rules: [],
    untestable: 'The ignore-when-IM-present rule is subsumed by C10, which exercises the resulting precedence outcome.',
  },
  {
    clause: ConditionalClauseId.IgnoreInvalidIus,
    rules: [],
    untestable:
      'An internal recipient-parsing decision (invalid-date, including a date-list-shaped value); not blackbox-isolable from a valid-IUS response.',
  },
  {
    clause: ConditionalClauseId.IgnoreIusNoModDate,
    rules: [],
    untestable:
      'Whether a resource has "no available modification date" is server-internal state ashward cannot independently confirm.',
  },
  {
    clause: ConditionalClauseId.IusOriginClock,
    rules: [],
    untestable:
      'Which clock basis the origin used to interpret the timestamp is internal state, not observable from the response alone.',
  },
  {
    clause: ConditionalClauseId.IusEvaluatePerGate,
    rules: [],
    untestable: 'An "evaluate per §13.2" statement; subsumed by C6/C10, which exercise the resulting outcomes.',
  },
  {
    clause: ConditionalClauseId.IusEvaluationDefinition,
    rules: [],
    untestable: 'Unmarked evaluation definition; subsumed by C6, which exercises the true/false outcomes it defines.',
  },
  {
    clause: ConditionalClauseId.IfUnmodifiedSinceFalseNotPerformed,
    rules: [differential(Rule.IfUnmodifiedSinceFalseNotPerformed)],
  },

  {
    clause: ConditionalClauseId.NotModifiedSemantics,
    rules: [],
    untestable:
      'Unmarked semantics statement about what 304 indicates; not itself a checkable behaviour (subsumed by C1-C3/C7/C11/C12).',
  },
  { clause: ConditionalClauseId.NotModifiedRequiredHeaders, rules: [differential(Rule.NotModifiedRequiredHeaders)] },
  {
    clause: ConditionalClauseId.NotModifiedDateHeader,
    rules: [],
    untestable:
      'Whether the origin has a live clock at 304-generation time is unobservable (§6.6.1) — a 200 carrying Date does not prove a 304 generated moments later would too; kept out of C11’s MUST rule.',
  },
  {
    clause: ConditionalClauseId.NotModifiedNoExtraMetadata,
    rules: [],
    untestable: 'The "except cache-update-useful metadata" exception makes "extra" ill-defined for a sound blackbox grading.',
  },
  { clause: ConditionalClauseId.NotModifiedNoContent, rules: [differential(Rule.NotModifiedNoContent, Severity.Warn)] },

  {
    clause: ConditionalClauseId.PreconditionFailedSemantics,
    rules: [],
    untestable:
      'Unmarked semantics statement about what 412 indicates; not itself a checkable behaviour (subsumed by C1/C2/C4-C6/C9/C10).',
  },

  {
    clause: ConditionalClauseId.IfMatchMay412,
    rules: [],
    untestable: 'A MAY (permission) can never be a sound blackbox failure; the underlying MUST-NOT-perform is tested by C4.',
  },
  {
    clause: ConditionalClauseId.IfUnmodifiedSinceMay412,
    rules: [],
    untestable: 'A MAY (permission) can never be a sound blackbox failure; the underlying MUST-NOT-perform is tested by C6.',
  },
  {
    clause: ConditionalClauseId.IfNoneMatchFailureSymmetry,
    rules: [],
    untestable:
      'The GET/HEAD→304 limb IS C1/C2; the other-method→412 limb requires an unsafe-method probe ashward never sends (PLAN §0/§8).',
  },
  {
    clause: ConditionalClauseId.StateChangingAlreadyApplied,
    rules: [],
    untestable: 'A state-changing-request exception; requires an unsafe-method probe ashward never sends (PLAN §0/§8).',
  },
];

/** This module's own hardcoded snapshot of its clause ids — deleting a member from the enum fails
 *  the catalog test loudly instead of vanishing from both the index and its own check at once. */
const SNAPSHOT: readonly string[] = [
  'entity-tag-grammar',
  'field-value-grammar',
  'http-date-formats-accepted',
  'two-digit-year-disambiguation',
  'http-date-case-sensitive-utc',
  'wildcard-mixing-invalid',
  'strong-comparison-definition',
  'weak-comparison-definition',
  'if-match-strong-comparison',
  'if-none-match-weak-comparison',
  'comparison-result-table',
  'evaluation-gate-general',
  'conditional-ignored-on-error-status',
  'conditional-ignored-on-non-selecting-method',
  'precedence-full-order',
  'precedence-if-none-match-over-if-modified-since',
  'precedence-if-match-over-if-unmodified-since',
  'if-match-evaluate-per-gate',
  'if-match-evaluation-definition',
  'if-match-false-not-performed',
  'if-none-match-evaluate-per-gate',
  'if-none-match-evaluation-definition',
  'if-none-match-false-not-performed',
  'if-none-match-false-response',
  'if-none-match-false-response-other-method',
  'ignore-ims-when-inm',
  'ignore-invalid-ims',
  'ignore-ims-no-mod-date',
  'ims-origin-clock',
  'evaluate-ims-should',
  'ims-evaluation-definition',
  'if-modified-since-not-modified',
  'if-modified-since-should-not-perform',
  'ignore-ius-when-im',
  'ignore-invalid-ius',
  'ignore-ius-no-mod-date',
  'ius-origin-clock',
  'ius-evaluate-per-gate',
  'ius-evaluation-definition',
  'if-unmodified-since-false-not-performed',
  'not-modified-semantics',
  'not-modified-required-headers',
  'not-modified-date-header',
  'not-modified-no-extra-metadata',
  'not-modified-no-content',
  'precondition-failed-semantics',
  'if-match-may-412',
  'if-unmodified-since-may-412',
  'if-none-match-failure-symmetry',
  'state-changing-already-applied',
];

const conditionalRequestCatalog: Catalog = {
  name: 'Conditional Request (RFC 9110 §13)',
  clauses: CLAUSES,
  dispositions: DISPOSITIONS,
  heuristics: [],
  snapshot: SNAPSHOT,
};

export { ConditionalClauseId, conditionalRequestCatalog };
