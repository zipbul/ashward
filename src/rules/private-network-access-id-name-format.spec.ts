import { test, expect } from 'bun:test';

import type { HttpTarget } from '../http/context';

import { SkipReason, Verdict } from '../core/contract/enums';
import { replay } from '../testkit/replay';
import { privateNetworkAccessIdNameFormat } from './private-network-access-id-name-format';

const TARGET: HttpTarget = { host: 'origin.test', port: 80, path: '/', timeoutMs: 500 };
const head = (fields: string): string => `HTTP/1.1 200 OK\r\n${fields}\r\n\r\n`;
const run = async (fields: string) => privateNetworkAccessIdNameFormat.run({ probe: replay(head(fields)), target: TARGET });

const VALID = 'Private-Network-Access-ID: 01:23:45:67:89:0A\r\nPrivate-Network-Access-Name: router.local';

test('passes a well-formed ID and Name pair', async () => {
  expect((await run(VALID)).verdict).toBe(Verdict.Pass);
});

test('fails a malformed ID (not six colon-separated hex bytes)', async () => {
  expect((await run('Private-Network-Access-ID: 0123\r\nPrivate-Network-Access-Name: router.local')).verdict).toBe(Verdict.Fail);
});

test('fails a Name outside /^[a-z0-9_.-]+$/', async () => {
  expect((await run('Private-Network-Access-ID: 01:23:45:67:89:0A\r\nPrivate-Network-Access-Name: Router Local')).verdict).toBe(
    Verdict.Fail,
  );
});

test('skips when only one of the pair is present', async () => {
  const out = await run('Private-Network-Access-ID: 01:23:45:67:89:0A');
  expect(out.verdict).toBe(Verdict.Skip);
  expect(out.reason).toBe(SkipReason.HeaderAbsent);
});

test('skips when the ID is present but blank (ephemeral grant, no format check)', async () => {
  const out = await run('Private-Network-Access-ID:\r\nPrivate-Network-Access-Name: router.local');
  expect(out.verdict).toBe(Verdict.Skip);
});
