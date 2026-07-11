import { test, expect } from 'bun:test';

import { isDeltaSeconds, isSerializedOrigin, isToken, splitFieldList } from './grammar';

test.each([
  ['GET', true],
  ['X-Custom!', true],
  ['*', true],
  ['', false],
  ['has space', false],
  ['semi;colon', false],
  ['GET,POST', false],
])('isToken(%p) is %p', (value, expected) => {
  expect(isToken(value)).toBe(expected);
});

test.each([
  ['0', true],
  ['86400', true],
  ['', false],
  ['-1', false],
  ['5.0', false],
  ['600s', false],
  ['1 week', false],
])('isDeltaSeconds(%p) is %p', (value, expected) => {
  expect(isDeltaSeconds(value)).toBe(expected);
});

test.each([
  ['https://example.com', true],
  ['http://example.com:8080', true],
  ['http://localhost', true],
  ['https://[::1]:443', true],
  ['null', false],
  ['example.com', false],
  ['https://example.com/', false],
  ['https://example.com/path', false],
  ['https://user@example.com', false],
  ['https://example.com?q=1', false],
  ['https://a, https://b', false],
])('isSerializedOrigin(%p) is %p', (value, expected) => {
  expect(isSerializedOrigin(value)).toBe(expected);
});

test('splitFieldList trims each element', () => {
  expect(splitFieldList('GET, POST ,PUT')).toEqual(['GET', 'POST', 'PUT']);
});

test('splitFieldList drops empty elements from stray commas', () => {
  expect(splitFieldList('GET,, POST')).toEqual(['GET', 'POST']);
});

test('splitFieldList yields nothing for an empty value', () => {
  expect(splitFieldList('')).toEqual([]);
});
