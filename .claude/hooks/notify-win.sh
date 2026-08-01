#!/usr/bin/env bash
# Windows(WSL2) 알림 훅. stdin 으로 들어온 훅 JSON payload 를 읽어
# Windows 토스트 알림을 띄우고, 볼륨 조절 가능한 벨소리를 재생한다.
#
# 사용: notify-win.sh "<라벨>" ["<사운드 파일명>"]
#   라벨    = payload 에 title/message 없을 때 fallback
#   사운드  = C:\Windows\Media\ 안의 wav 파일명(예: "chimes.wav"). 이벤트별로 다르게 준다.
#   - Stop        : 응답 완료      (Windows Notify.wav)
#   - Notification: 입력/선택 대기 (chimes.wav)
#   - SubagentStop: 서브에이전트 완료 (Windows Notify.wav)
#
# 소리는 SoundPlayer.PlaySync 로 동기 재생한다(헤드리스 PowerShell 에서도 확실히 남).
# 볼륨: 기본 100(원음 그대로 즉시 재생). 100 미만이면 진폭을 줄이고, 100 초과면 증폭한다
#       (예: 150 = 1.5배, 클리핑은 16bit 범위로 클램프). 환경변수 CLAUDE_NOTIFY_VOLUME 로 조절.
# 벨소리 우선순위: 환경변수 CLAUDE_NOTIFY_SOUND(전체 경로) > 2번째 인자(파일명) > 기본값.
set -euo pipefail

VOLUME="${CLAUDE_NOTIFY_VOLUME:-100}"
sound_arg="${2:-}"
if [ -n "${CLAUDE_NOTIFY_SOUND:-}" ]; then SOUND="$CLAUDE_NOTIFY_SOUND"
elif [ -n "$sound_arg" ]; then SOUND="C:\\Windows\\Media\\$sound_arg"
else SOUND="C:\\Windows\\Media\\Windows Notify.wav"; fi
# 토스트는 Windows 에 등록된 AppUserModelID 가 있어야 배너로 뜬다.
# 임의 문자열('Claude Code')은 조용히 버려지므로, 항상 등록돼 있는 PowerShell 의 AUMID 를 빌려 쓴다.
AUMID='{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'

payload=$(cat)
label="${1:-Claude Code}"

title=$(printf '%s' "$payload" | jq -r '.title // empty')
msg=$(printf '%s' "$payload" | jq -r '.message // empty')
[ -z "$title" ] && title="Claude Code"
[ -z "$msg" ] && msg="$label"

# 한글·따옴표·특수문자 깨짐 방지: base64 로 넘겨 PowerShell 안에서 복원.
b64t=$(printf '%s' "$title" | base64 -w0)
b64m=$(printf '%s' "$msg" | base64 -w0)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
\$ErrorActionPreference='SilentlyContinue'
# --- 토스트 배너 ---
\$t=[Security.SecurityElement]::Escape([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$b64t')))
\$m=[Security.SecurityElement]::Escape([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$b64m')))
[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null
[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom,ContentType=WindowsRuntime]|Out-Null
\$doc=New-Object Windows.Data.Xml.Dom.XmlDocument
\$doc.LoadXml('<toast><visual><binding template=\"ToastGeneric\"><text>'+\$t+'</text><text>'+\$m+'</text></binding></visual><audio silent=\"true\"/></toast>')
\$toast=New-Object Windows.UI.Notifications.ToastNotification \$doc
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('$AUMID').Show(\$toast)
# --- 벨소리 (동기, 볼륨 스케일) ---
\$path='$SOUND'; \$vol=$VOLUME
if(\$vol -eq 100){
  (New-Object Media.SoundPlayer \$path).PlaySync()
} else {
  try {
    \$b=[IO.File]::ReadAllBytes(\$path)
    \$af=1;\$bits=16;\$ds=-1;\$dl=0;\$i=12
    while(\$i+8 -le \$b.Length){
      \$id=[Text.Encoding]::ASCII.GetString(\$b,\$i,4)
      \$sz=[BitConverter]::ToInt32(\$b,\$i+4)
      if(\$id -eq 'fmt '){ \$af=[BitConverter]::ToInt16(\$b,\$i+8); \$bits=[BitConverter]::ToInt16(\$b,\$i+22) }
      elseif(\$id -eq 'data'){ \$ds=\$i+8; \$dl=\$sz }
      \$i+=8+\$sz+(\$sz%2)
    }
    if(\$af -eq 1 -and \$bits -eq 16 -and \$ds -gt 0){
      \$cnt=[int](\$dl/2); \$s=New-Object 'Int16[]' \$cnt
      [Buffer]::BlockCopy(\$b,\$ds,\$s,0,\$cnt*2)
      \$f=[double]\$vol/100.0
      for(\$k=0;\$k -lt \$cnt;\$k++){ \$v=[int][math]::Round(\$s[\$k]*\$f); if(\$v -gt 32767){\$v=32767}elseif(\$v -lt -32768){\$v=-32768}; \$s[\$k]=[Int16]\$v }
      [Buffer]::BlockCopy(\$s,0,\$b,\$ds,\$cnt*2)
      \$tmp=[IO.Path]::GetTempFileName(); [IO.File]::WriteAllBytes(\$tmp,\$b)
      (New-Object Media.SoundPlayer \$tmp).PlaySync(); Remove-Item \$tmp -EA SilentlyContinue
    } else { (New-Object Media.SoundPlayer \$path).PlaySync() }
  } catch { (New-Object Media.SoundPlayer \$path).PlaySync() }
}
" >/dev/null 2>&1 || true

exit 0
