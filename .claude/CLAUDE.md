# CLAUDE.md

이 프로젝트는 다른 프로젝트에서 사용할 MCP, Command, Skill, Hooks의 필수요소들과 사용법을 드롭인으로 복사 붙여넣기 해서 작은 규모의 하네스를 구성하는 목적으로 만들었다.

## MCP Tools

각 MCP 사용법은 아래 문서로 분리되어 있다.

@mcp/context7.md
@mcp/sequential-thinking.md
@mcp/playwright.md

## Commands

`.claude/commands/` 의 슬래시 커맨드. 토큰 절약을 위해 git 명령을 직접 실행한다.

- **`/git-commit [메시지]`**: 현재 브랜치에 `add -A` 후 커밋. 메시지 없으면 diff 요약으로 자동 작성.
- **`/git-push`**: 현재 브랜치를 `git push -u origin HEAD` 로 push.
- **`/git-pr [base]`**: commit → push → `gh pr create --base <base> --fill`. `base` 없으면 `develop`.
- **`/check [명령]`**: lint + typecheck + test 를 한 번에 실행하고 실패만 보고. 프로젝트 종류 자동 감지, 인자로 명령 직접 지정 가능.

## Skills

`.claude/skills/` 의 스킬. 조건에 맞는 작업이 시작되면 자동 발동한다.

- **`anti-ai-slop`**: 이미지·HTML·SVG·슬라이드·PDF 같은 시각 산출물과 문서·리포트·카피 글을 만들기 직전 발동하는 품질 게이트. 그라데이션·글로우·장식 모션 등 slop 디자인과 상투어·균질 구조·불릿 남발 등 AI 글쓰기 지문을 차단한다. 세부 기준은 `references/`(visual-craft·slides-pdf·writing-tells)로 분리.
- **`scaffold`**: "next.js/go/rust/spring/typescript/react/vue 스캐폴딩 만들어줘" 류 발화에 발동. 손으로 템플릿을 찍지 않고 각 생태계 공식 스캐폴더(create-next-app·cargo·create-vue·Spring Initializr)를 최신 명령으로 실행한 뒤, CLI가 안 만드는 구조·린터·CI를 얹는다. 죽은 도구(CRA 등) 차단 + YAGNI 구조 강제. 세부는 `references/`(js-ts·go-rust·java-spring).
- **`handoff`**: 세션 인계. "핸드오프", "이어서 작업", "인계/컨텍스트 정리" 발화에 발동해 진행상황·실패·다음 할 일을 `.handoff.md`(레포 루트)에 남긴다. 아래 `precompact-handoff` 훅과 짝을 이룬다.
- **`changelog`**: 되돌릴 수 없는 결정(아키텍처·의존성·API 계약)과 근거를 `changelog/changelog.md`에 append-only로 기록. 아래 `changelog-reminder` 훅이 push/PR 직전 매니페스트 변경을 감지하면 이 스킬로 기록할지 검토한다.
- **`token-usage`**: "토큰 얼마나 사용", "토큰 측정" 류 발화에 발동. `.claude/scripts/token-usage.py`로 세션 transcript의 토큰을 input·output·cache로 나눠 집계하고 총합을 낸다.

## Hooks

`.claude/hooks/` 의 훅. 설정은 `.claude/settings.json`.

- **`precompact-handoff.py`** (PreCompact): 컨텍스트 압축 직전 기계적 스냅샷(브랜치·변경파일·최근 사용자 메시지)을 `.handoff.md`에 덧붙인다. PreCompact는 모델을 부를 수 없어(컨텍스트 주입 미지원) 스냅샷만 남기고, 사람이 읽을 인계문 정리는 `handoff` 스킬이 한다. `.handoff.md`는 세션 로컬이라 `.gitignore` 처리.
- **`changelog-reminder.py`** (PreToolUse/Bash): `git push`·`gh pr create` 직전, 나갈 커밋에 의존성·빌드 매니페스트 변경이 있는데 `changelog/changelog.md` 갱신이 없으면 비차단 리마인더를 모델에 주입한다. push를 막지 않는다(defer).
- **`protect-paths.sh`** (PreToolUse/Edit|Write): `.env`·`credentials`·`.git/config`·ssh 키·`*.pem` 등 민감 파일 편집을 `exit 2`로 차단하고 사유를 Claude에 전달한다. 그 외 경로는 통과.
- **`format-on-edit.sh`** (PostToolUse/Edit|Write): 편집된 JS/TS 파일을 `eslint --fix` + `prettier --write`로 자동 정리. 차단 없음, 도구·설정 없으면 조용히 통과.
- **`lint-verify.sh`** (PostToolUse/Edit|Write): 편집된 `.ts/.tsx`에 ESLint 위반이 남으면 `exit 2`로 내용을 Claude에 피드백해 고치게 한다. `format-on-edit` 다음에 돌고, eslint 없으면 오탐 방지로 통과.
- **`typecheck-on-stop.sh`** (Stop): 응답 종료 시 `tsc --noEmit` 전체 검사, 에러 있으면 `exit 2`로 계속 작업시켜 고치게 한다. `stop_hook_active`로 무한 루프 방지, tsconfig·tsc 없으면 통과.
- **`notify-win.sh`** (Stop / Notification / SubagentStop): WSL2에서 `powershell.exe`로 Windows 토스트 알림 + 벨소리를 낸다. **응답 완료**(Stop), **입력·옵션 선택 대기**(Notification), **서브에이전트 완료**(SubagentStop) 세 경우에 발동. 소리는 `SoundPlayer.PlaySync` 로 동기 재생해 헤드리스 PowerShell 에서도 확실히 난다. 볼륨은 `CLAUDE_NOTIFY_VOLUME`(기본 100=원음, 100 미만이면 wav 진폭을 줄이고 100 초과면 증폭·클램프), 벨소리는 `CLAUDE_NOTIFY_SOUND`(Windows wav 경로, 기본 `Windows Notify.wav`)로 교체. 토스트 배너가 안 뜨고 알림 센터에만 쌓이면 Windows 의 **집중 지원/방해 금지**를 끄고 앱별 알림에서 **Windows PowerShell** 의 배너 표시를 켜야 한다(코드로 못 뚫는 OS 설정). 실패해도 exit 0으로 세션을 막지 않는다.

## 구현시 지침 
- GSD를 통해서 구현하되, 각 단계가 끝난 이후에는 다음 단계를 안내해줄것 