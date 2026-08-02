#!/usr/bin/env bash
#
# extract-my-prompts.sh
# ─────────────────────────────────────────────────────────────
# 현재 폴더에 해당하는 Claude Code 세션에서
# "내가 입력한 프롬프트"만 뽑아 Markdown 파일로 저장한다.
#
# 기본 동작은 "이번(최신) 세션 1개"만 추출한다.
#
# 사용법:
#   ./extract-my-prompts.sh                    # 이번 세션 → my-prompts.md
#   ./extract-my-prompts.sh <sessionId>        # 특정 세션 ID 지정
#   ./extract-my-prompts.sh --all              # 이 폴더의 모든 세션 합본(전체 덮어쓰기)
#   ./extract-my-prompts.sh --append           # 기존 파일 보존 + 신규 프롬프트만 이어붙임(증분)
#   ./extract-my-prompts.sh -o out.md          # 출력 파일명 지정
#   ./extract-my-prompts.sh --cwd /경로        # 대상 프로젝트 폴더 지정(기본: 현재 폴더)
#   (옵션 조합 가능:  ./extract-my-prompts.sh --all -o all.md)
#
# 동작 원리:
#   Claude Code는 대화를 ~/.claude/projects/<폴더>/<세션>.jsonl 로 저장한다.
#   각 줄에 cwd·sessionId 필드가 있다.
#   기본 모드는 cwd가 일치하는 jsonl 중 가장 최근에 수정된 1개(= 이번 세션)만 본다.
#   user 메시지 중 "내가 친 텍스트"만 남기고 도구 출력·메타·시스템 주입은 제외한다.
#   파싱은 추가 설치 없는 python3 로 처리한다(jq 불필요).

set -euo pipefail

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PROJECTS_DIR="$CLAUDE_DIR/projects"

# ── 인자 파싱 ────────────────────────────────────────────────
MODE="session"          # session | all
SESSION_ID=""           # 명시한 세션 ID(.jsonl 제거한 UUID)
TARGET_CWD="$PWD"
OUT="my-prompts.md"

while [ $# -gt 0 ]; do
  case "$1" in
    --all)   MODE="all"; shift ;;
    --append) MODE="append"; shift ;;
    -o)      OUT="${2:?-o 다음에 파일명이 필요합니다}"; shift 2 ;;
    --cwd)   TARGET_CWD="${2:?--cwd 다음에 경로가 필요합니다}"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
    -*)
      echo "❌ 알 수 없는 옵션: $1"; exit 1 ;;
    *)
      # 위치 인자 = 세션 ID (.jsonl 확장자 붙여줘도 허용)
      SESSION_ID="${1%.jsonl}"; MODE="session"; shift ;;
  esac
done

# 사전 점검
command -v python3 >/dev/null 2>&1 || { echo "❌ python3 가 필요합니다."; exit 1; }
[ -d "$PROJECTS_DIR" ] || { echo "❌ 세션 폴더가 없습니다: $PROJECTS_DIR"; exit 1; }

# 절대경로로 정규화(상대경로로 줘도 cwd 매칭이 되도록)
TARGET_CWD="$(cd "$TARGET_CWD" 2>/dev/null && pwd || echo "$TARGET_CWD")"

python3 - "$PROJECTS_DIR" "$TARGET_CWD" "$OUT" "$MODE" "$SESSION_ID" << 'PYEOF'
import json, sys, glob, os, re
from datetime import datetime

projects, target_cwd, out, mode, session_id = sys.argv[1:6]

# 1) cwd 가 일치하는 세션 파일 수집
matched = []
for f in glob.glob(os.path.join(projects, "*", "*.jsonl")):
    try:
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                try:
                    if json.loads(line).get("cwd") == target_cwd:
                        matched.append(f); break
                except Exception:
                    continue
    except Exception:
        continue

if not matched:
    print(f"⚠️  현재 폴더에 해당하는 세션을 찾지 못했습니다: {target_cwd}")
    print("    인자로 폴더를 지정해 보세요:  ./extract-my-prompts.sh --cwd /경로")
    sys.exit(1)

# 2) 대상 파일 선정
if mode in ("all", "append"):   # append 도 cwd 전 세션 합본 스코프
    files = sorted(matched)
