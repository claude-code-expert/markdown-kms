#!/usr/bin/env bash
# lint-verify.sh — PostToolUse (matcher: "Edit|Write").
# 편집된 TS 파일에 ESLint 위반이 남아 있으면 exit 2 로 Claude 에게 피드백해 고치게 한다.
# format-on-edit.sh(자동 --fix) 다음에 돌아, 자동 수정으로 안 잡히는 위반만 보고한다.
# set -e 는 쓰지 않는다(eslint 실패 시 우리가 직접 exit 2 를 던져야 하므로).
set -uo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // ""')

[ -z "$file" ] && exit 0   # 빈 경로 통과

case "$file" in
  *.ts|*.tsx)
    # eslint 이 없는 프로젝트에선 "not found" nonzero 를 위반으로 오인해 매 편집을 막는다 → 있을 때만 검증.
    pnpm exec eslint --version >/dev/null 2>&1 || exit 0
    lint_out=$(pnpm exec eslint "$file" --max-warnings 0 2>&1)
    if [ $? -ne 0 ]; then
      {
        echo "ESLint 위반 in $file:"
        echo "$lint_out"
        echo "위 위반 사항을 수정해주세요."
      } >&2
      exit 2
    fi
    ;;
esac

exit 0
