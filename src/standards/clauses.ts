import type { NormativeRef } from './interfaces';
import type { StandardDocument } from './types';

import { RFC9110, RFC9111, WHATWG_FETCH, WHATWG_URL, WICG_PNA } from './constants';
import { LocatorKind, ReqLevel } from './enums';

/** The closed set of CORS STANDARDS.md clauses — enumerated so every cross-reference (a
 *  disposition pointing at a clause) is a typed key, not a stringly-typed lookup that a typo
 *  could silently break. Snapshot 2026-07-10, §1–§8. */
enum Section {
  S1_1 = '§1.1',
  S1_2 = '§1.2',
  S1_3 = '§1.3',
  S1_4 = '§1.4',
  S1_5 = '§1.5',
  S1_6 = '§1.6',
  S2_1 = '§2.1',
  S2_2 = '§2.2',
  S2_3 = '§2.3',
  S2_4 = '§2.4',
  S3_1 = '§3.1',
  S3_2 = '§3.2',
  S3_3 = '§3.3',
  S3_4 = '§3.4',
  S3_5 = '§3.5',
  S3_6 = '§3.6',
  S3_7 = '§3.7',
  S3_8 = '§3.8',
  S4_1 = '§4.1',
  S4_2 = '§4.2',
  S5_1 = '§5.1',
  S6_1 = '§6.1',
  S6_2 = '§6.2',
  S7_1 = '§7.1',
  S7_2 = '§7.2',
  S8_1 = '§8.1',
  S8_2 = '§8.2',
}

/** One normative clause of the CORS STANDARDS.md, as a citable unit. `normative` carries EVERY
 *  document + locator the clause cites (STANDARDS.md co-cites Fetch with RFC 9110/9111, URL, and
 *  PNA); the test logic is implemented from those real algorithms, not from the summary prose
 *  (PLAN §0.1). A single anchor cannot hold RFC 9111's delta-seconds definition, so this must be a
 *  list, not a string. */
interface Clause {
  readonly section: Section;
  readonly reqLevel: ReqLevel;
  readonly normative: readonly NormativeRef[];
  readonly summary: string;
}

/** A citation shorthand, pre-`req`: the clause builder stamps each with the clause's requirement
 *  level (a clause has one level; its co-citations all inherit it). */
interface Cite {
  readonly doc: StandardDocument;
  readonly kind: LocatorKind;
  readonly value: string;
}

const fetchAnchor = (value: string): Cite => ({ doc: WHATWG_FETCH, kind: LocatorKind.Anchor, value });
const rfc = (doc: StandardDocument, value: string): Cite => ({ doc, kind: LocatorKind.Section, value });
const urlSection = (value: string): Cite => ({ doc: WHATWG_URL, kind: LocatorKind.Section, value });
const pnaSection = (value: string): Cite => ({ doc: WICG_PNA, kind: LocatorKind.Section, value });

const clause = (section: Section, reqLevel: ReqLevel, cites: readonly Cite[], summary: string): Clause => ({
  section,
  reqLevel,
  normative: cites.map(c => ({ doc: c.doc, locator: { kind: c.kind, value: c.value }, req: reqLevel })),
  summary,
});

/** The CORS clause index — hand-verified against zipbul/cors STANDARDS.md §1–§8. HTTP/1.1 framing
 *  (RFC 9112) is a separate domain and is not indexed here. */
