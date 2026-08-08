# Phase 4: Documents, Autosave & 3-Pane Workspace - Research

**Researched:** 2026-08-08
**Domain:** Next.js 15 App Router 라우트 리팩터(레이아웃 분리) + 문서 CRUD/소프트삭제/휴지통 cascade + 클라이언트 자동저장(디바운스+seq 가드)
**Confidence:** MEDIUM — TRD §7/§3/§4가 프로토콜과 스키마를 이미 확정해 둔 만큼 "무엇을" 부분은 HIGH급이지만, "어떻게"에 해당하는 구현 세부(휴지통 cascade 알고리즘, 기존 활성-전용 헬퍼의 재사용 한계)는 리포지토리 코드를 직접 읽어 도출한 추론이 섞여 있어 전체를 MEDIUM으로 표기한다. 세부 근거는 각 절의 태그를 참조.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**3분할 + 문서 라이프사이클**
- 레이아웃: 고정 3분할 — 사이드바 260px + 에디터|미리보기 1:1 + 하단 저장 상태 바. 리사이즈 핸들은 Phase 5(layout switching)로 미룸.
- 문서 열기: URL 라우트 `w/[wsId]/d/[docId]`. `w/[wsId]/layout.tsx`가 사이드바를 공유하고, `d/[docId]/page.tsx`(RSC)가 문서를 로드해 에디터에 적재 → 딥링크·새로고침 복원. (클라 상태-only는 새로고침 소실이라 배제.)
- 새 문서 생성: 폴더 컨텍스트 메뉴 "새 문서" + 루트 헤더 버튼(폴더 생성과 대칭). 생성된 문서는 트리에 문서 노드로 표시(folder_id 기준, NULL=루트 직속).
- 제목 편집: 에디터 상단 제목 입력(`document.title`). 자동저장 payload에 title 포함.

**자동저장 + 상태바 (TRD §7 — 확정, 재논의 아님)**
- 1초 디바운스 → `PUT /api/documents/:id { content, title, seq }`. `seq`는 에디터 세션 단조증가 정수.
- 서버: `UPDATE document SET content=:c, title=:t, saved_seq=:seq, updated_at=now() WHERE id=:id AND saved_seq < :seq`. 옛 요청은 `saved_seq < seq` 거짓 → 취소 없이 자연 무시(NFR-1.2).
- 클라: in-flight 요청 추적, **최신 전송 seq에 매칭되는 응답에만** "저장됨" 표시 — 역순(stale) 응답은 무시하고 새 상태를 덮지 않는다.
- 상태바 전이: `저장 중` → 2xx `저장됨` / 실패 `저장 실패` + 재시도 버튼(재시도는 현재 내용으로 **새 seq** 발급).
- 문서 열람 시 클라 seq는 서버 `saved_seq`부터 시작한다. 다중 세션 last-write-wins(PRD §6).

**휴지통**
- 진입: 라우트 `w/[wsId]/trash` (사이드바 하단 "휴지통" 링크).
- 노출: `is_trash_root=true`만(직접 삭제 항목), 폴더·문서 혼합(PRD §2-2).
- 복원: cascade(하위 함께), 원 폴더가 삭제 상태면 워크스페이스 루트로 복원 + UI 안내(PRD §2-3). EDITOR+.
- 완전삭제: ADMIN+ 전용, 확인 다이얼로그, document/folder 행 + closure 행 hard delete(비가역, PRD §3).

**문서 소프트삭제**
- 문서 소프트삭제: `is_deleted=true, deleted_at=now(), is_trash_root=true`. EDITOR+. 폴더 cascade 삭제 시 하위 문서도 소프트삭제되지만 trash_root는 삭제 대상에만(Phase 3 softDeleteFolder 확장 — 이제 document 테이블이 존재하므로 문서까지 cascade).

### Claude's Discretion
- 자동저장 클라 훅 구조(디바운스·in-flight·seq 카운터), 상태바 컴포넌트, 라우트 파일 배치, `EditorPreviewLayout`를 documentId-aware로 확장 vs 새 `DocumentWorkspace` 컴포넌트 — 코드베이스 관례(CSS Modules·ui-kit·zod·requireRole·DbClient 패턴) 따라 재량.

### Deferred Ideas (OUT OF SCOPE)
- 임시저장/크래시 복구 draft(document_draft, FR-E10) → Phase 5.
- 이미지 업로드·툴바 폴리시·테마/레이아웃 전환·패널 리사이즈 → Phase 5.
- 태그·검색·export(document_tag) → Phase 6.
- Phase 3 defer된 DnD 시각 2건은 이 phase와 무관(끝에 UAT).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| DOC-01 | 문서 생성·수정·삭제가 동작하고, 삭제는 소프트 삭제로 즉시 휴지통에 나타난다 | Architecture Patterns Pattern 3/4, Code Examples "문서 CRUD", Common Pitfalls #4/#6(IDOR·FK 순서) |
| DOC-02 | 휴지통에서 복원(cascade, 원위치 또는 루트)과 완전 삭제(ADMIN 이상)가 동작한다 | Architecture Patterns Pattern 5, Code Examples "복원/완전삭제", Common Pitfalls #3/#5/#6, Open Questions #2 |
| EDIT-07 | 입력 중단 1초 후 자동 저장되고 상태 바가 저장 중→저장됨/실패(재시도)로 전환된다. seq 가드로 역순 도착이 무시되고, 상태 바는 마지막 발신 seq의 응답일 때만 "저장됨"을 표시한다 | Architecture Patterns Pattern 1/2, Code Examples "useAutosave", Common Pitfalls #1/#2, Validation Architecture |
</phase_requirements>

---

## Summary

이 phase는 두 개의 독립적인 정확성 문제를 하나의 3분할 화면 위에서 조립한다. 하나는 **클라이언트 자동저장의 순서 보장**(EDIT-07)이고, 다른 하나는 **폴더-문서 혼합 트리의 소프트삭제/복원/완전삭제 cascade**(DOC-01/02)다. 둘 다 TRD §3·§4·§7이 스키마와 프로토콜을 이미 확정해 뒀으므로 이 리서치의 임무는 "무엇을 만들지"가 아니라 "기존 `src/lib/closure.ts`·`src/lib/rbac.ts`·`src/components/tree/*` 코드와 충돌 없이 어떻게 이어붙일지"를 구체화하는 것이다.

가장 중요한 발견은 두 가지다. 첫째, `getSubtree`와 `resolveActiveWorkspaceId`(둘 다 `src/lib/closure.ts`에 이미 존재)는 **활성(`is_deleted=false`) 행만 반환하도록 설계돼 있다** — 휴지통 복원·완전삭제 라우트는 정확히 그 반대(`is_deleted=true`인 행)를 다뤄야 하므로 이 두 헬퍼를 그대로 재사용할 수 없고, "비활성 허용" 버전을 별도로 추가해야 한다. 둘째, TRD §3 DDL에서 `document.folder_id`는 `ON DELETE CASCADE`가 **없다**(`folder.id`를 참조하는 일반 FK, 기본 `NO ACTION`) — 완전삭제 시 folder 행보다 document 행을 먼저 지우지 않으면 FK 위반으로 트랜잭션이 실패한다. 두 사실 모두 이번 세션에 해당 파일을 직접 읽어 확인했다(아래 각 절에 파일·줄 인용).

자동저장 쪽은 NFR-1.2("이전 저장 요청을 취소하지 않고")가 이미 AbortController 기반 취소 패턴을 명시적으로 배제하고 있다는 점이 웹서치로 흔히 추천되는 "표준" 패턴과 충돌한다 — 이 리서치는 AbortController를 쓰지 말라고 명시적으로 경고한다.

