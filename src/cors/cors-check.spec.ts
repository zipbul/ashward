import { test, expect } from 'bun:test';

import type { CorsCheckInput } from './interfaces';

import { corsCheck, isOkStatus } from './cors-check';
import { CorsCheckOutcome, CredentialsMode } from './enums';

const ORIGIN = 'https://app.example';

const input = (over: Partial<CorsCheckInput>): CorsCheckInput => ({
  allowOrigin: ORIGIN,
  allowCredentials: null,
  requestOrigin: ORIGIN,
  credentialsMode: CredentialsMode.Omit,
  ...over,
});

test('fails when Access-Control-Allow-Origin is absent', () => {
  expect(corsCheck(input({ allowOrigin: null }))).toBe(CorsCheckOutcome.Failure);
});

test('succeeds on wildcard when credentials are omitted', () => {
  expect(corsCheck(input({ allowOrigin: '*' }))).toBe(CorsCheckOutcome.Success);
});

test('fails on wildcard when credentials are included', () => {
  const result = corsCheck(input({ allowOrigin: '*', credentialsMode: CredentialsMode.Include }));
  expect(result).toBe(CorsCheckOutcome.Failure);
});

test('succeeds when allow-origin byte-matches the request origin without credentials', () => {
  expect(corsCheck(input({ allowOrigin: ORIGIN }))).toBe(CorsCheckOutcome.Success);
});

test('fails when allow-origin differs from the request origin by a single byte', () => {
  expect(corsCheck(input({ allowOrigin: 'https://app.example/' }))).toBe(CorsCheckOutcome.Failure);
});

test('succeeds on an exact origin match with credentials when allow-credentials is true', () => {
  const result = corsCheck(input({ allowOrigin: ORIGIN, allowCredentials: 'true', credentialsMode: CredentialsMode.Include }));
  expect(result).toBe(CorsCheckOutcome.Success);
});

test('fails on an exact origin match with credentials when allow-credentials is not true', () => {
  const result = corsCheck(input({ allowOrigin: ORIGIN, allowCredentials: 'True', credentialsMode: CredentialsMode.Include }));
  expect(result).toBe(CorsCheckOutcome.Failure);
});

test('same-origin credentials mode does not activate the credentialed path', () => {
  const result = corsCheck(input({ allowOrigin: '*', credentialsMode: CredentialsMode.SameOrigin }));
  expect(result).toBe(CorsCheckOutcome.Success);
});

test.each([
  [199, false],
  [200, true],
  [299, true],
  [300, false],
])('isOkStatus(%i) is %p', (code, expected) => {
  expect(isOkStatus(code)).toBe(expected);
});
