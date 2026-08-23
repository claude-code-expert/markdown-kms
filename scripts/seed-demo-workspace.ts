// 일회성 수동 검증용 시드 스크립트 — 지정 워크스페이스에 중첩 폴더 트리와 마크다운 문법별
// 샘플 문서를 채운다. 라우트(zod validation)를 거치지 않고 lib 함수를 직접 호출하므로,
// 실제 쓰기 경로가 하는 NFC 정규화(validation.ts normalizeNFC)를 이 스크립트가 대신 해준다.
//
// loadEnvFile 뒤의 두 lib import는 반드시 동적 import여야 한다 — ESM의 정적 import는
// 소스 순서와 무관하게 파일 최상단으로 호이스팅돼, loadEnvFile보다 먼저 "@/db"가
// DATABASE_URL 없이 초기화되어 버린다(codevillain@localhost:5432 EDB 인스턴스로 잘못
// 접속해 auth 실패 — 로컬엔 Homebrew PG16@5433/EDB PG18@5432 두 개가 떠 있다).
process.loadEnvFile(".env.local");

const WORKSPACE_ID = "de863543-bb8f-4157-a99d-9010fd3be833";

const HEADINGS_MD = `# 제목 1(H1)

## 제목 2(H2)

### 제목 3(H3)

#### 제목 4(H4)

##### 제목 5(H5)

###### 제목 6(H6)

이 문단은 여러 줄로 구성돼 있습니다.
줄바꿈 한 번(단일 개행)만으로도 <br>로 렌더링돼야 합니다(remark-breaks 확장).

빈 줄로 구분하면 새 문단이 됩니다.

---

위는 가로줄(thematic break)입니다.
`;

const EMPHASIS_MD = `# 강조와 인라인 서식

**굵게** 표시한 문장입니다.

*기울임*으로 표시한 문장입니다.

***굵고 기울인*** 문장입니다.

~~취소선~~ 문장입니다(GFM 3종 중 하나).

인라인 코드는 \`const x = 1;\`처럼 표시됩니다.

밑줄 스타일도 지원됩니다: __굵게__, _기울임_.
`;

const LISTS_MD = `# 목록

## 순서 없는 목록

- 첫 번째 항목
- 두 번째 항목
  - 중첩 항목 A
  - 중첩 항목 B
    - 더 깊은 중첩
- 세 번째 항목

## 순서 있는 목록

1. 첫 단계
2. 두 번째 단계
   1. 세부 단계 1
   2. 세부 단계 2
3. 마지막 단계
`;

const TASKS_MD = `# 태스크 목록

- [x] 완료된 작업
- [x] 두 번째 완료 작업
- [ ] 아직 안 한 작업
- [ ] 검토 대기 중인 작업
  - [x] 하위 완료 항목
  - [ ] 하위 미완료 항목
`;

const TABLE_MD = `# 표

| 항목 | 상태 | 담당자 |
| --- | :---: | ---: |
| 로그인 | 완료 | 김민지 |
| 검색 | 진행중 | 박서준 |
| 내보내기 | 대기 | 이하늘 |

왼쪽 정렬(기본) / 가운데 정렬(:---:) / 오른쪽 정렬(---:)을 각각 확인합니다.
`;

const QUOTE_MD = `# 인용문

> 첫 번째 인용입니다.
> 여러 줄에 걸쳐 이어집니다.

> 중첩 인용도 가능합니다.
>
> > 이렇게 안쪽에 한 번 더 인용하면
> > 들여쓰기가 한 단계 더 깊어집니다.

일반 문단으로 돌아옵니다.
`;

const CODE_MD = `# 코드 블록

인라인 코드: \`pnpm dev\`

TypeScript 예시:

\`\`\`typescript
function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

언어 표시 없는 블록:

\`\`\`
plain text block
no syntax highlight
\`\`\`
`;

