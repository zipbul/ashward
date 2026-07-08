# ashward

Bun-native HTTP conformance test library — verifies your server rejects framing / request-smuggling attacks, from inside your test runner.

## What it is

ashward sends deliberately malformed HTTP requests over a raw socket to a running server and checks that the server **rejects** them, the way the standards require. The rules are built in — you don't write assertions, you point it at a URL and it judges conformance.

It runs inside your existing test runner (`bun test`, and any runner that surfaces a thrown error). No CLI, no separate report, no external service.

## Usage

```ts
import { test } from 'bun:test';
import { ashward, assertConformance } from 'ashward';

test('my server resists request smuggling', async () => {
  const report = await ashward('http://localhost:3000');
  assertConformance(report); // throws with per-clause detail on any failure
});
```

Prefer to inspect instead of throw:

```ts
const report = await ashward('http://localhost:3000');
if (!report.ok()) {
  for (const clause of report.results) {
    console.log(clause.ruleId, clause.verdict);
  }
}
```

The target is a URL, so the server under test can be written in any language.

## What it checks (today)

HTTP/1.1 framing — the parser-discrepancy class behind request smuggling:

| Rule id                                 | Requirement                                                            |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `http.framing.duplicate-content-length` | RFC 9112 §6.3 — reject two divergent `Content-Length` headers          |
| `http.framing.cl-te-conflict`           | RFC 9112 §6.1 — reject `Content-Length` + `Transfer-Encoding` together |

Each rule cites its normative source (RFC clause) and taxonomy (CWE-444).

## How it judges

A rule sends one crafted request and classifies the wire response:

- **pass** — the server refused it (4xx/5xx, or closed the connection)
- **fail** — the server processed it as valid (2xx/3xx) — the smuggling-relevant discrepancy
- **inconclusive** — couldn't tell (timeout, etc.), with a typed reason

`report.ok(policy)` is a view over the results, not a stored flag — you decide what fails your build (`failOn`, how to treat inconclusive).

## What it does not do

No CLI. No source scanning. No exploitation — detection and verdict only. It tests a single origin over one hop; two-hop proxy⇄backend desync detection is out of scope.

## Status

Early. HTTP/1.1 framing rules land first; more standards (framing, semantics, security headers) follow.

## License

MIT
