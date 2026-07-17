import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineReflectRule } from './kit/reflect-rule';

/**
 * Q12 — §2.3 MUST (form, empty-name sub-limb): a sequence beginning with "=" splits on that first
 * "=" into an empty-string name and the remaining value — the same MUST step as first-equals-splits,
 * just with the split landing at index 0. `=v` MUST echo as `[["", "v"]]`: an ordered pair-list
 * echo represents the empty-string key losslessly (unlike an object-keyed echo, which cannot
 * distinguish an empty key from an absent one).
 */
export const urlencodedEmptyNamePreserved = defineReflectRule({
  id: Rule.UrlencodedEmptyNamePreserved,
  mode: 'form',
  rawQuery: '=v',
  expectedPairs: [['', 'v']],
  normative: refsFor(UrlencodedClauseId.EmptyNamePreserved),
});
