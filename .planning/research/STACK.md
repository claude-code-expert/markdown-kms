# Technology Stack

**Project:** markdown-kms — 워크스페이스 기반 마크다운 문서 관리
**Researched:** 2026-08-01
**Confidence:** MEDIUM-HIGH (version numbers cross-checked against npm registry/official docs pages surfaced via web search; Context7 MCP was not available in this session — see Sources)

The stack itself is already decided (`docs/TRD.md` §1) and is not re-litigated here. This file pins exact current versions, the companion packages TRD didn't spell out, and the integration gotchas that will bite during implementation.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | **15.5.7** (Maintenance LTS line) | App Router + Route Handlers | TRD locks the major to 15. As of this research, Next.js has moved on to a 16.x Active LTS line, and 15.5.x is now the maintenance branch — but 15.5.7 specifically is the **minimum safe patch**: it fixes a React Flight protocol RCE (CVE fixed across 15.0.5/15.1.9/15.2.6/15.3.6/15.4.8/**15.5.7**/16.0.7). Do not pin below 15.5.7. |
| React / react-dom | **19.2.1** | UI runtime | Next.js 15 requires React 19 as a hard minimum peer dependency (not optional). 19.2.1 is the patched release for the same Flight RCE — 19.0.0/19.1.0/19.1.1/19.2.0 are all vulnerable. |
| TypeScript | **^5.7 – 5.9** (latest 5.x) | Type system | Stay on the 5.x line. Next.js 15.5+ explicitly rejects TypeScript 7.0+ (the experimental native-compiler rewrite) with a hard error — don't let a stray `typescript@next`/`@7` land in the lockfile. |
| Node.js runtime | **22.x (Active LTS)** | Deploy target | Needed to satisfy pnpm 11's own Node ≥22 requirement (see below) without version-skew between local tooling and the deploy target. |

### Database & ORM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16 | Primary datastore | TRD-decided; partial indexes + `pg_trgm` + closure-table joins are all native features this version supports. Not re-litigated. |
| drizzle-orm | **^0.45.x** | Schema-as-TS, query builder | Matches TRD's "schema = TS code" requirement 1:1. |
| drizzle-kit | **matching drizzle-orm release** (dev dependency) | Migration generation/diffing | Drizzle explicitly recommends keeping `drizzle-orm` and `drizzle-kit` on the same release cadence — install both in the same `pnpm add` command, don't let one drift ahead. |
| pg (node-postgres) + `@types/pg` | latest 8.x | PostgreSQL driver | TRD names Drizzle but not the driver. For a self-hosted/standard Postgres 16 instance (not Neon/serverless), `pg` is the standard, connection-pool-friendly driver Drizzle's Postgres docs lead with — prefer it over `postgres.js` unless you later move to a serverless Postgres provider. |

