#!/usr/bin/env python3
"""PreToolUse 훅 — push/PR 직전 changelog 누락을 비차단으로 리마인드한다.

git push / gh pr create 로 나갈 커밋에 의존성·빌드 매니페스트 변경이 있는데
changelog/changelog.md 갱신이 없으면, 모델에 additionalContext 로 "changelog
스킬로 기록할지 검토하라"고 알린다. push 는 절대 막지 않는다(exit 0, defer).

ponytail: 매니페스트 변경 = "되돌리기 어려운 결정"의 휴리스틱 프록시. 완벽 탐지가
아니라 고신호 근사다. 아키텍처/API 결정 중 매니페스트를 안 건드리는 건 놓친다.

ponytail: matcher "Bash" 라 모든 Bash 호출에 이 스크립트가 뜬다(파이썬 콜드스타트
~30ms). 오버헤드가 거슬리면 settings.json 에서 `if: "Bash(git push*)"` /
`"Bash(gh pr create*)"` 로 게이트해 push/PR 에서만 뜨게 바꿔라.

self-test: python3 changelog-reminder.py --selftest
"""
import sys, os, json, subprocess

# basename 기준. 생태계별 의존성·빌드 매니페스트.
MANIFESTS = {
    "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "go.mod", "go.sum",
    "Cargo.toml", "Cargo.lock",
    "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts",
    "requirements.txt", "pyproject.toml", "poetry.lock", "Pipfile", "Pipfile.lock",
    "Gemfile", "Gemfile.lock", "composer.json", "composer.lock",
}
CHANGELOG = "changelog/changelog.md"


def is_push_or_pr(cmd):
    c = " ".join(cmd.split())
    return "git push" in c or "gh pr create" in c


def evaluate(files):
    """변경 파일 목록 → (건드린 매니페스트, changelog 갱신 여부)."""
    manifests = sorted({f for f in files if os.path.basename(f) in MANIFESTS})
    changelog_updated = any(f.replace("\\", "/").endswith(CHANGELOG) for f in files)
    return manifests, changelog_updated


def git(cwd, *args):
    try:
        out = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=5)
        return out.stdout.strip() if out.returncode == 0 else ""
    except Exception:
        return ""


def changed_files(cwd):
    """나갈 커밋의 변경 파일: upstream 이 있으면 그 기준, 없으면 base 브랜치 기준."""
    base = git(cwd, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    if not base:
        for b in ("origin/main", "origin/develop", "main", "develop"):
            if git(cwd, "rev-parse", "--verify", "--quiet", b):
                base = b
                break
    if base:
        mb = git(cwd, "merge-base", base, "HEAD") or base
        files = git(cwd, "diff", "--name-only", mb, "HEAD")
    else:
        files = git(cwd, "diff", "--name-only", "HEAD~1", "HEAD")
    return [f for f in files.splitlines() if f]


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        data = {}
    cmd = (data.get("tool_input") or {}).get("command", "")
    if not is_push_or_pr(cmd):
        sys.exit(0)  # push/PR 이 아니면 조용히 통과

    cwd = data.get("cwd") or os.getcwd()
    manifests, changelog_updated = evaluate(changed_files(cwd))
    if manifests and not changelog_updated:
        msg = (
            "이 push/PR 에 의존성·빌드 매니페스트 변경이 있다: "
            + ", ".join(manifests)
            + f". 하지만 {CHANGELOG} 갱신이 없다. 되돌리기 어려운 결정"
            "(의존성 추가/교체/메이저 버전업, 빌드 변경)이라면 changelog 스킬로 "
            "기록할지 사용자에게 물어라. 사소한 변경이면 무시하고 그대로 진행."
        )
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": msg,
        }}))
    sys.exit(0)  # 항상 비차단


def selftest():
    # 매니페스트 변경 + changelog 없음 → 리마인드
    m, cu = evaluate(["src/a.ts", "package.json"])
    assert m == ["package.json"] and cu is False, (m, cu)
    # 매니페스트 + changelog 갱신됨 → 조용
    m, cu = evaluate(["go.mod", "changelog/changelog.md"])
    assert m == ["go.mod"] and cu is True, (m, cu)
    # 매니페스트 없음 → 조용
    m, cu = evaluate(["src/a.ts", "README.md"])
    assert m == [] and cu is False, (m, cu)
    # 명령 감지
    assert is_push_or_pr("git push -u origin HEAD")
    assert is_push_or_pr("git commit -m x && gh pr create --base develop --fill")
    assert not is_push_or_pr("git status")
    print("selftest OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        main()
