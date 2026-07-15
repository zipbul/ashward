import type { Catalog, Clause, Disposition, Heuristic } from '../catalog-types';

import { Rule } from '../../core/contract/enums';
import { Severity } from '../disposition-enums';
import { RFC3986 } from '../documents';
import { ReqLevel } from '../enums';
import { clause, conditional, rfc, urlSection } from './build';

/**
 * A neutral, editorial identity for one query-parser requirement — the join key between this
 * catalog's clauses, its dispositions, and the rules that test them. Local to this module (mirrors
 * `CompressionClauseId`). The `§N` in each comment is the zipbul/query-parser STANDARDS digest's own
 * numbering (snapshot 2026-07-10) — a human breadcrumb only, never the key. §2.3 and §2.4 each carry
 * multiple normative levels/limbs (see §0.1 of PLAN-COMPRESSION-QUERYPARSER.md) and are modeled as
 * multiple clause ids here, one per level/limb.
 */
enum UrlencodedClauseId {
  // §1 — URI generic query syntax (RFC 3986)
  QueryComponentGrammar = 'query-component-grammar', // §1.1 Unmarked
  ReservedCharactersWithinQuery = 'reserved-characters-within-query', // §1.2 Unmarked
  PercentEncodingGrammar = 'percent-encoding-grammar', // §1.3 Unmarked
  PercentEncodingNormalizationOptional = 'percent-encoding-normalization-optional', // §1.4 Unmarked
  ProducerShouldPercentEncodeReserved = 'producer-should-percent-encode-reserved', // §1.5 Should
  NulByteHandling = 'nul-byte-handling', // §1.6 Must — heuristic-only (Q3 relatesTo)
  QueryComponentOptionality = 'query-component-optionality', // §1.7 Unmarked

  // §2 — application/x-www-form-urlencoded parsing (WHATWG URL)
  AmpersandOnlySeparator = 'ampersand-only-separator', // §2.1 Must — Q5
  EmptySequenceSkipped = 'empty-sequence-skipped', // §2.2 Must — Q11
  FirstEqualsSplits = 'first-equals-splits', // §2.3 Must — Q6
  EmptyNameEchoLossy = 'empty-name-echo-lossy', // §2.3 Unmarked (echo-lossy sub-limb)
  FormPlusIsSpace = 'form-plus-is-space', // §2.4 Must (form) — Q7
  UriGenericPlusIsLiteral = 'uri-generic-plus-is-literal', // §2.4 Unmarked (uri-generic) — Q8
  Utf8ReplacementOnDecode = 'utf8-replacement-on-decode', // §2.5 Must — Q9 (Q2 relatesTo)
  MalformedPercentPreserved = 'malformed-percent-preserved', // §2.6 Must — Q10 (Q1 relatesTo)
  WebCompatibleInterpretationNote = 'web-compatible-interpretation-note', // §2.7 Unmarked
}

/** The query-parser clause index — hand-verified against zipbul/query-parser STANDARDS.md §1–§2
 *  (snapshot 2026-07-10). */
