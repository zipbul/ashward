import { test, expect } from 'bun:test';

import type { RuleDef } from '../core/contract/interfaces';
import type { HttpRuleContext } from '../http/context';

import { Rule, Verdict } from '../core/contract/enums';
import { craftRequest } from '../http/encode/request';
import { authorityFor } from '../rules/kit/craft-probe';
import { urlencodedAmpersandOnlySeparator } from '../rules/urlencoded-ampersand-only-separator';
import { startRawOrigin } from '../testkit/origin/raw-origin';
import { ashward } from './ashward';

test('reports not-ok against an origin that accepts duplicate Content-Length', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  try {
    const report = await ashward(`http://127.0.0.1:${origin.port}`);
    expect(report.ok()).toBe(false);
  } finally {
    await origin.close();
  }
});

test('reports ok against an origin that rejects duplicate Content-Length', async () => {
  const origin = await startRawOrigin('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  try {
    const report = await ashward(`http://127.0.0.1:${origin.port}`);
    expect(report.ok()).toBe(true);
  } finally {
    await origin.close();
  }
});

test('surfaces the duplicate-content-length verdict in the results', async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
  try {
    const report = await ashward(`http://127.0.0.1:${origin.port}`);
    const clause = report.results.find(r => r.ruleId === Rule.DuplicateContentLength);
    expect(clause?.verdict).toBe(Verdict.Fail);
  } finally {
    await origin.close();
  }
});

/** A non-reflect rule that just probes `context.target.path` and reports the request line it sent
 *  as evidence, so a test can prove which path a rule actually hit. */
const echoPathRule: RuleDef<HttpRuleContext> = {
  id: Rule.DuplicateContentLength,
  normative: [],
  async run(context) {
    const request = craftRequest({ method: 'GET', target: context.target.path, host: authorityFor(context.target), headers: [] });
    const result = await context.probe(request);
    return {
      ruleId: Rule.DuplicateContentLength,
      verdict: Verdict.Pass,
      evidence: { request, response: result.response, outcome: result.termination },
    };
  },
};

test("a non-reflect rule keeps probing the URL's own resolved path even when reflect.path retargets the reflect probes elsewhere", async () => {
  const origin = await startRawOrigin('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 0\r\n\r\n');
  try {
    const report = await ashward(`http://127.0.0.1:${origin.port}/api`, [echoPathRule, urlencodedAmpersandOnlySeparator], {
      reflect: { path: '/reflect-only', mode: 'form' },
    });

    const nonReflect = report.results.find(r => r.ruleId === Rule.DuplicateContentLength);
    const nonReflectLine = new TextDecoder().decode(nonReflect?.evidence?.request).split('\r\n')[0];
    expect(nonReflectLine).toBe('GET /api HTTP/1.1');

    const reflect = report.results.find(r => r.ruleId === Rule.UrlencodedAmpersandOnlySeparator);
    const reflectLine = new TextDecoder().decode(reflect?.evidence?.request).split('\r\n')[0];
    expect(reflectLine).toBe('GET /reflect-only?a=1;b=2 HTTP/1.1');
  } finally {
    await origin.close();
  }
});