elif session_id:
    files = [f for f in matched if os.path.splitext(os.path.basename(f))[0] == session_id]
    if not files:
        # cwd 밖일 수도 있으니 전체에서 한 번 더 탐색
        cand = glob.glob(os.path.join(projects, "*", session_id + ".jsonl"))
        files = cand
    if not files:
        print(f"⚠️  세션 ID 를 찾지 못했습니다: {session_id}")
        sys.exit(1)
else:
    # 기본: cwd 일치 파일 중 가장 최근 수정본 = 이번 세션
    files = [max(matched, key=os.path.getmtime)]

# 3) 내가 입력한 프롬프트만 추출
#
# 판별 기준은 2단계다.
#   1순위 promptSource — Claude Code 가 프롬프트의 출처를 로그에 직접 남긴다.
#         typed/sdk = 사람이 입력창에 친 것, system = 서브에이전트 완료 알림 등 자동 주입.
#         이 필드만 보면 <task-notification> 같은 긴 작업 내역이 통째로 걸러진다.
#   2순위 텍스트 래퍼 — promptSource 가 없는 구버전 로그를 위한 폴백.
KEEP_SOURCES = {"typed", "sdk"}
DROP_PREFIXES = ("<bash-input", "<bash-stdout", "<local-command", "<system-reminder",
                 "<task-notification", "[Request interrupted")

prompts = []
for f in files:
    with open(f, encoding="utf-8") as fh:
        for line in fh:
            try:
                o = json.loads(line)
            except Exception:
                continue
            if o.get("type") != "user" or o.get("isMeta"):
                continue
            src = o.get("promptSource")
            if src is not None and src not in KEEP_SOURCES:
                continue
            c = o.get("message", {}).get("content")
            if isinstance(c, str):
                text = c
            elif isinstance(c, list):  # 배열이면 text 블록만(도구 결과 제외)
                text = "\n".join(b.get("text", "") for b in c
                                 if isinstance(b, dict) and b.get("type") == "text")
            else:
                text = ""
            # IDE 확장이 주입하는 컨텍스트 블록(<ide_opened_file>…</ide_opened_file>,
            # <ide_selection>…</ide_selection> 등)은 내가 친 텍스트가 아니므로 도려낸다.
            # 블록만 제거하고 실제 입력은 보존한다(통째로 버리지 않음).
            text = re.sub(r"<ide_[^>]*>.*?</ide_[^>]*>", "", text, flags=re.DOTALL)
            text = text.strip()
            # 슬래시 커맨드는 확장된 본문이 아니라 내가 친 "/이름 인자" 한 줄로 줄인다.
            m = re.search(r"<command-name>\s*([^<]+?)\s*</command-name>", text)
            if m:
                a = re.search(r"<command-args>(.*?)</command-args>", text, flags=re.DOTALL)
                a = a.group(1).strip() if a else ""
                text = (m.group(1) + (" " + a if a else "")).strip()
            # 빈 줄 / 시스템 주입 / Caveat 래퍼 제외.
            # 단, 사용자가 친 <태그> 프롬프트는 살리기 위해 known 래퍼만 정확히 거른다.
            if not text or text.startswith("Caveat:"):
                continue
            if text.lstrip().startswith(DROP_PREFIXES):
                continue
            prompts.append((o.get("timestamp", ""), text))

# 4) 시간순 정렬 + 중복 제거(연속 동일 입력)
prompts.sort(key=lambda x: x[0])
seen, uniq = None, []
for ts, t in prompts:
    if t != seen:
        uniq.append((ts, t)); seen = t

# 5) Markdown 작성
scope = "이번 세션" if (mode == "session" and not session_id) else \
        (f"세션 {session_id}" if session_id else
        ("cwd 전체 합본 (증분)" if mode == "append" else "cwd 전체 합본"))

state_path = out + ".state"                       # 사이드카 상태(워터마크). Prompt.md 바이트는 안 건드린다.
max_ts = max((ts for ts, _ in uniq), default="")  # 현재 수집분 중 가장 늦은 timestamp