const CLAUSES: readonly Clause[] = [
  clause(
    UrlencodedClauseId.QueryComponentGrammar, // §1.1
    ReqLevel.Unmarked,
    [rfc(RFC3986, '3.4')],
    'the query component is `*( pchar / "/" / "?" )`, delimited from the fragment by "#"',
  ),
  clause(
    UrlencodedClauseId.ReservedCharactersWithinQuery, // §1.2
    ReqLevel.Unmarked,
    [rfc(RFC3986, '2.2')],
    'reserved characters (gen-delims/sub-delims) may appear in the query as data or as delimiters, ambiguously',
  ),
  clause(
    UrlencodedClauseId.PercentEncodingGrammar, // §1.3
    ReqLevel.Unmarked,
    [rfc(RFC3986, '2.1')],
    'percent-encoding grammar: "%" HEXDIG HEXDIG',
  ),
  clause(
    UrlencodedClauseId.PercentEncodingNormalizationOptional, // §1.4
    ReqLevel.Unmarked,
    [rfc(RFC3986, '6.2.2.1')],
    'decoding percent-encoded octets of unreserved characters for comparison is optional normalization, not a parsing requirement',
  ),
  clause(
    UrlencodedClauseId.ProducerShouldPercentEncodeReserved, // §1.5
    ReqLevel.Should,
    [rfc(RFC3986, '2.2')],
    'a URI producer ought to percent-encode data octets that correspond to reserved characters used as data',
  ),
  clause(
    UrlencodedClauseId.NulByteHandling, // §1.6
    ReqLevel.Must,
    [rfc(RFC3986, '2.1')],
    'a NUL byte (raw or percent-encoded) in the query is either rejected or parsed without corrupting server state',
  ),
  clause(
    UrlencodedClauseId.QueryComponentOptionality, // §1.7
    ReqLevel.Unmarked,
    [rfc(RFC3986, '3.4')],
    'the query component is OPTIONAL and its absence is distinct from an empty query ("?" with zero octets following)',
  ),

  clause(
    UrlencodedClauseId.AmpersandOnlySeparator, // §2.1
    ReqLevel.Must,
    [urlSection('5.1')],
    'application/x-www-form-urlencoded splits the query on the literal "&" (0x26) byte only — no other byte is a sequence separator',
  ),
  clause(
    UrlencodedClauseId.EmptySequenceSkipped, // §2.2
    ReqLevel.Must,
    [urlSection('5.1')],
    'an empty byte sequence between/around separators (leading, trailing, or doubled "&") is skipped, contributing no pair',
  ),
  clause(
    UrlencodedClauseId.FirstEqualsSplits, // §2.3
    ReqLevel.Must,
    [urlSection('5.1')],
    'a non-empty sequence splits into name/value on the FIRST literal "=" (0x3D) byte only; a sequence with no "=" is a name with an empty-string value',
  ),
  clause(
    UrlencodedClauseId.EmptyNameEchoLossy, // §2.3
    ReqLevel.Unmarked,
    [urlSection('5.1')],
    'a sequence beginning with "=" yields an empty-string name — a distinct pair from an absent one, though an echo contract may not round-trip it losslessly',
  ),
  clause(
    UrlencodedClauseId.FormPlusIsSpace, // §2.4
    ReqLevel.Must,
    [urlSection('5.1')],
    'in application/x-www-form-urlencoded, "+" (0x2B) decodes to a space (0x20), applied before percent-decoding',
  ),
  clause(
    UrlencodedClauseId.UriGenericPlusIsLiteral, // §2.4
    ReqLevel.Unmarked,
    [rfc(RFC3986, '3.4'), rfc(RFC3986, '1.1')],
    'in the RFC 3986 generic query component (outside the form media type), "+" is an ordinary data octet, never substituted for space',
  ),
  clause(
    UrlencodedClauseId.Utf8ReplacementOnDecode, // §2.5
    ReqLevel.Must,
    [urlSection('5.1')],
    'the percent-decoded byte sequence is UTF-8 decoded with the replacement character (U+FFFD) substituted for invalid byte sequences, never a throw',
  ),
  clause(
    UrlencodedClauseId.MalformedPercentPreserved, // §2.6
    ReqLevel.Must,
    [urlSection('5.1')],
    'a "%" not followed by two hex digits is preserved literally in the decoded output; the malformed escape is never consumed past the "%" itself',
  ),
  clause(
    UrlencodedClauseId.WebCompatibleInterpretationNote, // §2.7
    ReqLevel.Unmarked,
    [urlSection('5.1'), rfc(RFC3986, '3.4')],
    'the web-compatible application/x-www-form-urlencoded algorithm is a stricter, real-world profile of the RFC 3986 generic query grammar, not a competing definition of it',
  ),
];

/** The per-clause disposition table: every query-parser clause resolves to testing rules and/or a
 *  reasoned untestable residue. */
