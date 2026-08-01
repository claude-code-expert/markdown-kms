# js-ts — JS/TS 스캐폴딩 세부 (2026)

SKILL.md의 명령을 실행한 뒤 이 문서로 플래그·구조·설정을 확정한다. 버전은 항상 `@latest`, 숫자 하드코딩 금지.

## 1. Next.js

```bash
npx create-next-app@latest my-app          # 대화형
npx create-next-app@latest my-app --yes    # 권장 기본값 그대로
```

**현행 기본값(2026)**: TypeScript · ESLint · Tailwind v4 · App Router · Turbopack · import alias `@/*` · `AGENTS.md` 생성. 대화형은 "권장 기본값 쓸래?"를 먼저 묻고, 커스터마이즈하면 TS→린터(ESLint/Biome/None)→React Compiler→Tailwind→`src/`→App Router→alias 순.

주요 플래그: `--ts` `--tailwind` `--eslint` `--biome`(ESLint 대신 lint+format) `--app` `--src-dir`(기본 off) `--turbopack` `--import-alias` `--use-pnpm` `--empty`.

**CLI가 안 만드는 것 (얹기)**:
- `src/` 레이아웃 + feature 폴더: `src/app/`, `src/components/ui/`, `src/lib/`(utils·db·clients), `src/hooks/`, `src/types/`, `src/server/`(또는 `actions/`).
- **env 검증**: 원시 `process.env` 대신 Zod 또는 `@t3-oss/env-nextjs`의 `env.ts`.
- Prettier + `prettier-plugin-tailwindcss` (ESLint는 포맷 안 함). 또는 Biome로 통합.
- `.nvmrc`/`engines`, Husky + lint-staged, CI에서 `next build` + typecheck. shadcn/ui 쓰면 `components.json`.

**피할 것**: 신규에 Pages Router(레거시), Tailwind v3 수동 config(v4는 CSS-first, `tailwind.config.js` 불필요).

## 2. React SPA (non-Next)

```bash
npm create vite@latest my-app -- --template react-ts
# 변형: react-swc-ts (SWC, 더 빠름), react (JS)
cd my-app && npm install
```

**CRA는 공식 사망** (react.dev, 2025-02 "Sunsetting Create React App" — 보안 패치·의존성 업데이트 없음). 신규 SPA는 Vite(또는 프레임워크: Next/React Router/Expo). Vite 스캐폴드는 최소만 준다(라우터·상태·테스트 없음, ESLint 있음, Prettier 없음).

**얹기**:
- 라우팅: **React Router v7** 또는 TanStack Router(타입세이프). 데이터: **TanStack Query**. 상태: 대부분 Zustand/Jotai가 Redux보다 낫다.
- 구조: `src/`에 `routes/`(또는 `pages/`), `components/ui/`, `features/<domain>/`, `lib/`, `hooks/`, `api/`, `types/`. `@/` alias는 `vite-tsconfig-paths` + tsconfig `paths`.
- 테스트: **Vitest** + React Testing Library (Vite-native). Vite에 Jest 쓰지 않는다.
- env: Vite `import.meta.env`, `VITE_` 프리픽스.
- SSR/SEO/라우팅 요구가 커지면 손으로 늘리지 말고 Next/React Router 프레임워크 모드로 이전.

**피할 것**: CRA, Webpack 수동 셋업, Jest-with-Vite, Enzyme.

## 3. Vue

```bash
npm create vue@latest          # @latest 필수 (캐시 회피)
npm create vue@latest -- --help   # 비대화형 플래그 확인
```

공식 **create-vue**(Vite 기반). 프롬프트 순서: TypeScript → JSX → Vue Router(SPA) → Pinia → Vitest → E2E(Playwright/Cypress/Nightwatch/No) → ESLint → Prettier(ESLint 선택 시). 비대화형 플래그: `--typescript --router --pinia --vitest --eslint --bare`.

> ⚠️ 최신 버전은 실험적 **Oxlint** / Rolldown-Vite 토글이 추가됐을 수 있다. 문서화 전 `-- --help`로 현재 프롬프트 확인.