**Primary recommendation:** 클라이언트는 `seq` ref 비교(≤30줄, 신규 의존성 없음)로 stale 응답을 걸러내고, 서버는 `UPDATE ... WHERE saved_seq < :seq RETURNING id`의 결과 배열 길이로 반영 여부를 판단한다. 휴지통 cascade는 `closure.ts`의 기존 `moveFolder`(복원-루트 재배치)를 재사용하고, `getSubtree`/`resolveActiveWorkspaceId`를 휴지통 라우트에 그대로 쓰지 않는다 — 대신 "비활성 허용" 버전을 새로 추가한다.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 자동저장 디바운스·seq 카운터·상태바 전이 판정 | Browser / Client | — | 순수 UI 상태 로직(useAutosave 훅) — 서버 응답을 "보여줄지" 판단만 함, 저장 자체의 정확성은 서버가 보장 |
| 자동저장 seq 가드(`saved_seq < seq`) | API / Backend | Database / Storage | WHERE 절이 곧 동시성 제어 — 애플리케이션 코드가 아니라 SQL 문 자체가 정확성의 최종 관문 |
| 3분할 라우트 조립(`layout.tsx`+`d/[docId]/page.tsx`+`trash/page.tsx`) | Frontend Server (SSR/RSC) | — | Next.js App Router의 서버 컴포넌트가 세션 검증 후 초기 데이터를 적재 — 클라 로딩 스피너 불필요(Phase 1/3 패턴 승계) |
| 문서 CRUD·소프트삭제·휴지통 cascade(복원/완전삭제) | API / Backend | Database / Storage | `requireRole` 서버 전용 검증 + Drizzle 트랜잭션이 정확성 소유. UI는 결과를 반영할 뿐 검증하지 않는다(CLAUDE.md 불변식) |
| 문서 트리 노드 렌더링·"현재 열람 중" 표시 | Browser / Client | — | 기존 `FolderTree`/`FolderTreeNode`(client component) 확장 — 서버는 평면 목록만 내려주고 트리 조립은 클라이언트 `tree-utils.ts` |
| 권한 게이팅(비활성 버튼+안내 문구) | Browser / Client | API / Backend(최종 검증) | UI-SPEC이 명시: 숨김이 아니라 disabled+설명 — 그러나 서버 `requireRole`이 유일한 진짜 경계(NFR-3.2) |

---

## Standard Stack

