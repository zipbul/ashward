# ashward

## 0.2.0

### Minor Changes

- 4ce1342: Add three conformance-rule domains, judged blackbox over a running origin.

  - **Response compression** (RFC 9110 / 9111 / 9530, RFC 1950 / 1952 / 8878 / 9659) — no `identity` token in `Content-Encoding`, no coding on a bodiless status, `Vary: Accept-Encoding` on a negotiated resource, a strong `ETag` weakened or distinguished across representations, and byte-format checks over the transfer-decoded body: gzip header, zlib-wrapped `deflate`, and `zstd` within the 8 MiB HTTP window cap (RFC 9659) with reserved bits zero.
  - **x-www-form-urlencoded query parsing** (WHATWG URL / Encoding, RFC 3986) — control-guarded robustness heuristics (malformed percent, invalid UTF-8, NUL, prototype-pollution must not crash) plus parse-correctness rules judged against a caller-opted echo route that reflects the parsed query as an ordered pair list (opt in with `ashward(url, rules, { reflect: { path, mode } })`).
  - **Conditional requests** (RFC 9110 §13) — `If-None-Match` / `If-Match` evaluation and weak-vs-strong comparison, `If-Modified-Since` / `If-Unmodified-Since`, the three HTTP-date formats, §13.2.2 precedence, the required `304` headers, no content on a `304`, and the ignore rules for non-selecting methods and error statuses, all from the resource's own discovered validators.

  Supporting surface: a new `ReqLevel.Unmarked` level (never maps to a blocking `fail`), a transfer-decoding body reader, the opt-in `AshwardOptions.reflect` reflect-target, and new `SkipReason` / `InconclusiveReason` members. Every clause is dispositioned in its catalog (a shipped rule or a reasoned untestable entry), machine-checked for the clause↔rule bijection.

## 0.1.0

### Minor Changes

- d2a118f: First rule set and public API. Point `ashward(url)` at a running server and it judges conformance over real bytes; `assertOk(report)` throws with per-clause detail, or inspect `report.ok()` / `report.results`.

  - **HTTP/1.1 framing** (RFC 9112) — duplicate `Content-Length` (fail) and `CL`+`TE` conflict (warn).
  - **WHATWG Fetch CORS** — the full origin-server response-conformance roster across the Fetch / WHATWG URL / RFC 9110–9111 / WICG PNA clauses (§1–§7), plus the credentialed-reflection and `null`-origin security heuristics (CWE-346 / CWE-942).
  - Rules are the atomic unit with stable, domain-free ids; select with `ALL_RULES` / the `rules` namespace, or run all by default.
  - Fail-closed on connectivity; HTTP over plaintext only (TLS is a later domain).
