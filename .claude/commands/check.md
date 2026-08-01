---
description: lint + typecheck + test 를 한 번에 돌리고 실패만 보고
allowed-tools: Bash
---

프로젝트의 품질 게이트(lint · typecheck · test)를 실행하고 **실패한 것만** 보고한다.
토큰 절약이 목적이므로 성공한 단계는 출력을 읽거나 요약하지 말 것.

1. 프로젝트 종류를 한 번에 감지한다:
   `ls package.json pyproject.toml go.mod Cargo.toml Makefile 2>/dev/null`
2. 감지 결과에 맞는 명령을 `&&` 로 묶어 **한 번에** 실행한다. 대표 매핑:
   - **Node** (`package.json`): `npm run lint && npm run typecheck && npm test`
     (스크립트가 없으면 `package.json` 의 `scripts` 를 보고 있는 것만 실행)
   - **Python** (`pyproject.toml`): `ruff check . && mypy . && pytest -q`
   - **Go** (`go.mod`): `go vet ./... && go build ./... && go test ./...`
   - **Rust** (`Cargo.toml`): `cargo clippy && cargo test`
   - **Makefile** 에 `lint`/`test` 타깃이 있으면 그걸 우선 사용.
3. `$ARGUMENTS` 가 있으면 그 명령을 대신 실행한다 (예: `/check pnpm test`).
4. 보고 규칙:
   - 전부 통과 → **"✅ check passed"** 한 줄만.
   - 실패 → 실패한 단계 이름 + 에러 핵심 라인만. 통과한 단계의 로그는 언급하지 않는다.

명령이 없거나 감지 안 되면 무엇을 돌려야 할지 한 줄로 되묻는다.
