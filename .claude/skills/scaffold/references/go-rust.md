# go-rust — Go / Rust 스캐폴딩 세부 (2026)

두 생태계 모두 스캐폴더가 **최소만** 만든다. 구조는 전부 사람 판단 — 원칙은 flat until it hurts.

## Go

```bash
go mod init github.com/<user>/<repo>   # 모듈 경로 = import 경로
# 디렉터리는 필요할 때만 만든다 (아래 c)
go mod tidy                            # import 추가 후
```

- 모듈 경로는 **저장소 fetch URL**(`github.com/user/repo`). 라이브러리는 필수(남이 import하는 경로). 비공개 바이너리라도 URL 형태로 — 공짜 미래대비.
- `go.mod`에 Go 버전을 명시(`go 1.24` 등). Go 1.21+부터 실제 툴체인 제약이다.

**`go mod init`이 만드는 것**: `go.mod` 하나뿐. 디렉터리·main.go 없음. 아래는 전부 수동.

### 레이아웃 — 논쟁 지점 (중요)

Go 팀 공식 가이드(go.dev/doc/modules/layout)는 **`internal/`과 `cmd/` 두 가지만** 언급한다. **`pkg/`는 언급조차 안 한다.**

- **작은 CLI/라이브러리/PoC → flat.** 코드를 저장소 루트(`go.mod` 옆)에. 단일 바이너리 CLI는 루트 `main.go` 하나면 된다. 공식 문서도 여기서 시작한다.
- **`cmd/` — 정당한 경우**: 바이너리가 **여럿**이거나, 한 저장소에 바이너리+import 가능 패키지가 **섞일** 때. `cmd/prog1/main.go`. 바이너리가 정확히 하나면 `cmd/`는 노이즈.
- **`internal/` — 적극 사용**: 컴파일러가 강제하는 privacy(모듈 밖에서 import 불가). 공식 가이드도 "가능한 한 많이" 권장 — 자유로운 리팩터링을 위해. 시니어가 일찍 손대는 유일한 디렉터리.
- **`pkg/` — 쓰지 마라.** `internal/`(Go 1.4) 이전의 낡은 관례. Go 팀 미승인. `golang-standards/project-layout`은 **커뮤니티 산물이지 공식 표준이 아니다**(자체 README도 학습/PoC/단순 프로젝트엔 과하다고 명시). import 가능하면 루트나 named 패키지에, 아니면 `internal/`에.

원칙: **flat until it hurts** → `internal/` 도입 → 바이너리 >1개이거나 혼합일 때만 `cmd/`.

### post-init 추가

- **`.gitignore`**: 빌드 바이너리, `*.out`, `coverage.*`, `.env`.
- **`.golangci.yml`**: **golangci-lint v2** 스키마(파일 상단 `version: "2"`). 기본 린터: `govet` `staticcheck`(gosimple/unused 포함) `errcheck` `revive` `ineffassign` `misspell` `gocyclo`(느슨하게 ~15부터). 포맷은 `formatters` 블록의 `gofumpt`. 느슨하게 시작해 점진적으로 조인다.
- **`Makefile` 또는 `Taskfile.yml`**: `lint`/`test`(`go test ./...`)/`build`/`tidy` 얇은 래퍼. Taskfile은 탭 함정 없고 크로스플랫폼. 하나만 골라라.

### 안티패턴

- `golang-standards/project-layout` 전체(api/·build/·configs/·pkg/…)를 작은 프로젝트에 복사 — 비표준 카고컬트.
- `pkg/` 반사 사용. `internal/` 없이 전부 public 노출.
- 코드도 없이 깊은 패키지 트리 선구축 → import 사이클.
- 라이브러리 모듈 이름을 실제 import 경로와 다르게.

## Rust

```bash
cargo new <name>          # 바이너리 → src/main.rs
cargo new --lib <name>    # 라이브러리 → src/lib.rs
cargo init [--lib]        # 기존 디렉터리에서
```

**생성물**: `Cargo.toml`, `src/`, git repo(`.git` + `/target` 무시하는 `.gitignore`). 바이너리는 hello-world `main.rs`, 라이브러리는 샘플 `add` + `#[cfg(test)] mod tests`. 툴체인 1.85+에서 **`edition = "2024"` 기본**.

