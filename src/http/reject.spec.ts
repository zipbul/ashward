import { test, expect } from 'bun:test';

import type { StatusLine } from './decode/interfaces';

import { TerminationCause } from '../transport/tcp/enums';
import { FramingOutcome } from './enums';
import { classifyFramingOutcome } from './reject';

const status = (statusCode: number): StatusLine => ({
  httpVersion: 'HTTP/1.1',
  statusCode,
  reasonPhrase: '',
});

test('classifies a 2xx response as accepted', () => {
  expect(classifyFramingOutcome({ statusLine: status(200), termination: TerminationCause.Fin })).toBe(FramingOutcome.Accepted);
});

test('classifies status 399 (adjacent to the 400 boundary) as accepted', () => {
  expect(classifyFramingOutcome({ statusLine: status(399), termination: TerminationCause.Fin })).toBe(FramingOutcome.Accepted);
});

test('classifies status 400 (the rejection boundary) as rejected', () => {
  expect(classifyFramingOutcome({ statusLine: status(400), termination: TerminationCause.Fin })).toBe(FramingOutcome.Rejected);
});

test('classifies status 599 (upper server-error boundary) as rejected', () => {
  expect(classifyFramingOutcome({ statusLine: status(599), termination: TerminationCause.Fin })).toBe(FramingOutcome.Rejected);
});

test('classifies a 1xx interim status as inconclusive', () => {
  expect(classifyFramingOutcome({ statusLine: status(100), termination: TerminationCause.Fin })).toBe(
    FramingOutcome.Inconclusive,
  );
});

test('classifies an out-of-range status (600) as inconclusive', () => {
  expect(classifyFramingOutcome({ statusLine: status(600), termination: TerminationCause.Fin })).toBe(
    FramingOutcome.Inconclusive,
  );
});

test('classifies a clean close with no response as rejected', () => {
  expect(classifyFramingOutcome({ statusLine: null, termination: TerminationCause.Fin })).toBe(FramingOutcome.Rejected);
});

test('classifies an aborted connection with no response as rejected', () => {
  expect(classifyFramingOutcome({ statusLine: null, termination: TerminationCause.Rst })).toBe(FramingOutcome.Rejected);
});

test('classifies a timeout with no response as inconclusive', () => {
  expect(classifyFramingOutcome({ statusLine: null, termination: TerminationCause.Timeout })).toBe(FramingOutcome.Inconclusive);
});

test('classifies a refused connection with no response as inconclusive (an unreachable peer tells us nothing)', () => {
  expect(classifyFramingOutcome({ statusLine: null, termination: TerminationCause.Unreachable })).toBe(
    FramingOutcome.Inconclusive,
  );
});

test('lets an observed 2xx win over a later timeout', () => {
  expect(classifyFramingOutcome({ statusLine: status(200), termination: TerminationCause.Timeout })).toBe(
    FramingOutcome.Accepted,
  );
});

test('classifies a 3xx redirect as accepted (the frame was processed)', () => {
  expect(classifyFramingOutcome({ statusLine: status(301), termination: TerminationCause.Fin })).toBe(FramingOutcome.Accepted);
});

test('classifies a mid-range 5xx as rejected', () => {
  expect(classifyFramingOutcome({ statusLine: status(500), termination: TerminationCause.Fin })).toBe(FramingOutcome.Rejected);
});

test('classifies status 199 (adjacent below the 200 boundary) as inconclusive', () => {
  expect(classifyFramingOutcome({ statusLine: status(199), termination: TerminationCause.Fin })).toBe(
    FramingOutcome.Inconclusive,
  );
});
