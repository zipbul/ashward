import type { Catalog, Clause, Disposition } from '../catalog-types';

import { Rule } from '../../core/contract/enums';
import { RFC9110, RFC9112 } from '../documents';
import { ReqLevel } from '../enums';
import { clause, direct, rfc } from './build';

/** Neutral clause identity for the RFC 9112 HTTP/1.1 framing requirements ashward tests. Local to
 *  this module — the framing domain is a first-class catalog, not a side-exception in a CORS table. */
enum Rfc9112ClauseId {
  DuplicateContentLengthRejected = 'duplicate-content-length-rejected', // §6.3
  ClTeConflictRejected = 'cl-te-conflict-rejected', // §6.1
}

const CLAUSES: readonly Clause[] = [
  clause(
    Rfc9112ClauseId.DuplicateContentLengthRejected, // §6.3
    ReqLevel.Must,
    [rfc(RFC9112, '6.3'), rfc(RFC9110, '5.3')],
    'two divergent Content-Length values are unrecoverably ambiguous and must be rejected',
  ),
  clause(
    Rfc9112ClauseId.ClTeConflictRejected, // §6.1
    ReqLevel.Must,
    [rfc(RFC9112, '6.1')],
    'Content-Length + Transfer-Encoding is ambiguous framing and must be treated as an error',
  ),
];

const DISPOSITIONS: readonly Disposition[] = [
  { clause: Rfc9112ClauseId.DuplicateContentLengthRejected, rules: [direct(Rule.DuplicateContentLength)] },
  { clause: Rfc9112ClauseId.ClTeConflictRejected, rules: [direct(Rule.ClTeConflict)] },
];

const SNAPSHOT: readonly string[] = ['duplicate-content-length-rejected', 'cl-te-conflict-rejected'];

const rfc9112Catalog: Catalog = {
  name: 'RFC 9112 (HTTP/1.1 framing)',
  clauses: CLAUSES,
  dispositions: DISPOSITIONS,
  heuristics: [],
  snapshot: SNAPSHOT,
};

export { Rfc9112ClauseId, rfc9112Catalog };
