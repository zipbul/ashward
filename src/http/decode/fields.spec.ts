import { test, expect } from 'bun:test';

import type { ResponseHead } from './interfaces';

import { fieldValues, singleFieldValue } from './fields';

const head = (fields: readonly { name: string; value: string }[]): ResponseHead => ({
  statusLine: { httpVersion: 'HTTP/1.1', statusCode: 200, reasonPhrase: 'OK' },
  fields,
});

test('fieldValues matches the name case-insensitively', () => {
  const h = head([{ name: 'vary', value: 'Origin' }]);
  expect(fieldValues(h, 'Vary')).toEqual(['Origin']);
});

test('fieldValues returns every repeated line in wire order', () => {
  const h = head([
    { name: 'Vary', value: 'Origin' },
    { name: 'Vary', value: 'Accept' },
  ]);
  expect(fieldValues(h, 'Vary')).toEqual(['Origin', 'Accept']);
});

test('fieldValues is empty when the field is absent', () => {
  expect(fieldValues(head([]), 'Vary')).toEqual([]);
});

test('singleFieldValue returns the lone value', () => {
  expect(singleFieldValue(head([{ name: 'X-A', value: '1' }]), 'X-A')).toBe('1');
});

test('singleFieldValue is null when the field is absent', () => {
  expect(singleFieldValue(head([]), 'X-A')).toBeNull();
});

test('singleFieldValue is null when the field is repeated', () => {
  const h = head([
    { name: 'X-A', value: '1' },
    { name: 'X-A', value: '2' },
  ]);
  expect(singleFieldValue(h, 'X-A')).toBeNull();
});
