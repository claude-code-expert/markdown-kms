# UAT 검증 샘플 — 전체 마크다운 문법

이 파일은 `02-UAT.md`의 5개 테스트를 실제로 검증하기 위한 붙여넣기 샘플이다.
사용법: `pnpm dev` → 에디터에 이 파일 전체를 붙여넣고, 아래 섹션별 기대 결과를 미리보기와 대조한다.
지원 범위: CommonMark 0.31.2 + GFM 3종(취소선·태스크·표) + remark-breaks(단일 개행 → `<br>`). footnote·autolink-literal 등 그 외 GFM은 렌더되지 않아야 한다.

---

## Test 1 — 한글 IME 조합 안전성 + Bold

이 줄의 **한글 조합 테스트**를 검증한다. 실제 IME로 이 문장을 다시 타이핑하고 조합 중간/인접에서 Bold(`**`)를 적용해도 음절 누락·중복·순서 뒤바뀜이 없어야 한다.

- 기대(문서): `**한글 조합 테스트**`
- 기대(미리보기): <strong>한글 조합 테스트</strong> — 한글이 그대로 굵게

---

## Test 2 — 전체 툴바 14컨트롤 대응 문법

### 제목 드롭다운 (제목1–4 + 본문)

# 제목1 (H1)
## 제목2 (H2)
### 제목3 (H3)
#### 제목4 (H4)

본문 문단. 드롭다운에서 "본문"을 고르면 앞의 `#` 프리픽스가 제거되어 이 줄처럼 평문이 된다.

> 참고: 에디터 드롭다운은 제목1–4만 노출하지만, `heading.ts`는 ATX `#`~`######`(H1–H6)를 인식해 스트립한다. 렌더 파이프라인은 아래 H5/H6도 정상 렌더한다.

##### 제목5 (H5)
###### 제목6 (H6)

### inline 그룹 (Bold / Italic / 취소선 / 인라인 코드)

- **굵게 (Bold)** — `**굵게**`
- *기울임 (Italic)* — `*기울임*`
- ***굵게+기울임*** — `***굵게+기울임***`
- ~~취소선 (Strikethrough)~~ — `~~취소선~~` (GFM 활성 3종 중 하나)
- 인라인 코드 `const x = 1;` — `` `const x = 1;` ``

### list 그룹 (Bullet / Ordered / Task)

불릿 리스트:

- 첫 번째 항목
- 두 번째 항목
  - 중첩된 항목 (2단계)
    - 중첩된 항목 (3단계)

순서 리스트:

1. 첫 단계
2. 두 번째 단계
   1. 하위 단계 a
   2. 하위 단계 b

태스크 리스트 (GFM 활성 3종 중 하나):

- [x] 완료된 작업 — 체크박스 체크됨(disabled)
- [ ] 미완료 작업 — 체크박스 빈 상태(disabled)

### block 그룹 (인용 / 코드 블록 / 수평선)

인용문 + 중첩:

> 1단계 인용.
>
> > 2단계 중첩 인용.
> >
> > > 3단계 중첩 인용.

펜스드 코드 블록 (언어 지정 → `class="language-ts"`):

```ts
type Doc = { id: string; content: string };
function save(doc: Doc): void {
  console.log(doc.id);
}
```

수평선(HR) 아래위 구분:

---

### insert 그룹 (링크 / 이미지 / 표)

- 링크: [Claude Code](https://docs.claude.com/claude-code)
- CommonMark 자동 링크(꺾쇠): <https://example.com>
- 이미지: ![대체 텍스트 placeholder](https://placehold.co/120x40/png)

표 (GFM 활성 3종 중 하나, 정렬 포함):

| 왼쪽 정렬 | 가운데 정렬 | 오른쪽 정렬 |
| :------- | :--------: | --------: |
| a        | b          | c         |
| 가       | 나          | 다        |

---

## remark-breaks 검증 (단일 개행 → `<br>`)

이 문단은 첫째 줄
둘째 줄
셋째 줄 — 각 줄이 한 번의 Enter로만 구분됐다.
기대: 세 줄이 한 문단 안에서 `<br>`로 줄바꿈되어 보인다(빈 줄 없이도 줄바꿈 유지).

---

## Test 3 — 미리보기 오버플로 / 긴 텍스트

긴 끊김 없는 URL (창 안에서 줄바꿈되어야 함):

<https://example.com/very/long/unbroken/path/segment-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb>

넓은 표 (컨테이너 안에서 가로 스크롤되어야 함):

| 열1 | 열2 | 열3 | 열4 | 열5 | 열6 | 열7 | 열8 | 열9 | 열10 | 열11 | 열12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- | ---- | ---- |
| 데이터1 | 데이터2 | 데이터3 | 데이터4 | 데이터5 | 데이터6 | 데이터7 | 데이터8 | 데이터9 | 데이터10 | 데이터11 | 데이터12 |

줄바꿈 없는 긴 코드 라인 (코드 컨테이너 안에서 가로 스크롤되어야 함):

```
const veryLongLine = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
```

### 긴 제목이 말줄임 없이 자연스럽게 줄바꿈되는지 — 아주 길고 끊이지 않게 이어지는 제목 텍스트를 넣어 미리보기 창 폭을 넘겨서 여러 줄로 감싸지는지 그리고 어디에서도 말줄임(…)으로 잘리지 않는지를 확인하는 문장형 제목

긴 문단 (말줄임 없이 자연 줄바꿈되어야 함): 이 문단은 한 줄 안에 개행 없이 아주 긴 텍스트를 담아 미리보기 창 폭을 넘겼을 때 자동으로 여러 줄로 감싸지는지, 그리고 어느 지점에서도 말줄임으로 잘리지 않고 전체 내용이 그대로 보이는지를 검증하기 위한 목적의 문장이며 계속 이어져서 충분히 길게 폭을 넘긴다.

---

## Test 5 — 열린 코드 펜스 안의 `#` 라인

아래 펜스 안의 `# 이건 제목이 아니다` 줄은 코드 텍스트로 렌더되어야 하며, H1 제목으로 승격되면 안 된다:

```
# 이건 제목이 아니다 (코드 펜스 내부)
## 이것도 제목이 아니다
일반 코드 라인
```

참고: `heading.ts`(에디터 플러그인)는 커서가 열린 펜스 안에 있을 때 이를 감지하지 못한다(RESEARCH Pitfall #5). 이는 **에디터 토글** 한정 이슈이고, 위처럼 **렌더** 시에는 펜스가 `#`을 보호한다. EDIT-01을 차단하지 않는다.

---

## 미지원 문법 (렌더 안 되어야 정상 — GFM 3종만 활성 불변식 검증)

- 각주: 여기 각주 참조[^1] 는 링크로 변환되지 않고 `[^1]` 리터럴로 남아야 한다.

[^1]: 이 각주 정의도 별도 블록으로 렌더되지 않아야 한다.

- autolink-literal: 꺾쇠 없는 맨 URL https://example.com 은 자동 링크되지 않고 평문으로 남아야 한다.
