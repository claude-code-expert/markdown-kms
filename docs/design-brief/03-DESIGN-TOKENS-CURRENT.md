# 현재 디자인 토큰 (교체 대상 원본)

전부 `src/app/globals.css`에서 그대로 뽑았다. 새 디자인이 이 값들을 유지할 의무는 전혀 없다 — "지금 뭐가 있는지" 기록일 뿐이다. CSS 커스텀 프로퍼티(`var(--token)`) 방식 자체는 컴포넌트 전체가 이미 이 패턴으로 짜여 있어서, 새 디자인도 같은 변수명 체계를 재사용하면(값만 교체) 컴포넌트 코드를 거의 안 건드리고 반영할 수 있다. 변수명을 바꾸려면 전체 `.module.css`에 흩어진 `var(--xxx)` 참조를 다 고쳐야 한다는 점만 참고.

## 색상 — 라이트 (기본)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg` | `#ffffff` | 배경(카드, 인풋, 팝업) |
| `--surface` | `#f8fafc` | 살짝 구분되는 배경(카드 리스트 패널 등) |
| `--surface-2` | `#eef2f6` | hover 배경, 배지 배경, 인라인 코드 배경 |
| `--border` | `#e5e7eb` | 기본 테두리·구분선 |
| `--border-strong` | `#cbd5e1` | 강조 테두리(배너 좌측 보더, 리사이즈 핸들 등) |
| `--text` | `#0f172a` | 본문 텍스트 |
| `--heading-text` | `var(--text)` (라이트는 본문과 동일) | 제목 텍스트 |
| `--muted` | `#64748b` | 보조 텍스트, 비활성 아이콘 |
| `--dim` | `#94a3b8` | 더 옅은 안내 텍스트(권한 부족 힌트 등) |
| `--accent` | `#2563eb` | 브랜드 강조색(primary 버튼, 선택 상태, 헤더 배경, 폴더/문서 아이콘) |
| `--accent-strong` | `#1d4ed8` | accent hover |
| `--accent-weak` | `#eff6ff` | 선택된 행 배경 등 옅은 워시 |
| `--destructive` | `#dc2626` | 위험 액션(삭제 버튼, 에러 텍스트) |
| `--destructive-strong` | `#b91c1c` | destructive hover |
| `--code-bg` | `#0f172a` | 코드블록 배경(테마 무관 고정값) |

## 색상 — 다크 (`[data-theme="dark"]`)

| 토큰 | 값 |
|---|---|
| `--bg` | `#0e0d11` |
| `--surface` | `#1c1b22` |
| `--surface-2` | `#383645` |
| `--border` | `#383645` |
| `--border-strong` | `#514f60` |
| `--text` | `#c2c0ce` |
| `--heading-text` | `#d3d1db` (다크만 본문보다 한 단계 밝음) |
| `--muted` | `#b2afc0` |
| `--dim` | `#757383` |
| `--accent` | `#7359f8` (라이트의 파랑 대신 보라) |
| `--accent-strong` | `#9580fa` |
| `--accent-weak` | `#241f3d` |
| `--destructive` | `#e5484d` |
| `--destructive-strong` | `#ef7570` |
| `--code-bg` | `#1c1b22` |

라이트↔다크 전환은 accent가 파랑↔보라로 바뀌는 게 핵심 아이덴티티 변화다. 나머지는 명도 반전.

## 타이포그래피

- **본문 폰트**: DM Sans(self-host, `next/font/local`). CSS 변수명은 `--font-ibm-plex-sans`로 남아 있지만 실제 로드되는 파일은 DM Sans다(레거시 변수명, 실제 렌더 폰트와 무관 — 새 디자인에서 변수명도 같이 정리해도 됨).
- **코드/모노 폰트**: DM Mono(self-host). 변수명은 `--font-ibm-plex-mono`.
- **에디터 입력 폰트**: `EditorHost.module.css`가 `var(--font-ibm-plex-mono), "IBM Plex Mono", monospace`로 선언 — DM Mono가 로드되므로 실제로는 DM Mono가 렌더된다. `"IBM Plex Mono"` 문자열은 시스템에 그 폰트가 없으면 그냥 무시되는 죽은 폴백.
- **본문 기본**: 14px / 400 / line-height 1.5.
- **크기 스케일(코드에서 실측)**: 11~28px 범위 안에서 화면마다 12/13/14/15/16/18/20/22/24/28px가 흩어져 쓰인다. 통일된 스케일 시스템은 없다 — 새 디자인이 4~6단계 스케일로 재정리하기 좋은 지점.

## Spacing (4의 배수)

| 토큰 | 값 |
|---|---|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |
| `--space-3xl` | 64px |

## Radius

| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-sm` | 6px | 버튼, 인풋, 배지 |
| `--radius-md` | 12px | 카드, 모달, 드롭다운 |
| `--radius-lg` | 18px | 페이지급 컨테이너(대시보드 카드 패널, 에디터 셸 프레임) |

`corner-shape: squircle`(CSS 신규 스펙, `@supports` 점진 향상)이 버튼/카드/모달에 부분 적용돼 있다 — 지원 브라우저에서만 각진 라운드가 아니라 매끈한 슈퍼타원 모서리로 보인다.

## Motion

| 토큰 | 값 |
|---|---|
| `--duration-fast` | 180ms |
| `--duration-standard` | 240ms |
| `--duration-slow` | 300ms |
| `--ease-fluid` | `cubic-bezier(0.36, 0.66, 0.6, 1)` |
| `--ease-elastic` | `cubic-bezier(0.42, 0, 0.58, 1.8)` |

버튼 클릭 피드백은 색상 변화가 아니라 `transform: scale(0.98) translateY(1px)` — 장식성 모션(글로우/펄스/그라데이션)은 프로젝트 전체에 의도적으로 없음(anti-slop 방침, `.claude/skills/anti-ai-slop` 참고).

## 기타 고정값

- `--header-h: 64px` — SiteHeader 높이. `w/[wsId]` 셸의 `height: calc(100vh - var(--header-h))` 계산에 재사용됨.
- 사이드바 폭: 최소 48px / 최대 400px / 기본 260px(쿠키로 폭·접힘 상태 기억).
- 다크 배경색이 완전한 무채색 검정이 아니라 보라 기가 살짝 도는 `#0e0d11` 계열(Dracula 파생) — 새 디자인이 순수 그레이스케일로 갈지 이 톤을 유지할지는 열린 선택.
