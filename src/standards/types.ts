import type { RfcDocument } from './interfaces';

/** Open taxonomy id: shape-checked (`CWE-444` ok, `CWE_444`/`cwe444` not) without enumerating. */
export type CweId = `CWE-${number}`;

/** Union of document shapes. Today only RFC; WHATWG/W3C added as those rules land. */
export type StandardDocument = RfcDocument;
