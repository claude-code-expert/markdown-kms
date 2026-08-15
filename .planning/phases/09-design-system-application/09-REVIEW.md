---
phase: 09-design-system-application
reviewed: 2026-08-15T16:12:31Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - .gitignore
  - CLAUDE.md
  - changelog/changelog.md
  - e2e/design-system-flow.spec.ts
  - public/fonts/dm-mono-400.woff2
  - public/fonts/dm-sans-400.woff2
  - public/fonts/dm-sans-500.woff2
  - public/fonts/dm-sans-600.woff2
  - public/fonts/dm-sans-700.woff2
  - src/app/(auth)/login/login-form.tsx
  - src/app/(auth)/login/page.module.css
  - src/app/(auth)/signup/page.module.css
  - src/app/(auth)/signup/signup-form.tsx
  - src/app/(main)/dashboard/page.module.css
  - src/app/(main)/dashboard/page.tsx
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/document/DocumentWorkspace.module.css
  - src/components/document/SaveStatusBar.module.css
  - src/components/document/TagBar.module.css
  - src/components/editor/EditorHost.module.css
  - src/components/editor/HeadingDropdown.module.css
  - src/components/editor/Toolbar.module.css
  - src/components/layout/LayoutModeToggle.module.css
  - src/components/preview/PreviewPane.module.css
  - src/components/tree/FolderContextMenu.module.css
  - src/components/tree/FolderTree.module.css
  - src/components/tree/FolderTreeNode.module.css
  - src/components/tree/MoveFolderModal.module.css
  - src/components/tree/SearchBox.module.css
  - src/components/ui/Button.module.css
  - src/components/ui/Card.module.css
  - src/components/ui/ConfirmDialog.module.css
  - src/components/ui/Form.module.css
  - src/components/ui/Input.module.css
  - src/components/ui/Modal.module.css
  - src/components/workspace/JoinWorkspaceInput.module.css
  - src/components/workspace/WorkspaceCard.module.css
  - src/components/workspace/WorkspaceCard.tsx
  - src/lib/db-membership.ts
  - tests/membership/list-memberships.test.ts
  - tests/theme/rsc-cookie.test.ts
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-08-15T16:12:31Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 9 is a presentational restyling pass (light-color tokens unchanged, dark palette replaced with a Dracula-derived scale, radius/motion tokens made global, IBM Plex → DM Sans/Mono self-hosted fonts) plus one declared real-behavior extension: `listMembershipsForUser` now returns `ownerName`/`createdAt`/`docCount`/`folderCount`, consumed by `WorkspaceCard`. Confirmed no RBAC, soft-delete, autosave seq-guard, or sanitize-pipeline logic was touched — the `db-membership.ts` changes are additive read-only aggregate subqueries layered on top of the pre-existing `is_deleted=false` filter, which is within the phase's declared scope. `tsc --noEmit` is clean and the two new/changed unit-test files (`list-memberships.test.ts`, `rsc-cookie.test.ts`) pass (9/9). The `.gitignore` narrowing from a blanket `.planning/*` to `.planning/research/.cache/` is correct and verified against `git check-ignore`/`git ls-files`.

One real defect was found: the four "DM Sans" weight files shipped in `public/fonts/` are not actually four different fonts — three of them are byte-identical duplicates, silently breaking the weight differentiation this phase's typography system depends on across ~21 stylesheets. Two smaller quality issues (an accessibility regression against an established truncation pattern, and a Korean-language documentation-convention violation) are also flagged below.

## Critical Issues

### CR-01: DM Sans 500/600/700 font files are byte-identical to the 400 file — every "semibold"/"bold" weight in the app silently renders as regular weight

**File:** `public/fonts/dm-sans-500.woff2`, `public/fonts/dm-sans-600.woff2`, `public/fonts/dm-sans-700.woff2` (registered in `src/app/layout.tsx:13-22`)
**Issue:** `dm-sans-400.woff2`, `dm-sans-500.woff2`, `dm-sans-600.woff2`, and `dm-sans-700.woff2` all have the identical MD5 hash `9598e1855de9dcb4c522f0d705e8fd5c` — they are the exact same binary, just copied under different filenames (the same duplication already exists in the `docs/design_system/fonts/` scrape source, so it was carried over rather than introduced by a copy-paste mistake in this phase, but it shipped into `public/` unverified):

```
MD5 (public/fonts/dm-sans-400.woff2) = 9598e1855de9dcb4c522f0d705e8fd5c
MD5 (public/fonts/dm-sans-500.woff2) = 9598e1855de9dcb4c522f0d705e8fd5c
MD5 (public/fonts/dm-sans-600.woff2) = 9598e1855de9dcb4c522f0d705e8fd5c
MD5 (public/fonts/dm-sans-700.woff2) = 9598e1855de9dcb4c522f0d705e8fd5c
```

