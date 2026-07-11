import type { StandardsBody, ReqLevel, LocatorKind, DocumentStatus } from './enums';
import type { CweId, StandardDocument } from './types';

/** An IETF RFC. Immutable once published; a revision is a new number, not an edit — so
 *  the current defining document is data, tracked with an obsoletes chain, not a folder. */
export interface RfcDocument {
  readonly body: StandardsBody.IETF;
  readonly number: number;
  readonly code: `RFC ${number}`;
  readonly title: string;
  readonly url: string;
  readonly obsoletes?: readonly string[];
}

/** A living standard (WHATWG, W3C's evergreen specs, and WICG draft reports). Unversioned by
 *  design: there is no number to cite and no obsoletes chain — the document at the URL is always
 *  the current one, so clauses are located by anchor rather than by section number. `status`
 *  records whether it is a ratified living standard or a non-standard draft (e.g. WICG PNA), so a
 *  rule's draft-ness is carried by the document it cites rather than by a per-rule flag. */
export interface LivingDocument {
  readonly body: StandardsBody.WHATWG | StandardsBody.W3C | StandardsBody.WICG;
  readonly code: string;
  readonly title: string;
  readonly url: string;
  readonly status: DocumentStatus;
}

export interface StandardLocator {
  readonly kind: LocatorKind;
  readonly value: string;
}

/** A pointer into a standards document: a (document, locator) pair with NO requirement level. This
 *  is what a `normative/` atom exports to name the exact production/algorithm it renders as code —
 *  the RFC 2119 level belongs to the clause that imposes it, not to a grammar primitive. */
export interface Citation {
  readonly doc: StandardDocument;
  readonly locator: StandardLocator;
}

/** One normative citation on a clause/rule: a Citation stamped with the requirement level the
 *  clause imposes. A rule carries an array — sources are inherently a set. */
export interface NormativeRef extends Citation {
  readonly req: ReqLevel;
}

/** Classification tags (many per rule) — distinct from the normative definition above. */
export interface Taxonomy {
  readonly cwe?: readonly CweId[];
}
