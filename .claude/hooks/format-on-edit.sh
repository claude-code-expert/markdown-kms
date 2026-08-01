#!/usr/bin/env bash
# format-on-edit.sh — PostToolUse (matcher: "Edit|Write"). 차단 없이 정리만.
# 편집된 JS/TS 파일을 eslint --fix + prettier 로 자동 포매팅한다. 실패해도 통과.
set -euo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // ""')

# 경로 없거나 실제 파일이 아니면 통과
[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    pnpm exec eslint "$file" --fix >/dev/null 2>&1 || true
    pnpm exec prettier --write "$file" >/dev/null 2>&1 || true
    ;;
esac

exit 0
