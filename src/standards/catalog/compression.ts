import type { Catalog, Clause, Disposition } from '../catalog-types';

import { Rule } from '../../core/contract/enums';
import { Severity } from '../disposition-enums';
import { RFC1950, RFC1952, RFC8878, RFC9110, RFC9111, RFC9530, RFC9659 } from '../documents';
import { ReqLevel } from '../enums';
import { clause, conditional, differential, direct, rfc } from './build';

/**
 * A neutral, editorial identity for one compression requirement — the join key between this
 * catalog's clauses, its dispositions, and the rules that test them. Local to this module (adding
 * another standard never touches it). The `§N` in each comment is the zipbul/compression STANDARDS
 * digest's own numbering (snapshot 2026-07-10) — a human breadcrumb only, never the key. A digest
 * section carrying MULTIPLE normative levels is modeled as multiple clause ids here, one per level
 * (see §0.1 of PLAN-COMPRESSION-QUERYPARSER.md) — §2.1, §3.1, §4.2 and §5.4 each split this way.
 */
enum CompressionClauseId {
  // §1 — negotiation (Accept-Encoding interpretation)
  NegotiationNeedsFixture = 'negotiation-needs-fixture', // §1.1 SHOULD (+ Unmarked facts)
  QvalueGrammar = 'qvalue-grammar', // §1.2 Unmarked
  XGzipXCompressAlias = 'x-gzip-x-compress-alias', // §1.3 SHOULD
  CodingNameCaseInsensitive = 'coding-name-case-insensitive', // §1.4 Unmarked
  AcceptEncodingEmptyListTolerance = 'accept-encoding-empty-list-tolerance', // §1.5 MUST

  // §2 — encoding application (Content-Encoding generation)
  AppliedOrderUnobservable = 'applied-order-unobservable', // §2.1 MUST
  IdentityTokenExcluded = 'identity-token-excluded', // §2.1 SHOULD NOT — R1
  IanaRegisteredNamePreference = 'iana-registered-name-preference', // §2.1 Unmarked
  CodedFormMetadataDefinitional = 'coded-form-metadata-definitional', // §2.1 Unmarked
  ContentLengthRegeneration = 'content-length-regeneration', // §2.2 SHOULD (+ Unmarked invalidation fact)
  IntegrityFieldInvalidation = 'integrity-field-invalidation', // §2.2 Unmarked

  // §3 — exclusions (responses that must not be coded)
  NoContentOnBodilessResponse = 'no-content-on-bodiless-response', // §3.1 Unmarked — R2
  HeadFieldOmissionPermitted = 'head-field-omission-permitted', // §3.1 MAY
  HeadResponseLimb = 'head-response-limb', // §3.1 Unmarked
  ByteRangeCodingConflict = 'byte-range-coding-conflict', // §3.2 MUST (+ Unmarked def)
  NoTransformHonored = 'no-transform-honored', // §3.3 Unmarked

  // §4 — cache/validator interaction
  VaryAcceptEncodingOnNegotiated = 'vary-accept-encoding-on-negotiated', // §4.1 SHOULD — R3
  CompressedEtagWeakMarking = 'compressed-etag-weak-marking', // §4.2 MUST — R4
  ValidatorSharingDefinition = 'validator-sharing-definition', // §4.2 Unmarked

  // §5 — coding formats (byte specs)
  GzipFormatValid = 'gzip-format-valid', // §5.1 Unmarked — R5
  DeflateZlibWrapped = 'deflate-zlib-wrapped', // §5.2 Unmarked — R6
  BrotliFormat = 'brotli-format', // §5.3 Unmarked
  ZstdWindowCap = 'zstd-window-cap', // §5.4 MUST NOT — R7
  ZstdReservedBitsZero = 'zstd-reserved-bits-zero', // §5.4 Unmarked — R8

  // §6 — format extension fields (padding)
  PaddingFormatExtensions = 'padding-format-extensions', // §6 Unmarked
}

/** The compression clause index — hand-verified against zipbul/compression STANDARDS.md §1–§6
 *  (snapshot 2026-07-10). */
