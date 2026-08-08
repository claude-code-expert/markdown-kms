# Requirements: markdown-kms

**Defined:** 2026-08-01
**Core Value:** 에디터 입력 → 60ms 내 CommonMark 0.31.2 정합 미리보기 렌더링
**원천:** docs/REQUIREMENT.md FR/NFR → docs/PRD.md 해석 확정. REQ-ID ↔ FR-ID 매핑 유지. 우선순위 P0/P1/P2는 릴리스 R1/R2/R3와 일치.

## v1 Requirements

v1 = R1(P0) + R2(P1) + R3(P2) 전체. P2도 v1에 포함하되 후순위 (REQUIREMENT §3 정의).

### Authentication (AUTH)

- [x] **AUTH-01** (P0, FR-A1): 사용자는 이메일+비밀번호로 가입하고 즉시 로그인된다
- [x] **AUTH-02** (P0, FR-A1): 로그인 세션이 브라우저 새로고침 후에도 유지된다
- [x] **AUTH-03** (P0, FR-A3): 가입 완료 시 기본 워크스페이스에 EDITOR로 자동 소속되고 사이드바에 표시된다
- [ ] **AUTH-04** (P2, FR-A2): 사용자는 Google 계정으로 로그인할 수 있다 (provider 추가만으로 동작해야 함)

### Editor (EDIT)

- [x] **EDIT-01** (P0, FR-E1): 헤딩 H1~H4·P 서식을 툴바/문법으로 적용할 수 있다 (ATX `#`~`####`)
- [x] **EDIT-02** (P0, FR-E2): Bold·Italic·Strikethrough·Inline Code를 선택 텍스트에 적용할 수 있다
- [x] **EDIT-03** (P0, FR-E3): Bullet·Ordered·Task 목록을 삽입할 수 있다
- [x] **EDIT-04** (P0, FR-E4): Blockquote·언어 지정 Code Block·HR을 삽입할 수 있다
- [x] **EDIT-05** (P0, FR-E5): Link·Image·Table(GFM)을 삽입할 수 있다
- [x] **EDIT-06** (P0, FR-E8/NFR-1.1): 10,000자 문서에서 keystroke → 미리보기 DOM 갱신 p95 ≤ 60ms
- [x] **EDIT-07** (P0, FR-E9): 입력 중단 1초 후 자동 저장되고 상태 바가 저장 중→저장됨/실패(재시도)로 전환된다. seq 가드로 역순 도착이 무시되고, 상태 바는 마지막 발신 seq의 응답일 때만 "저장됨"을 표시한다
- [x] **EDIT-08** (P0, NFR-3.1): `<script>`·이벤트 핸들러·`javascript:` URL이 미리보기에서 실행되지 않는다. GFM 태스크 체크박스는 sanitize를 통과해 렌더링된다
- [ ] **EDIT-09** (P1, FR-E6): 이미지 업로드 완료 시 커서 위치에 이미지 마크다운이 삽입된다
- [ ] **EDIT-10** (P1, FR-E7): 툴바는 lucide 아이콘 + hover 300ms 내 툴팁 + 클릭 pressed 피드백을 갖는다
- [ ] **EDIT-11** (P1, FR-E10): 1분 주기 임시 스냅샷이 저장되고, 재진입 시 임시본이 최신이면 복구 여부를 묻는다
- [ ] **EDIT-12** (P1, FR-E11): 라이트/다크 테마와 split/에디터 전용/미리보기 전용 레이아웃을 전환할 수 있다

### Folder Tree (TREE)

- [x] **TREE-01** (P0, FR-T1): 사이드바에 워크스페이스>폴더>자식 폴더>문서 계층 트리가 표시된다
- [x] **TREE-02** (P0, FR-T2/NFR-1.3): 폴더 계층은 Closure Table로 저장되고 서브트리 조회가 단일 쿼리로 수행된다
- [x] **TREE-03** (P0, FR-T3): 폴더 생성·이름 변경·이동·소프트 삭제가 동작한다. 자기 자손으로의 이동은 거부된다

### Documents (DOC)