### Auth

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| next-auth (Auth.js v5) | **pin an exact `5.0.0-beta.x`** (check npm dist-tags at install time, don't float `latest`) | Session/credentials auth | v5 has *never* shipped a `5.0.0` stable tag — it has been "beta" for years but is the actively maintained, production-used line (v4 is legacy-only). TRD's requirement — "credentials provider now, Google OAuth-extensible later" — is exactly what v5's provider architecture is built for. Floating `latest` on a long-lived beta channel risks an unannounced breaking bump; pin the exact beta version in `package.json`. |
| @auth/drizzle-adapter | **1.11.3** | Auth.js ↔ Drizzle session/user persistence | Official adapter, actively released (2 days old at research time). Install alongside `drizzle-orm` + `drizzle-kit` per Auth.js's own Drizzle adapter docs. |
| bcryptjs | latest 2.x (**not** `bcrypt`) | Password hashing | TRD says "비밀번호는 bcrypt" — that names the *algorithm*, and `bcryptjs` implements the same bcrypt algorithm with cross-compatible hashes. The native `bcrypt` package requires node-gyp/a C++ toolchain at install and build time, which is a routine source of broken builds on Vercel/serverless and CI images without a compiler. `bcryptjs` is pure JS, zero native deps, ~30% slower (irrelevant for a deliberately-slow hashing op), and hashes are interchangeable with `bcrypt` if you ever need to switch. |

### Editor

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @codemirror/state | latest 6.x | `EditorState`/`Transaction` primitives | This is what the plugin architecture (`run(state): TransactionSpec`, §6 TRD) is actually built on — plugins operate on state, not the view. |
| @codemirror/view | latest 6.x | `EditorView`, DOM binding, keymaps | |
| @codemirror/commands | **6.10.4** | Base editing commands, `standardKeymap` | Needed for default cursor/selection behavior underneath the 14 custom plugins. |
| @codemirror/lang-markdown | **6.5.0** | Markdown syntax highlighting in the editor pane | Pulls in `@lezer/markdown` + `@lezer/highlight` transitively — don't add those manually. |
| codemirror (meta-package) | 6.0.2 | `basicSetup` bundle | Optional. Given the project needs granular control (custom toolbar dispatching `TransactionSpec`s per plugin), prefer composing `@codemirror/state` + `@codemirror/view` + individual extensions directly over pulling in the `basicSetup` grab-bag — it bundles features (search panel, fold gutter, lint gutter) this spec doesn't ask for. |

### Markdown Pipeline (unified)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| unified | 11.0.5 | Pipeline core | |
| remark-parse | 11.x | Markdown → mdast | CommonMark-compliant core (micromark), matches NFR-5.1's spec.json requirement. |
| remark-gfm | **4.0.1** | GFM extensions (strikethrough/tasklist/table only, per TRD scope) | Configure `{ singleTilde: false }` and don't enable footnote/autolink extensions — TRD explicitly restricts GFM to those 3. |
| remark-rehype | 11.1.2 | mdast → hast | Use with `{ allowDangerousHtml: true }` so raw HTML nodes survive to the `rehype-raw` step (required — otherwise raw HTML is dropped before sanitize even sees it). |
| rehype-raw | 7.0.0 | Parse raw HTML nodes embedded in hast | Must run **after** remark-rehype, **before** rehype-sanitize. |
| rehype-sanitize | 6.0.0 | XSS-safe allowlist filtering (NFR-3.1) | See Integration Gotchas — the default schema needs extending for GFM output. |
| rehype-react | 8.0.0 | hast → React elements for the preview pane | Declares a loose `react: '>=18'` peer, so React 19 resolves without an override — but this package hasn't shipped a release in ~a year (low commit velocity), so budget time to smoke-test it explicitly against React 19.2.x rather than assuming green. |

### Icons, Export, Mail

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| lucide-react | **1.28.0** | Icon set (FR-E7) | Declares `react: ^16.5.1 \|\| ^17 \|\| ^18 \|\| ^19` — React 19-safe. Note lucide-react crossed from 0.x → 1.x semver at some point; if any reference code/examples assume 0.x import paths, re-check against current docs, though the React component API itself is stable. |
| archiver | **8.0.0** | Streaming zip for folder export (FR-X2) | Use the long-established `archiver('zip', { zlib: { level: 9 } })` factory-function API (documented for years, what TRD's "archiver" reference means). **Do not** reach for the newer `@archiver/archiver` TypeScript rewrite — it requires Node.js 24+, ahead of the Node 22 LTS this stack targets. |
| nodemailer | **9.0.3** | Invitation email SMTP (§9 TRD) | Zero runtime dependencies, no native addons — safe for any deploy target. Set `secure: true` only for port 465; for 587/others leave `secure: false` (STARTTLS is negotiated automatically). |

### Validation & Testing

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| zod | **^4.x** | API body validation (§8 TRD: "전 변경 API는 zod로 body 검증") | Zod 4 is stable and current: 14x faster string parsing, 57% smaller bundle, closes the top long-standing v3 issues. TRD doesn't pin a version — start on v4 rather than v3 since this is a greenfield project with no v3 migration debt to avoid. |
| vitest | **4.1.10** | Unit tests, CommonMark spec.json runner, plugin tests | Don't adopt the `5.0.0-beta.x` "next" tag yet — stay on the `4.1` stable line until v5 stabilizes. |
| @playwright/test | **1.62.1** | E2E + the 60ms p95 keystroke-latency measurement (§10 TRD) | Current stable; ships the accessibility-snapshot and trace tooling used for debugging flaky E2E. |

### Package Manager & Style

| Tool | Version | Notes |
|------|---------|-------|
| pnpm | **11.18.0** | pnpm 11 **requires Node.js ≥22** (dropped 18–21 support) and is pure ESM. Pin via `"packageManager"` in `package.json` so CI/deploy don't silently resolve a different major. If the deploy target is stuck on Node 20 for any reason, pin pnpm to the `10.x` line instead rather than fighting the Node requirement. |
| CSS Modules | n/a (native) | TRD-decided; no version to track — it's a Next.js built-in, not a dependency. |

## Installation

```bash
# Core framework
pnpm add next@15.5.7 react@19.2.1 react-dom@19.2.1

# Database / ORM
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg

# Auth (pin the exact beta — check `pnpm view next-auth versions` first)
pnpm add [email protected] @auth/drizzle-adapter bcryptjs
pnpm add -D @types/bcryptjs

# Editor
pnpm add @codemirror/state @codemirror/view @codemirror/commands @codemirror/lang-markdown

# Markdown pipeline
pnpm add unified remark-parse remark-gfm remark-rehype rehype-raw rehype-sanitize rehype-react

# Icons, export, mail
pnpm add lucide-react archiver nodemailer
pnpm add -D @types/archiver

# Validation
pnpm add zod

# Dev / test tooling
pnpm add -D vitest @vitejs/plugin-react jsdom @playwright/test typescript
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Password hashing | bcryptjs | native `bcrypt` | Requires node-gyp/C++ toolchain at install; routine build breakage on Vercel/slim CI images. Same algorithm, cross-compatible hashes — no security tradeoff, only a minor speed one. |
| Auth | Auth.js v5 (beta channel, pinned) | Auth.js v4 | v4 doesn't have the credentials → OAuth-provider-additive architecture TRD's FR-A2 needs, and is now the legacy line receiving minimal investment. |
| PG driver | `pg` (node-postgres) | `postgres` (postgres.js) / `@neondatabase/serverless` | Both work fine with Drizzle. `pg` is the standard, pool-based choice for a self-hosted Postgres 16 instance; switch to a serverless driver only if the deploy target becomes Neon/a serverless Postgres provider. |
| Editor integration | Raw `@codemirror/*` packages | `@uiw/react-codemirror` wrapper | The wrapper hides direct `EditorView`/`dispatch` access behind a React-friendly API, which fights against TRD §6's plugin architecture (`run(state): TransactionSpec` dispatched by a central toolbar registry). Use the primitives directly. |
| Validation | zod v4 | zod v3 | No existing v3 codebase to preserve compatibility with — greenfield, so start on the faster/smaller v4 line. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma | TRD already replaced it with Drizzle (changelog-recorded decision) — schema-as-code 1:1 mapping to §3 DDL was the deciding factor | Drizzle ORM |
| Tailwind CSS | TRD-decided against it — `docs/ui-kit.html` is already a complete pure-CSS-variable token system; Tailwind would create a second, competing token source | CSS Modules + the existing design tokens |
| Monaco Editor | IDE-weight bundle for a feature set (cursor-position insert, selection wrap, 10k-char perf) CodeMirror 6's public API already covers | CodeMirror 6 |
| native `bcrypt` | Native compilation breaks on serverless/slim-container deploys | `bcryptjs` |
| `next-auth@4` | Legacy line, doesn't match the OAuth-extensible provider architecture FR-A2 needs | Auth.js v5 |
| Next.js 16 | Tempting since it's now the "current" major, but TRD explicitly locked the stack to 15 and this is a decided/changelogged constraint, not an oversight — don't upgrade mid-implementation | Next.js 15.5.7, revisit 16 as a deliberate post-v1 decision |
| `@archiver/archiver` (new TS rewrite) | Requires Node.js 24+, ahead of this stack's Node 22 target | `archiver@8.0.0` (classic API) |
| `create-react-app` / hand-rolled webpack boilerplate | Dead tooling; not applicable here anyway since scaffolding is `pnpm create next-app` (TRD §11, and the repo's own `scaffold` skill blocks CRA) | `pnpm create next-app@latest` |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| next@15.5.7 | react@19.2.1, react-dom@19.2.1 | React 19 is a hard minimum peer for Next 15, not optional. Both must be ≥ the patched versions listed or the app carries the Flight-protocol RCE. |
| pnpm@11.18.0 | Node.js ≥22 | pnpm 11 dropped Node 18–21 support entirely (pure ESM). Set Node 22 as the project's engine target to avoid local/CI/deploy skew. |
| next-auth@5.0.0-beta.x | @auth/[email protected], next@15.x | Minimum Next.js for Auth.js v5 is 14.0; 15.x App Router is the primary supported target. |
| rehype-react@8.0.0 | react@>=18 (peer range) | Resolves against React 19 without an override, but the package's low release cadence (~1yr since last publish) means it hasn't been explicitly re-validated against React 19 upstream — smoke-test the preview pane render path early, don't assume. |
| zod@^4 | react-hook-form resolvers, tRPC, most current OpenAPI generators | Major ecosystem consumers have shipped v4-compatible releases; low migration risk for a greenfield project with no v3 code to preserve. |
| drizzle-orm@^0.45.x | drizzle-kit (same release date) | Drizzle's own guidance: keep both packages on matching versions, install/upgrade together. |

## Integration Gotchas

1. **`rehype-sanitize`'s default schema strips GFM task-list checkboxes.** `remark-gfm`'s task list renders `<input type="checkbox" disabled checked>`. `rehype-sanitize`'s `defaultSchema` (from `hast-util-sanitize`, modeled on GitHub's own sanitization rules) does not allow-list the `input` tag by default — form controls are stripped as a security default. You must explicitly extend the schema before FR-related checklist rendering will work at all:
   ```ts
   import { defaultSchema } from 'rehype-sanitize'
   const schema = {
     ...defaultSchema,
     tagNames: [...(defaultSchema.tagNames ?? []), 'input'],
     attributes: {
       ...defaultSchema.attributes,
       input: ['type', 'checked', 'disabled'],
     },
   }
   ```
   `del` (strikethrough) and `table`/`thead`/`tbody`/`tr`/`th`/`td` are already present in the default GitHub-derived schema, so those two GFM features need no schema changes — only the checkbox input does. Confirm this against the actual installed `rehype-sanitize@6.0.0` schema during implementation; treat the snippet above as the starting point, not gospel.

2. **`remark-rehype` must run with `{ allowDangerousHtml: true }`, and `rehype-raw` must come directly after it.** Without that option, raw HTML in the markdown source is dropped at the mdast→hast step and `rehype-sanitize` never gets a chance to allow-list anything — NFR-3.1's "sanitize gate" only works if raw HTML survives to reach it.

3. **Auth.js v5 has no stable npm tag — pin an exact beta, never `latest`/`^5`.** A caret range on a beta channel can silently pull a breaking API change on `pnpm install`. Lock the exact version string in `package.json`.

4. **Next.js 15.5.x and React 19.x both had an active RCE (React Flight protocol) — the minimum safe versions are 15.5.7 and 19.2.1 respectively, not just "any 15.5.x"/"any 19.x".** Don't let the roadmap's dependency-install phase pin an earlier patch out of habit.

5. **pnpm 11's Node ≥22 requirement is a hard floor, not a recommendation.** If any part of the deploy pipeline (CI runner, hosting platform build image) defaults to Node 20, either bump it to 22 or pin pnpm to the 10.x line — don't discover this mismatch at deploy time.

6. **`archiver` has multiple same-named-adjacent packages on npm** (`archiver`, `archiver-node`, `@archiver/archiver`, `zip-stream`). TRD means the classic `archiver` package (factory-function API, v8.0.0) — the newer `@archiver/archiver` TS rewrite requires Node 24+ and is a different, incompatible API surface.

## Stack Patterns by Variant

**If image storage moves beyond local disk (post-R2, per TRD §8 note "S3 계열 전환은 저장 함수 하나 교체로"):**
- Add an S3-compatible SDK (`@aws-sdk/client-s3` or a provider-specific client) behind the single upload module TRD already isolates — don't add it speculatively now.

**If Google OAuth lands (R3, FR-A2):**
- Add `@auth/core`'s Google provider config only — no new package, it ships inside `next-auth`/`@auth/core` already.

## Sources

- npm registry package pages (via web search, not Context7 — MCP unavailable this session): `next`, `next-auth`, `drizzle-orm`, `drizzle-kit`, `@auth/drizzle-adapter`, `@codemirror/commands`, `@codemirror/lang-markdown`, `codemirror`, `unified`, `remark-gfm`, `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-react`, `lucide-react`, `archiver`, `vitest`, `playwright`, `zod`, `nodemailer`, `pnpm`, `bcrypt`/`bcryptjs` — MEDIUM-HIGH confidence (primary registry data, cross-checked across multiple queries)
- nextjs.org official upgrade/release docs (v15, v16 upgrade guides, testing guide) — HIGH confidence
- authjs.dev migration + adapter docs — MEDIUM confidence (community/maintainer commentary on beta status corroborated across GitHub discussions + npm)
- zod.dev v4 release notes/migration guide — HIGH confidence
- orm.drizzle.team getting-started/PostgreSQL docs — HIGH confidence
- GitHub security advisory data (React Flight RCE, patched version list) — HIGH confidence (specific fixed-version list corroborated across advisory + release notes)
- **Gap:** rehype-sanitize's exact current default schema (tagNames/attributes) was not directly fetched from source in this session — the GFM extension gotcha above is well-documented practice but should be re-verified against the literal `defaultSchema` export from the installed version before relying on it in the sanitize test suite (§10 TRD's XSS tests).

---
*Stack research for: markdown document management SaaS (markdown-kms)*
*Researched: 2026-08-01*
