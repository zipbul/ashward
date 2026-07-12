import type { Rule } from '../../core/contract/enums';
import type { Clause, RuleMapping } from '../catalog-types';
import type { StandardDocument } from '../types';

import { Severity, TestabilityBasis } from '../disposition-enums';
import { WHATWG_FETCH, WHATWG_URL, WICG_PNA } from '../documents';
import { LocatorKind, ReqLevel } from '../enums';

/** A citation shorthand, pre-`req`: {@link clause} stamps each with the clause's requirement level
 *  (a clause has one level; its co-citations all inherit it). */
interface Cite {
  readonly doc: StandardDocument;
  readonly kind: LocatorKind;
  readonly value: string;
}

export const fetchAnchor = (value: string): Cite => ({ doc: WHATWG_FETCH, kind: LocatorKind.Anchor, value });
export const rfc = (doc: StandardDocument, value: string): Cite => ({ doc, kind: LocatorKind.Section, value });
export const urlSection = (value: string): Cite => ({ doc: WHATWG_URL, kind: LocatorKind.Section, value });
export const pnaSection = (value: string): Cite => ({ doc: WICG_PNA, kind: LocatorKind.Section, value });

/** Assemble a clause: stamp every co-citation with the clause's requirement level. */
export const clause = (id: string, reqLevel: ReqLevel, cites: readonly Cite[], summary: string): Clause => ({
  id,
  reqLevel,
  normative: cites.map(c => ({ doc: c.doc, locator: { kind: c.kind, value: c.value }, req: reqLevel })),
  summary,
});

export const direct = (ruleId: Rule, severity = Severity.Fail): RuleMapping => ({
  ruleId,
  basis: TestabilityBasis.DirectObservation,
  severity,
});
export const differential = (ruleId: Rule, severity = Severity.Fail): RuleMapping => ({
  ruleId,
  basis: TestabilityBasis.DifferentialIntentRevelation,
  severity,
});
export const conditional = (ruleId: Rule, severity = Severity.Fail, severityNote?: string): RuleMapping => ({
  ruleId,
  basis: TestabilityBasis.ConditionalFormat,
  severity,
  ...(severityNote !== undefined ? { severityNote } : {}),
});
