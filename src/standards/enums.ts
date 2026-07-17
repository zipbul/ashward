export enum StandardsBody {
  IETF = 'IETF',
  WHATWG = 'WHATWG',
  W3C = 'W3C',
  WICG = 'WICG',
  MITRE = 'MITRE',
  OWASP = 'OWASP',
}

/**
 * RFC 2119 / 8174 requirement levels — a closed, universal set. `Unmarked` is not a BCP-14 keyword: it
 * marks a clause the source states as a fact/definition with no requirement keyword (a standard's "무표기").
 * An Unmarked clause never maps to `Severity.Fail` — at most a `Warn` self-consistency/format check.
 */
export enum ReqLevel {
  Must = 'MUST',
  MustNot = 'MUST NOT',
  Should = 'SHOULD',
  ShouldNot = 'SHOULD NOT',
  May = 'MAY',
  Unmarked = 'UNMARKED',
}

/** How a clause is located within its document — bodies cite differently. */
export enum LocatorKind {
  Section = 'section',
  Anchor = 'anchor',
  Clause = 'clause',
}

/** Whether a living document is a ratified standard or a non-standard draft (e.g. WICG PNA). */
export enum DocumentStatus {
  Living = 'living',
  Draft = 'draft',
}
