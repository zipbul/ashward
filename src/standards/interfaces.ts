import type { StandardsBody, ReqLevel, LocatorKind } from './enums';
import type { CweId } from './types';

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

export interface StandardLocator {
  readonly kind: LocatorKind;
  readonly value: string;
}

/** One normative citation on a rule. A rule carries an array — sources are inherently a set. */
export interface NormativeRef {
  readonly doc: RfcDocument;
  readonly locator: StandardLocator;
  readonly req: ReqLevel;
}

/** Classification tags (many per rule) — distinct from the normative definition above. */
export interface Taxonomy {
  readonly cwe?: readonly CweId[];
}
