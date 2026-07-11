import { test, expect } from 'bun:test';

import { hasEmptyListElement, splitFieldList } from './field-list';

test('splitFieldList trims each element', () => {
  expect(splitFieldList('GET, POST ,PUT')).toEqual(['GET', 'POST', 'PUT']);
});

test('splitFieldList drops empty elements from stray commas', () => {
  expect(splitFieldList('GET,, POST')).toEqual(['GET', 'POST']);
});

test('splitFieldList yields nothing for an empty value', () => {
  expect(splitFieldList('')).toEqual([]);
});

test.each([
  ['GET, POST', false],
  ['GET,, POST', true],
  [',GET', true],
  ['GET,', true],
  ['GET', false],
  ['', true],
])('hasEmptyListElement(%p) is %p', (value, expected) => {
  expect(hasEmptyListElement(value)).toBe(expected);
});