def write_header(w):
    w.write("# Claude Code 프롬프트 모음\n\n")
    w.write(f"- 프로젝트: `{target_cwd}`\n")
    w.write(f"- 범위: {scope}\n")
    w.write(f"- 추출 시각: {datetime.now():%Y-%m-%d %H:%M:%S}\n")
    w.write(f"- 세션 수: {len(files)} / 프롬프트 수: {len(uniq)}\n\n---\n\n")

def entry_text(i, ts, t):                          # 기존 포맷과 동일(항목 간 빈 줄 1개)
    day = ts[:10] if ts else ""
    return f"### {i}. {day}\n\n{t}\n\n"

def load_state(p):
    try:
        with open(p, encoding="utf-8") as fh:
            o = json.load(fh)
        if isinstance(o, dict) and "last_ts" in o and "last_index" in o:
            return o
    except Exception:
        pass
    return None

def write_state(p, last_ts, last_index, count):    # tmp+rename 으로 원자적 기록
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"last_ts": last_ts, "last_index": last_index, "count": count,
                   "updated": f"{datetime.now():%Y-%m-%d %H:%M:%S}"},
                  fh, ensure_ascii=False)
    os.replace(tmp, p)

def max_existing_index(path):                      # 본문에서 마지막 '### N.' 번호(무번호 수기항목은 자동 무시)
    mx = 0
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                m = re.match(r"^###\s+(\d+)\.", line)
                if m:
                    mx = max(mx, int(m.group(1)))
    except Exception:
        pass
    return mx

if mode == "append":
    # 분기 우선순위: 파일 존재 여부 먼저, 그 다음 state.
    file_exists = os.path.exists(out) and os.path.getsize(out) > 0
    st = load_state(state_path)

    if not file_exists:
        # (1) FRESH — 파일 없음/빈 파일: 헤더 + 전체 생성
        with open(out, "w", encoding="utf-8") as w:
            write_header(w)
            for i, (ts, t) in enumerate(uniq, 1):
                w.write(entry_text(i, ts, t))
        write_state(state_path, max_ts, len(uniq), len(uniq))
        print(f"✅ 생성: {out}  (FRESH · 세션 {len(files)}개 · 프롬프트 {len(uniq)}개)")

    elif st is None:
        # (2) SEED/마이그레이션 + 상태유실 폴백: 본문 미변경, 신규 0건, 상태만 시드
        last_i = max_existing_index(out)
        write_state(state_path, max_ts, last_i, len(uniq))
        print(f"✅ 시드: {out} 본문 보존(미변경) · 기준 번호 #{last_i} · 워터마크 {max_ts[:19]}")

    else:
        # (3) INCREMENTAL — 순수 append: 워터마크 이후만 파일 끝에 이어붙임
        last_ts = st.get("last_ts", "")
        last_i = int(st.get("last_index", 0))
        batch = [(ts, t) for (ts, t) in uniq if ts > last_ts]
        if batch:
            buf = "".join(entry_text(last_i + n, ts, t)
                          for n, (ts, t) in enumerate(batch, 1))
            # 기존 파일이 개행으로 안 끝나면 분리 보장(글루 방지)
            need_sep = False
            try:
                with open(out, "rb") as fh:
                    fh.seek(-1, os.SEEK_END)
                    need_sep = fh.read(1) != b"\n"
            except Exception:
                need_sep = False
            with open(out, "a", encoding="utf-8") as w:
                if need_sep:
                    w.write("\n")
                w.write(buf)
            write_state(state_path, batch[-1][0], last_i + len(batch), len(uniq))
            print(f"✅ 추가: {out}  (+{len(batch)}건 · #{last_i+1}~#{last_i+len(batch)})")
        else:
            write_state(state_path, last_ts, last_i, len(uniq))
            print(f"✅ 변경 없음: {out}  (신규 프롬프트 0건)")
else:
    # 기존 동작(--all / session / id): 전체 덮어쓰기
    with open(out, "w", encoding="utf-8") as w:
        write_header(w)
        for i, (ts, t) in enumerate(uniq, 1):
            w.write(entry_text(i, ts, t))
    if mode == "all":
        write_state(state_path, max_ts, len(uniq), len(uniq))  # 이후 --append 연속성
    print(f"✅ 완료: {out}  ({scope}, 세션 {len(files)}개, 프롬프트 {len(uniq)}개)")
PYEOF