const CLAUSES: readonly Clause[] = [
  clause(
    CompressionClauseId.NegotiationNeedsFixture, // §1.1
    ReqLevel.Should,
    [rfc(RFC9110, '12.5.3'), rfc(RFC9110, '12.4.3'), rfc(RFC9110, '15.5.7')],
    'Accept-Encoding acceptability/preference algorithm; absent content-coding response when nothing acceptable',
  ),
  clause(
    CompressionClauseId.QvalueGrammar, // §1.2
    ReqLevel.Unmarked,
    [rfc(RFC9110, '12.4.2')],
    'qvalue grammar (0..1, 3 fractional digits), case-insensitive q parameter name, default weight 1',
  ),
  clause(
    CompressionClauseId.XGzipXCompressAlias, // §1.3
    ReqLevel.Should,
    [rfc(RFC9110, '8.4.1.3'), rfc(RFC9110, '8.4.1.1')],
    'treat x-gzip as gzip and x-compress as compress (request-side negotiation)',
  ),
  clause(
    CompressionClauseId.CodingNameCaseInsensitive, // §1.4
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.4.1')],
    'content-coding names are case-insensitive',
  ),
  clause(
    CompressionClauseId.AcceptEncodingEmptyListTolerance, // §1.5
    ReqLevel.Must,
    [rfc(RFC9110, '5.6.1')],
    'parse and ignore a reasonable number of empty Accept-Encoding list elements',
  ),

  clause(
    CompressionClauseId.AppliedOrderUnobservable, // §2.1
    ReqLevel.Must,
    [rfc(RFC9110, '8.4')],
    'Content-Encoding lists codings in the order applied',
  ),
  clause(
    CompressionClauseId.IdentityTokenExcluded, // §2.1
    ReqLevel.ShouldNot,
    [rfc(RFC9110, '8.4')],
    'identity is not included in a generated Content-Encoding (reserved for Accept-Encoding)',
  ),
  clause(
    CompressionClauseId.IanaRegisteredNamePreference, // §2.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.4.1'), rfc(RFC9110, '16.6.1')],
    'generated content-coding names ought to be IANA-registered (non-BCP14 "ought to")',
  ),
  clause(
    CompressionClauseId.CodedFormMetadataDefinitional, // §2.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.4')],
    'Content-Encoding is a representation characteristic; post-application metadata is coded-form',
  ),
  clause(
    CompressionClauseId.ContentLengthRegeneration, // §2.2
    ReqLevel.Should,
    [rfc(RFC9110, '8.6')],
    'generate Content-Length for the encoded content when its size is known before the header section is sent',
  ),
  clause(
    CompressionClauseId.IntegrityFieldInvalidation, // §2.2
    ReqLevel.Unmarked,
    [rfc(RFC9530, '1.2'), rfc(RFC9530, '2'), rfc(RFC9530, '3')],
    'pre-encoding-computed integrity fields (Content-Digest/Repr-Digest) are invalidated by encoding',
  ),

  clause(
    CompressionClauseId.NoContentOnBodilessResponse, // §3.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '6.4.1'), rfc(RFC9110, '15.3.6')],
    '1xx/204/304 carry no content and 205 forbids content generation, so there is no content to code',
  ),
  clause(
    CompressionClauseId.HeadFieldOmissionPermitted, // §3.1
    ReqLevel.May,
    [rfc(RFC9110, '9.3.2')],
    'HEAD may omit fields whose value is determined only at content-generation time (e.g. Content-Encoding)',
  ),
  clause(
    CompressionClauseId.HeadResponseLimb, // §3.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '9.3.2')],
    'HEAD sends no content, so there is no content to code on a HEAD response',
  ),
  clause(
    CompressionClauseId.ByteRangeCodingConflict, // §3.2
    ReqLevel.Must,
    [rfc(RFC9110, '14.1.2'), rfc(RFC9110, '15.3.7.1')],
    'byte ranges are computed over the encoded byte sequence; do not code content after Content-Range is fixed',
  ),
  clause(
    CompressionClauseId.NoTransformHonored, // §3.3
    ReqLevel.Unmarked,
    [rfc(RFC9111, '5.2.2.6'), rfc(RFC9110, '7.7')],
    'content carrying a no-transform cache-control directive is not transformed (derived from the intermediary MUST NOT)',
  ),

  clause(
    CompressionClauseId.VaryAcceptEncodingOnNegotiated, // §4.1
    ReqLevel.Should,
    [rfc(RFC9110, '12.5.5'), rfc(RFC9111, '4.1')],
    'generate Vary: Accept-Encoding on a cacheable response selected by Accept-Encoding, including the identity choice',
  ),
  clause(
    CompressionClauseId.CompressedEtagWeakMarking, // §4.2
    ReqLevel.Must,
    [rfc(RFC9110, '8.8.3'), rfc(RFC9110, '8.8.1')],
    'an entity-tag failing strong-validator characteristics (e.g. shared with the uncoded representation) is marked weak (W/)',
  ),
  clause(
    CompressionClauseId.ValidatorSharingDefinition, // §4.2
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.8.1'), rfc(RFC9110, '8.8.3.3')],
    'a validator shared between a coded and an uncoded representation is weak by definition; strong tags should differ (example-section Note)',
  ),

  clause(
    CompressionClauseId.GzipFormatValid, // §5.1
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.4.1.3'), rfc(RFC1952, '2.3.1'), rfc(RFC1952, '2.3.1.2')],
    'gzip is the RFC 1952 file format: fixed 10-byte member header sanity (ID1/ID2/CM=8 deflate, reserved FLG bits zero)',
  ),
  clause(
    CompressionClauseId.DeflateZlibWrapped, // §5.2
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.4.1.2'), rfc(RFC1950, '2.2'), rfc(RFC1950, '2.3')],
    'HTTP deflate is RFC 1951 deflate inside the RFC 1950 zlib wrapper, never raw deflate: header sanity (CM=8, CINFO<=7, FDICT unset, correct check bits)',
  ),
  clause(
    CompressionClauseId.BrotliFormat, // §5.3
    ReqLevel.Unmarked,
    [rfc(RFC9110, '8.4.1')],
    'br is the Brotli Compressed Data Format; reserved meta-block/tail bits are zero',
  ),
  clause(
    CompressionClauseId.ZstdWindowCap, // §5.4
    ReqLevel.MustNot,
    [rfc(RFC9659, '3')],
    'a zstd frame must not require a Window_Size exceeding 8 MiB over HTTP',
  ),
  clause(
    CompressionClauseId.ZstdReservedBitsZero, // §5.4
    ReqLevel.Unmarked,
    [rfc(RFC8878, '3.1.1.1.1.3'), rfc(RFC8878, '3.1.1.1.1.4')],
    'a zstd Frame_Header_Descriptor sets its Unused and Reserved bits to zero',
  ),

  clause(
    CompressionClauseId.PaddingFormatExtensions, // §6
    ReqLevel.Unmarked,
    [rfc(RFC1952, '2.3.1.1'), rfc(RFC8878, '3.1.2')],
    'gzip extra-field subfields and zstd skippable frames — format-extension padding mechanisms',
  ),
];

