# Changelog — 결정 기록 (append-only, 최신이 위)

## 2026-08-29 — D-02 반전: 가입에 이메일 인증 도입(Resend + 6자리 코드), 메일 스택 nodemailer→Resend
- **결정**: (1) Phase 1의 **D-02("이메일 인증은 v1 제외 — 가입 즉시 로그인", `01-CONTEXT.md:22`, `Reversibility: reversible`)를 뒤집는다.** 가입은 `user.email_verified=false`로 계정을 만들고 6자리 코드를 메일로 보내며, 코드 검증에 성공해야 세션이 생긴다. (2) 인증 수단은 **링크가 아니라 코드 입력**(사용자 지시). 라우트를 나누지 않고 가입 카드 안에서 단계만 전환한다 — 인증 직후 로그인하려면 방금 입력한 비밀번호가 필요한데, 페이지를 옮기면 그 값을 URL이나 스토리지에 실어야 한다. (3) 코드 원문은 저장하지 않고 `HMAC-SHA256(AUTH_SECRET, code)`만 보관한다(TTL 10분/시도 5회/재발송 쿨다운 60초). (4) 메일 스택을 TRD §9가 예고했던 **nodemailer+SMTP에서 Resend로 교체**하고 발송을 `src/lib/mailer.ts` 한 모듈에 계속 가둔다. `RESEND_API_KEY`가 없으면 콘솔 출력으로 떨어진다. (5) 미인증 계정의 Credentials 로그인은 거부하되, `CredentialsSignin` 서브클래스의 `code`로 "인증 필요"를 알린다 — **비밀번호 검증에 성공한 뒤에만** 던지므로 계정 열거 oracle이 되지 않는다. (6) 미인증 이메일로 재가입하면 409가 아니라 **코드 재발송 + 비밀번호·이름 갱신**으로 처리한다.
- **이유**: 직전 Google OAuth 작업(PR #4)이 계정 선점 위험을 수용된 리스크로 남겼다 — 공격자가 피해자 Gmail로 먼저 가입해두면 피해자의 Google 로그인이 그 계정에 합류한다(`docs/oauth-google.md`). D-02가 그 위험의 근본 원인이고 `reversible`로 표시돼 있었다. 코드 방식을 고른 것은 제품 오너 지시("인증 메일의 값을 입력"). Resend를 고른 것은 SMTP 자격증명·커넥션 관리 대신 API 키 하나와 DNS 레코드 3개로 끝나고, 서버리스에서 커넥션 유지가 애매한 nodemailer를 피할 수 있어서다.
- **대안**: (1) 인증 링크(매직 링크) — 클릭 한 번이라 UX가 낫지만 오너가 코드 입력을 지정. (2) 코드 평문 저장 — 6자리는 10^6 공간이라 DB 유출 시 즉시 노출되어 기각, 키 있는 HMAC 사용. (3) 미인증 재가입에 409 유지 — 코드 입력 전에 탭을 닫은 사용자가 그 이메일을 영영 못 쓰는 막다른 길이라 기각. (4) 미인증 로그인 시 일반 오류만 표시 — 오너가 "인증 필요 안내"를 지정했고, 비밀번호 확인 뒤로 미루면 열거 위험 없이 양립한다. (5) 기존 가입자도 재인증 — 시드 데모 계정 포함 전원이 잠겨 기각, 마이그레이션에서 `true` 백필.
- **영향**: 신규 의존성 `resend` 1개(React Email 미사용 — 코드 한 줄 메일에 템플릿 엔진은 과함). 신규 env `RESEND_API_KEY`(+선택 `MAIL_FROM`). 마이그레이션 **`0009`** — `user.email_verified` 컬럼 + `email_verification` 테이블 + **손으로 넣은 백필 `UPDATE "user" SET email_verified = true`**(이 줄을 지우면 기존 계정 전원이 잠긴다). TRD §1 스택 표에 메일 행 추가, §3 DDL 2건, §8 API 표에 라우트 2건, **§9.1·§9.2 신설**(§9의 "nodemailer + SMTP" 문장 대체). `src/lib/account.ts`의 `findOrCreateOAuthUser`가 미인증 계정을 만나면 인증됨으로 승격하며 **`password_hash`를 비운다** — 이것이 선점 위험을 닫는 지점이고 `docs/oauth-google.md`의 "알려진 미해결 이슈"를 해소로 갱신했다. **e2e 13개 스펙 전부가 `/signup` UI로 계정을 만들던 것을 `e2e/helpers.ts`의 `signUpAndLogin`으로 교체** — 코드는 랜덤이고 DB엔 해시만 남아 브라우저로 알 수 없으므로 헬퍼가 DB의 `email_verified`를 직접 뒤집는다(프로덕션 라우트에 테스트 백도어를 심지 않기 위한 선택). 코드 검증 해피패스는 `tests/auth/email-verification.test.ts`가 mailer를 mock해 평문 코드를 가로채는 방식으로 실제 라우트에 대고 커버한다. 절차 문서 `docs/email-verification.md` 신설. 유닛 1095→1116, e2e 33/35(실패 2건은 pre-existing 플레이크).

## 2026-08-29 — Google OAuth 도입: Auth.js 어댑터 미사용(user 테이블 직접 upsert) + 검증된 이메일 자동 연결 (FR-A2)
- **결정**: (1) `@auth/drizzle-adapter`와 `account`/`session`/`verificationToken` 테이블을 도입하지 **않고**, `src/auth.ts`의 `jwt` 콜백에서 `src/lib/account.ts`의 `findOrCreateOAuthUser`로 기존 `user` 테이블에 직접 upsert한다. 마이그레이션 0건. (2) Google이 `email_verified: true`로 보증한 이메일이 기존 비밀번호 계정과 일치하면 **같은 계정으로 자동 연결**한다(별도 계정을 만들지 않고, `password_hash`도 건드리지 않는다). (3) `signIn` 콜백에 `isVerifiedGoogleProfile` 게이트를 두어 미검증 이메일 프로필은 로그인 자체를 거부한다. (4) 신규 Google 회원도 비밀번호 가입과 같은 트랜잭션을 타 기본 워크스페이스에 EDITOR로 편입된다(FR-A3) — 그 로직을 `src/lib/account.ts` 한 곳으로 추출해 두 경로가 공유한다.
- **이유**: 세션이 이미 JWT 고정(D-07 — Credentials provider는 DB 세션 불가)이라 어댑터를 붙여도 `session` 테이블이 할 일이 없고 `account`는 링크 기록용으로만 남는다. TRD §1이 FR-A2를 "credentials provider → Google provider 추가"로 충족하도록 설계해뒀고 `user.password_hash`는 이미 nullable(TRD §3 "OAuth 전용 계정은 NULL 허용")이라, 스키마 변경 없이 provider 추가만으로 요구가 충족된다. 자동 연결은 같은 사람이 두 계정으로 갈라져 문서·워크스페이스가 쪼개지는 것을 막는다.
- **대안**: (1) 어댑터 + 3개 테이블 도입 — 표준 경로이고 향후 Google API 호출 시 refresh token 저장이 가능하지만, 지금 필요한 건 로그인 신원 확인뿐이라 테이블 3개와 마이그레이션이 순수 비용. (2) 같은 이메일이면 연결을 거부하고 에러 안내 — 아래 선점 위험은 사라지나 사용자가 그 계정에 Google로 영영 못 들어온다. 제품 오너가 자동 연결을 선택. (3) env 유무로 Google 버튼 조건부 렌더 — 오너가 항상 노출을 선택.
- **영향**: 신규 의존성 0건(`next-auth`에 Google provider 내장), 신규 테이블·마이그레이션 0건. 신규 env 2개 `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`(없으면 버튼만 동작 안 하고 비밀번호 로그인은 정상). `src/auth.ts`에 `pages: { signIn: "/login", error: "/login" }` 추가로 Auth.js 기본 `/api/auth/signin`·에러 화면이 더 이상 노출되지 않는다. `src/app/api/auth/signup/route.ts`는 트랜잭션 본문을 공용 헬퍼 호출로 교체(동작·응답 무변경). 절차 문서 `docs/oauth-google.md` 신설, `docs/connect.md` env 요약에 상호참조 추가. **수용된 잔여 위험**: 비밀번호 가입에 이메일 인증이 없어(D-02) 공격자가 피해자 이메일로 선점 가입해두면 피해자의 Google 로그인이 그 계정에 합류한다 — 근본 해결은 가입 시 이메일 인증(현재 `src/lib/mailer.ts`가 콘솔 스텁)이며 `docs/oauth-google.md` "알려진 미해결 이슈"에 기록.

## 2026-08-16 — 디자인 시스템 적용: 폰트 IBM Plex → DM Sans/Mono, 다크 팔레트 전면 교체, 전역 radius/motion 토큰 도입 (Phase 9)
- **결정**: (1) 폰트를 `next/font/google`의 IBM Plex Sans/Mono에서 `docs/design_system/fonts/*.woff2`(DM Sans 400/500/600/700, DM Mono 400)를 이식한 `next/font/local` 자체호스팅으로 교체(D-03) — CSS 변수명(`--font-ibm-plex-sans/mono`)은 하위 CSS Modules 호환을 위해 그대로 유지. (2) `[data-theme="dark"]` + `@media prefers-color-scheme` 다크 팔레트를 기존 blue-accent(`--accent: #3b82f6`)에서 Dracula 파생 팔레트(`--accent: #7359f8`, `--bg: #0e0d11` 등)로 전면 교체, 라이트 `:root` 색상은 무변경(D-04). (3) `--radius-sm/md/lg`(squircle 6/12/18px), `--duration-fast/standard/slow`(180/240/300ms), `--ease-fluid/--ease-elastic` 8개 전역 토큰을 신설해 테마 무관 공통 적용(D-05).
- **이유**: `docs/design_system/`(draculatheme.com 스크랩, 카피·이미지는 미사용하고 토큰만 추출) 룩앤필을 랜딩·워크스페이스 메인·에디터 3개 화면에 적용해 "이 페이지 뭘로 만들었지" 신선한 인상을 주려는 사용자 요구(09-CONTEXT.md 사용자 발화). 색상만 바꾸는 게 아니라 타입/반경/모션까지 전역 교체해야 그 인상이 성립한다는 판단.
- **대안**: (1) 다크 팔레트만 교체하고 라이트도 유지 — 검토했으나 D-06에서 라이트는 `docs/ui-kit.html`을 색상 원천으로 계속 쓰기로 확정, 다크만 신규 파생. (2) Google Fonts CDN에서 DM Sans 직접 로드 — 자체호스팅(`public/fonts/`) 대신 CDN 왕복이 생겨 기각. (3) 반경/모션을 컴포넌트별 하드코딩 유지 — 전역 토큰 없이는 6개 UI 프리미티브 간 일관성이 깨져 기각.
- **영향**: `src/app/layout.tsx`(폰트 로더 교체) · `src/app/globals.css`(다크 팔레트 전면 교체 + 전역 토큰 8개 신설) · `src/components/ui/*.module.css`(6개 프리미티브 토큰 소비) · 로그인/회원가입/대시보드/에디터 화면 CSS Modules 전체(09-01~09-03). `CLAUDE.md` §문서 체계의 `docs/ui-kit.html` 설명을 "라이트=ui-kit.html 색상 + 신규 전역 타입/반경/모션, 다크=신규 Dracula 파생 색상 + 동일 전역 타입/반경/모션"으로 갱신(D-06). 신규 백엔드 기능·API 계약 변경 없음 — AUTH-01/02·WS-01/02·DOC-01/02는 `e2e/design-system-flow.spec.ts` 통합 회귀로 무변경 확인.

## 2026-08-02 — 미리보기 줄바꿈: 단일 엔터 → `<br>` (CommonMark 0.31.2 이탈, remark-breaks 추가)
- **결정**: 렌더 파이프라인에 `remark-breaks`를 추가해 단일 `\n`(엔터 1번)을 hard break `<br>`로 렌더. Phase 2 UAT 중 제품 오너 지시로 잠긴 CommonMark 0.31.2 soft-break 불변식(TRD §5)을 명시적으로 override. 적용 범위는 렌더 fork(`markdownProcessor`·`markdownProcessorReact`)뿐 — CommonMark 정합성 fork(`markdownProcessorPreSanitize`)는 순수 유지.
- **이유**: 에디터 사용자는 엔터=줄바꿈을 기대하나 순수 CommonMark은 단일 soft break를 공백 처리해 "엔터가 미리보기에 반영 안 됨"으로 보였다(UAT 리포트).
- **대안**: (1) 순수 CommonMark 유지 — 스펙 정합·불변식 보존이나 사용자 기대와 어긋남(오너 기각). (2) 전역 적용 — CommonMark conformance suite 651/652가 깨져 스펙 참조 fork의 존재 의미 상실. 렌더 fork 한정으로 둘 다 회피.
- **영향**: `remark-breaks@4` 의존성 신규 추가. `src/lib/markdown/pipeline.ts` `baseProcessor({breaks})` 분기. TRD §1 스택 행·§5 다이어그램+이탈 불릿 개정. 잠금 테스트 `tests/markdown/line-breaks.test.ts` 신규(렌더=`<br>`, conformance fork=순수). 기존 markdown/spec/editor 스위트 734건 회귀 없음(단일 `\n` 픽스처 부재). export 원문(NFR-5.2)은 파이프라인 역변환 안 하므로 무영향.

## 2026-08-02 — 워크스페이스 삭제: 하드 cascade → 소프트 삭제 (D-15 override)
- **결정**: `DELETE /api/workspaces/:id`를 하드 cascade가 아니라 소프트 삭제(`workspace.is_deleted=true`)로 확정. 행·멤버십 보존, 활성 조회에서 제외, OWNER 전용·기본 워크스페이스 삭제 불가는 유지. Phase 1 실행 중(Plan 01-04 Task 3 decision checkpoint)에 제품 오너 지시로 잠긴 결정 D-15를 명시적으로 override.
- **이유**: 워크스페이스 삭제를 복구 가능하게 하려는 오너 요구. 문서·폴더 소프트 삭제(Phase 4)와 삭제 의미를 일관되게.
- **대안**: 하드 cascade(원 D-15·PRD §3·TRD `ON DELETE CASCADE`) — 스펙 정합·최소지만 비가역이라 오너가 기각. 연구는 워크스페이스 소프트삭제를 Phase-1 scope creep으로 봤으나 오너가 override.
- **영향**: TRD §3(`workspace.is_deleted` 컬럼 추가)·PRD §3·CONTEXT D-15·`01-04-PLAN.md` Task 4 개정. 새 Drizzle 마이그레이션 1건. `src/lib/db-membership.ts` 활성 조회에 `is_deleted=false` 필터, `tests/workspace/delete.test.ts` soft 의미로 재작성. 복원 UI는 Phase 4 휴지통과 함께 도입.

## 2026-08-01 — ORM을 Prisma에서 Drizzle로 교체, 패키지 매니저 pnpm 고정
- **결정**: TRD 확정 당일 사용자 지시로 ORM을 Drizzle ORM으로 교체. 전 명령은 pnpm 경유.
- **이유**: 스키마가 TS 코드(`src/db/schema.ts`)라 TRD §3 DDL과 1:1 대응, Closure Table 벌크 연산을 `sql` 템플릿으로 그대로 쓸 수 있다.
- **대안**: Prisma — 마이그레이션 표준이지만 raw SQL 의존 구간(closure 연산·부분 인덱스)이 많아 이점이 줄어듦.
- **영향**: 코드 없음 단계라 마이그레이션 비용 0. TRD §1·§3·§11, CLAUDE.md 갱신 완료.

## 2026-08-01 — 개발 방법론: GSD 워크플로 + TDD + 에디터 플러그인 아키텍처
- **결정**: 개발은 GSD(phase별 plan→execute→verify)로 진행. TDD(테스트 선행 커밋). 에디터 서식 기능 14종은 1기능 1파일 플러그인(`run(state): TransactionSpec` 순수 함수, 플러그인 간 import 금지).
- **이유**: 플러그인 독립성 보장 요구(사용자 지시). 순수 함수 인터페이스는 DOM 없이 테스트 가능해 TDD 단위와 모듈 경계가 일치한다.
- **대안**: 툴바 핸들러를 에디터 컴포넌트에 인라인 — 기능 추가마다 한 파일이 비대해지고 테스트가 EditorView(DOM)에 묶임.
- **영향**: TRD §6(신설)·§10, CLAUDE.md 불변식에 반영. 기존 섹션 번호 §6~§10 → §7~§11로 이동.

## 2026-08-01 — 초기 스택 확정 (TRD v1.0.0)
- **결정**: Next.js 15 App Router 모놀리스 + PostgreSQL 16 + Auth.js v5 + CodeMirror 6 + unified(remark-gfm·rehype-sanitize) + Vitest/Playwright.
- **이유**: P0~P2 요구를 최소 부품으로 커버. 부분 인덱스(NFR-2.2)·pg_trgm 검색(FR-D4)이 PostgreSQL 지목, OAuth 확장 구조(FR-A2)는 Auth.js provider 추가로 대응.
- **대안**: SPA+별도 API 서버(부품 증가), MySQL(부분 인덱스 없음), Monaco(무게), textarea(커서 API 부재).
- **영향**: 신규 확정이라 깨지는 것 없음. 상세 근거는 docs/TRD.md §1.
