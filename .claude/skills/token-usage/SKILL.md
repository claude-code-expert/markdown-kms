---
name: token-usage
description: >
  현재/특정 세션의 토큰 사용량을 집계한다. "토큰 얼마나 사용", "토큰 측정",
  "토큰 사용량", "이번 세션 토큰", "token usage" 류 발화에 발동한다.
  input·output·cache creation/read를 나눠 보여주고 총합을 낸다.
---

# token-usage — 세션 토큰 집계

세션 transcript(jsonl)를 훑어 assistant 턴별 usage를 더한다. `.claude/scripts/token-usage.py`가 실제 계산을 하고, 이 스킬은 언제 어떻게 부르는지만 정한다.

## 실행

```bash
python3 .claude/scripts/token-usage.py            # 최신 세션 자동 탐색
python3 .claude/scripts/token-usage.py <파일.jsonl>  # 특정 세션 지정
```

인자 없으면 `~/.claude/projects/<cwd>/` 에서 가장 최근 jsonl을 고른다. 대개 인자 없이 부르면 된다 — 지금 세션이 최신이므로.

## 출력 읽는 법

- **input_tokens (uncached)**: 캐시 안 탄 순수 입력. 보통 작다.
- **cache_creation / cache_read**: 프롬프트 캐시. CLAUDE.md·MCP 문서·툴 정의가 여기 대부분 잡힌다. 총합의 대부분을 차지하는 게 정상.
- **output_tokens**: 모델이 실제 생성한 양. 체감 "작업량"에 가장 가깝다.
- **TOTAL**: 넷을 합친 값. 과금·컨텍스트 압력을 볼 땐 이걸 본다.

## 주의

- 최신 세션 = "지금 이 대화"인지 확인한다. mtime 기준이라 다른 세션이 방금 갱신됐으면 그게 잡힐 수 있다. 애매하면 파일 경로(출력 첫 줄)를 사용자에게 보여주고 맞는지 물어본다.
- output이 유독 작고 cache가 크면 "일은 조금, 컨텍스트는 많이" — CLAUDE.md·MCP 문서 로딩 비용이다. 컨텍스트를 줄이려면 그쪽을 손본다.