const LINKS_MD = `# 링크와 이미지

[Markdown 공식 사이트](https://commonmark.org)로 이동하는 링크입니다.

제목 속성이 있는 링크: [CommonMark 스펙](https://spec.commonmark.org/0.31.2/ "CommonMark 0.31.2")

꺾쇠괄호 자동 링크: <https://github.com>

이미지 예시(alt 텍스트 확인용, 실제 파일 없이 깨진 상태로 렌더돼도 정상):

![샘플 다이어그램](https://example.com/diagram.png "다이어그램 제목")
`;

const COMBINED_MD = `# 프로젝트 킥오프 회의록

**일시**: 2026-08-20 14:00
**참석자**: 김민지, 박서준, 이하늘

## 안건

1. 프로젝트 범위 확정
2. 일정 합의
3. 역할 분담

## 결정 사항

- [x] 스코프는 R1(P0) 우선 릴리스로 한정한다
- [x] 디자인 시스템은 \`docs/ui-kit.html\` 토큰을 그대로 따른다
- [ ] 다크 모드는 다음 스프린트로 미룬다

## 역할 분담

| 이름 | 역할 | 담당 영역 |
| --- | --- | --- |
| 김민지 | PM | 일정 관리 |
| 박서준 | FE | 에디터·미리보기 |
| 이하늘 | BE | RBAC·마이그레이션 |

## 메모

> "완벽한 계획보다 빠른 피드백 루프가 낫다" — 회의 중 인용

세부 작업은 \`lib/rbac.ts\`의 ~~구버전 미들웨어~~ 대신 \`requireRole\` 경유로 통일한다.

---

다음 회의는 1주 뒤 같은 시간에 진행한다.
`;

const ESCAPE_MD = `# 특수 문자와 이스케이프

이스케이프한 별표: \\*이건 강조가 아닙니다\\*

이스케이프한 대괄호: \\[이건 링크가 아닙니다\\]

HTML 원문 통과 확인(sanitize 허용 목록 내 태그):

H<sub>2</sub>O 와 x<sup>2</sup> 표기가 살아있어야 합니다.

허용되지 않는 태그 확인(제거·무해화돼야 정상):

<script>alert('XSS')</script>

가로줄 세 가지 표기:

---

***

___
`;

async function main() {
  const { createFolder } = await import("../src/lib/closure");
  const { createDocument, autosaveDocument } = await import("../src/lib/documents");

  async function folder(parentId: string | null, name: string) {
    const row = await createFolder(WORKSPACE_ID, parentId, name);
    return row.id;
  }

  async function doc(folderId: string | null, title: string, content: string) {
    const created = await createDocument(WORKSPACE_ID, folderId, title);
    await autosaveDocument(created.id, content.normalize("NFC"), title.normalize("NFC"), 1);
    return created.id;
  }

  const guideRoot = await folder(null, "문법 가이드");
  const textFmt = await folder(guideRoot, "텍스트 서식");
  const listsTables = await folder(guideRoot, "목록과 표");
  const codeQuote = await folder(guideRoot, "코드와 인용");

  const projectRoot = await folder(null, "프로젝트 문서");
  const planning = await folder(projectRoot, "기획");
  const meetingNotes = await folder(planning, "회의록");
  const dev = await folder(projectRoot, "개발");

  await doc(textFmt, "01. 제목과 문단", HEADINGS_MD);
  await doc(textFmt, "02. 강조와 인라인 서식", EMPHASIS_MD);
  await doc(listsTables, "03. 목록", LISTS_MD);
  await doc(listsTables, "04. 태스크 목록", TASKS_MD);
  await doc(listsTables, "05. 표", TABLE_MD);
  await doc(codeQuote, "06. 인용문", QUOTE_MD);
  await doc(codeQuote, "07. 코드 블록", CODE_MD);
  await doc(planning, "08. 링크와 이미지", LINKS_MD);
  await doc(meetingNotes, "09. 종합 문서 - 킥오프 회의록", COMBINED_MD);
  await doc(dev, "10. 특수 문자와 이스케이프", ESCAPE_MD);

  console.log("done: 8 folders, 10 documents");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
