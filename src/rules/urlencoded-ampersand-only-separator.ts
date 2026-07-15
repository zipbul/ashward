import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineReflectRule } from './kit/reflect-rule';

/**
 * Q5 — §2.1 MUST (form): application/x-www-form-urlencoded splits the query on the literal "&"
 * byte only. A semicolon inside a sequence is DATA, not a separator: `a=1;b=2` is one pair whose
 * value is the literal string `1;b=2`, never split into `a=1` and `b=2`.
 */
export const urlencodedAmpersandOnlySeparator = defineReflectRule({
  id: Rule.UrlencodedAmpersandOnlySeparator,
  mode: 'form',
  rawQuery: 'a=1;b=2',
  expectedPairs: [['a', '1;b=2']],
  normative: refsFor(UrlencodedClauseId.AmpersandOnlySeparator),
});
