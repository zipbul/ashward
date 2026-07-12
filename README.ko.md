# ashward

[English](./README.md) | **한국어**

[![npm](https://img.shields.io/npm/v/@zipbul/ashward)](https://www.npmjs.com/package/@zipbul/ashward)
[![CI](https://github.com/zipbul/ashward/actions/workflows/ci.yml/badge.svg)](https://github.com/zipbul/ashward/actions/workflows/ci.yml)

**실행 중인 서버**를 국제 표준·보안 요구사항에 대해 검증하는, 규칙이 내장된 테스트 보조 라이브러리 — 테스트 러너 안에서 동작합니다. 단정을 직접 짜지 않고, URL을 가리키면 실제 바이트로 준수 여부를 판정합니다.

> 규칙이 원자 단위입니다. ashward는 규칙을 제공하고 살아있는 origin에 대해 실행할 뿐, **어떤** 규칙을 돌릴지는 사용자의 선택입니다. 한 hop으로 프로브하며 `Cookie`를 절대 보내지 않습니다 — 자격증명 규칙은 브라우저 CORS check가 추론하듯 응답의 자기모순으로 판정합니다.

<br>

## 📦 설치

```bash
bun add -d @zipbul/ashward
```

<br>

## 🚀 빠른 시작

테스트 러너 안에서 실행 중인 서버를 가리킵니다. `assertOk`은 차단 결과가 있으면 조항별 상세와 함께 throw하므로, 던져진 에러가 모든 러너의 공통 실패 신호가 됩니다.

```typescript
import { test } from 'bun:test';
import { ashward, assertOk } from '@zipbul/ashward';

test('내 서버가 내장 표준 + 보안 규칙을 준수한다', async () => {
  const report = await ashward('http://localhost:3000/api'); // 모든 규칙 실행
  assertOk(report);
});
```

throw 대신 직접 들여다보기:

```typescript
const report = await ashward('http://localhost:3000/api');

report.ok(); // 기본 정책 하의 boolean
for (const clause of report.results) {
  console.log(clause.ruleId, clause.verdict, clause.reason);
}
```

대상이 URL이므로, 검사 대상 서버는 어떤 언어로 작성되어도 됩니다.

<br>

## 🎯 규칙 선택

패키지는 규칙을 제공할 뿐, "어떤 규칙을 반드시 지켜야 한다"고 정하지 않습니다. `ashward(url)`은 기본으로 모든 규칙을 돌리며, 원하는 선택을 넘겨 범위를 좁힙니다.

```typescript
import { ashward, rules, ALL_RULES, Rule } from '@zipbul/ashward';

// 특정 규칙만 골라서
await ashward(url, [rules.accessControlAllowOriginGrammar, rules.originReflection]);

// 또는 전체 레지스트리를 필터링
await ashward(
  url,
  ALL_RULES.filter(r => r.id !== Rule.PrivateNetworkAccessIdNameFormat),
);
```

<br>

## 🔬 검사 항목

모든 규칙은 도메인 접두사 없는 안정적 kebab id(예: `access-control-allow-origin-wildcard-with-credentials`)를 가지며, 규범 출처를 인용하고, 보안 규칙은 CWE를 함께 지닙니다.

**HTTP/1.1 framing** (RFC 9112) — request smuggling의 원인인 파서 불일치 계열:

| Rule id                    | 요구사항                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `duplicate-content-length` | §6.3 — 서로 다른 `Content-Length` 두 개는 거부 (MUST → **fail**)                   |
| `cl-te-conflict`           | §6.1 — `Content-Length` + `Transfer-Encoding` 병존은 에러로 다뤄야 (SHOULD → warn) |

**WHATWG Fetch CORS** — origin 서버 응답의 준수 여부를 Fetch/URL/RFC/PNA 조항 전반으로:

- **문법 & 단일 생성** (§1–§2) — `Access-Control-Allow-Origin` serialized-origin 문법, `Allow-Credentials` byte-exact `true`, token-list 헤더, `Max-Age` delta-seconds, 각 헤더 1회 생성, `*`+자격증명 자기모순.
- **Preflight** (§3) — ok 상태, 메서드 byte-case, `*`+자격증명, 자격증명 grant 일관성.
- **Actual & redirect** (§4–§5) — `Expose-Headers` 위치, userinfo 없는 `Location`.
- **Private Network Access** (§6, WICG draft) — `Allow-Private-Network` 리터럴 `true`, ID/Name 형식.
- **캐싱** (§7) — origin에 따라 답이 달라지면 `Vary: Origin`, 정적이면 붙이지 않기.
- **보안 휴리스틱** — 자격증명 origin 반사, `null` origin grant (CWE-346 / CWE-942).

전체 목록은 `ALL_RULES`로 export되며, 각 규칙은 `rules` 아래 이름으로 접근합니다.

<br>

## 🧭 판정 방식

규칙은 조작된 프로브를 보내고 응답 바이트를 분류합니다:

- **pass** — 서버가 준수하는 동작을 함
- **fail** — MUST / MUST NOT 위반 (기본 차단)
- **warn** — SHOULD 수준 또는 보안 우려 (기본 비차단)
- **skip** — 조항이 적용되지 않음 (판정 대상 헤더 부재), 타입 있는 사유와 함께
- **inconclusive** — 판단 불가 (타임아웃, 파싱 불가 응답), 타입 있는 사유와 함께

`report.ok(policy)`는 저장된 플래그가 아니라 결과에 대한 뷰입니다 — 무엇이 차단할지는 사용자가 정합니다(`failOn`, `inconclusive` 처리). **연결 실패에 대해 fail-closed**입니다: 서버에 닿지 못하면(죽은 호스트, 잘못된 URL, 거부, 타임아웃) 정책과 무관하게 리포트는 절대 ok가 아닙니다. _닿았지만 판단 불가_한 inconclusive는 기본 비차단이며, `inconclusive: 'fail'`로 이것도 차단할 수 있습니다.

<br>

## 🚧 범위

- **평문 HTTP 전용** — `https:` 대상은 throw (아직 TLS 없음); `http`로 서버를 가리키세요.
- **한 hop, 탐지 전용** — CLI 없음, 소스 스캔 없음, 익스플로잇 없음. 2-hop 프록시⇄백엔드 desync는 범위 밖.
- **모든 조항이 블랙박스로 검증되진 않음** — 서버 의도가 필요한 조항(예: "이 응답을 공유할 의도")은 intent-bound라, 추측하지 않고 정직하게 untestable로 카탈로그에 기록합니다.

<br>

## 📄 라이선스

MIT
