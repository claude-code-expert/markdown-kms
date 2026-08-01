#!/usr/bin/env bash
# 보호 경로 수정 차단 (PreToolUse, matcher: "Edit|Write").
# 민감 파일(.env, credentials, .git/config 등) 편집을 시도하면 exit 2 로 차단하고
# Claude 에게 사유를 전달한다. 그 외에는 통과.
set -euo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // ""')

# 빈 경로는 통과
[ -z "$file" ] && exit 0

# 보호 경로 매칭
case "$file" in
  */.env|*/.env.*|*/credentials*|*/.git/config|*/id_rsa|*/id_ed25519|*/*.pem)
    echo "BLOCKED: '$file' 는 수정 금지 경로입니다. 민감 정보 파일이라 훅이 편집을 차단했습니다." >&2
    exit 2   # 차단 + Claude 에게 사유 전달
    ;;
esac

exit 0   # 명시적 통과