const CLAUSES: readonly Clause[] = [
  clause(
    Section.S1_1,
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), fetchAnchor('origin-header')],
    'ACAO grammar: origin-or-null / "*"; no list, no subdomain pattern; null lowercase-only',
  ),
  clause(
    Section.S1_2,
    ReqLevel.Must,
    [fetchAnchor('origin-header'), urlSection('4.4')],
    'serialized origin: no trailing slash/path; default port elided',
  ),
  clause(
    Section.S1_3,
    ReqLevel.Must,
    [fetchAnchor('origin-header')],
    'lowercase scheme/host, no percent-encoding, IPv6 normalized, port 1*5DIGIT',
  ),
  clause(Section.S1_4, ReqLevel.Must, [fetchAnchor('http-new-header-syntax')], 'ACAC is byte-exact "true"'),
  clause(
    Section.S1_5,
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), rfc(RFC9110, '5.6.1.1'), rfc(RFC9110, '5.6.2')],
    'ACAM/ACAH/ACEH are token lists; no empty list elements',
  ),
  clause(
    Section.S1_6,
    ReqLevel.Must,
    [fetchAnchor('http-new-header-syntax'), rfc(RFC9111, '1.2.2')],
    'ACMA is delta-seconds (1*DIGIT)',
  ),

  clause(Section.S2_1, ReqLevel.Must, [fetchAnchor('cors-check')], 'shared response must send ACAO; absence is always failure'),
  clause(
    Section.S2_2,
    ReqLevel.Must,
    [fetchAnchor('cors-check'), fetchAnchor('serializing-a-request-origin'), fetchAnchor('cors-protocol-and-credentials')],
    'ACAO byte-matches request origin; * only when not include; no cookie-based selection',
  ),
  clause(Section.S2_3, ReqLevel.Must, [fetchAnchor('cors-check')], 'credentialed → ACAC: true'),
  clause(
    Section.S2_4,
    ReqLevel.Must,
    [fetchAnchor('cors-check'), fetchAnchor('terminology-headers')],
    'ACAO and ACAC each generated once',
  ),

  clause(
    Section.S3_1,
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('cors-check')],
    'preflight ok status (200–299) and satisfies §2',
  ),
  clause(Section.S3_2, ReqLevel.Must, [fetchAnchor('cors-preflight-fetch')], 'ACAM/ACAH extractable per ABNF'),
  clause(
    Section.S3_3,
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch')],
    'ACAM includes request method (safelist/*/synth exceptions)',
  ),
  clause(
    Section.S3_4,
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('concept-method-normalize')],
    'ACAM method byte-case matches request method',
  ),
  clause(
    Section.S3_5,
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch'), fetchAnchor('cors-non-wildcard-request-header-name')],
    'Authorization in request → explicit in ACAH; * never covers',
  ),
  clause(
    Section.S3_6,
    ReqLevel.Must,
    [fetchAnchor('cors-preflight-fetch')],
    'each CORS-unsafe request header in ACAH; * only non-credentialed',
  ),
  clause(
    Section.S3_7,
    ReqLevel.MustNot,
    [fetchAnchor('cors-protocol-and-credentials'), fetchAnchor('cors-preflight-fetch'), fetchAnchor('main-fetch')],
    'ACAM/ACAH/ACEH must not be * with credentials',
  ),
  clause(
    Section.S3_8,
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('cors-preflight-fetch')],
    'credentialed actual → preflight also ACAC:true + echoed origin',
  ),

  clause(
    Section.S4_1,
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('http-fetch'), fetchAnchor('cors-check')],
    'shared response satisfies §2 at any status; 304/407/SW exempt',
  ),
  clause(
    Section.S4_2,
    ReqLevel.Must,
    [fetchAnchor('http-responses'), fetchAnchor('main-fetch')],
    'ACEH on actual (not preflight) response to expose non-safelist headers',
  ),

  clause(
    Section.S5_1,
    ReqLevel.MustNot,
    [fetchAnchor('http-redirect-fetch')],
    '3xx Location must not carry userinfo credentials',
  ),

  clause(
    Section.S6_1,
    ReqLevel.Must,
    [pnaSection('3.4.2'), fetchAnchor('cors-check')],
    'ACRPN:true + allowed → ACAPN literal "true"',
  ),
  clause(
    Section.S6_2,
    ReqLevel.Must,
    [pnaSection('3.4.2')],
    'PNA ID (6 hex bytes) / Name (regex, ≤248) format when both present',
  ),

  clause(
    Section.S7_1,
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-and-http-caches'), rfc(RFC9110, '12.5.5')],
    'Vary: Origin when ACAO depends on request Origin',
  ),
  clause(
    Section.S7_2,
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-and-http-caches')],
    'static */fixed origin → always ACAO, no Vary: Origin',
  ),

  clause(
    Section.S8_1,
    ReqLevel.ShouldNot,
    [fetchAnchor('basic-safe-cors-protocol-setup')],
    'no ACAO:* on network-location-protected resources',
  ),
  clause(
    Section.S8_2,
    ReqLevel.Should,
    [fetchAnchor('cors-protocol-exceptions')],
    'expect non-preflighted requests for certain content-types',
  ),
];

export { CLAUSES, Section };
export type { Clause };
