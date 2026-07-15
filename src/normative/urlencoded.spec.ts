import { test, expect } from 'bun:test';

import { parseFormUrlencoded, parseUriGenericQuery } from './urlencoded';

test('semicolon is not a separator (only literal & splits)', () => {
  expect(parseFormUrlencoded('a=1;b=2')).toEqual([['a', '1;b=2']]);
});

test('only the first = splits a sequence', () => {
  expect(parseFormUrlencoded('a=b=c')).toEqual([['a', 'b=c']]);
});

test('a sequence with no = at all gets an empty-string value', () => {
  expect(parseFormUrlencoded('a')).toEqual([['a', '']]);
});

test('form: + decodes to a space', () => {
  expect(parseFormUrlencoded('a=1+2')).toEqual([['a', '1 2']]);
});

test('form: %2B decodes to a literal plus', () => {
  expect(parseFormUrlencoded('a=%2B')).toEqual([['a', '+']]);
});

test('uri-generic: + stays a literal plus', () => {
  expect(parseUriGenericQuery('a=1+2')).toEqual([['a', '1+2']]);
});

test('a lone invalid UTF-8 byte decodes to U+FFFD', () => {
  expect(parseFormUrlencoded('a=%FF')).toEqual([['a', '�']]);
});

test('a well-formed multi-byte UTF-8 percent sequence decodes correctly', () => {
  expect(parseFormUrlencoded('a=%C3%A9')).toEqual([['a', 'é']]);
});

test('a malformed % sequence (non-hex digits) is preserved literally', () => {
  expect(parseFormUrlencoded('a=%zz')).toEqual([['a', '%zz']]);
});

test('a truncated % sequence at end of input is preserved literally', () => {
  expect(parseFormUrlencoded('a=%4')).toEqual([['a', '%4']]);
});

test('a malformed % sequence followed by a well-formed one: only the malformed one is preserved', () => {
  expect(parseFormUrlencoded('a=%ZZ%41')).toEqual([['a', '%ZZA']]);
});

test('an empty sequence between && is skipped', () => {
  expect(parseFormUrlencoded('a=1&&b=2')).toEqual([
    ['a', '1'],
    ['b', '2'],
  ]);
});

test('a leading & (empty first sequence) is skipped', () => {
  expect(parseFormUrlencoded('&a=1')).toEqual([['a', '1']]);
});

test('a trailing & (empty last sequence) is skipped', () => {
  expect(parseFormUrlencoded('a=1&')).toEqual([['a', '1']]);
});

test('a wholly empty rawQuery yields no pairs', () => {
  expect(parseFormUrlencoded('')).toEqual([]);
});

test('a rawQuery of only & yields no pairs', () => {
  expect(parseFormUrlencoded('&')).toEqual([]);
});

test('an empty-name sequence (=v) keeps the empty-string key', () => {
  expect(parseFormUrlencoded('=v')).toEqual([['', 'v']]);
});

test('an empty-value sequence (a=) keeps the empty-string value', () => {
  expect(parseFormUrlencoded('a=')).toEqual([['a', '']]);
});

test('a bare = (both empty) yields one empty/empty pair', () => {
  expect(parseFormUrlencoded('=')).toEqual([['', '']]);
});

test('duplicate keys are preserved in order, not merged', () => {
  expect(parseFormUrlencoded('a=1&a=2')).toEqual([
    ['a', '1'],
    ['a', '2'],
  ]);
});

test('order is preserved across many pairs', () => {
  expect(parseFormUrlencoded('c=3&a=1&b=2')).toEqual([
    ['c', '3'],
    ['a', '1'],
    ['b', '2'],
  ]);
});

test('never throws on a lone % at the very end of a sequence', () => {
  expect(() => parseFormUrlencoded('a=%')).not.toThrow();
  expect(parseFormUrlencoded('a=%')).toEqual([['a', '%']]);
});

test('percent-decoding a name works the same as a value', () => {
  expect(parseFormUrlencoded('%61=1')).toEqual([['a', '1']]);
});
