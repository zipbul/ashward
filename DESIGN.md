# ashward — 설계 정본 (v7)

npm 설치형 **테스트 서포트 라이브러리**. **네 서버의 HTTP 파서가 국제표준을 준수하는지** 실제 바이트 요청으로 유닛테스트. 이후 보안 규칙 확장. **CLI 없음**(테스트 실행 한정).

> 정본. 삼자리뷰 5라운드 수렴. HANDOFF.md·PLAN.md 폐기.

## 1. 정체성 & 포지션
- 규칙은 **패키지 내장**. 소비자가 assertion 안 씀(supertest 반대).
- **한 문장:** "내 origin이 미래 desync의 파서-불일치 쪽이 **아님**을 증명" — dup Content-Length·모호 TE·bare-LF/CR·CRLF injection·obs-fold·oversized를 내 서버가 **거부하는가**. 단일홉·방어적·CI 안전·무주공산.
- **2-hop desync 탐지는 ashward 아님**(공격영역, Burp/Nuclei 몫).

## 2. 규칙 조직 (핵심 — 저장/정체성/선택 3축 분리)
**by-capability도 by-RFC번호도 primary key 아님. 셋이 직교하는 별개 축이다:**

### 2.1 저장 = 안정 도메인 폴더 (RFC 번호 아님)
```
rules/
  http-messaging/     framing/  message-parsing/       # RFC 9112 계열
  http-semantics/     methods/  status-codes/  fields/ # RFC 9110 계열(버전공유)
  http2-messaging/    frames/   hpack/
  fetch/              cors/                              # WHATWG
  webappsec-csp/      directives/                        # W3C
  tls-handshake/      protocols/  ciphers/
```
- 도메인은 스펙 obsolete(7230→9112→미래) 견딤. RFC 번호 폴더는 주기적으로 썩음 → 금지.
- 1규칙 = 1파일(SRP). `duplicate-content-length.ts`.

### 2.2 정체성 = string enum (값 = 안정 slug)
- **공개 ID = `Rule` string enum.** 멤버값이 슬러그: `Rule.DuplicateContentLength = 'http.framing.duplicate-content-length'`.
- **반드시 string enum**(숫자 금지) — 값이 곧 슬러그라 소비자 DX(자동완성·안정 참조)와 리포트/baseline/canonical JSON 직렬화가 **같은 값**. 숫자 enum이면 `0`이 박혀 안정 ID 파탄. (Bun 실측: `Rule.X === '...slug'` true, JSON에 슬러그, 역매핑 IIFE 없음.)
- 슬러그 = 위반의 본질, **영구 불변**. 폴더(유지보수 축, 이동 가능)와 별개 — 둘이 다른 게 옳다.
- 내부: 규칙 로직은 enum값 키 레지스트리에 매핑(enum=공개 핸들, 레지스트리=로직).

