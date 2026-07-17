import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineReflectRule } from './kit/reflect-rule';

/**
 * Q11 — §2.2 MUST (form): an empty byte sequence between/around separators is skipped, contributing
 * no pair. `a=1&&b=2` — the doubled "&" produces an empty sequence between the two real pairs — MUST
 * yield exactly two pairs, never a spurious empty-string pair for the skipped sequence.
 */
export const urlencodedEmptySequenceSkipped = defineReflectRule({
  id: Rule.UrlencodedEmptySequenceSkipped,
  mode: 'form',
  rawQuery: 'a=1&&b=2',
  expectedPairs: [
    ['a', '1'],
    ['b', '2'],
  ],
  normative: refsFor(UrlencodedClauseId.EmptySequenceSkipped),
});
