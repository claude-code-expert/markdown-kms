---
name: scaffold
description: "새 프로젝트나 하위 모듈의 초기 구조(스캐폴딩)를 만들 때 발동한다. \"next.js/go/rust/java(spring)/typescript/react/vue 스캐폴딩 만들어줘\", \"프로젝트 초기 셋업\", \"보일러플레이트\", \"새 프로젝트 시작\" 류의 발화에 반응한다. 손으로 템플릿을 찍지 않고 각 생태계의 공식 스캐폴더(create-next-app·cargo·create-vue·Spring Initializr 등)를 최신·정확한 명령으로 실행한 뒤, CLI가 만들지 않는 디렉터리 구조·린터·포매터·CI를 시니어 수준으로 얹는다. 죽은 도구(CRA 등)를 차단하고 YAGNI 구조를 강제한다."
---

# scaffold — 프로젝트 스캐폴딩 게이트

> 스캐폴딩의 90%는 이미 공식 도구가 한다. 이 스킬의 가치는 **손으로 안 찍는 것** + **CLI가 남긴 판단(구조·설정)을 대신 내려주는 것**이다. 템플릿을 복붙하는 순간 이 게이트에 실패한다.

## 4대 원칙 (모든 스택 공통)

1. **공식 스캐폴더를 재발명하지 않는다.** `create-next-app`·`cargo new`·`npm create vue`·Spring Initializr가 존재한다. 손으로 파일을 찍기 전에 공식 도구가 있는지 먼저 확인하고, 있으면 무조건 그것을 쓴다.
2. **버전을 하드코딩하지 않는다.** 스캐폴더는 항상 최신을 안다. `@latest`를 쓰고, Rust 의존성은 `cargo add`, Spring 버전은 Initializr 서버 기본값에 맡긴다. 이 문서의 버전 숫자도 "확인 후 사용" 대상이다.
3. **구조는 flat until it hurts.** 처음부터 `cmd/`·`pkg/`·워크스페이스·package-by-feature를 깔지 않는다. 코드가 그걸 요구할 때 도입한다. 빈 디렉터리 트리는 구조가 아니라 노이즈다.
4. **죽은 도구를 쓰지 않는다.** Create React App, Vue CL(`@vue/cli`), Spring Boot 3.x(EOL), 신규 프로젝트 Lombok 반사 사용 — 전부 금지. 아래 표의 현행 도구를 쓴다.

## 작업 흐름

1. **스택 식별** — 발화에서 언어/프레임워크와 종류(앱 vs 라이브러리, SPA vs SSR)를 파악한다. 애매하면 한 줄로 물어본다 (예: "React는 SPA(Vite)로? 아니면 SSR 필요하면 Next?").
2. **공식 명령 실행** — 아래 표의 명령을 실행한다. 상세 플래그·프롬프트는 산출물 만들기 직전 해당 `references/` 파일을 읽는다.
3. **post-scaffold 레이어** — CLI가 안 만드는 것을 얹는다. 스택별 세부는 references, 공통은 아래 체크리스트.
4. **검증** — 스캐폴드 직후 빌드/타입체크가 도는지 확인한다 (`next build`, `cargo build`, `./gradlew build`, `npm run build`). 안 돌면 스캐폴딩 실패다.

## 스택별 공식 스캐폴딩 명령 (2026 현행)

| 스택 | 명령 | 세부 |
|------|------|------|
| **Next.js** | `npx create-next-app@latest my-app` (기본값: TS·ESLint·Tailwind·App Router·Turbopack) | `references/js-ts.md` |
| **React SPA** | `npm create vite@latest my-app -- --template react-ts` (⚠️ CRA 아님) | `references/js-ts.md` |
| **Vue** | `npm create vue@latest` (공식 create-vue, 프롬프트로 TS·Router·Pinia·Vitest 선택) | `references/js-ts.md` |
| **TS 라이브러리** | `npm init -y` + `tsc --init` + `tsdown`(또는 안정 우선이면 `tsup`) | `references/js-ts.md` |
| **Go** | `go mod init github.com/<user>/<repo>` (디렉터리는 필요할 때만) | `references/go-rust.md` |
| **Rust (bin)** | `cargo new <name>` / 라이브러리는 `cargo new --lib <name>` | `references/go-rust.md` |
| **Java/Spring** | `curl https://start.spring.io/starter.zip -d ... -o app.zip` (Initializr, 자동화엔 curl) | `references/java-spring.md` |

## post-scaffold 공통 체크리스트 (스택 무관)

CLI가 안 해주는 것. 스캐폴드 후 얹는다.

- [ ] **버전 고정**: 언어/런타임 버전을 파일로 핀 — `.nvmrc`+`engines`(Node), `go 1.xx`(go.mod), `rust-toolchain.toml`(Rust), `javaVersion`(Spring).
- [ ] **린터+포매터**: 스택 표준 하나. JS/TS는 ESLint+Prettier 또는 Biome, Go는 golangci-lint(v2)+gofumpt, Rust는 clippy+rustfmt, Java는 Spotless. 없이 스캐폴드 끝내지 않는다.
- [ ] **.gitignore**: 대부분 스캐폴더가 넣지만 빌드 산출물·`.env`·IDE 폴더 커버 확인.
- [ ] **환경변수**: 원시 `process.env` 대신 검증(Zod 등). 시크릿은 파일이 아니라 env로.
- [ ] **구조 결정**: 원칙 3 — 지금 필요한 최소 트리만. 세부는 references의 "small vs large" 기준.
- [ ] **CI 한 개**: 빌드+타입체크+테스트 도는 최소 워크플로. 나중에 늘린다.

## 안티패턴 (이 중 하나라도 하면 재작업)

- 공식 스캐폴더가 있는데 손으로 파일 트리를 찍는다.
- 죽은 도구(CRA, Vue CLI, Spring 3.x) 사용.
- 버전 숫자를 명령에 하드코딩 (움직이는 값).
- 빈 `cmd/`·`pkg/`·`internal/`·feature 폴더를 코드도 없이 미리 판다.
- 스캐폴드만 하고 빌드 검증 없이 끝낸다.
