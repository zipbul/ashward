import { Rule } from '../core/contract/enums';
import { UrlencodedClauseId } from '../standards/catalog/urlencoded';
import { refsFor } from './kit/clause-refs';
import { defineReflectRule } from './kit/reflect-rule';

/**
 * Q8 — §2.4 Unmarked→Warn (uri-generic; RFC 3986 §1.1/§3.4). Outside the form media type, "+" is
 * an ordinary data octet in the generic URI query — never substituted for a space. `a=1+2` decodes
 * to the literal value `1+2`.
 */
export const uriGenericPlusIsLiteral = defineReflectRule({
  id: Rule.UriGenericPlusIsLiteral,
  mode: 'uri-generic',
  rawQuery: 'a=1+2',
  expectedPairs: [['a', '1+2']],
  normative: refsFor(UrlencodedClauseId.UriGenericPlusIsLiteral),
});
