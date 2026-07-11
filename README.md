# ashward

Bun-native conformance test library — verifies your running server against international standards and security requirements, from inside your test runner.

## What it is

ashward probes a running server with real bytes and judges the responses against the normative clauses of international standards and security rules (IETF RFCs today; WHATWG, W3C, and security domains next). The rules are built in — you don't write assertions, you point it at a URL and it judges conformance.

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

**HTTP/1.1 framing** — the parser-discrepancy class behind request smuggling (RFC 9112). These run by default:

| Rule id                    | Requirement                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| `duplicate-content-length` | RFC 9112 §6.3 — reject two divergent `Content-Length` headers          |
| `cl-te-conflict`           | RFC 9112 §6.1 — reject `Content-Length` + `Transfer-Encoding` together |

**CORS** (WHATWG Fetch) — **in progress.** The rule roster (the `Rule` enum) and the per-clause disposition table are frozen against the origin-side Fetch/RFC/PNA requirements, but the CORS rule implementations are being (re)built against that frozen identity and are **not yet run by default**. See `src/standards/disposition.ts` for the authoritative clause→rule mapping. The public `Rule` id is a stable kebab slug with no domain prefix (e.g. `access-control-allow-origin-wildcard-with-credentials`, `origin-reflection`).

Each rule cites its normative source (RFC clause or Fetch anchor) and taxonomy (CWE).

## How it judges

A rule sends its crafted request(s) and classifies the wire response:

- **pass** — the server did the conformant thing (framing: refused with 4xx/5xx or a close; CORS: answered safely)
- **fail** — the server did the unsafe/non-conformant thing
- **warn** — non-blocking by default, but worth surfacing (e.g. an origin reflected without credentials)
- **skip** — the clause did not apply (the header it judges was absent), with a typed reason
- **inconclusive** — couldn't tell (timeout, malformed response), with a typed reason

`report.ok(policy)` is a view over the results, not a stored flag — you decide what fails your build (`failOn`, how to treat inconclusive). It is **fail-closed on connectivity**: if ashward could not reach the server (dead host, wrong URL, refused, timeout) the report is never green, regardless of policy. A _reached-but-undecidable_ inconclusive (a live server that answered oddly) is non-blocking by default; set `inconclusive: 'fail'` to block those too.

## What it does not do

No CLI. No source scanning. No exploitation — detection and verdict only. It tests a single origin over one hop; two-hop proxy⇄backend desync detection is out of scope.

## Status

Early. HTTP/1.1 framing and WHATWG Fetch CORS land first; more standards and security domains follow.

## License

MIT
