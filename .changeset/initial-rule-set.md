---
'ashward': minor
---

First rule set and public API. Point `ashward(url)` at a running server and it judges conformance over real bytes; `assertOk(report)` throws with per-clause detail, or inspect `report.ok()` / `report.results`.

- **HTTP/1.1 framing** (RFC 9112) — duplicate `Content-Length` (fail) and `CL`+`TE` conflict (warn).
- **WHATWG Fetch CORS** — the full origin-server response-conformance roster across the Fetch / WHATWG URL / RFC 9110–9111 / WICG PNA clauses (§1–§7), plus the credentialed-reflection and `null`-origin security heuristics (CWE-346 / CWE-942).
- Rules are the atomic unit with stable, domain-free ids; select with `ALL_RULES` / the `rules` namespace, or run all by default.
- Fail-closed on connectivity; HTTP over plaintext only (TLS is a later domain).
