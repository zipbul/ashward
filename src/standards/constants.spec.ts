import { test, expect } from 'bun:test';
import { RFC9112, RFC9110 } from './constants';
import { StandardsBody } from './enums';

test('RFC 9112 code matches its number', () => {
  expect(RFC9112.code).toBe('RFC 9112');
  expect(RFC9112.number).toBe(9112);
});

test('RFC 9112 records the document it obsoletes', () => {
  expect(RFC9112.obsoletes).toContain('RFC 7230');
});

test('every registered document is attributed to a body', () => {
  for (const doc of [RFC9112, RFC9110]) {
    expect(doc.body).toBe(StandardsBody.IETF);
  }
});
