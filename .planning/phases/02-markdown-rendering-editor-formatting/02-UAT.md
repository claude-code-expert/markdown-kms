---
status: complete
phase: 02-markdown-rendering-editor-formatting
source: [02-VERIFICATION.md]
started: 2026-08-02T04:55:06Z
updated: 2026-08-08T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 한글 IME 조합 안전성
expected: 실제 IME로 '한글 조합 테스트'를 입력하고 조합 중간/인접 지점에서 Bold를 적용 — 음절 누락·중복·순서 뒤바뀜 없음, 문서는 입력값 + Bold 마커와 일치, 미리보기는 한글 텍스트를 <strong> 안에 표시.
result: pass

### 2. 전체 툴바 시각 검수
expected: 14개 컨트롤(제목 드롭다운 + 13개 플랫 버튼)을 각각 hover하고 드롭다운을 연다. 각 버튼은 32×32px 버튼 안에 16px lucide 아이콘을 렌더하고, hover 시 (~300ms 지연 없이) 즉시 올바른 레이블의 툴팁이 뜨며, 시각 상태는 정확히 두 개(기본/hover)로 pressed/서식-활성 애니메이션은 없다. 제목 드롭다운은 정확히 5개 항목(제목1–4 + 본문)을 표시한다.
result: pass

### 3. 미리보기 오버플로 / 긴 텍스트 상태
expected: 끊기지 않는 긴 URL, 넓은 GFM 표, 줄바꿈 없는 긴 코드 라인, 긴 제목/문단을 붙여넣는다. 긴 URL은 창 안에서 줄바꿈되고, 넓은 표와 긴 코드 라인은 각자의 컨테이너 안에서 가로 스크롤되며, 긴 제목/문단은 말줄임 잘림 없이 자연스럽게 줄바꿈된다.
result: pass

### 4. 비영속 계약
expected: 내용을 입력한 뒤 브라우저 탭을 새로고침한다. 모든 내용이 사라지고(에디터가 빈 상태로 복귀), 어느 시점에도 저장 표시·상태 바·미저장 변경 경고가 나타나지 않는다(영속성은 Phase 4 담당 — 의도된 동작, 버그 아님).
result: pass

### 5. (참고용, 비차단) 열린 코드 펜스 안 라인의 제목
expected: heading.ts는 현재 열린 ``` 코드 펜스를 감지하지 못한다(RESEARCH Pitfall #5, 02-04-SUMMARY.md에 표기, 고정 fixture로 미검증). 이 엣지가 실사용에서 문제되는지 확인 — 명세상 EDIT-01을 차단하지 않는다.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