**얹기**:
- `<script setup>` SFC 관례. CI 타입체크는 **`vue-tsc`** (tsc 단독은 SFC 검사 못 함).
- 구조: `src/`에 `views/`(라우팅) vs `components/`, `stores/`(Pinia), `composables/`(`use*`), `router/`, `lib/`, `assets/`, `types/`. `@/` alias는 create-vue가 이미 설정.
- Tailwind는 CLI가 안 줌 — 수동 추가. 필요 시 `unplugin-auto-import`·`unplugin-vue-components`.

**피할 것**: **Vue CLI(`@vue/cli`) 폐기됨** — Vite가 공식 경로. Vue 2/Options-only 신규, Vuex(→ Pinia).

## 4. TypeScript 라이브러리 / Node 패키지

공식 단일 스캐폴더 없음. 현행 스택 = **tsdown**(또는 tsup) + strict tsconfig + `exports` 맵 + publint/attw.

```bash
mkdir my-lib && cd my-lib && npm init -y
npm i -D typescript tsdown       # 안정 우선이면 tsup
npx tsc --init
npx tsdown                       # zero-config: ESM+CJS+.d.ts → dist/
```

**빌드 도구 선택**: **tsdown**(Rolldown 기반, 빠름, tsup 호환 DX, 단 pre-1.0 ~v0.22) / **tsup**(esbuild 기반, 성숙·최대 커뮤니티 — 안정 원하면 이것) / **unbuild**(UnJS·Nuxt 생태계). 순수 타입/트리비얼 라이브러리는 raw `tsc`도 OK.

**라이브러리용 tsconfig 핵심**:
```jsonc
{ "compilerOptions": {
  "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
  "strict": true, "declaration": true, "declarationMap": true, "sourceMap": true,
  "isolatedModules": true, "verbatimModuleSyntax": true, "outDir": "dist", "skipLibCheck": true
}}
```

**package.json (dual ESM+CJS)**:
```jsonc
{ "type": "module",
  "types": "./dist/index.d.ts",
  "exports": { ".": {
    "types": "./dist/index.d.ts",   // types를 조건 맨 앞에
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  }, "./package.json": "./package.json" },
  "files": ["dist"], "sideEffects": false,
  "scripts": { "build": "tsdown",
    "prepublishOnly": "npm run build && publint && attw --pack" } }
```

- **가장 가치 높은 추가**: `prepublishOnly`에 **publint** + **`@arethetypeswrong/cli`(attw)** — 깨진 `exports`/타입 해석을 publish 전에 잡는다.
- ESM 목표. CJS 소비자가 남아있으니 dual 배포가 안전. 순수 ESM-only도 점점 표준(단순, dual-package hazard 없음).
- 버저닝은 Changesets, 테스트는 Vitest, `tsc --noEmit` 타입체크는 번들과 분리.

**피할 것**: 수제 Rollup+Babel 다중 config, `microbundle`(방치), `exports` 없이 `main`만, CJS-only 신규, `tsc` 두 번 돌려 CJS+ESM 만들기(번들러에 맡겨라).

## 크로스커팅

- 패키지 매니저: **pnpm** 시니어 기본(속도·strict). bun 성장 중.
- Node: `.nvmrc` + `engines`, LTS(20/22) 타깃.
- 포매터 트렌드: **Biome**가 ESLint+Prettier를 한 도구로 대체하는 흐름(create-next-app에 1급 옵션).

---

## 출처 (2026-07 검증)

- create-next-app CLI — https://nextjs.org/docs/app/api-reference/cli/create-next-app
- Sunsetting Create React App — https://react.dev/blog/2025/02/14/sunsetting-create-react-app
- Vue Quick Start / vuejs/create-vue — https://vuejs.org/guide/quick-start · https://github.com/vuejs/create-vue
- tsdown — https://tsdown.dev/guide/ · tsup — https://tsup.egoist.dev/
- antfu, publish ESM & CJS — https://antfu.me/posts/publish-esm-and-cjs

> 미검증 플래그: create-vue 최신 프롬프트(Oxlint/Rolldown 여부)는 `-- --help`로 확인. tsdown은 pre-1.0 — 안정 필수면 tsup.
