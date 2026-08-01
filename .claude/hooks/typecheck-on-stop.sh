#!/usr/bin/env bash
# typecheck-on-stop.sh — Stop 훅. 응답 종료 시 1회 전체 타입체크(tsc --noEmit).
# 에러가 있으면 exit 2 로 Claude 를 계속 작업시켜 고치게 한다.
# Stop 은 file_path 를 받지 않으므로 전체 검사가 맞다.
# set -e 는 쓰지 않는다(tsc 실패 시 우리가 직접 exit 2 를 던져야 하므로).
set -uo pipefail

payload=$(cat)

# 무한 루프 방지: 이미 이 Stop 훅 때문에 계속 작업 중이면 재검사하지 않고 통과.
if [ "$(printf '%s' "$payload" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

# TS 프로젝트가 아니거나 tsc 가 없으면(드롭인) 오탐 방지로 통과.
[ -f tsconfig.json ] || exit 0
pnpm exec tsc --version >/dev/null 2>&1 || exit 0

tsc_out=$(pnpm exec tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  {
    echo "TypeScript 컴파일 에러 발견:"
    echo "$tsc_out"
    echo "위 타입 에러를 수정해주세요."
  } >&2
  exit 2   # Stop 의 exit 2 = "종료 막고 계속 작업"
fi

exit 0
