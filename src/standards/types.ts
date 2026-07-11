import type { LivingDocument, RfcDocument } from './interfaces';

/** Open taxonomy id: shape-checked (`CWE-444` ok, `CWE_444`/`cwe444` not) without enumerating. */
export type CweId = `CWE-${number}`;

/** Union of document shapes, discriminated by `body`. Numbered RFCs and unversioned living
 *  standards cite differently, so they are different shapes rather than one lossy record. */
export type StandardDocument = RfcDocument | LivingDocument;
