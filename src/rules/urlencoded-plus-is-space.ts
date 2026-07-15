import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineReflectRule } from './kit/reflect-rule';

/**
 * Q7 — §2.4 MUST (form): in application/x-www-form-urlencoded, "+" decodes to a space. `a=1+2`
 * decodes to the value `1 2`.
 */
export const urlencodedPlusIsSpace = defineReflectRule({
  id: Rule.UrlencodedPlusIsSpace,
  mode: 'form',
  rawQuery: 'a=1+2',
  expectedPairs: [['a', '1 2']],
  normative: refsFor(UrlencodedClauseId.FormPlusIsSpace),
});