- [x] **DOC-01** (P0, FR-D1): 문서 생성·수정·삭제가 동작하고, 삭제는 소프트 삭제로 즉시 휴지통에 나타난다
- [x] **DOC-02** (P0, FR-D2/PRD §2-2·2-3): 휴지통에서 복원(cascade, 원위치 또는 루트)과 완전 삭제(ADMIN 이상)가 동작한다
- [ ] **DOC-03** (P1, FR-D3): 문서당 태그 3개까지 입력되고 4개째는 클라이언트·서버 모두 거부한다
- [ ] **DOC-04** (P1, FR-D4): 제목·본문·태그 검색이 동작한다 (NFC 정규화, pg_trgm)

### Workspace & RBAC (WS)

- [x] **WS-01** (P0, FR-W1/W2): Owner/Admin/Editor/Viewer 권한 매트릭스(PRD §3)대로 서버가 검증하고 위반 시 403을 반환한다
- [x] **WS-02** (P0, PRD §2-1): 회원은 워크스페이스를 생성할 수 있고 생성자가 OWNER가 된다. 워크스페이스 삭제는 OWNER만 가능하다
- [ ] **WS-03** (P1, FR-W3): 회원은 워크스페이스에 가입 신청할 수 있다
- [ ] **WS-04** (P1, FR-W4): Owner·Admin은 가입 신청을 승인·거절할 수 있다
- [ ] **WS-05** (P1, FR-W5/NFR-3.3): Owner·Admin은 회원을 검색해 초대 메일을 발송하고, 수락 링크(서명·일회성·만료)를 클릭한 회원은 EDITOR로 편입된다

### Export (EXP)

- [ ] **EXP-01** (P1, FR-X1/NFR-5.2): 문서를 원본 무손실 `.md`로 다운로드할 수 있다
- [ ] **EXP-02** (P1, FR-X2): 폴더 하위 전체를 구조 유지 `.zip`으로 다운로드할 수 있다

### Presentation (PRES)

- [ ] **PRES-01** (P2, FR-P1): 에디터에서 전체화면 프레젠테이션 모드로 진입할 수 있다
- [ ] **PRES-02** (P2, FR-P2): TOC 목차 클릭·키보드(←/→, PgUp/PgDn)로 섹션을 이동할 수 있다

## v2 Requirements

(없음 — v1 범위가 REQUIREMENT 전체를 커버. 향후 마일스톤에서 추가)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 실시간 동시 편집(CRDT/OT) | seq 가드 last-write-wins 모델과 구조적 충돌, REQUIREMENT §7 명시 제외 |
| 댓글·버전 히스토리 | REQUIREMENT §7 명시 제외. 출시 후 요청 1순위 예상 항목으로만 기록 (FEATURES.md) |
| 위키 링크·외부 공개 링크·알림·감사 로그 | REQUIREMENT §7 명시 제외 |
| footnote 등 3종 외 GFM 문법 | 파싱 범위는 CommonMark + 취소선·태스크·표만 (PRD §1) |
| 다중 세션 충돌 병합 | last-write-wins 확정 (PRD §6) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| WS-01 | Phase 1 | Complete |
| WS-02 | Phase 1 | Complete |
| EDIT-01 | Phase 2 | Complete |
| EDIT-02 | Phase 2 | Complete |
| EDIT-03 | Phase 2 | Complete |
| EDIT-04 | Phase 2 | Complete |
| EDIT-05 | Phase 2 | Complete |
| EDIT-06 | Phase 2 | Complete |
| EDIT-08 | Phase 2 | Complete |
| TREE-01 | Phase 3 | Complete |
| TREE-02 | Phase 3 | Complete |
| TREE-03 | Phase 3 | Complete |
| DOC-01 | Phase 4 | Complete |
| DOC-02 | Phase 4 | Complete |
| EDIT-07 | Phase 4 | Complete |
| EDIT-09 | Phase 5 | Pending |
| EDIT-10 | Phase 5 | Pending |
| EDIT-11 | Phase 5 | Pending |
| EDIT-12 | Phase 5 | Pending |
| DOC-03 | Phase 6 | Pending |
| DOC-04 | Phase 6 | Pending |
| EXP-01 | Phase 6 | Pending |
| EXP-02 | Phase 6 | Pending |
| WS-03 | Phase 7 | Pending |
| WS-04 | Phase 7 | Pending |
| WS-05 | Phase 7 | Pending |
| PRES-01 | Phase 8 | Pending |
| PRES-02 | Phase 8 | Pending |
| AUTH-04 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-08-01*
*Last updated: 2026-08-01 after roadmap creation (8 phases, 100% coverage)*
