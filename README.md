# ashward

**English** | [한국어](./README.ko.md)

[![npm](https://img.shields.io/npm/v/@zipbul/ashward)](https://www.npmjs.com/package/@zipbul/ashward)
[![CI](https://github.com/zipbul/ashward/actions/workflows/ci.yml/badge.svg)](https://github.com/zipbul/ashward/actions/workflows/ci.yml)

Test-support library with built-in rules that verify a **running server** against international standards and security requirements — from inside your test runner. You don't write assertions; you point it at a URL and it judges conformance over real bytes.

> The rule is the atomic unit. ashward ships the rules and runs them against a live origin — **which** rules to run is your choice. It probes over one hop and never sends a `Cookie`; credential rules are judged from response self-contradiction, the way a browser's CORS check reasons.

<br>

## 📦 Installation

```bash
bun add -d @zipbul/ashward
```

<br>

## 🚀 Quick Start

Point it at your running server inside any test runner. `assertOk` throws — with per-clause detail — on any blocking result, so a thrown error is the one universal failure signal.

```typescript
import { test } from 'bun:test';
import { ashward, assertOk } from '@zipbul/ashward';

test('my server conforms to the built-in standards + security rules', async () => {
  const report = await ashward('http://localhost:3000/api'); // runs every shipped rule
  assertOk(report);
});
```

Prefer to inspect instead of throw:

```typescript
const report = await ashward('http://localhost:3000/api');

report.ok(); // boolean under the default policy
for (const clause of report.results) {
  console.log(clause.ruleId, clause.verdict, clause.reason);
}
```

The target is a URL, so the server under test can be written in any language.

<br>

## 🎯 Selecting rules

The package ships rules, never an opinion about which ones your app must satisfy. `ashward(url)` runs every rule by default; pass your own selection to scope it.

```typescript
import { ashward, rules, ALL_RULES, Rule } from '@zipbul/ashward';

// hand-pick specific rules
await ashward(url, [rules.accessControlAllowOriginGrammar, rules.originReflection]);

// or filter the full registry
await ashward(
  url,
  ALL_RULES.filter(r => r.id !== Rule.PrivateNetworkAccessIdNameFormat),
);
```

<br>

## 🔬 What it checks

Every rule has a stable, domain-free kebab id (e.g. `access-control-allow-origin-wildcard-with-credentials`), cites its normative source, and — for security rules — carries a CWE.

**HTTP/1.1 framing** (RFC 9112) — the parser-discrepancy class behind request smuggling:

| Rule id                    | Requirement                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `duplicate-content-length` | §6.3 — reject two divergent `Content-Length` headers (MUST → **fail**)             |
| `cl-te-conflict`           | §6.1 — `Content-Length` + `Transfer-Encoding` ought to be an error (SHOULD → warn) |

**WHATWG Fetch CORS** — origin-server response conformance across the Fetch/URL/RFC/PNA clauses:

- **Grammar & single-generation** (§1–§2) — `Access-Control-Allow-Origin` serialized-origin grammar, `Allow-Credentials` byte-exact `true`, token-list headers, `Max-Age` delta-seconds, single generation, `*`-with-credentials contradictions.
- **Preflight** (§3) — ok status, method byte-case, `*`-with-credentials, credentialed-grant consistency.
- **Actual & redirect** (§4–§5) — `Expose-Headers` placement, `Location` without userinfo.
- **Private Network Access** (§6, WICG draft) — `Allow-Private-Network` literal `true`, ID/Name format.
- **Caching** (§7) — `Vary: Origin` when the answer varies by origin, and not when it's static.
- **Security heuristics** — credentialed origin reflection and `null`-origin grants (CWE-346 / CWE-942).

**Response compression** (RFC 9110 / 9111 / 9530, RFC 1950 / 1952 / 8878 / 9659) — content-coding conformance on the wire:

- **Headers** — no `identity` token in `Content-Encoding`, no coding on a bodiless status, `Vary: Accept-Encoding` on a negotiated resource, a strong `ETag` weakened or distinguished across the coded and identity representations.
- **Byte formats** — a well-formed gzip header, zlib-wrapped `deflate` (never raw), and `zstd` within the 8 MiB HTTP window cap (RFC 9659) with reserved bits zero — checked over the transfer-decoded body.

**x-www-form-urlencoded query parsing** (WHATWG URL / Encoding, RFC 3986) — judged against a route you opt in that echoes its parsed query as an ordered pair list:

- **Robustness heuristics** — malformed percent-escapes, invalid UTF-8, NUL bytes, and prototype-pollution vectors must not crash the origin (CWE-20 / CWE-1321), control-guarded so a flaky endpoint can't be blamed.
- **Parse correctness** — `&`-only separation, first-`=` split, `+`→space (form) vs. literal (uri-generic), U+FFFD on invalid UTF-8, a preserved malformed `%`, skipped empty sequences, and a preserved empty name.

**Conditional requests** (RFC 9110 §13) — precondition evaluation over `304` / `412` / `200`, from the resource's own discovered validators:

- **Evaluation** — `If-None-Match` / `If-Match` (weak vs. strong comparison, §8.8.3.2), `If-Modified-Since` / `If-Unmodified-Since`, all three HTTP-date formats, and the §13.2.2 precedence order.
- **Response shape** — the required `304` headers (§15.4.5), no content on a `304`, and the ignore rules for non-selecting methods and error statuses.

The full roster is exported as `ALL_RULES` (and each rule by name under `rules`).

The query-parser reflection rules need a route that echoes its parsed query; pass it opt-in and declare the parse mode (every other rule keeps probing the URL's own path):

```typescript
await ashward('http://localhost:3000/', ALL_RULES, {
  reflect: { path: '/echo', mode: 'form' }, // or 'uri-generic'
});
```

<br>

## 🧭 How it judges

A rule sends its crafted probe(s) and classifies the wire response:

- **pass** — the server did the conformant thing
- **fail** — a MUST / MUST NOT violation (blocks by default)
- **warn** — a SHOULD-level or security concern (non-blocking by default)
- **skip** — the clause did not apply (the header it judges was absent), with a typed reason
- **inconclusive** — couldn't tell (timeout, malformed response), with a typed reason

`report.ok(policy)` is a view over the results, not a stored flag — you decide what blocks (`failOn`, how to treat `inconclusive`). It is **fail-closed on connectivity**: if ashward could not reach the server (dead host, wrong URL, refused, timeout) the report is never ok, whatever the policy. A _reached-but-undecidable_ inconclusive is non-blocking by default; set `inconclusive: 'fail'` to block those too.

<br>

## 🚧 Scope

- **HTTP over plaintext only** — an `https:` target throws (no TLS yet); point it at your server over `http`.
- **One hop, detection only** — no CLI, no source scanning, no exploitation. Two-hop proxy⇄backend desync is out of scope.
- **Not every clause is blackbox-testable** — clauses that need server intent (e.g. "the server means to share this response") are intent-bound and honestly catalogued as untestable rather than guessed.

<br>

## 📄 License

MIT
