import { test, expect } from 'bun:test';

import { RFC9110, RFC9111, RFC9112, WHATWG_FETCH, WHATWG_URL, WICG_PNA } from './documents';
import { DocumentStatus, StandardsBody } from './enums';

test('RFC 9112 code matches its number', () => {
  expect(RFC9112.code).toBe('RFC 9112');
  expect(RFC9112.number).toBe(9112);
});

test('RFC 9112 records the document it obsoletes', () => {
  expect(RFC9112.obsoletes).toContain('RFC 7230');
});

test('every registered RFC is attributed to the IETF', () => {
  for (const doc of [RFC9112, RFC9110, RFC9111]) {
    expect(doc.body).toBe(StandardsBody.IETF);
  }
});

test('WHATWG living documents have no number and carry living status', () => {
  for (const doc of [WHATWG_FETCH, WHATWG_URL]) {
    expect(doc.body).toBe(StandardsBody.WHATWG);
    expect('number' in doc).toBe(false);
    expect(doc.status).toBe(DocumentStatus.Living);
  }
});

test('WICG PNA is a WICG draft — its draft status lives on the document', () => {
  expect(WICG_PNA.body).toBe(StandardsBody.WICG);
  expect(WICG_PNA.status).toBe(DocumentStatus.Draft);
});