const DISPOSITIONS: readonly Disposition[] = [
  {
    clause: UrlencodedClauseId.QueryComponentGrammar,
    rules: [],
    untestable: 'A byte-grammar definition of the query component; not itself a checkable server behaviour.',
  },
  {
    clause: UrlencodedClauseId.ReservedCharactersWithinQuery,
    rules: [],
    untestable:
      'An inherent ambiguity the grammar itself documents (delimiter vs. data); not a soundly gradeable blackbox failure.',
  },
  {
    clause: UrlencodedClauseId.PercentEncodingGrammar,
    rules: [],
    untestable:
      'A request-side grammar the target parses; not itself a response artifact ashward observes directly (subsumed by the oracle rules).',
  },
  {
    clause: UrlencodedClauseId.PercentEncodingNormalizationOptional,
    rules: [],
    untestable: 'A comparison-normalization permission (MAY-shaped, no BCP14 keyword); omitting it is always conformant.',
  },
  {
    clause: UrlencodedClauseId.ProducerShouldPercentEncodeReserved,
    rules: [],
    untestable:
      'A producer-side (client-authoring) SHOULD over how a URI is constructed; not observable from the server responses ashward probes.',
  },
  {
    clause: UrlencodedClauseId.NulByteHandling,
    rules: [],
    untestable:
      'The reject limb depends on the raw-data context the NUL byte lands in (server-internal, unknowable blackbox); the no-crash limb is only heuristically observable via Q3 (nul-byte-no-hard-fail), which relates to but does not disposition this clause.',
  },
  {
    clause: UrlencodedClauseId.QueryComponentOptionality,
    rules: [],
    untestable: 'A structural/definitional fact about the query component being optional; not itself a checkable behaviour.',
  },

  { clause: UrlencodedClauseId.AmpersandOnlySeparator, rules: [conditional(Rule.UrlencodedAmpersandOnlySeparator)] },
  { clause: UrlencodedClauseId.EmptySequenceSkipped, rules: [conditional(Rule.UrlencodedEmptySequenceSkipped)] },
  { clause: UrlencodedClauseId.FirstEqualsSplits, rules: [conditional(Rule.UrlencodedFirstEqualsSplits)] },
  {
    clause: UrlencodedClauseId.EmptyNameEchoLossy,
    rules: [],
    untestable:
      'Echo-lossy: a conforming echo contract may legitimately drop an empty-string key when re-serializing to JSON, so a mismatch here is not a sound parser failure.',
  },
  { clause: UrlencodedClauseId.FormPlusIsSpace, rules: [conditional(Rule.UrlencodedPlusIsSpace)] },
  { clause: UrlencodedClauseId.UriGenericPlusIsLiteral, rules: [conditional(Rule.UriGenericPlusIsLiteral, Severity.Warn)] },
  { clause: UrlencodedClauseId.Utf8ReplacementOnDecode, rules: [conditional(Rule.UrlencodedUtf8Replacement)] },
  { clause: UrlencodedClauseId.MalformedPercentPreserved, rules: [conditional(Rule.UrlencodedMalformedPercentPreserved)] },
  {
    clause: UrlencodedClauseId.WebCompatibleInterpretationNote,
    rules: [],
    untestable:
      'A relational/definitional note between the two grammars; not itself a checkable behaviour (the difference it describes is exercised by Q7/Q8).',
  },
];

/**
 * Robustness heuristics (PLAN §4a): a 5xx on a hostile query vector doesn't prove the *parser*
 * threw (a route-level 500 could come from anywhere downstream), so these are CWE-tagged Warn
 * heuristics, never a MUST-Fail — each `relatesTo` a concrete clause as context only.
 */
const HEURISTICS: readonly Heuristic[] = [
  {
    ruleId: Rule.MalformedPercentNoHardFail,
    cwe: ['CWE-20'],
    relatesTo: UrlencodedClauseId.MalformedPercentPreserved,
    rationale:
      'A malformed percent-escape (`%zz`, `%4`, `%ZZ%41`) causing a 5xx suggests unvalidated input reaching an unguarded decoder.',
  },
  {
    ruleId: Rule.InvalidUtf8NoHardFail,
    cwe: ['CWE-20'],
    relatesTo: UrlencodedClauseId.Utf8ReplacementOnDecode,
    rationale:
      'An invalid UTF-8 byte sequence (`%FF`) causing a 5xx suggests the decoder does not fail closed to U+FFFD as the parsing algorithm requires.',
  },
  {
    ruleId: Rule.NulByteNoHardFail,
    cwe: ['CWE-20'],
    relatesTo: UrlencodedClauseId.NulByteHandling,
    rationale:
      'A NUL byte (`%00`) causing a 5xx suggests unvalidated input reaching a C-string-bounded or similarly NUL-sensitive code path.',
  },
  {
    ruleId: Rule.PrototypePollutionNoCrash,
    cwe: ['CWE-1321'],
    relatesTo: UrlencodedClauseId.FirstEqualsSplits,
    rationale:
      'A prototype-pollution-shaped key (`__proto__[x]=1`, `constructor[prototype][x]=1`, `k[toString]=1`) causing a 5xx suggests an unguarded object-merge parser extension.',
  },
];

/** This module's own hardcoded snapshot of its clause ids — deleting a member from the enum fails
 *  the catalog test loudly instead of vanishing from both the index and its own check at once. */
const SNAPSHOT: readonly string[] = [
  'query-component-grammar',
  'reserved-characters-within-query',
  'percent-encoding-grammar',
  'percent-encoding-normalization-optional',
  'producer-should-percent-encode-reserved',
  'nul-byte-handling',
  'query-component-optionality',
  'ampersand-only-separator',
  'empty-sequence-skipped',
  'first-equals-splits',
  'empty-name-echo-lossy',
  'form-plus-is-space',
  'uri-generic-plus-is-literal',
  'utf8-replacement-on-decode',
  'malformed-percent-preserved',
  'web-compatible-interpretation-note',
];

const urlencodedCatalog: Catalog = {
  name: 'Query-parser (RFC 3986, WHATWG URL application/x-www-form-urlencoded)',
  clauses: CLAUSES,
  dispositions: DISPOSITIONS,
  heuristics: HEURISTICS,
  snapshot: SNAPSHOT,
};

export { UrlencodedClauseId, urlencodedCatalog };
