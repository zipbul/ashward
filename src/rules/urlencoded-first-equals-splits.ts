import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineReflectRule } from './kit/reflect-rule';

/**
 * Q6 — §2.3 MUST (form): a non-empty sequence splits into name/value on the FIRST literal "="
 * byte only. `a=b=c` splits at the first "=", leaving `b=c` — including the second "=" — as the
 * value.
 */
export const urlencodedFirstEqualsSplits = defineReflectRule({
  id: Rule.UrlencodedFirstEqualsSplits,
  mode: 'form',
  rawQuery: 'a=b=c',
  expectedPairs: [['a', 'b=c']],
  normative: refsFor(UrlencodedClauseId.FirstEqualsSplits),
});
