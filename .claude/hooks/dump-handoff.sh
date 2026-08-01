#!/usr/bin/env bash
# .claude/hooks/dump-handoff.sh — PreCompact(manual) 훅
# /compact 수동 호출 직전, 현재 결정·미해결 스냅샷을 .handoff.md 에 덧붙인다.
# SessionStart(resume)의 inject-handoff.sh 가 새 세션에서 이걸 다시 주입한다.
# compaction 을 막지 않는다(항상 exit 0).

payload=$(cat)

cwd=$(printf '%s' "$payload" | jq -r '.cwd // empty')
[ -z "$cwd" ] && cwd="$PWD"
trigger=$(printf '%s' "$payload" | jq -r '.trigger // "manual"')
now=$(date -u '+%Y-%m-%d %H:%M UTC')

branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
status=$(git -C "$cwd" status --short 2>/dev/null)

target="$cwd/.handoff.md"
{
  echo ""
  echo "## ⏸ handoff dump — $now (trigger: $trigger)"
  echo "- branch: \`$branch\`"
  if [ -n "$status" ]; then
    echo "- 변경:"
    echo '  ```'
    printf '%s\n' "$status" | sed 's/^/  /'
    echo '  ```'
  else
    echo "- 변경: (없음)"
  fi
  echo ""
  echo "> dump-handoff 훅 자동 생성. 결정·미해결을 여기에 정리하면 다음 세션에 주입됨."
  echo ""
} >> "$target" 2>/dev/null

echo "[handoff] dump 저장: $target"
exit 0
