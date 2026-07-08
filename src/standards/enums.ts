export enum StandardsBody {
  IETF = 'IETF',
  WHATWG = 'WHATWG',
  W3C = 'W3C',
  MITRE = 'MITRE',
  OWASP = 'OWASP',
}

/** RFC 2119 / 8174 requirement levels — a closed, universal set. */
export enum ReqLevel {
  Must = 'MUST',
  MustNot = 'MUST NOT',
  Should = 'SHOULD',
  ShouldNot = 'SHOULD NOT',
  May = 'MAY',
}

/** How a clause is located within its document — bodies cite differently. */
export enum LocatorKind {
  Section = 'section',
  Anchor = 'anchor',
  Clause = 'clause',
}