### 구조 결정

- **`main.rs` vs `lib.rs` + `src/bin/`**: 테스트/재사용 가치가 있는 바이너리는 **로직을 `lib.rs`에, `main.rs`는 얇은 껍데기**로. 통합테스트(`tests/`)는 lib crate만 import 가능 — 진짜 로직은 lib에.
- **다중 바이너리**: `src/bin/<name>.rs`(각각 별도 타깃) 또는 `[[bin]]` 선언. CLI + 헬퍼 툴에 흔함.
- **모듈**: 현대 관례는 **`foo.rs` + `foo/` 하위디렉터리**. `foo/mod.rs`는 2018부터 비권장. 파일이 커지기 전엔 flat.
- **워크스페이스 — 언제/어떻게**: **멀티 크레이트**(lib+CLI+공유타입 등)일 때. 루트 `Cargo.toml`:
  ```toml
  [workspace]
  resolver = "3"            # edition 2024와 연동
  members = ["crates/*"]
  [workspace.dependencies]  # 버전 중앙화
  serde = { version = "1", features = ["derive"] }
  ```
  멤버는 `serde.workspace = true`. 이점: 단일 `Cargo.lock`·공유 `target/`·통일 버전. **단일 크레이트에 워크스페이스 만들지 마라 (YAGNI).**

### edition (검증됨)

- **현행 = `2024`.** Rust **1.85.0(2025-02-20)** 안정화, 1.85+ `cargo new` 기본. `edition = "2021"`도 여전히 유효.
- **"Rust 2026" edition은 없다.** edition은 ~3년 주기(2015/18/21/24), 다음은 ~2027. 블로그 추측은 무시.

### post-init 추가

- **`.gitignore`**: cargo가 `/target` 추가함. `Cargo.lock`은 **라이브러리만** 무시(바이너리/앱은 커밋).
- **`rustfmt.toml`**: 대개 비우거나 최소(기본이 커뮤니티 표준). `edition` 정도. `imports_granularity`·`group_imports`는 stable rustfmt에서 nightly-gated일 수 있으니 사용 전 현재 상태 확인.
- **clippy**: `Cargo.toml`에 lint 레벨 —
  ```toml
  [lints.clippy]
  all = "warn"
  # pedantic = "warn"   # opt-in, 시끄러움
  ```
  CI에서 `cargo clippy --all-targets -- -D warnings`.
- **`rust-toolchain.toml`**: 채널 + 컴포넌트(`rustfmt`·`clippy`) 핀 — 재현 가능한 팀 빌드.
- **의존성**: `serde`(+derive), 앱 에러는 `anyhow` / 라이브러리 에러는 `thiserror`, CLI는 `clap`(derive), async는 `tokio`. **`cargo add <crate>`로 추가**(현재 버전 자동 기입 — 손으로 버전 쓰지 마라).

### 안티패턴

- 전 로직을 `main.rs`에 넣어 통합테스트 불가 → `lib.rs`로 추출.
- 새 모듈에 `mod.rs`(레거시). 단일 크레이트 워크스페이스.
- 손으로 의존성 버전 기입(→ `cargo add`).
- `Cargo.lock` 반대로(lib: 무시 / app: 커밋).
- 첫날부터 `clippy::pedantic`/`nursery` 전면 활성화 — 경고 홍수. 선택적 opt-in.

---

## 검증 상태 (2026-07)

| 주장 | 상태 |
|------|------|
| Go 팀은 `internal/`+`cmd/`만 권장, `pkg/` 미언급 | 검증 (go.dev/doc/modules/layout) |
| project-layout은 비공식 | 검증 (repo README) |
| golangci-lint v2(`version: "2"`) 현행 | 검증 |
| Rust 2024 edition, 1.85.0(2025-02) 안정 | 검증 (Rust blog) |
| "Rust 2026" edition 없음 | 검증 |
| rustfmt import 옵션 nightly-gated 여부 | 미재검증 — 사용 전 확인 |

출처: go.dev/doc/modules/layout · github.com/golang-standards/project-layout · golangci-lint.run · blog.rust-lang.org/2025/02/20/Rust-1.85.0 · doc.rust-lang.org/cargo
