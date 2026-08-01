---
description: 현재 브랜치에서 변경사항을 add + commit
allowed-tools: Bash(git add:*), Bash(git commit:*), Bash(git status:*), Bash(git diff:*), Bash(git branch:*)
---

현재 브랜치에 변경사항을 커밋한다. 토큰 절약을 위해 아래 순서로 git 명령을 직접 실행한다.

1. `git add -A && git status --short && git diff --staged --stat` 를 한 번에 실행해 스테이징 + 변경 요약을 파악한다. (diff 전문을 읽지 말 것)
2. 요약만으로 커밋 메시지 한 줄을 작성한다. 필요할 때만 `git diff --staged` 로 세부를 본다.
3. `git commit -m "<메시지>"` 로 현재 브랜치에 커밋한다.

$ARGUMENTS 가 있으면 그것을 커밋 메시지로 사용한다.
