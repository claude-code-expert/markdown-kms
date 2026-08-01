#!/usr/bin/env bash
# .claude/hooks/notify-mac.sh — macOS 데스크톱 알림

payload=$(cat)

msg=$(echo "$payload" | jq -r '.message // "Claude needs input"')
title=$(echo "$payload" | jq -r '.title // "Claude Code"')

osascript -e "display notification \"$msg\" with title \"$title\" sound name \"Glass\""

exit 0
