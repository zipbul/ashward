import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineReflectRule } from './kit/reflect-rule';

/**
 * Q9 — §2.5 MUST (form): the percent-decoded byte sequence is UTF-8 decoded with U+FFFD
 * substituted for invalid byte sequences, never a throw. `a=%FF` decodes to a single invalid byte,
 * which becomes the replacement character.
 */
export const urlencodedUtf8Replacement = defineReflectRule({
  id: Rule.UrlencodedUtf8Replacement,
  mode: 'form',
  rawQuery: 'a=%FF',
  expectedPairs: [['a', '�']],
  normative: refsFor(UrlencodedClauseId.Utf8ReplacementOnDecode),
});
