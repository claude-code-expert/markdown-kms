# Phase 1: Auth & Workspace Foundation - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 이메일+비밀번호로 가입해 즉시 로그인되고, 세션이 새로고침 후에도 유지되며, 역할이 강제된 워크스페이스에 착지하는 인증·워크스페이스·RBAC 기반을 만든다. 모든 변경 API가 권한 매트릭스대로 서버에서 403 검증한다.

**In scope:** AUTH-01(가입·즉시 로그인), AUTH-02(세션 유지), AUTH-03(기본 워크스페이스 EDITOR 자동 가입), WS-01(RBAC 매트릭스 서버 403), WS-02(워크스페이스 생성=OWNER / 삭제=OWNER 전용). 스키마 `user`/`workspace`/`workspace_member`, `lib/rbac.ts`의 `requireRole`, 가입/워크스페이스 생성·삭제 API, 로그인 후 카드 대시보드 착지 화면.

**Out of scope (다른 Phase):** 에디터·마크다운 파이프라인(Phase 2), 폴더 트리(Phase 3), 문서·자동저장·3분할 화면(Phase 4), 가입 신청·초대 메일(Phase 7), Google OAuth(Phase 8). Phase 1의 RBAC 매트릭스는 7행 전체를 서버에 심되, Phase 1에서 실제로 검증 가능한 액션은 워크스페이스 생성(회원)·삭제(OWNER)뿐 — 나머지 행은 해당 리소스가 생기는 Phase에서 활성화된다.

</domain>

<decisions>
## Implementation Decisions

### 가입 폼·비밀번호 정책
- **D-01:** 비밀번호 규칙 = 8자 이상, 문자종류 복잡도 강제 없음 (NIST 800-63B — 길이 우선). 클라이언트·서버 양쪽 검증. — **Reversibility:** reversible
- **D-02:** 이메일 인증(확인 메일)은 v1 제외 — 가입 즉시 로그인한다. 근거: AUTH-01 인수조건 "즉시 로그인"과 정합, 메일 인프라(nodemailer)는 TRD §9상 R2 초대에서 처음 도입되어 Phase 1엔 없음. — **Reversibility:** reversible
- **D-03:** 가입 폼 필드 = 이메일·비밀번호·이름 3필드. `user.name`이 NOT NULL(TRD §3)이고 멤버 표시에 쓰이므로 직접 입력받는다. — **Reversibility:** reversible
- **D-04:** 비밀번호 해싱은 bcrypt (TRD §1 확정). — 스택 잠금, 논의 대상 아님.

### 로그인 세션
- **D-05:** 세션 유지 기간(maxAge) = 24시간, 슬라이딩 갱신(활동 시 연장, Auth.js 기본 동작 채택). AUTH-02 "새로고침 후 유지"는 자연 충족. — **Reversibility:** reversible
- **D-06:** "로그인 상태 유지"는 항상 유지 방식 — remember-me 체크박스 없음. 로그인하면 무조건 maxAge만큼 유지. — **Reversibility:** reversible
- **D-07:** 세션 전략은 JWT (Auth.js v5 credentials provider는 DB 세션 불가 — 스택 제약, 논의 대상 아님).

### 기본 워크스페이스 모델·착지 화면
- **D-08:** 기본 워크스페이스 = **단일 공용 워크스페이스**. 시스템이 1행 시드(`is_default = true`), 모든 가입자가 이 하나의 워크스페이스에 EDITOR로 자동 합류한다. 사용자별 개인 기본 워크스페이스 아님. — **Reversibility:** costly — 되돌리면 시드 로직·가입 시 멤버십 생성·AUTH-03 테스트가 전부 바뀐다. 프로덕션 시드 후엔 데이터 마이그레이션 필요.
- **D-09:** 기본 워크스페이스는 OWNER/ADMIN 없이 전원 EDITOR로 둔다. 시드 생성이라 생성자(OWNER)가 없고, "삭제 불가 + Phase 1에 설정 변경 없음"이라 OWNER 전용 액션이 발생하지 않아 매트릭스 위반이 아니다. — **Reversibility:** reversible
- **D-10:** 기본 워크스페이스 표시 이름 = "기본 워크스페이스". — **Reversibility:** reversible
- **D-11:** 로그인 직후 착지 화면 = 소속 워크스페이스 **카드 대시보드**(사이드바 없이 카드 목록). 상시 폴더 사이드바는 Phase 4의 3분할에서 등장. — **Reversibility:** reversible — Phase 4 3분할 진입 시 이 대시보드는 교체/재배치될 수 있다.
- **D-12:** AUTH-03 인수조건의 "사이드바에 표시된다"는 Phase 1에서 **카드 대시보드에 기본 워크스페이스가 보이는 것**으로 충족한 것으로 본다. planner·verifier는 문자 그대로의 "사이드바 컴포넌트" 부재를 실패로 처리하지 말 것. 상시 사이드바 = Phase 4.

### 워크스페이스 생성·전환·삭제 UX
- **D-13:** 워크스페이스 생성 = 모달 다이얼로그(이름 필드 1개). ui-kit 모달 컴포넌트 이식. — **Reversibility:** reversible
- **D-14:** 생성 직후 = 즉시 `/w/[newId]`로 진입해 새 워크스페이스를 활성화(Phase 1엔 빈 플레이스홀더 화면). "활성 워크스페이스"는 URL 파라미터(`w/[wsId]`, TRD §11)로 표현. — **Reversibility:** reversible
- **D-15:** 워크스페이스 삭제(OWNER 전용) = 이름 재입력 확인(GitHub 방식). cascade 비가역 액션이라 강한 확인 채택. — **Reversibility:** reversible

