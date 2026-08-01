---
description: commit + push 후 PR 생성 (기본 대상 브랜치 develop)
argument-hint: "[base-branch]"
allowed-tools: Bash(git add:*), Bash(git commit:*), Bash(git status:*), Bash(git diff:*), Bash(git push:*), Bash(git branch:*), Bash(gh pr create:*), Bash(gh pr view:*)
---

commit → push → PR 생성을 한 번에 수행한다. 대상(base) 브랜치는 `$ARGUMENTS`, 없으면 `develop`.

토큰 절약을 위해 git 명령을 직접 실행한다.

1. `git add -A && git status --short && git diff --staged --stat` 로 스테이징 + 요약 파악.
2. 요약으로 커밋 메시지 한 줄 작성 → `git commit -m "<메시지>"`. (변경 없으면 커밋 건너뜀)
3. `git push -u origin HEAD` 로 현재 브랜치 push.
4. `gh pr create --base <base> --head <현재브랜치> --fill` 로 PR 생성.
   - `<base>` = `$ARGUMENTS` 값, 비어있으면 `develop`.
   - 이미 열린 PR이 있으면 `gh pr view --web` 로 안내만 한다.