### 2.3 표준 = const-레지스트리 + 다값 인용 메타 (enum 아님)
**타이핑은 문서에서 멈춤. 조항 god-enum 금지**(RFC 섹션·WHATWG 앵커는 enumerable 아님 → false uniformity).
```ts
// 문서 = 타입드 const, body별 discriminated union (IETF 번호 / WHATWG 무버전 / W3C)
export const RFC9112 = { body:'IETF', kind:'RFC', number:9112, code:'RFC 9112',
  title:'HTTP/1.1', url:'https://www.rfc-editor.org/rfc/rfc9112', supersededBy:null } as const satisfies RfcDocument
export type ReqLevel = 'MUST'|'MUST NOT'|'SHOULD'|'SHOULD NOT'|'MAY'   // 닫힌 유니온
export type CweId = `CWE-${number}`                                    // 템플릿리터럴(open id)
// 규칙의 인용 = 다값. §6.3은 자유문자열 locator(타입드 아님)
normative: [ { doc: RFC9112, locator:{kind:'section', value:'6.3'}, req:'MUST' },
             { doc: RFC9110, locator:{kind:'section', value:'5.3'}, req:'MUST' } ]
tags: { cwe:['CWE-444'], owasp:['WSTG-INPV-16'] }
```
- **enum 아님**: const-registry가 데이터(title/url/supersededBy) 담고, 트리셰이킹되고, 3자 팩이 자기 레지스트리로 확장 가능(`defineStandards()`). 타입은 `StandardDocument` 모양(닫힌 코드 유니온 아님).
- **카디널리티 1 요구사항(slug) : N 표준인용.** "코드별 테스트" 틀림 — 테스트 단위는 행동(rule slug), 표준은 다값 인용 메타. N:M(9110 시맨틱 + 9112 framing 공동정의) 무손실.
- 기관별 감사/리포트 = 메타 쿼리(`filter({std:'RFC 9112'})`, `cwe:444`). obsolete는 `supersededBy` 체인.
- **정확성 = 빌드타임 citation 밸리데이터**(enum 아님): CWE/ASVS 기계카탈로그 대조로 존재/폐기 검증, RFC 섹션 shape-lint, WHATWG 앵커 resolve 체크. enum이 못 잡는 dangling/rotted 인용까지 잡음.
- **커버리지 = 자체 선언 corpus**(untestable 근거 vs untested), "% of RFC"는 허수 분모라 금지.

### 2.4 선택 = suites (프리셋+프로파일 붕괴)
- 규칙이 **자기 소속을 자기 파일에 선언**: `suites: ['http11', 'owasp-asvs-l2']`. 추가+소속 한 곳 → 사일런트 갭 없음.
- suite `kind: 'target'|'compliance'` = 메타(문서/카탈로그용, config 타입 아님). target(http11)·compliance(pci-dss-4) 엔진은 동일 취급.
- **CI 체크: 어떤 suite에도 안 걸린 규칙 = 실패**(orphan 방지).

## 3. 소비자 DX (흔한 케이스 2개념)
```ts
// 90% 케이스 — 이 한 줄. select/rules/profiles 없음.
const report = await ashward(url, 'http11')
expect(report.ok).toBe(true)
// CI 하드페일:
await ashward({ url, suite: 'http11', failOn: 'error' })
```
- **개념 2개: `suite`(뭐 돌리나) + `failOn`(뭐가 깨나).** 나머지는 opt-in 고급.
- 고급: `suites:[]`, `select:['std:RFC 9112','http.framing.*']`, `rules:{ 'id':{severity,enabled,params} }`.
- **병합 3단**(5단 아님): `defaults → ordered suites(last-wins) → explicit rules 오버라이드`. **policy(failOn·baseline)는 병합 밖 별개 축**(severity→결과 매핑).
- **security tightening 우선**: compliance suite가 severity 올리면 target suite가 못 내림(역전 버그 금지).

## 4. 데이터 모델 / 드라이버 / verdict (v6 유지)
- **probe→assertion→clause.** 엔진이 probe 스케줄·dedupe·캐시 소유. 규칙은 "필요 프로브+디코더모드" 선언, ad hoc framing 금지.
- 드라이버 = 멍청한 바이트 프로브(`net.Socket`), probe당 커넥션 1개. 종료원인 구분(FIN/RST/timeout/close). 헤드 파서 비정규화. v1: keep-alive·파이프라인·100-continue·HTTP2 제외.
- verdict: `pass/fail/warn/skip/inconclusive`. inconclusive 이유 enum 필수. **조항마다 정밀 wire-observable 거부기준 명시**(400/close/413 다양성 → false positive 방지).