/** The per-clause disposition table: every compression clause resolves to testing rules (each with
 *  a sound basis and a severity mapped from its RFC 2119 level) and/or a reasoned untestable
 *  residue. */
const DISPOSITIONS: readonly Disposition[] = [
  {
    clause: CompressionClauseId.NegotiationNeedsFixture,
    rules: [],
    untestable:
      'Judging Accept-Encoding negotiation needs a compressible representation fixture ashward does not control (non-goal until a compressible-fixture mode).',
  },
  {
    clause: CompressionClauseId.QvalueGrammar,
    rules: [],
    untestable: 'qvalue grammar is a request-field-value grammar the target parses; not a response artifact ashward observes.',
  },
  {
    clause: CompressionClauseId.XGzipXCompressAlias,
    rules: [],
    untestable:
      'A request-side SHOULD over how the target interprets an incoming Accept-Encoding alias; not response-observable without a negotiation fixture.',
  },
  {
    clause: CompressionClauseId.CodingNameCaseInsensitive,
    rules: [],
    untestable: 'Definitional: how the target compares coding names internally is not blackbox-observable.',
  },
  {
    clause: CompressionClauseId.AcceptEncodingEmptyListTolerance,
    rules: [],
    untestable:
      'A request-field-value parsing tolerance in the target; no response artifact reveals whether empty elements were tolerated vs. simply absent.',
  },

  {
    clause: CompressionClauseId.AppliedOrderUnobservable,
    rules: [],
    untestable:
      "Whether the listed Content-Encoding order matches the order actually applied requires knowing the target's internal pipeline — unobservable blackbox.",
  },
  { clause: CompressionClauseId.IdentityTokenExcluded, rules: [conditional(Rule.ContentEncodingNoIdentityToken, Severity.Warn)] },
  {
    clause: CompressionClauseId.IanaRegisteredNamePreference,
    rules: [],
    untestable:
      'A non-BCP14 "ought to" over producer-side naming choice; a non-registered but otherwise well-formed coding name is not a soundly gradeable failure.',
  },
  {
    clause: CompressionClauseId.CodedFormMetadataDefinitional,
    rules: [],
    untestable: 'Definitional statement about which metadata basis applies after coding; not itself a checkable behaviour.',
  },
  {
    clause: CompressionClauseId.ContentLengthRegeneration,
    rules: [],
    untestable:
      'Whether Content-Length reflects the encoded (not pre-encoding) size requires knowing the pre-encoding length, which ashward cannot observe.',
  },
  {
    clause: CompressionClauseId.IntegrityFieldInvalidation,
    rules: [],
    untestable:
      'Content-Digest is recomputable from the received bytes (candidate for a deferred digest-integrity rule, not shipped here); Repr-Digest needs representation-level decode ashward does not perform.',
  },

  {
    clause: CompressionClauseId.NoContentOnBodilessResponse,
    rules: [direct(Rule.NoContentEncodingOnBodilessResponse, Severity.Warn)],
  },
  {
    clause: CompressionClauseId.HeadFieldOmissionPermitted,
    rules: [],
    untestable: 'A MAY (permission to omit) can never be a sound blackbox failure — omission is always conformant.',
  },
  {
    clause: CompressionClauseId.HeadResponseLimb,
    rules: [],
    untestable:
      'ashward only sends safe GET/HEAD/OPTIONS probes that read state; the HEAD-specific no-content limb is not exercised by the GET-shaped probes this domain uses.',
  },
  {
    clause: CompressionClauseId.ByteRangeCodingConflict,
    rules: [],
    untestable:
      'Whether Content-Range was computed pre- or post-coding is server-internal state; a 206 with both Content-Range and Content-Encoding is not distinguishable from a conformant range-of-a-coded-representation response (weak/noisy signal).',
  },
  {
    clause: CompressionClauseId.NoTransformHonored,
    rules: [],
    untestable:
      'A derived (originally intermediary-facing) obligation over internal transform decisions; ashward cannot observe whether a no-transform response was left untransformed versus never coded in the first place.',
  },

  {
    clause: CompressionClauseId.VaryAcceptEncodingOnNegotiated,
    rules: [differential(Rule.VaryAcceptEncodingOnNegotiated, Severity.Warn)],
  },
  { clause: CompressionClauseId.CompressedEtagWeakMarking, rules: [differential(Rule.CompressedEtagWeakOrDistinct)] },
  {
    clause: CompressionClauseId.ValidatorSharingDefinition,
    rules: [],
    untestable:
      'Unmarked definition/example-section Note (no BCP14 keyword); subsumed by the MUST weak-marking rule (R4) which carries the only soundly gradeable residue of §4.2.',
  },

  { clause: CompressionClauseId.GzipFormatValid, rules: [conditional(Rule.GzipFormatValid, Severity.Warn)] },
  { clause: CompressionClauseId.DeflateZlibWrapped, rules: [conditional(Rule.DeflateZlibWrapped, Severity.Warn)] },
  {
    clause: CompressionClauseId.BrotliFormat,
    rules: [],
    untestable:
      'No brotli bitstream validator is implemented (non-goal, §8) — shipping a format-validity rule without a real parser would be an unsound blackbox judgment.',
  },
  { clause: CompressionClauseId.ZstdWindowCap, rules: [conditional(Rule.ZstdWindowWithinHttpCap)] },
  { clause: CompressionClauseId.ZstdReservedBitsZero, rules: [conditional(Rule.ZstdReservedBitsZero, Severity.Warn)] },

  {
    clause: CompressionClauseId.PaddingFormatExtensions,
    rules: [],
    untestable:
      'Format-extension padding (gzip extra field, zstd skippable frames) is only exercised by injecting extension bytes into a compressed body, which ashward does not generate (non-goal, §8).',
  },
];

