# crucible — 계획서 (v2: 테스트 서포트 라이브러리)

**소비자의 테스트 안에서 import 하나로 국제표준 규범 준수를 자동 검증하는 라이브러리.**

작성일 2026-07-03 · 상태 설계 · 위치 `projects/zipbul/crucible/` (독립 배포 패키지) · **CLI 없음**

---

## 1. 정체성

crucible은 **테스트 서포트 라이브러리**다. supertest가 "요청을 편하게 보내는" 도구라면, crucible은 "**규범 규칙을 편하게 검증하는**" 도구다. 결정적 차이:

- supertest: 소비자가 assertion을 **직접 쓴다**.
- crucible: assertion(국제표준 규칙)이 **패키지에 내장**돼 있고, 소비자는 **어떤 규칙팩을 적용할지 선언만** 한다.

소비자의 기존 테스트 러너(Bun test / Jest / Vitest) 안에서 돌아가, 규칙 하나하나가 소비자의 리포트에 개별 `test()`로 펼쳐진다. 별도 프로세스·별도 리포트 없음.

## 2. 소비자 UX (설계 목표 — 이 짧음을 지킨다)

```ts
import { crucible } from 'crucible'
import { http11 } from 'crucible/packs/http11'
import { test } from 'bun:test'

crucible(test)                         // 소비자 러너 주입
  .target(() => Bun.serve({ fetch: myHandler }))   // 피검 서버 기동자
  .use(http11)                         // 내장 규칙팩 선언
  .fixtures({                          // 픽스처 엔드포인트 매핑(의미론 규칙용)
    resource: '/items/1',
    protected: '/admin',
    sse: '/events',
  })
  .run()                               // 규칙별 test()가 러너에 주입되어 실행
```

소비자가 작성하는 것: **규칙팩 선언 + 픽스처 매핑 몇 줄.** 요청 생성·전송·판정·조항 추적은 전부 패키지.

`.run()`은 규칙마다 `test('http11 §1.2.1 [MUST] negative Content-Length → 400', ...)` 형태로 소비자 러너에 등록. 실패 시 소비자 리포트에 조항·보낸 바이트·받은 바이트가 그대로 뜬다.

## 3. 아키텍처 (2층, CLI 없음)

```
crucible/
  src/
    core/
      rule/        # 규칙팩(내장 데이터) 로더 + 매니페스트
      driver/      # http11-raw (TCP 직결), 이후 ws·tls
      engine/      # 규칙 → 테스트 실행 → 판정 → 결과
    adapter/
      runner.ts    # 소비자 러너(test 함수) 주입 어댑터 (Bun/Jest/Vitest 공통 시그니처)
    api.ts         # crucible() 빌더 (target/use/fixtures/run)
  packs/
    http11/
      rules.json   # 규칙팩 = 내장 데이터 (STANDARDS.md에서 빌드타임 생성)
      tests/       # 각 규칙의 검증 구현
```

- **core** — 도메인 무관 엔진. 규칙팩 로드, 드라이버로 실요청, 판정.
- **adapter/runner** — 소비자의 `test()` 함수를 받아 규칙을 그 위에 펼침. 러너 종속성 0(함수 시그니처만 의존).
- **규칙팩은 패키지에 내장**(`packs/*/rules.json`). 소비자는 규칙 문서를 볼 필요 없이 import만.

## 4. 규칙팩 = 내장 데이터

### 4.1 소스와 빌드
규칙 정본은 STANDARDS.md(현 어댑터 235 규칙)지만, **소비자에게는 빌드된 `rules.json`으로 배포**한다. STANDARDS.md → rules.json 변환은 crucible 빌드 단계.

입력 문법(확정): `- **§<섹션>.<항목>.<연번>** [<수준>] <문장> [<출처>]`

### 4.2 파서 (리뷰 지적 HIGH-2 반영: sources 추출 알고리즘 명시)
출처 대괄호 파싱은 정규식 한 줄로 불가 — `·` 과부하 때문. 상태 파서 규약:
- 대괄호 내부를 `·`로 1차 분할(단, en-dash `–` 범위는 분할 금지)
- 각 토큰: `RFC N §S`(std+section) / `§S`(직전 std 이월) / `RFC N`(section=null) / `RFC N §A–§B`(범위)
- 결과: `sources: { std, section|null, range?: [a,b] }[]`
- **불변식 명문화**: statement에 리터럴 `[`·`]` 금지(STANDARDS.md 포맷 규격에 추가). 파서가 이 전제로 마지막 `[...]`를 출처로 분리.

### 4.3 매니페스트
```ts
interface Rule {
  id: string        // "http11:1.2.1"
  pack: string; code: string
  level: 'MUST'|'MUST NOT'|'SHOULD'|'SHOULD NOT'|'MAY'|'NONE'   // 무표기→NONE (리뷰 R2: 언어중립 토큰)
  statement_ko: string; statement_en: string                    // 리뷰 R2: 영어 병기
  sources: { std: string; section: string|null; range?: [string,string] }[]
  scoring: 'fail'|'warn'|'info'|'exclude'   // MUST*→fail, SHOULD*→warn, MAY→info, NONE→exclude
}
```

## 5. 규칙 → 테스트 연결 + verdict 합성 (리뷰 CRIT-1 반영)

규칙:테스트 = 1:0..N, 테스트:규칙 = 1:1..N. **합성 규칙을 명시한다:**

