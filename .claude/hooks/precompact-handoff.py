#!/usr/bin/env python3
"""PreCompact 훅 — 압축 직전 기계적 스냅샷을 .handoff.md 에 덧붙인다.

PreCompact 훅은 모델을 호출할 수 없다(additionalContext 미지원). 그래서 여기서
할 수 있는 건 "지금 상태"를 파일로 영속화하는 것뿐이다: 브랜치·변경파일·최근
사용자 메시지. 지능형 인계문 정리는 handoff 스킬(모델)이 나중에 한다.

stdin 으로 PreCompact JSON(session_id, transcript_path, cwd, trigger)을 받는다.
어떤 경우에도 compaction 을 막지 않는다(항상 exit 0).

self-test: python3 precompact-handoff.py --selftest
"""
import sys, os, json, subprocess, datetime


def last_user_messages(transcript_path, n=5, maxlen=200):
    """transcript jsonl 에서 마지막 사용자 텍스트 메시지 n개를 뽑는다."""
    msgs = []
    try:
        with open(transcript_path) as f:
            for line in f:
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if o.get("type") != "user":
                    continue
                m = o.get("message") or {}
                if m.get("role") != "user":
                    continue
                c = m.get("content")
                if isinstance(c, str):
                    text = c
                elif isinstance(c, list):
                    # tool_result 만 있는 user 턴은 건너뛴다(사람이 친 게 아님)
                    parts = [p.get("text", "") for p in c if isinstance(p, dict) and p.get("type") == "text"]
                    text = " ".join(t for t in parts if t)
                else:
                    text = ""
                text = " ".join(text.split())  # 공백 정규화
                if text and not text.startswith("<"):  # 시스템/훅 주입 노이즈 제외
                    msgs.append(text[:maxlen])
    except FileNotFoundError:
        return []
    return msgs[-n:]


def git(cwd, *args):
    try:
        out = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=5)
        return out.stdout.strip()
    except Exception:
        return ""


def build_snapshot(cwd, trigger, transcript_path, now):
    branch = git(cwd, "rev-parse", "--abbrev-ref", "HEAD") or "?"
    status = git(cwd, "status", "--short")
    msgs = last_user_messages(transcript_path)

    lines = [
        "",
        f"## ⏸ pre-compact snapshot — {now} (trigger: {trigger})",
        f"- branch: `{branch}`",
    ]
    if status:
        lines += ["- 변경:", "  ```", *[f"  {l}" for l in status.splitlines()], "  ```"]
    else:
        lines.append("- 변경: (없음)")
    if msgs:
        lines.append("- 최근 사용자 메시지:")
        lines += [f'  - "{m}"' for m in msgs]
    lines.append("")
    lines.append("> 자동 생성(precompact 훅). handoff 스킬로 정리하면 이 섹션은 지워도 됨.")
    lines.append("")
    return "\n".join(lines)


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        data = {}
    cwd = data.get("cwd") or os.getcwd()
    trigger = data.get("trigger", "?")
    transcript_path = data.get("transcript_path", "")
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    snapshot = build_snapshot(cwd, trigger, transcript_path, now)
    target = os.path.join(cwd, ".handoff.md")
    try:
        with open(target, "a") as f:
            f.write(snapshot)
        print(f"[handoff] pre-compact 스냅샷을 {target} 에 저장했다.")
    except Exception as e:
        print(f"[handoff] 스냅샷 저장 실패: {e}", file=sys.stderr)
    sys.exit(0)  # 절대 compaction 을 막지 않는다


def selftest():
    import tempfile
    tp = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
    tp.write(json.dumps({"type": "user", "message": {"role": "user", "content": "첫 요청"}}) + "\n")
    # tool_result 만 있는 user 턴 → 제외돼야 함
    tp.write(json.dumps({"type": "user", "message": {"role": "user", "content": [{"type": "tool_result", "content": "x"}]}}) + "\n")
    tp.write(json.dumps({"type": "assistant", "message": {"role": "assistant", "content": "응답"}}) + "\n")
    tp.write(json.dumps({"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": "두 번째 요청"}]}}) + "\n")
    tp.close()
    msgs = last_user_messages(tp.name)
    assert msgs == ["첫 요청", "두 번째 요청"], msgs
    snap = build_snapshot(os.getcwd(), "manual", tp.name, "2026-01-01 00:00 UTC")
    assert "pre-compact snapshot" in snap and "두 번째 요청" in snap
    os.unlink(tp.name)
    print("selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        main()