## 5. 리포트 (v6 §12 유지 + explain)
- 불변 `Report`. `ok`는 정책 뷰(저장 아님). 접근자 summary/filter/diff.
- **canonical 버전드 JSON = 유일 계약.** SARIF/JUnit은 그 위 순수함수. 팩트 저장(severity/verdict/baselineGated 3축 직교), 타임스탬프 monotonic-ns(digest 제외), 증거 base64+sha256, probes 별도 배열 id참조, probeRefs assertion레벨 배열.
- **per-finding `explain`**: ruleId + resolvedSeverity + **이긴 레이어** + normative(RFC§)+cwe + evidence + **복붙 suppression 스니펫**. "왜 실패/어떻게 끄나" 한 방 + 병합 디버깅 해결.

## 6. 실패 DX & 타입안전
- 러너무관 `assertConformance(report, policy?)` 던짐. `toPassConformance` = jest/vitest 설탕 하나.
- **codegen `RuleId`/`SuiteId` union 타입**(매니페스트에서 생성) → `rules:{}` 오타=컴파일에러+자동완성.
- `ashward.catalog()` = suites/rules 매니페스트(디스커버리, select 쿼리 대상).

## 7. 버저닝 & baseline
- npm semver=룰셋 정체성, lock이 핀. 규칙 `since`+severity. baseline보다 새 규칙 report-only(warn).
- baseline = 커밋 파일, writer = `run({updateBaseline:true})` 플래그.

## 8. 아키텍처 레이어 (agnostic 코어 + 플러그인)
```
src/
  core/       contract(transport·source·verdict·clause·assertion·pack) / engine / report / assert / baseline / api / selection(suites·query·merge·catalog)
  rules/      도메인별 규칙(§2.1) — core 모름, contract만 의존
  presets/    (=suites 정의; http11 등은 규칙이 선언한 소속의 역인덱스)
  profiles/   컴플라이언스 suite (owasp-asvs·pci-dss)
  exporters/  sarif / junit (canonical JSON 위 순수함수)
  testkit/    broken-server (수용 바)
```
모든 폴더 배럴 index.ts. package.json exports: `.` / `./sarif` / `./junit`.

## 9. v1 컷
- 단일 npm 패키지. **v1 규칙 = `http-messaging/framing/` 파서 컨포먼스 클러스터**(dup CL, CL+TE 모호, malformed chunked, bare-LF/CR, CRLF injection, obs-fold, 크기제한). 각 정밀 거부기준 포함.
- **수용 바: 깨진 서버 하네스** — 비준수 응답 뿜는 소켓에 각 조항 FAIL 검증. examples/ 동봉.
- **첫 슬라이스:** `http.framing.duplicate-content-length` — dup 발산 CL 1개 → 캡처 → accept/reject 분류 → assertion 1개 → Report → 하네스에 assertConformance FAIL. 아키텍처 전체 증명.

## 9.5 테스트 표준 (강제 — 구멍 금지)
- **모든 로직 파일 = colocated `.spec.ts`.** 순수 선언 파일(`enums.ts`/`interfaces.ts`/`types.ts`)은 행동 없음 → 테스트 없음. `constants.ts`는 조합값(BUILTIN_RULES 등)이면 shape 테스트.
- **각 로직마다 4범주 전부**: happy(EP valid) / negative(EP invalid) / edge(BVA 경계+인접) / exception(throw/reject 계약). ISTQB 도출.
- **테스트 종류 3층 다**: unit(순수, 콜라보레이터 주입) / integration(실 소켓·모듈 결합, 예 `runRules`·raw-origin) / e2e(공개 `ashward()` 관통, raw-origin 상대).
- **TDD**: 새 유닛은 실패 테스트 → RED 눈확인 → 최소 구현 → GREEN → 리팩터.
- **커버리지 게이트**: `bun test --coverage`, 로직 파일 line/func 100% 목표(도달불가 분기는 이유 주석+skip).
- 테스트성 위해 분기 로직은 순수함수로 추출(예 URL→Target 해석).

## 10. 안 함 / 미결
- 안 함: CLI(테스트 실행), SAST, 익스플로잇, 프로세스 스폰, 픽스처 규칙(v1), 2-hop desync.
- 미결: canonical JSON 필드 최종 확정 / security suite v2 형태.