- **테스트가 여러 규칙을 cover하고 fail**: 각 규칙에 어느 관찰이 깨졌는지 **귀속(attribution)**한다. 테스트는 `assert(ruleId, observation)` 단위로 판정을 쪼개 보고 — 한 왕복이 §7.4.5(304)와 §7.4.2(순서)를 보면 각각 별도 assert. 뭉뚱그린 pass/fail 금지.
- **규칙에 테스트 N개**: 규칙의 셀 verdict = `any-fail → fail`(가장 엄격). 단 개별 테스트 결과도 evidence로 보존.
- YAML 선언형은 관찰마다 covers를 분리 명시(`status`→규칙A, `connection`→규칙B). 한 expect에 다규칙 뭉치기 금지.

## 6. untestable 규율 (리뷰 CRIT-2 반영)

- `untestable`은 규칙팩 **저작 시점에 고정**되고 근거 필드를 가진다: `{ ruleId, reason }`. 소비자·실행 시점에 임의 지정 불가.
- **MUST 등급은 untestable로 뺄 수 없다** — MUST를 관찰불가로 판정하려면 규칙팩 리뷰에서 명시 승인 + 근거 기록. 커버리지 분모 조작 차단.
- 리포트는 `untested`(구현 안 됨)와 `untestable`(원리상 불가·근거 있음)을 분리 표시. 커버리지 %는 `untestable` 제외 분모와 포함 분모 둘 다 노출.

## 7. 픽스처 오염 방지 (리뷰 R1·MEDIUM-1 반영)

의미론 규칙은 픽스처 앱 협조 필요 → 소비자 부담 = 채택 장벽. 완화:
- **무픽스처 규칙을 기본**으로: framing(§1)·응답 정합(§2 다수)·연결(§10)은 픽스처 0. `.run()` 기본이 이것만 돌린다.
- **의미론 규칙은 opt-in**: 소비자가 `.fixtures({...})`로 엔드포인트를 매핑한 규칙만 활성. 매핑 안 하면 그 규칙은 `skip(no-fixture)`로 정직하게 표시(침묵 통과 아님).
- **픽스처 계약을 바이트 단위 규약화**: 픽스처 엔드포인트가 반드시 set해야 할 응답 헤더 집합·결정성(고정 리소스·고정 타임스탬프)을 crucible이 명세. 자기귀속 왕복(ETag echo 등)은 값 무관이라 오염 없음.
- **공식 픽스처 제공**: zipbul·node:http·Bun.serve용 레퍼런스 픽스처를 crucible이 동봉해 소비자 저작 부담 최소화.

## 8. 드라이버 신뢰성 (리뷰 HIGH-1 반영)

- **연결 종료 구분**: 정상 FIN / RST / 타임아웃 / keep-alive-유지를 각각 다른 신호로 판정. `closed=true` 뭉개기 금지. 타임아웃은 `inconclusive`(probe 선례의 verdict 차용)로, 규범 위반으로 단정 안 함.
- **100-continue 반이중 API**: 드라이버가 헤더만 write → 중간 응답 대기 → body write 시퀀싱 지원(`ctx.sendExpecting100()`). 이것 없이 §1.7.2 검증 불가.
- **keep-alive/파이프라인 하네스**: 한 소켓 다중 요청 지원(`ctx.pipeline([...])`). §10.3.2·§10.4.2용.
- **응답 프레이밍 파서**: chunked·다중 응답 경계 상태기계. raw 캡처만으로 부족.

## 9. 다중 팩 중복 (리뷰 MEDIUM-2 반영)

- 소비자가 팩 여러 개 `.use()`하면 **출처 조항 기준 dedup**: 같은 `{std, section}`을 가리키는 규칙은 한 번만 채점하고 중복은 리포트에 `merged`로 표기.
- 팩 로드 시 출처 충돌 탐지 → 경고. (어댑터 §5.8.3 ≡ compression §1.1.7 같은 케이스 자동 발견.)

## 10. 무엇을 안 하는가

- **CLI 없음.** 라이브러리만. 러너 없는 대상 테스트는 범위 밖(필요해지면 나중).
- **소스 스캔·SAST 없음.** 블랙박스 실요청만.
- **익스플로잇 없음.** 탐지·판결까지(방어적 포지션).
- **security 팩 v1 제외.** 엔진이 팩 무관이라 나중에 얹음.
- **공개 대시보드·커뮤니티 기여 v1 제외.**

## 11. v1 컷

`http11` 팩(framing 규칙 우선, 무픽스처) + core 엔진 + Bun test 어댑터 + 레퍼런스 픽스처(zipbul·node·bun).

**순서:**
1. `core/rule` — STANDARDS.md → rules.json 빌드 + §4.2 상태 파서. 235 규칙 손실 없이 추출 검증.
2. `core/driver/http11-raw` — §8의 신뢰성 요건(종료 구분·100-continue·파이프라인·프레이밍).
3. `core/engine` — §5 합성·§6 untestable·§9 dedup.
4. `adapter/runner` (Bun test) + `api.ts` 빌더.
5. `packs/http11/tests` — framing 계층 A/B ~20개.
6. 레퍼런스 픽스처 3종 + 자체 e2e(crucible가 crucible로 세 서버 채점). → **소비자가 import→선언→테스트 통과 실증.**

## 12. 미결정

1. **규칙팩 배포 형태**: `rules.json` 내장(현안) vs STANDARDS.md 직파싱. 소비자 배포엔 json이 안전(파서를 소비자 런타임에 안 실음).
2. **statement 영어화 시점**: 매니페스트는 ko/en 병기 스키마지만 en 콘텐츠 채우기는 별도 작업. v1은 ko만, en은 공개 전.
3. **소비자 러너 지원 범위**: v1 Bun test만. Jest/Vitest 어댑터는 시그니처 호환 확인 후.