`layout.tsx` registers all four as distinct `next/font/local` faces (`weight: "400"/"500"/"600"/"700"`). Because the browser sees an explicit face registered for each requested weight, it will **not** synthesize faux-bold — it just renders the (visually identical to regular) glyph outlines at whatever weight is requested. Every `font-weight: 600` (all card titles, page titles, toolbar/tree headings, `SaveStatusBar`'s "저장됨" badge, `WorkspaceCard.meta`, etc. — 21 `*.module.css` files in `src/` set `font-weight: 500/600/700`) will render with zero visual weight difference from `font-weight: 400` body text. This directly undermines the phase's stated purpose ("타이포... 전역 교체"로 신선한 인상을 주려는 사용자 요구, changelog 2026-08-16) — the typographic hierarchy the whole restyle is built on does not actually exist in the shipped fonts. It is also directly falsified by the phase's own comment in `layout.tsx:11-12` claiming "실사용은 400/600 2종뿐" while `ConfirmDialog.module.css:41` (`.cancel`/`.confirm`/`.confirmDestructive`) sets `font-weight: 500`, which will also silently render indistinguishable from 400.

**Fix:** Source genuinely distinct DM Sans 500/600/700 static weight files (e.g. from Google Fonts' official DM Sans release) and replace the three duplicate `public/fonts/dm-sans-{500,600,700}.woff2`, or — if self-hosting the real weights isn't available in time — fall back to `next/font/google`'s `DM_Sans({ weight: ["400","600"] })` for the weights actually used, so the browser fetches correct glyph outlines instead of shipping fake weight variants:

```ts
// verify before shipping:
// $ md5sum public/fonts/dm-sans-*.woff2   # all four must differ
```
Add a one-line CI/lint check (or a `demo()`-style assertion in a font-asset test) that fails the build if any two `public/fonts/*.woff2` files share a hash — the exact defect that slipped through here.

## Warnings

### WR-01: `WorkspaceCard`'s new meta line has no `title` fallback for truncated text, breaking the codebase's established pattern

**File:** `src/components/workspace/WorkspaceCard.tsx:45-47`, `src/components/workspace/WorkspaceCard.module.css:35-44`
**Issue:** The new (Phase 9 D-08) `.meta` line — `소유자 {ownerName} · 생성일 {date} · 문서 {n}개 · 폴더 {n}개` — is styled with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, so it silently truncates for a workspace with a long owner name. Unlike `TagBar.tsx:99` (`<span className={styles.chipText} title={tag}>`), which sets a native `title` attribute on every other ellipsis-truncated text node in this codebase so users can still read the full value on hover, `WorkspaceCard`'s new `<p className={styles.meta}>` has no `title`. A user with a long name or a workspace with large counts has no way to see the full meta line.
**Fix:**
```tsx
<p className={styles.meta} title={`소유자 ${ownerName ?? "-"} · 생성일 ${formatCreatedAt(createdAt)} · 문서 ${docCount}개 · 폴더 ${folderCount}개`}>
  소유자 {ownerName ?? "-"} · 생성일 {formatCreatedAt(createdAt)} · 문서 {docCount}개 · 폴더 {folderCount}개
</p>
```

### WR-02: New JSDoc block in `db-membership.ts` is written in English, violating CLAUDE.md's mandatory Korean-language rule

**File:** `src/lib/db-membership.ts:10-16`
**Issue:** CLAUDE.md states, with explicit override emphasis, that all documentation and "코드 주석의 설명 문장까지" (explanatory code comment sentences) must be written in Korean, with narrow exceptions (identifiers, paths, library names, fixed technical terms). The Phase 9 addition to `listMembershipsForUser`'s docstring ("Phase 9 D-08: extended with real-data card fields — createdAt, ownerName ... T-09-02-SQLI") is entirely in English. The codebase does have pre-existing English comments from earlier phases (not introduced here), but this is a net-new block added by this phase and should follow the current, explicit project rule rather than perpetuate the pre-existing inconsistency.
**Fix:** Rewrite the added block in Korean, keeping code identifiers/decision tags (`D-08`, `T-09-02-SQLI`) as-is per the stated exceptions:
```ts
/**
 * Phase 9 D-08: 워크스페이스 카드용 실데이터 필드 확장 — createdAt, ownerName(OWNER 멤버가
 * 없는 워크스페이스, 예: 전원 EDITOR인 시드 기본 워크스페이스는 null), docCount/folderCount
 * (활성 항목만 카운트하는 상관 서브쿼리 — 멤버십 목록이 이미 워크스페이스 단위라 고정
 * 서브쿼리 수 유지, TRD Closure Table 고정 쿼리 수 불변식 위반 아님). 서브쿼리 조건은 전부
 * drizzle sql 템플릿 컬럼 참조/정적 불리언 — 호출자 제어값은 userId뿐이며 바깥 WHERE의
 * eq()로 이미 바인딩됨(T-09-02-SQLI).
 */
```

---

_Reviewed: 2026-08-15T16:12:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