이 phase는 **신규 npm 패키지를 설치하지 않는다.** 기존 스택(Next.js 15 App Router, Drizzle ORM, zod, CodeMirror 6 — 변경 없음, lucide-react)만으로 요구 범위를 전부 덮는다. 자동저장 디바운스는 `lodash.debounce`류 의존성 없이 `setTimeout`/`useRef` 직접 관리로 충분하다(Don't Hand-Roll 참조).

### Core (기존 의존성 재확인 — 버전 변경 없음)
| Library | Version(설치됨) | 레지스트리 최신 | Purpose | 확인 방법 |
|---------|------|------|---------|-----------|
| next | 15.5.22 | 16.3.0 (더 최신 존재하나 이 phase는 15.x 고정 유지 — TRD §1 잠금, 업그레이드는 범위 밖) | App Router 라우트/레이아웃 | `npm view next version` [VERIFIED: npm registry] |
| drizzle-orm | 0.45.2 | 0.45.2(일치) | document 테이블·UPDATE/트랜잭션 | `npm view drizzle-orm version` [VERIFIED: npm registry] |
| zod | 4.4.3 | 이미 설치된 최신급, 프로젝트 전역 재확인 불필요 | PUT body(`content`/`title`/`seq`) 검증 | 기존 `src/lib/validation.ts` 패턴 재사용 [VERIFIED: src/lib/validation.ts:1-49] |
| vitest | 4.1.10 | 4.1.10(일치) | 자동저장 훅·seq-가드 유닛/통합 테스트 | `npm view vitest version` [VERIFIED: npm registry] |
| lucide-react | 설치됨(package.json) | — | `FileText`/`FilePlus2`/`Check`/`AlertCircle`/`Trash2`/`Info` 아이콘(UI-SPEC 지정) | 이미 설치, 추가 설치 불필요 |

### Supporting
없음 — 이 phase가 새로 요구하는 기능(디바운스, 조건부 UPDATE, 트랜잭션, RSC 데이터 로딩)은 전부 기존 스택의 표준 API로 해결된다.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 수제 `setTimeout` 디바운스(≤10줄) | `lodash.debounce` 또는 `use-debounce` 패키지 신설 | 이 정도 로직에 패키지를 추가하는 것은 과설계(ponytail 6단: one line) — 신규 의존성 감사 부담만 늘어난다 |
| seq ref 비교로 stale 응답 무시 | `AbortController`로 이전 요청 취소 | **금지** — NFR-1.2가 "이전 저장 요청을 취소하지 않고"를 명시. AbortController는 이 phase의 잠긴 요구사항과 정면 충돌([VERIFIED: docs/TRD.md:210-220] 인용은 Common Pitfalls #1 참조) |
| Drizzle `.returning()` 배열 길이로 affected-rows 판정 | postgres-js 원시 결과의 `count` 속성 직접 참조 | `.returning()`이 드라이버 독립적이고 공식 문서에 명시된 패턴(WebSearch로 확인, [CITED: orm.drizzle.team/docs/update]) — `count`/`rowCount` 이름이 드라이버마다 달라 신뢰도가 낮다 |

**Installation:** 불필요 — 신규 패키지 없음.

**버전 검증 근거:** `npm view <pkg> version`을 이번 세션에 직접 실행해 next/drizzle-orm/vitest 버전을 레지스트리와 대조했다(위 표 참조).

---

## Package Legitimacy Audit

**이 phase는 외부 패키지를 설치하지 않는다 — Package Legitimacy Gate 적용 대상 없음.**

**Packages removed due to [SLOP] verdict:** 없음
**Packages flagged as suspicious [SUS]:** 없음

---

## Architecture Patterns

### System Architecture Diagram

```
[EditorHost onChange] ──content──┐
[TitleInput onChange] ──title────┼──> [DocumentWorkspace 상태]
                                  │
                                  ▼ (값 변경마다 재호출, 1s 디바운스)
                         useAutosave(docId, initialSeq).scheduleSave(content, title)
                                  │
                         setTimeout 1000ms 이후에만 실제 전송
                                  ▼
                    seqRef.current += 1  ;  latestSentSeqRef.current = seq
                                  │
                    PUT /api/documents/:id  { content, title, seq }
                                  ▼
        requireRole(workspaceId, "EDITOR")  ── 실패 시 403, 함수 종료
                                  │
        putBodySchema.safeParse(body)       ── 실패 시 400
                                  ▼
   UPDATE document SET content=:c, title=:t, saved_seq=:seq, updated_at=now()
   WHERE id=:id AND saved_seq < :seq
   RETURNING id                                  ← Postgres가 유일한 동시성 심판
                                  │
        rows.length===1 → 최신 요청이 반영됨 (구요청이면 자연스럽게 0행)
                                  ▼
                    Response 200 { seq }  (0행이어도 200 — 에러 아님)
                                  │
                                  ▼ (클라이언트로 되돌아옴, 도착 순서는 네트워크가 결정 — 역순 가능)
        if (응답의 seq !== latestSentSeqRef.current) → 조용히 폐기(상태 변경 없음)
        else → setStatus(res.ok ? "저장됨" : "저장 실패")
```

문서 CRUD·휴지통 데이터 흐름:

```
w/[wsId]/layout.tsx (RSC)
   requireRole(wsId, "VIEWER") → notFound()
   getWorkspaceFolders(wsId) + getWorkspaceDocuments(wsId)  ── 2개의 평면 쿼리(TREE-02 analog)
   ──> <FolderTree folders documents>  (client, 트리 조립은 클라 tree-utils.ts)
        │
        ├─ children: w/[wsId]/page.tsx        → 빈 상태만
        ├─ children: w/[wsId]/d/[docId]/page.tsx (RSC)
        │      requireRole(wsId,"VIEWER") + getDocument(docId, wsId) IDOR 가드
        │      ──> <DocumentWorkspace initialContent initialTitle initialSeq>
        └─ children: w/[wsId]/trash/page.tsx (RSC)
               requireRole(wsId,"VIEWER") + getTrashItems(wsId)  (folder ∪ document, is_trash_root=true)
               ──> <TrashList> ─(복원 클릭)→ POST /api/trash/:type/:id/restore (EDITOR+)
                              └─(완전삭제 클릭)→ DELETE /api/trash/:type/:id (ADMIN+)
```

### Recommended Project Structure

```
src/
├── app/(main)/w/[wsId]/
│   ├── layout.tsx                # 신설: page.tsx에서 사이드바 렌더링을 이관
│   ├── page.tsx                  # 축소: 빈 상태 플레이스홀더만
│   ├── d/[docId]/page.tsx        # 신설: 문서 로드 RSC
│   └── trash/page.tsx            # 신설: 휴지통 뷰 RSC
├── app/api/documents/
│   ├── route.ts                  # 신설: POST 생성 (folders/route.ts와 동형)
│   └── [id]/route.ts             # 신설: PUT 자동저장(§7), DELETE 소프트삭제
├── app/api/trash/[type]/[id]/
│   ├── restore/route.ts          # 신설: POST 복원 (TRD §8 잠금 경로)
│   └── route.ts                  # 신설: DELETE 완전삭제 (ADMIN)
├── components/document/
│   ├── DocumentWorkspace.tsx     # 신설: 제목입력+본문(EditorPreviewLayout 래핑)+상태바 3단
│   ├── SaveStatusBar.tsx         # 신설
│   ├── useAutosave.ts            # 신설: 디바운스+seq 훅
│   └── EmptyState.tsx            # 신설
├── components/trash/
│   ├── TrashList.tsx             # 신설
│   └── RestoreRootBanner.tsx     # 신설: 복원-루트 안내 배너
├── lib/documents.ts               # 신설: createDocument/getDocument/softDeleteDocument/
│                                   #        restoreDocument/permanentlyDeleteDocument/
│                                   #        resolveWorkspaceIdForDocument
├── lib/closure.ts                 # 확장: softDeleteFolder에 document cascade 추가,
│                                   #        restoreFolder/permanentlyDeleteFolder/
│                                   #        resolveWorkspaceIdForTrashItem 신설
├── db/schema.ts                   # 확장: document 테이블 추가(TRD §3 DDL 그대로)
└── components/tree/
    ├── FolderTree.tsx             # 확장: documents prop 추가, "새 문서" 헤더 버튼
    ├── FolderTreeNode.tsx         # 확장: documentsByFolderId를 ctx에 추가(문서 리프 렌더)
    └── DocumentTreeLeaf.tsx       # 신설: 문서 리프 노드(체브론 없음, draggable 없음)
```

### Pattern 1: useAutosave 훅 — 디바운스 + seq 비교로 stale 응답 폐기

**What:** 1초 디바운스 후 PUT 전송, 응답이 최신 발신 seq와 일치할 때만 상태바를 갱신하는 클라이언트 훅.
**When to use:** `DocumentWorkspace`가 `EditorHost.onChange`/제목 `<input>.onChange` 둘 다에서 호출.
**Example:**
```typescript
// src/components/document/useAutosave.ts — Claude's Discretion (04-CONTEXT.md), 신규 의존성 없음
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type SaveStatus = "saved" | "saving" | "error";

export function useAutosave(docId: string, initialSeq: number) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const seqRef = useRef(initialSeq);
  const latestSentSeqRef = useRef(initialSeq);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ content: string; title: string } | null>(null);

  // 문서 전환 시 모든 ref를 리셋 — 이전 문서의 타이머/seq가 새 docId에 발사되면 안 된다
  // (Common Pitfalls #2).
  useEffect(() => {
    seqRef.current = initialSeq;
    latestSentSeqRef.current = initialSeq;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("saved");
  }, [docId, initialSeq]);

  const send = useCallback(
    async (content: string, title: string) => {
      const seq = ++seqRef.current;
      latestSentSeqRef.current = seq;
      setStatus("saving");
      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content, title, seq }),
        });
        // NFR-1.2: 요청을 취소하지 않는다 — 응답이 늦게 와도 여기까지는 항상 실행된다.
        // "최신 발신 seq와 일치하는 응답에만" 반영 — 그 외는 조용히 폐기.
        if (seq !== latestSentSeqRef.current) return;
        setStatus(res.ok ? "saved" : "error");
      } catch {
        if (seq !== latestSentSeqRef.current) return;
        setStatus("error");
      }
    },
    [docId],
  );

  const scheduleSave = useCallback(
    (content: string, title: string) => {
      pendingRef.current = { content, title };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (pendingRef.current) void send(pendingRef.current.content, pendingRef.current.title);
      }, 1000);
    },
    [send],
  );

  // 언마운트 시 타이머 정리(Common Pitfalls #2) — 진행 중인 fetch 자체는 취소하지 않는다.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, [docId]);

  const retry = useCallback(() => {
    if (pendingRef.current) void send(pendingRef.current.content, pendingRef.current.title);
  }, [send]);

  return { status, scheduleSave, retry };
}
```
근거: 디바운스+in-flight-seq-비교 패턴 자체는 일반 웹서치로 확인한 널리 쓰이는 관용구다 [ASSUMED — 공식 문서가 아닌 일반 패턴, Assumptions Log A1]. NFR-1.2 "취소 없이" 제약은 TRD §7 원문에서 직접 확인했다 [VERIFIED: docs/TRD.md:216-219 — "옛 요청이 늦게 도착하면 `saved_seq < seq`가 거짓이라 자연 무시 — 취소 없이(NFR-1.2) 순서가 보장된다."].

### Pattern 2: 서버 seq 가드 — `.returning()` 배열 길이로 반영 여부 판정

**What:** `WHERE saved_seq < :seq`가 실제 동시성 심판이고, 애플리케이션 코드는 결과만 확인한다.
**When to use:** `PUT /api/documents/[id]/route.ts`.
**Example:**
```typescript
// src/app/api/documents/[id]/route.ts
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { document } from "@/db/schema";
import { resolveWorkspaceIdForDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

const putBodySchema = z.object({
  content: z.string(),
  title: z.string().trim().max(255).catch("제목 없음"), // TRD §3 컬럼 기본값과 동형 — 상한 255는 ASSUMED(Assumptions Log A2)
  seq: z.number().int().nonnegative(),
});

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // resolveWorkspaceIdForDocument는 "활성" 문서만 반환(휴지통에 있는 문서로의 저장 시도는
  // 404/403과 동일하게 거부돼야 하므로 — resolveActiveWorkspaceId와 동일 관례).
  const target = await resolveWorkspaceIdForDocument(id);
  if (!target) return forbiddenResponse();

  try {
    await requireRole(target.workspaceId, "EDITOR");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const parsed = putBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
  }
  const { content, title, seq } = parsed.data;

  await db
    .update(document)
    .set({ content, title, savedSeq: seq, updatedAt: new Date() })
    .where(and(eq(document.id, id), lt(document.savedSeq, seq)))
    .returning({ id: document.id });
  // affected 0행은 에러가 아니라 seq 가드가 정상 동작한 것(TRD §7) — 클라이언트의
  // 상태바 갱신 여부는 이 응답의 성공/실패가 아니라 훅의 seq 비교가 최종 결정한다.

  return Response.json({ seq }, { status: 200 });
}
```
근거: `.returning()`으로 affected rows를 판정하는 방식은 Drizzle 공식 문서 패턴이다 [CITED: orm.drizzle.team/docs/update — WebSearch로 확인, MEDIUM confidence]. `document` 스키마 필드명(`savedSeq`)은 TRD §3 DDL의 `saved_seq bigint NOT NULL DEFAULT 0` [VERIFIED: docs/TRD.md:100]을 Drizzle 관례(`src/db/schema.ts`의 camelCase 컬럼명 패턴, 예: `isTrashRoot`/`deletedAt`)로 옮긴 이름이다.

### Pattern 3: `w/[wsId]/page.tsx` → `layout.tsx` + `d/[docId]/page.tsx` 분리

**What:** 현재 `page.tsx`(`src/app/(main)/w/[wsId]/page.tsx`)가 갖고 있는 사이드바+`requireRole`+`notFound` 로직을 `layout.tsx`로 옮기고, `page.tsx`는 빈 상태만 렌더한다.
**When to use:** 이 phase의 라우트 리팩터 첫 태스크.
**Example:**
```typescript
// src/app/(main)/w/[wsId]/layout.tsx — 기존 page.tsx의 requireRole/notFound/getWorkspaceFolders를 그대로 이관
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { getWorkspaceFolders } from "@/lib/closure";
import { getWorkspaceDocuments } from "@/lib/documents";
import { FolderTree } from "@/components/tree/FolderTree";
import styles from "./layout.module.css"; // 기존 page.module.css의 .page 규칙을 그대로 이관

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ wsId: string }>;
}) {
  const { wsId } = await params;
  try {
    await requireRole(wsId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }
  const [ws] = await db.select({ name: workspace.name }).from(workspace).where(eq(workspace.id, wsId));
  if (!ws) notFound();

  const [folders, documents] = await Promise.all([
    getWorkspaceFolders(wsId),
    getWorkspaceDocuments(wsId), // TREE-02와 동일한 flat 쿼리 패턴(§4 analog)
  ]);

  return (
    <div className={styles.page}>
      <FolderTree folders={folders} documents={documents} workspaceId={wsId} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
```
```typescript
// src/app/(main)/w/[wsId]/d/[docId]/page.tsx — 신설
import { notFound } from "next/navigation";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { getDocument } from "@/lib/documents";
import { DocumentWorkspace } from "@/components/document/DocumentWorkspace";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ wsId: string; docId: string }>;
}) {
  const { wsId, docId } = await params;
  try {
    await requireRole(wsId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }
  // getDocument는 workspaceId까지 함께 필터해야 한다(Common Pitfalls #6, IDOR) — docId만으로
  // 조회하면 다른 워크스페이스의 문서를 wsId 멤버가 열람할 수 있다.
  const doc = await getDocument(docId, wsId);
  if (!doc) notFound();

  return (
    <DocumentWorkspace
      docId={doc.id}
      initialTitle={doc.title}
      initialContent={doc.content}
      initialSeq={doc.savedSeq}
    />
  );
}
```
근거: 기존 `page.tsx`의 `requireRole`+`notFound` 패턴을 그대로 읽어 확인했다 [VERIFIED: src/app/(main)/w/[wsId]/page.tsx:23-35]. `params`가 `Promise<{...}>`이고 `await`로 풀어야 한다는 것도 같은 파일과 `src/app/api/folders/[id]/route.ts:13`에서 이미 쓰이는 이 코드베이스의 확립된 관례다.

**Anti-pattern 경고:** `d/[docId]/page.tsx`가 자기 자신의 `/api/documents/:id` 라우트를 `fetch`로 호출하지 않는다 — 기존 `page.tsx`가 `getWorkspaceFolders`를 직접 호출하듯(HTTP 라운드트립 없음, [VERIFIED: src/app/(main)/w/[wsId]/page.tsx:36]) `lib/documents.ts`의 함수를 RSC에서 직접 호출한다. `PUT /api/documents/:id`(TRD §8 API 표에 있는 GET 엔드포인트)는 외부 API 소비자용이지 자체 RSC용이 아니다.

### Pattern 4: `softDeleteFolder`에 문서 cascade 추가

**What:** 이미 존재하는 `softDeleteFolder`(`src/lib/closure.ts:144-155`)에 document UPDATE 한 줄을 같은 트랜잭션 안에 추가.
**When to use:** 폴더 삭제 시 하위 문서까지 소프트삭제(04-CONTEXT.md 잠금).
**Example:**
```typescript
// src/lib/closure.ts — 기존 softDeleteFolder 확장(파일 129~137행 주석이 이미 이 확장을 예고함)
import { document } from "@/db/schema";

export async function softDeleteFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    const [target] = await tx.select({ isDeleted: folder.isDeleted }).from(folder).where(eq(folder.id, folderId));
    if (!target || target.isDeleted) return;

    const subtree = await getSubtree(folderId, tx);
    const ids = subtree.map((f) => f.id);

    await tx.update(folder).set({ isDeleted: true, deletedAt: new Date() }).where(inArray(folder.id, ids));
    await tx.update(folder).set({ isTrashRoot: true }).where(eq(folder.id, folderId));

    // 신규: 서브트리 소속 문서 cascade. WR-01과 동일하게 "여전히 활성인" 문서만 대상으로
    // 한다 — 하위 폴더가 삭제되기 전에 그 안의 문서 하나가 독립적으로 이미 휴지통에
    // 있었다면(is_deleted=true) 그 문서의 is_trash_root는 건드리지 않는다.
    await tx
      .update(document)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(and(inArray(document.folderId, ids), eq(document.isDeleted, false)));
  });
}
```
근거: `softDeleteFolder`의 WR-01 idempotency 주석 [VERIFIED: src/lib/closure.ts:140-143 — "WR-01: idempotent on an already-deleted target... Bail out before touching any row."]과 129~137행의 명시적 예고 주석 [VERIFIED: src/lib/closure.ts:136-138 — "Phase 4 will extend this transaction with `document WHERE folder_id = ANY(ids)` once the document table exists"]을 그대로 따랐다.

### Pattern 5: 복원 — `moveFolder` 재사용으로 "루트 재배치" 중복 구현 방지

**What:** 원 폴더가 삭제 상태면 워크스페이스 루트로 복원(PRD §2-3) — 이 재배치는 기존 `moveFolder(folderId, null, tx)`가 이미 하는 일(closure 외부 링크 제거, `parent_id=NULL` 갱신)과 동일하다.
**When to use:** `restoreFolder`.
**Example:**
```typescript
// src/lib/closure.ts — 신설
export async function restoreFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    const [target] = await tx
      .select({ isTrashRoot: folder.isTrashRoot, parentId: folder.parentId })
      .from(folder)
      .where(eq(folder.id, folderId));
    if (!target || !target.isTrashRoot) return null; // 직접 삭제된 항목만 복원 가능(PRD §2-2)

    // getSubtree는 isDeleted=false만 반환하므로 여기선 쓸 수 없다(Common Pitfalls #3) —
    // closure를 직접 조인해 "현재 is_deleted=true인" 서브트리를 모은다.
    const subtree = await tx
      .select({ id: folder.id, isTrashRoot: folder.isTrashRoot })
      .from(folder)
      .innerJoin(folderClosure, eq(folderClosure.descendantId, folder.id))
      .where(and(eq(folderClosure.ancestorId, folderId), eq(folder.isDeleted, true)));

    // WR-01 대칭: 서브트리 안에 "독립적으로 트래시된" 항목(자기 자신 아닌 trash_root)은
    // 이 복원에 딸려오지 않는다 — 세부 규칙은 Open Questions #2 참조(확정 전 planner 재확인 권장).
    const restorableIds = subtree.filter((f) => f.id === folderId || !f.isTrashRoot).map((f) => f.id);

    await tx.update(folder).set({ isDeleted: false, deletedAt: null }).where(inArray(folder.id, restorableIds));
    await tx.update(folder).set({ isTrashRoot: false }).where(eq(folder.id, folderId));
    await tx
      .update(document)
      .set({ isDeleted: false, deletedAt: null })
      .where(and(inArray(document.folderId, restorableIds), eq(document.isTrashRoot, false)));

    if (target.parentId) {
      const [parent] = await tx.select({ isDeleted: folder.isDeleted }).from(folder).where(eq(folder.id, target.parentId));
      if (!parent || parent.isDeleted) {
        // 기존 moveFolder를 그대로 재사용 — closure 재작성을 두 번째로 구현하지 않는다
        // (Don't Hand-Roll). newParentId=null이므로 사이클/워크스페이스 검사는 건너뛴다.
        await moveFolder(folderId, null, tx);
        return { relocatedToRoot: true };
      }
    }
    return { relocatedToRoot: false };
  });
}
```
근거: `moveFolder`가 `newParentId=null`일 때 사이클 검사 블록을 건너뛰고 외부 closure 링크만 제거한다는 것은 이번 세션에 직접 읽어 확인했다 [VERIFIED: src/lib/closure.ts:89-131 — `if (newParentId) { ... }`로 감싼 사이클 검사·`INSERT` 블록, DELETE는 무조건 실행]. TRD §4의 "복원 위치의 부모가 삭제 상태면 parent_id = NULL(루트)로 옮기고 closure를 재작성한다"는 [VERIFIED: docs/TRD.md:164]에서 확인했다.

### Anti-Patterns to Avoid
- **AbortController로 이전 저장 요청 취소:** NFR-1.2 위반(위 참조). "표준" 웹 패턴이라고 그대로 가져오면 안 된다.
- **RSC가 자기 API 라우트를 `fetch`로 호출:** 불필요한 네트워크 왕복. 항상 `lib/*.ts` 함수를 직접 호출(Pattern 3 참조).
- **`buildTree`(tree-utils.ts)를 문서까지 다루도록 제네릭화:** 이미 폴더 전용으로 테스트된 유틸(`tests/folder/schema.test.ts` 등)을 건드리는 대신, `FolderTreeNode`의 ctx에 `documentsByFolderId: Map<string|null, DocumentRow[]>`를 별도로 전달한다.
- **`getSubtree`/`resolveActiveWorkspaceId`를 휴지통 라우트에 그대로 재사용:** 둘 다 `is_deleted=false` 필터가 박혀 있어(Common Pitfalls #3) 휴지통(비활성 행)에 쓰면 항상 빈 결과 또는 403이 나온다.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| 클라이언트 저장 순서 보장 | 커스텀 요청 취소/재시도 큐 | seq ref 비교(≤15줄) + 서버 `WHERE saved_seq < seq`(TRD §7, 이미 잠김) | NFR-1.2가 "취소 없는" 순서 보장을 명시 — 취소 기반 라이브러리는 요구사항 위반이자 과설계 |
| 디바운스 | `lodash.debounce`/`use-debounce` 신규 설치 | `setTimeout` ref 직접 관리 | ponytail 6단(one line) — 이 정도 로직에 의존성 하나를 더할 이유가 없다 |
| 복원 시 "부모가 삭제 상태면 루트로" 재배치 | `moveFolder`와 별개의 두 번째 closure 재작성 구현 | 기존 `moveFolder(folderId, null, tx)` 재사용(Pattern 5) | TRD §4가 이미 정의한 연산과 동일 — 두 번째 구현은 정합성 버그의 씨앗이 된다 |
| 트리에 문서 병합 | `tree-utils.ts`의 `buildTree` 제네릭화 | `FolderTreeNode` ctx에 `documentsByFolderId` Map을 별도 전달 | 이미 검증된 유틸을 건드리는 불필요한 리스크 |
| 활성/비활성 행 조회 분기 | 매 신규 라우트마다 조건부 필터 인라인 반복 | `resolveActiveWorkspaceId`를 본뜬 `resolveWorkspaceIdForTrashItem`(비활성 허용) 하나만 추가 | 새 라우트마다 필터를 베끼면 하나만 놓쳐도 IDOR가 열린다(Common Pitfalls #6) |

**Key insight:** 이 phase의 위험은 "새 알고리즘을 잘못 짜는 것"이 아니라 "이미 검증된 기존 헬퍼(`getSubtree`/`resolveActiveWorkspaceId`/`moveFolder`)를 전제가 다른 곳(비활성 행, 휴지통)에 그대로 재사용해 조용히 틀리는 것"이다. 신규 로직은 최소화하고, 기존 함수의 전제(활성 행만 반환)를 명시적으로 우회하는 지점만 새로 만든다.

---

## Common Pitfalls

### Pitfall 1: AbortController로 자동저장을 "취소"하면 NFR-1.2 위반
**What goes wrong:** 웹서치에서 흔히 추천되는 패턴(useEffect cleanup에서 `AbortController.abort()`)을 그대로 적용하면 이전 저장 요청이 실제로 취소된다.
**Why it happens:** React 데이터 페칭 자료 대부분이 "최신 요청만 유효" 문제를 취소로 해결한다 — 하지만 이 phase는 "취소하지 않고 무시"라는 다른 요구사항을 갖고 있다.
**How to avoid:** seq ref 비교로만 stale 응답을 걸러낸다. `fetch`에 `signal`을 넘기지 않는다.
**Warning signs:** 네트워크 탭에서 이전 PUT 요청이 `(cancelled)` 상태로 보이면 위반.

### Pitfall 2: 디바운스 타이머 + 문서 전환이 겹치면 옛 문서의 저장이 새 문서에 발사
**What goes wrong:** `d/[docId]`를 이동할 때 이전 문서의 `setTimeout`이 아직 대기 중이면, 타이머가 발사되는 시점엔 `docId`/`seqRef`가 이미 새 문서 것으로 바뀌어 있어 잘못된 문서에 PUT이 나갈 수 있다.
**Why it happens:** `useAutosave`의 ref들이 `docId`가 바뀌어도 자동으로 리셋되지 않으면 이전 클로저가 살아남는다.
**How to avoid:** Pattern 1처럼 `docId`를 의존성으로 하는 `useEffect`에서 타이머를 `clearTimeout`하고 `seqRef`/`latestSentSeqRef`를 새 `initialSeq`로 리셋한다.
**Warning signs:** 문서 A에서 입력 후 1초 내로 문서 B로 이동하면 B에 A의 마지막 입력이 저장됨.

### Pitfall 3: `getSubtree`/`resolveActiveWorkspaceId`는 활성 행 전제 — 휴지통 라우트에 재사용 불가
**What goes wrong:** 복원/완전삭제 라우트가 기존 헬퍼를 그대로 호출하면 대상이 이미 `is_deleted=true`이므로 항상 빈 결과나 403이 나온다.
**Why it happens:** 두 헬퍼 모두 `is_deleted=false` 필터가 쿼리에 박혀 있다.
```typescript
// [VERIFIED: src/lib/closure.ts:72-83]
export async function getSubtree(folderId: string, client: DbClient = db) {
  return client
    .select({ id: folder.id, parentId: folder.parentId, name: folder.name, workspaceId: folder.workspaceId })
    .from(folder)
    .innerJoin(folderClosure, eq(folderClosure.descendantId, folder.id))
    .where(and(eq(folderClosure.ancestorId, folderId), eq(folder.isDeleted, false)));
}
```
```typescript
// [VERIFIED: src/lib/closure.ts:35-41]
export async function resolveActiveWorkspaceId(folderId: string, client: DbClient = db) {
  const [row] = await client
    .select({ workspaceId: folder.workspaceId })
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.isDeleted, false)));
  return row ?? null;
}
```
**How to avoid:** 휴지통(복원/완전삭제) 라우트 전용으로 `is_deleted` 필터가 없는 새 헬퍼(`resolveWorkspaceIdForTrashItem`, Pattern 5의 인라인 closure join)를 추가한다. 이름에 "Active"가 없는 기존 함수가 있다면 그것부터 재사용을 시도할 것.
**Warning signs:** 복원 버튼을 눌렀는데 매번 403/404가 뜬다.

### Pitfall 4: `document.folder_id`에 `ON DELETE CASCADE`가 없다 — 완전삭제 순서를 틀리면 FK 위반
**What goes wrong:** 폴더를 완전삭제할 때 `folder` 행을 먼저 지우면 그 폴더를 참조하는 `document.folder_id` 값이 남아 있어 Postgres가 FK 제약 위반으로 트랜잭션을 롤백한다.
**Why it happens:** TRD §3 DDL을 그대로 읽으면 명확하다.
```sql
-- [VERIFIED: docs/TRD.md:96-97]
folder_id    uuid REFERENCES folder(id),   -- NULL = 워크스페이스 루트 직속
```
`ON DELETE CASCADE`가 없다 — 기본 동작은 `NO ACTION`(참조된 행이 있으면 삭제 거부). 반대로 `folder_closure`는 양쪽 다 `ON DELETE CASCADE`가 있어 folder 삭제 시 자동으로 정리된다:
```typescript
// [VERIFIED: src/db/schema.ts:79-84]
ancestorId: uuid("ancestor_id").notNull().references(() => folder.id, { onDelete: "cascade" }),
descendantId: uuid("descendant_id").notNull().references(() => folder.id, { onDelete: "cascade" }),
```
**How to avoid:** 완전삭제 트랜잭션에서 항상 **document 행을 먼저 DELETE**하고 그다음 folder 행을 DELETE한다(`folder_closure`는 수동 삭제 불필요 — cascade가 처리). Pattern은 Code Examples "완전삭제" 참조.
**Warning signs:** 완전삭제 API가 500과 함께 `violates foreign key constraint` 에러를 반환.

### Pitfall 5: 복원 cascade가 "독립적으로 이미 트래시된" 하위 항목을 잘못 되살릴 수 있다
**What goes wrong:** 폴더 A 아래 문서 X가 먼저 독립적으로 삭제됐고(A는 아직 활성), 그다음 A 전체가 삭제됐다가 다시 복원되는 시나리오에서, 순진하게 "서브트리 전체를 `is_deleted=false`로"만 하면 X도 함께 부활한다 — 사용자가 명시적으로 지운 문서가 의도치 않게 되살아난다.
**Why it happens:** `folder_closure`는 삭제 시점을 구분하지 않는 무방향 이력 링크라, "이 복원과 함께 삭제됐던 것"과 "그 전에 이미 따로 삭제됐던 것"을 closure만으로는 구별할 수 없다.
**How to avoid:** `softDeleteFolder`의 WR-01과 대칭으로, 복원 대상 서브트리에서 **자기 자신이 아니면서 `is_trash_root=true`인 행은 제외**한다(Pattern 5의 `restorableIds` 필터). 다만 이 규칙은 TRD/PRD에 명시된 문장이 아니라 기존 WR-01 로직에서 유추한 것이므로 확정 전 재확인이 필요하다(Open Questions #2).
**Warning signs:** 통합 테스트로 "폴더 삭제 전 하위 문서를 먼저 독립 삭제 → 폴더 삭제 → 폴더 복원 → 그 문서는 여전히 휴지통에 있어야 함"을 명시적으로 검증하지 않으면 조용히 재현되지 않는 회귀.

### Pitfall 6: 문서 라우트의 IDOR — `docId`만으로는 워크스페이스 경계를 보장하지 못한다
**What goes wrong:** `d/[docId]/page.tsx`가 `docId`만으로 문서를 조회하고 `wsId` 멤버십만 확인하면, 워크스페이스 A의 멤버가 URL의 `docId`를 워크스페이스 B의 문서 UUID로 바꿔 넣었을 때 B의 문서를 열람할 수 있다(A에 대한 `requireRole`은 통과하지만 그 문서는 B 소속).
**Why it happens:** `requireRole(wsId, "VIEWER")`는 "이 사용자가 wsId의 멤버인가"만 검증하고, "이 docId가 실제로 wsId 소속인가"는 별도로 확인해야 한다.
**How to avoid:** `getDocument(docId, wsId)`가 `WHERE id=:docId AND workspace_id=:wsId`로 스코프해야 한다(기존 폴더 라우트의 `resolveActiveWorkspaceId` 패턴, T-03-02-IDOR/T-03-04-IDOR 주석과 동일 원칙). 불일치 시 `notFound()`(403이 아니라 404 — 문서 존재 여부를 노출하지 않기 위해 기존 코드베이스가 이미 채택한 관례).
**Warning signs:** `getDocument`가 `workspace_id` 조건 없이 `WHERE id=:docId`만 쓴다.

### Pitfall 7: `tree-utils.ts`의 `buildTree`는 폴더 전용 — 문서 병합을 그 안에 넣으면 기존 테스트를 건드린다
**What goes wrong:** `FolderTreeNode`(폴더 리프)와 `DocumentTreeLeaf`(문서 리프)를 같은 `children` 배열에 섞어 넣으려고 `buildTree`의 타입을 확장하면, `isDescendantOrSelf`(DnD 사이클 체크)가 문서 노드까지 순회하게 돼 불필요한 분기가 생긴다.
**Why it happens:** `buildTree`/`isDescendantOrSelf`는 순수 폴더 트리 알고리즘으로 이미 작성·테스트돼 있다.
**How to avoid:** 문서는 `documentsByFolderId: Map<string | null, DocumentRow[]>`로 별도 전달하고, `FolderTreeNode`가 자기 `node.id`(또는 루트는 `null`)에 해당하는 문서 배열을 렌더 끝에 붙인다. `buildTree` 시그니처는 변경하지 않는다.
**Warning signs:** `tests/folder/schema.test.ts`류 기존 테스트가 새 필드 때문에 깨짐.

---

## Code Examples

### 문서 CRUD — `lib/documents.ts` 골격
```typescript
// src/lib/documents.ts — closure.ts의 DbClient 주입 패턴을 그대로 따른다
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { document, folder } from "@/db/schema";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getWorkspaceDocuments(workspaceId: string, client: DbClient = db) {
  return client
    .select({ id: document.id, folderId: document.folderId, title: document.title })
    .from(document)
    .where(and(eq(document.workspaceId, workspaceId), eq(document.isDeleted, false)));
}

// Common Pitfalls #6 — workspaceId까지 함께 스코프(IDOR 방지)
export async function getDocument(documentId: string, workspaceId: string, client: DbClient = db) {
  const [row] = await client
    .select()
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.workspaceId, workspaceId), eq(document.isDeleted, false)));
  return row ?? null;
}

// 저장 라우트가 재사용 — 활성 문서만(휴지통에 저장 시도는 거부)
export async function resolveWorkspaceIdForDocument(documentId: string, client: DbClient = db) {
  const [row] = await client
    .select({ workspaceId: document.workspaceId })
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.isDeleted, false)));
  return row ?? null;
}

export async function createDocument(
  workspaceId: string,
  folderId: string | null,
  title: string,
  client: DbClient = db,
) {
  const [created] = await client.insert(document).values({ workspaceId, folderId, title }).returning();
  return created;
}

export async function softDeleteDocument(documentId: string, client: DbClient = db) {
  await client
    .update(document)
    .set({ isDeleted: true, deletedAt: new Date(), isTrashRoot: true })
    .where(and(eq(document.id, documentId), eq(document.isDeleted, false)));
}
```

### 완전삭제 — FK 순서(Common Pitfalls #4) 준수
```typescript
// src/lib/closure.ts — 신설
import { folderClosure } from "@/db/schema";

export async function permanentlyDeleteFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    // getSubtree는 isDeleted=false만 반환 — 완전삭제 대상(is_deleted=true)에는 쓸 수 없다
    // (Common Pitfalls #3). closure를 직접 조인해 필터 없이 전체 서브트리를 모은다.
    const subtree = await tx
      .select({ id: folder.id })
      .from(folder)
      .innerJoin(folderClosure, eq(folderClosure.descendantId, folder.id))
      .where(eq(folderClosure.ancestorId, folderId));
    const ids = subtree.map((f) => f.id);

    // document.folder_id는 ON DELETE CASCADE가 없다 — folder보다 먼저 지운다(Pitfall 4).
    await tx.delete(document).where(inArray(document.folderId, ids));
    // folder_closure는 양쪽 다 ON DELETE CASCADE — folder 삭제로 자동 정리, 수동 DELETE 불필요.
    await tx.delete(folder).where(inArray(folder.id, ids));
  });
}

export async function permanentlyDeleteDocument(documentId: string, client: DbClient = db) {
  await client.delete(document).where(eq(document.id, documentId)); // 자식 없음, 단일 행
}
```

### Vitest — seq 역순 도착 시 affected rows 0 검증(TRD §10 명시 항목)
```typescript
// tests/documents/autosave-seq-guard.test.ts (서버 유닛, TRD §10 "저장 순서" 항목)
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { document } from "@/db/schema";

it("역순(stale) seq는 0행 영향 — 최신 내용을 덮지 않는다", async () => {
  // ... createTestDocument 등으로 saved_seq=5인 문서 준비
  const stale = await db
    .update(document)
    .set({ content: "옛 내용", savedSeq: 3, updatedAt: new Date() })
    .where(and(eq(document.id, docId), lt(document.savedSeq, 3)))
    .returning({ id: document.id });
  expect(stale).toHaveLength(0); // saved_seq(5) < 3 이 거짓이라 반영되지 않음

  const [row] = await db.select({ content: document.content }).from(document).where(eq(document.id, docId));
  expect(row.content).not.toBe("옛 내용"); // 최신 내용이 그대로 보존됨
});
```
근거: Vitest fake timer/async 흐름은 WebSearch로 확인한 공식-문서 인접 관용구다(`vi.advanceTimersByTimeAsync`가 마이크로태스크까지 함께 처리) [CITED: 일반 web — orm.drizzle.team/vitest 공식 문서 직접 열람은 아님, MEDIUM confidence].

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---------------|-------------------|---------------|--------|
| Next.js `params`를 동기 객체로 받음 | `params: Promise<{...}>`을 `await` | Next.js 15 (이미 이 코드베이스 전역에 적용됨) | 신규 라우트(`d/[docId]/page.tsx` 등)도 동일 관례 — 기존 `page.tsx`/`route.ts`가 이미 이 패턴을 쓰고 있어 새로 조사할 것 없음 [VERIFIED: src/app/(main)/w/[wsId]/page.tsx:11-13, src/app/api/folders/[id]/route.ts:12-13] |

**Deprecated/outdated:** 해당 없음 — 이 phase는 기존 스택 버전을 그대로 사용한다.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | 클라이언트 자동저장의 "seq ref 비교로 stale 응답 폐기" 패턴이 표준적 관용구라는 판단은 공식 문서가 아닌 일반 WebSearch 결과에 근거한다 | Architecture Patterns Pattern 1 | 낮음 — 대안(React Query 기반 dedup 등)도 있으나 신규 의존성이 필요해 이 프로젝트엔 부적합. 로직 자체는 TRD §7 요구사항과 직접 정합하므로 패턴 출처의 신뢰도와 무관하게 정확성은 확보됨 |
| A2 | 문서 제목(`document.title`) 길이 상한 255자는 TRD/PRD/UI-SPEC 어디에도 숫자로 명시되지 않았다 — `folderSchema`의 255자 상한을 유추 적용했다 | Code Examples "Pattern 2" | 낮음 — DB 컬럼이 `text`(무제한)라 값 자체엔 영향 없음. 실제 요구 상한이 다르면 zod 스키마 숫자만 조정하면 됨 |
| A3 | 복원 cascade에서 "독립적으로 이미 트래시된 하위 항목은 제외" 규칙은 TRD §4/PRD §2-3 원문에 명시된 문장이 아니라 `softDeleteFolder`의 WR-01 idempotency 로직에서 대칭적으로 유추했다 | Common Pitfalls #5, Architecture Patterns Pattern 5 | 중간 — 틀리면 사용자가 명시적으로 지운 항목이 상위 폴더 복원 시 의도치 않게 부활하거나(데이터 노출), 반대로 복원돼야 할 항목이 누락될 수 있다. planner가 이 규칙을 명시적 태스크/테스트로 확정해야 한다(Open Questions #2) |
| A4 | 신규 문서 생성 API 계약(`POST /api/documents` body: `{title, folderId, workspaceId?}`)은 TRD §8이 "POST/PUT/DELETE `/api/documents*`"로만 뭉뚱그려 둔 것을 기존 `POST /api/folders`(`{name, parentId, workspaceId?}`)와 동형으로 미러링해 추론했다 | Recommended Project Structure, Pattern 3 주변 | 낮음 — 기존 폴더 생성 라우트가 이미 검증된 패턴이라 그대로 미러링하면 안전. UI-SPEC의 "Enter = title로 생성 요청"과도 정합 |

---

## Open Questions

1. **휴지통 라우트를 TRD §8의 통합 경로(`/api/trash/:type/:id/restore`, `DELETE /api/trash/:type/:id`)로 할지, CONTEXT.md가 병기한 리소스별 경로(`/api/documents/:id/restore` 등)로 할지**
   - What we know: TRD §8이 이번 세션에 직접 읽은 원문으로 통합 경로를 명시한다 [VERIFIED: docs/TRD.md:240-241 — `POST /api/trash/:type/:id/restore`(EDITOR) / `DELETE /api/trash/:type/:id`(ADMIN)]. CONTEXT.md의 code_context 절은 "`/api/documents/[id]/restore`... 또는 통합 trash 라우트"로 두 옵션을 열어 뒀다.
   - What's unclear: CONTEXT.md의 "또는" 표현이 TRD §8을 재확인 없이 뒤집어도 된다는 뜻인지, 단순히 실행 시점에 정할 세부사항이라는 뜻인지.
   - Recommendation: TRD가 상위 문서(CLAUDE.md 문서 체계 §"문서 체계")이므로 이 리서치는 TRD §8의 통합 경로를 그대로 따를 것을 권장한다. 휴지통 UI가 폴더·문서를 한 목록에서 동일한 두 액션(복원/완전삭제)으로 다루므로 `:type` 파라미터로 분기하는 통합 라우트가 리소스별 라우트보다 중복이 적다.

2. **복원 cascade에서 "독립적으로 트래시된 하위 항목 제외" 규칙의 정확한 알고리즘**
   - What we know: `softDeleteFolder`가 이미 "여전히 활성인 것만" cascade 대상으로 삼는 WR-01 원칙을 갖고 있다(Common Pitfalls #5).
   - What's unclear: 복원 시에도 대칭 규칙을 적용해야 하는지가 TRD §4/PRD §2-3 원문에 명시돼 있지 않다 — 이 리서치의 Pattern 5 구현은 추론(A3)이다.
   - Recommendation: planner가 이 알고리즘을 명시적 태스크로 고정하고, "하위 문서를 먼저 독립 삭제 → 상위 폴더 삭제 → 상위 폴더 복원 → 그 문서는 휴지통에 남아있어야 한다"는 시나리오를 통합 테스트로 박아 둘 것.

3. **문서 제목 길이 상한(A2)** — 서버 zod 스키마에 어떤 숫자를 쓸지 planner/discuss 단계에서 확정 필요(현재 255 유추).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| PostgreSQL (Homebrew, 5433) | document 테이블 마이그레이션·자동저장 seq 가드·트랜잭션 | ✓ | `pg_isready -p 5433` → accepting connections | — |
| Node.js | Next.js dev/build, Vitest | ✓ | v24.2.0 (devDependencies의 `@types/node: ^20`보다 최신이나 이미 프로젝트 전역에서 이 버전으로 동작 중 — 이 phase에서 새로 문제될 이유 없음) | — |
| pnpm | 전 명령 | ✓ | 10.18.3 | — |
| drizzle-kit | `document` 테이블 마이그레이션 생성 | ✓ (devDependencies 0.31.10) | 0.31.10 | — |

**Missing dependencies with no fallback:** 없음
**Missing dependencies with fallback:** 없음

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.ts` (environment: node, `DATABASE_URL_TEST` via `tests/global-setup.ts`, `fileParallelism: false`) [VERIFIED: vitest.config.ts:12-37] |
| Quick run command | `pnpm vitest run tests/documents/autosave-seq-guard.test.ts` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|---------------------|---------------|
| EDIT-07 | 서버 seq 가드: 역순 도착 요청은 affected rows 0 | unit(DB) | `pnpm vitest run tests/documents/autosave-seq-guard.test.ts -t "역순"` | ❌ Wave 0 |
| EDIT-07 | 클라 훅: stale 응답이 상태바를 되돌리지 않음 | unit(fake timers+mock fetch) | `pnpm vitest run tests/document/useAutosave.test.ts` | ❌ Wave 0 |
| EDIT-07 | 상태바 전이(저장 중→저장됨/실패+재시도) | unit(React Testing Library 필요 여부 확인 — 없으면 순수 훅 단위로 축소) | `pnpm vitest run tests/document/useAutosave.test.ts -t "상태"` | ❌ Wave 0 |
| DOC-01 | 문서 생성·수정·소프트삭제 → 휴지통 즉시 반영 | integration(DB+route) | `pnpm vitest run tests/documents/crud.test.ts` | ❌ Wave 0 |
| DOC-01 | 문서 라우트 IDOR(다른 워크스페이스 docId 거부) | integration | `pnpm vitest run tests/documents/idor.test.ts` | ❌ Wave 0 |
| DOC-02 | 폴더 삭제 cascade가 하위 문서까지 소프트삭제 | integration | `pnpm vitest run tests/folder/closure.test.ts -t "document cascade"`(기존 파일 확장) | ❌ Wave 0(기존 파일에 케이스 추가) |
| DOC-02 | 복원 cascade + 루트 재배치 + 독립 트래시 항목 보존(Open Questions #2) | integration | `pnpm vitest run tests/trash/restore.test.ts` | ❌ Wave 0 |
| DOC-02 | 완전삭제 FK 순서(document 먼저) + ADMIN 권한 | integration | `pnpm vitest run tests/trash/permanent-delete.test.ts` | ❌ Wave 0 |
| DOC-02 | 완전삭제 RBAC 매트릭스(ADMIN만 허용) | integration | `pnpm vitest run tests/rbac/matrix.test.ts`(기존 파일 확장) | ❌ Wave 0(기존 파일에 케이스 추가) |
| (ROADMAP) 3분할 동시 표시·문서 열기 딥링크 | e2e | `pnpm exec playwright test e2e/document-workspace.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/documents/` (신설 디렉터리 한정, 빠른 피드백)
- **Per wave merge:** `pnpm vitest run` (전체)
- **Phase gate:** 전체 스위트 green + `pnpm exec playwright test e2e/document-workspace.spec.ts` 통과 후 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/documents/` 디렉터리 신설 — `crud.test.ts`, `autosave-seq-guard.test.ts`, `idor.test.ts`
- [ ] `tests/document/useAutosave.test.ts` — 클라 훅 단위(fake timers)
- [ ] `tests/trash/` 디렉터리 신설 — `restore.test.ts`, `permanent-delete.test.ts`
- [ ] `tests/documents/helpers.ts` — `createTestDocument` 팩토리(`tests/rbac/helpers.ts`의 `createTestWorkspace` 패턴 재사용)
- [ ] `e2e/document-workspace.spec.ts` — 3분할 표시·문서 열기 딥링크·자동저장 UI 전이
- [ ] `src/db/schema.ts`에 `document` 테이블 추가 후 `pnpm drizzle-kit generate` + `pnpm drizzle-kit migrate`(신규 마이그레이션, 기존 `drizzle/0000~0002` 뒤에 `0003_*.sql`)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|---------------------|
| V2 Authentication | no | 변경 없음 — Auth.js v5, 이 phase 범위 밖 |
| V3 Session Management | no | 변경 없음 |
| V4 Access Control | yes | `requireRole`(EDITOR: CRUD/소프트삭제/복원, ADMIN: 완전삭제) + `resolveWorkspaceIdForDocument`/`resolveWorkspaceIdForTrashItem`(문서·휴지통 IDOR 가드, Common Pitfalls #6) |
| V5 Input Validation | yes | zod(`putBodySchema` — content/title/seq), `z.uuid()`(경로 파라미터) — 기존 `src/lib/validation.ts` 관례 그대로 |
| V6 Cryptography | no | 이 phase에서 신규 암호화 요구 없음 |

### Known Threat Patterns for Next.js/Drizzle/Postgres 스택

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| IDOR: `docId`만으로 문서 조회, 워크스페이스 스코프 누락 | Information Disclosure / Elevation of Privilege | `getDocument(docId, wsId)`가 `workspace_id`까지 WHERE에 포함(Common Pitfalls #6), 불일치는 `notFound()` |
| 활성-전용 헬퍼를 휴지통(비활성) 라우트에 오용 → 항상 거부 또는 검증 누락 | Tampering | Common Pitfalls #3의 전용 헬퍼로 명시적 분리 — 라우트마다 필터를 베끼지 않는다(Don't Hand-Roll) |
| ADMIN 전용 완전삭제를 EDITOR가 호출 | Elevation of Privilege | `requireRole(wsId, "ADMIN")` — `tests/rbac/matrix.test.ts` 매트릭스에 완전삭제 케이스 추가로 회귀 방지 |
| SQL injection(신규 raw `sql` 템플릿 사용 시) | Tampering | Drizzle 파라미터 바인딩(`sql\`...${value}...\``) — 문자열 결합 금지, 기존 `closure.ts` 관례 그대로 |
| 완전삭제 FK 순서 오류로 인한 부분 실패(트랜잭션 롤백 자체는 안전하지만, 재시도 로직 없이 사용자에게 500만 노출) | Denial of Service(가용성 저하, 데이터 훼손은 아님) | 하나의 `client.transaction`으로 document→folder 순서 강제(Pitfall 4) — 트랜잭션이므로 부분 삭제는 원리적으로 불가능 |

---

## Sources

### Primary (HIGH confidence)
- `docs/TRD.md` §3(데이터 모델)·§4(폴더 트리 연산)·§7(자동 저장 프로토콜)·§8(API) — 이번 세션에 전문 열람
- `docs/PRD.md` §2-2/2-3(cascade·복원-루트)·§3(권한 매트릭스)·§6(last-write-wins) — 이번 세션에 전문 열람
- `src/lib/closure.ts`, `src/lib/rbac.ts`, `src/db/schema.ts`, `src/app/api/folders/*`, `src/components/tree/*`, `src/components/layout/EditorPreviewLayout.tsx`, `src/components/editor/EditorHost.tsx`, `src/app/(main)/w/[wsId]/page.tsx`, `vitest.config.ts`, `tests/folder/*`, `tests/rbac/helpers.ts` — 이번 세션에 전문 또는 관련 구간 열람(각 절 [VERIFIED] 인용 참조)

### Secondary (MEDIUM confidence)
- WebSearch: "Next.js App Router nested layout persistent sidebar dynamic segment page.tsx server component load data" → nextjs.org/docs 공식 문서 인용 확인
- WebSearch: "Drizzle ORM postgres-js update where returning rowCount affected rows" → orm.drizzle.team/docs/update 공식 문서 인용 확인
- WebSearch: "Vitest vi.useFakeTimers debounce test vi.advanceTimersByTime async fetch mock" → 커뮤니티 자료 다수, 공식 문서 직접 인용은 부분적

### Tertiary (LOW confidence)
- WebSearch: "React debounce autosave hook ignore stale out-of-order fetch response pattern in-flight seq" — 공식 문서 아님, 관용구 확인 목적(Assumptions Log A1)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 신규 의존성 없음, 기존 설치 버전을 레지스트리와 직접 대조(`npm view`)
- Architecture(자동저장 seq 가드): HIGH — TRD §7 원문을 그대로 구현 코드로 옮김, 서버 측은 [VERIFIED] 인용 다수
- Architecture(휴지통 cascade): MEDIUM — 스키마·FK 사실은 [VERIFIED]지만 "독립 트래시 항목 제외" 알고리즘(A3)은 추론
- Pitfalls: HIGH(FK 순서·IDOR·활성전용 헬퍼) / MEDIUM(복원 cascade 세부 규칙, Open Questions #2로 이관)

**Research date:** 2026-08-08
**Valid until:** 2026-09-07(30일 — 스택이 안정적이고 phase 범위가 좁아 빠르게 변할 요인 없음)
