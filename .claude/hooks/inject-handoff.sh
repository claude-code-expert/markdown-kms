#!/usr/bin/env bash
# .claude/hooks/inject-handoff.sh — SessionStart(resume) 훅
# 새(이어받는) 세션 시작 시 .handoff.md 를 읽어 컨텍스트로 주입한다.
# SessionStart 는 PreCompact 와 달리 additionalContext 주입이 가능하다.
# 파일 없으면 조용히 통과.

payload=$(cat)

cwd=$(printf '%s' "$payload" | jq -r '.cwd // empty')
[ -z "$cwd" ] && cwd="$PWD"

target="$cwd/.handoff.md"
[ -s "$target" ] || exit 0   # 없거나 빈 파일이면 주입할 것 없음

content=$(cat "$target")
ctx=$(printf '이전 세션 인계문(.handoff.md):\n\n%s' "$content")

jq -n --arg c "$ctx" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $c
  }
}'
exit 0
