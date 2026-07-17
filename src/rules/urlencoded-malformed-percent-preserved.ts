import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineReflectRule } from './kit/reflect-rule';

/**
 * Q10 — §2.6 MUST (form): a "%" not followed by two hex digits is preserved literally; the
 * malformed escape is never consumed past the "%" itself. `a=%ZZ%41` decodes `%ZZ` as three
 * literal characters (not hex digits) immediately followed by the well-formed `%41` ("A"),
 * yielding `%ZZA`.
 */
export const urlencodedMalformedPercentPreserved = defineReflectRule({
  id: Rule.UrlencodedMalformedPercentPreserved,
  mode: 'form',
  rawQuery: 'a=%ZZ%41',
  expectedPairs: [['a', '%ZZA']],
  normative: refsFor(UrlencodedClauseId.MalformedPercentPreserved),
});