### Claude's Discretion
- 로그인 브루트포스 rate-limit / 계정 잠금 정책: 논의에서 확정하지 않음 — researcher/planner가 Auth.js 관례와 위험도에 맞춰 결정.
- 세션 슬라이딩 갱신 주기(updateAge)는 Auth.js 기본값 채택.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항·해석 확정 (우선순위 순)
- `docs/REQUIREMENT.md` — 원 요구사항 FR/NFR/US (AUTH-01~03, WS-01~02, NFR-3.2). CommonMark 0.31.2 기준.
- `docs/PRD.md` §2 — REQUIREMENT 공백 9건 해석 확정. Phase 1 직결: #1(워크스페이스 생성=회원 누구나→OWNER), #4(삭제 열=워크스페이스 삭제 OWNER 전용), #5(기본 워크스페이스 자동 가입 역할=EDITOR). **REQUIREMENT와 충돌 시 PRD 우선.**
- `docs/PRD.md` §3 — 최종 권한 매트릭스 7행. 서버가 이 표대로 검증, 위반 403. 워크스페이스 생성은 역할 무관 전 회원 가능.

### 스택·스키마·프로토콜 확정
- `docs/TRD.md` §1 — 스택 확정: Next.js 15 App Router + TS, PG16, Drizzle, Auth.js v5(credentials→bcrypt), pnpm.
- `docs/TRD.md` §2 — 아키텍처: `requireRole(workspaceId, minRole)`가 모든 변경 API 공통 관문, 권한 검증 전부 서버.
- `docs/TRD.md` §3 — DDL 원천. Phase 1 테이블: `"user"`, `workspace`(is_default), `workspace_member`(role CHECK 4종, PK=workspace_id+user_id). Drizzle `src/db/schema.ts`가 이 DDL의 1:1 표현.
- `docs/TRD.md` §8 — API 표. Phase 1: `POST /api/auth/signup`(가입+기본 WS EDITOR 편입), `POST /api/workspaces`(생성자 OWNER, 최소 역할=회원), `DELETE /api/workspaces/:id`(OWNER).
- `docs/TRD.md` §11 — 디렉터리 구조: `app/(auth)/login,signup`, `app/(main)/w/[wsId]`, `lib/rbac.ts`, `db/schema.ts`. 스캐폴딩은 `pnpm create next-app` 최신 명령.

### 디자인·불변식
- `docs/ui-kit.html` — 디자인 토큰 원천(IBM Plex Sans/Mono, accent `#2563eb`, lucide, 순수 CSS 변수, 32 컴포넌트). 가입·로그인 폼, 워크스페이스 카드, 생성/삭제 모달은 이 토큰·컴포넌트를 이식.
- `CLAUDE.md` (레포 루트) — 불변식. Phase 1 관련: "권한 검증은 서버 전용, 모든 변경 API는 `requireRole` 경유 위반 403. UI 버튼 숨김은 보안이 아니다."

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **없음 — greenfield.** 코드는 아직 없다(설계 단계). Phase 1 첫 작업이 `pnpm create next-app` 스캐폴딩(scaffold 스킬 규칙, 수제 보일러플레이트 금지).
- `docs/ui-kit.html`의 32 컴포넌트(폼 인풋, 버튼, 카드, 모달, 다이얼로그)가 UI 이식 원천. 새 UI는 여기 CSS 변수 토큰을 CSS Modules로 옮겨 쓴다.

### Established Patterns
- **RBAC는 서버 전용:** `lib/rbac.ts`의 `requireRole(workspaceId, minRole)`이 세션→`workspace_member.role` 조회→미달 403. Phase 1이 이 패턴의 최초 구현 지점이며 이후 전 Phase가 재사용.
- **스키마 단일 원천:** Drizzle `src/db/schema.ts`가 TRD §3 DDL의 1:1 표현. 스키마 변경은 TRD §3 갱신 후 `drizzle-kit generate → migrate`.
- **TDD:** 테스트가 구현보다 먼저 커밋(TRD §10). RBAC는 "역할 4종 × 주요 API 매트릭스 통합 테스트, 미달 403"을 먼저 작성.

### Integration Points
- Auth.js v5 세션 → `requireRole`이 읽는 세션 사용자 ID의 원천. Phase 1이 이 연결을 최초로 세운다.
- 가입 트랜잭션이 `user` 생성 + 기본 워크스페이스 `workspace_member`(EDITOR) 삽입을 원자적으로 수행 — AUTH-01과 AUTH-03이 한 흐름에서 만난다.

</code_context>

<specifics>
## Specific Ideas

- 착지 화면을 "워크스페이스 카드 대시보드"로 명시 선택(사이드바 껍데기 안 함). Phase 4에서 3분할로 교체될 것을 인지한 선택.
- 워크스페이스 삭제는 GitHub식 "이름 재입력" 확인 — cascade 비가역성에 대한 사용자 명시 선호.

</specifics>

<deferred>
## Deferred Ideas

- **가입 신청·초대 메일 흐름** — Phase 7 (WS-03~05). Phase 1의 워크스페이스는 생성/삭제/자동가입까지만.
- **Google OAuth** — Phase 8 (AUTH-04). Auth.js credentials 구조가 provider 추가만으로 확장되는지가 그때의 인수 기준.
- **로그아웃·비밀번호 재설정 UX** — 논의에서 다루지 않음. 필요 시 Phase 1 plan 단계 또는 후속에서 별도 검토(현재 요구사항 ID 없음).
- **상시 폴더 사이드바** — Phase 4 3분할 화면에서 등장.

None deferred outside these — 논의는 Phase 1 범위 안에 머물렀다.

</deferred>

---

*Phase: 1-auth-workspace-foundation*
*Context gathered: 2026-08-01*