/** This module's own hardcoded snapshot of its clause ids — deleting a member from the enum fails
 *  the catalog test loudly instead of vanishing from both the index and its own check at once. */
const SNAPSHOT: readonly string[] = [
  'negotiation-needs-fixture',
  'qvalue-grammar',
  'x-gzip-x-compress-alias',
  'coding-name-case-insensitive',
  'accept-encoding-empty-list-tolerance',
  'applied-order-unobservable',
  'identity-token-excluded',
  'iana-registered-name-preference',
  'coded-form-metadata-definitional',
  'content-length-regeneration',
  'integrity-field-invalidation',
  'no-content-on-bodiless-response',
  'head-field-omission-permitted',
  'head-response-limb',
  'byte-range-coding-conflict',
  'no-transform-honored',
  'vary-accept-encoding-on-negotiated',
  'compressed-etag-weak-marking',
  'validator-sharing-definition',
  'gzip-format-valid',
  'deflate-zlib-wrapped',
  'brotli-format',
  'zstd-window-cap',
  'zstd-reserved-bits-zero',
  'padding-format-extensions',
];

const compressionCatalog: Catalog = {
  name: 'Compression (RFC 9110/9111/9530, RFC 1950/1952, RFC 8878/9659)',
  clauses: CLAUSES,
  dispositions: DISPOSITIONS,
  heuristics: [],
  snapshot: SNAPSHOT,
};

export { CompressionClauseId, compressionCatalog };
