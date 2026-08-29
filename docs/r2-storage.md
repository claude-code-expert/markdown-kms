# Cloudflare R2 이미지 업로드 연동 가이드

에디터 툴바의 **클라우드에 이미지 업로드** 버튼이 쓰는 저장소를 붙이는 절차. Cloudflare 계정 생성부터 로컬·프로덕션 환경변수까지 순서대로 정리한다.

관련 문서: 배포·환경변수 전반은 `connect.md`, 스토리지 설계 원칙은 `TRD.md` §8.

---

## 요약

환경변수 **4개**를 넣으면 동작한다.

| 키 | 값 | 어디서 얻나 |
|---|---|---|
| `R2_ACCOUNT_ID` | 32자 hex | Cloudflare 대시보드 우측 Account ID |
| `R2_ACCESS_KEY_ID` | R2 API 토큰의 Access Key ID | R2 → Manage API Tokens |
| `R2_SECRET_ACCESS_KEY` | 같은 토큰의 Secret Access Key | 발급 직후 1회만 표시 |
| `R2_BUCKET` | 버킷 이름 (예: `markdown-kms-uploads`) | 직접 지정 |

**버킷은 비공개로 둔다.** Public Access를 켜지 않는다 — 이미지는 앱의 `/api/uploads/r2/...` 라우트가 권한을 확인한 뒤 대신 내려준다.

env가 없으면 업로드 버튼이 `503`과 함께 "클라우드 저장소가 설정되지 않았어요"를 띄운다. 앱의 나머지 기능과 기존 이미지 버튼은 영향받지 않는다.

---

## 0단계 — Cloudflare 계정과 R2 활성화

**위치**: [dash.cloudflare.com](https://dash.cloudflare.com) 가입 → 좌측 메뉴 **R2 Object Storage**

R2는 처음 켤 때 **결제 수단 등록을 요구한다.** 무료 한도가 있지만(월 10GB 저장, Class A 100만 / Class B 1000만 요청) 카드 등록 자체는 건너뛸 수 없다.

`mingleup.net`의 DNS가 가비아에 있어도 상관없다 — 이 방식은 커스텀 도메인을 쓰지 않는다.

---

## 1단계 — 버킷 생성

**Create bucket** → 이름 입력 (예: `markdown-kms-uploads`)

| 항목 | 값 |
|---|---|
| Location | `Asia-Pacific (APAC)` — 한국에서 가장 가깝다 |
| Storage class | `Standard` |

생성 후 **Settings에서 Public Access는 켜지 않는다.** 기본값이 비공개이므로 그냥 두면 된다.

> **함정 ①** — 흔한 R2 튜토리얼은 대부분 "Public Access를 켜고 `pub-xxx.r2.dev` URL을 쓰라"고 안내한다. 그렇게 하면 **업로드된 모든 이미지가 URL만 알면 누구나 열람 가능**해진다. 워크스페이스 권한이 무의미해지므로 이 프로젝트는 그 방식을 쓰지 않는다.

---

## 2단계 — API 토큰 발급

**위치**: R2 → **Manage API Tokens** → **Create API Token**

| 항목 | 값 |
|---|---|
| Token name | `markdown-kms` |
| Permissions | **Object Read & Write** |
| Specify bucket | 1단계에서 만든 버킷만 선택 |
| TTL | Forever (또는 운영 정책에 맞게) |

버킷을 한정하는 것이 중요하다. 계정 전체 권한을 주면 토큰이 새는 순간 다른 버킷까지 함께 털린다.

생성하면 **Access Key ID**와 **Secret Access Key**가 표시된다.

> **함정 ②** — Secret Access Key는 **이 화면에서만** 전체가 보인다. 창을 닫으면 다시 볼 수 없고, 재발급 외에 방법이 없다. 바로 복사한다.

같은 화면에 표시되는 S3 엔드포인트(`https://<account-id>.r2.cloudflarestorage.com`)의 `<account-id>` 부분이 `R2_ACCOUNT_ID`다. 엔드포인트 전체가 아니라 **hex 문자열만** 넣는다.

---

## 3단계 — 로컬 설정

`.env.local`에 4줄을 추가한다.

```
R2_ACCOUNT_ID=abc123...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=markdown-kms-uploads
```

`.env.example`에도 값 없이 키만 남긴다(실제 값은 `.gitignore`가 `.env*`를 전부 막는다).

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

env는 기동 시점에 한 번만 읽히므로 개발 서버를 **재시작**한다.

```bash
pnpm dev
```

---

## 4단계 — 프로덕션 설정

**위치**: Vercel → 프로젝트 → **Settings → Environment Variables**

4개를 모두 **Production**에 등록한다. `R2_SECRET_ACCESS_KEY`는 Sensitive로 체크한다.

등록 후 **재배포**한다 — env 변경은 기존 배포에 소급 적용되지 않는다(`connect.md` §반복해서 밟는 함정 2).

---

## 5단계 — 확인

문서 편집 화면에서 툴바의 **클라우드에 이미지 업로드**(구름 아이콘, 기존 이미지 아이콘 바로 오른쪽)를 누르고 PNG를 하나 고른다.

1. 에디터에 `![업로드 중...]()` 플레이스홀더가 잠깐 뜬다
2. `![파일명](/api/uploads/r2/w/<워크스페이스id>/<uuid>.png)`로 바뀐다
3. 미리보기에 이미지가 보인다
4. Cloudflare R2 대시보드 → 버킷 → Objects에 `w/<워크스페이스id>/<uuid>.png`가 있다

권한이 실제로 걸리는지도 확인한다. 다른 계정으로 로그인해 위 이미지 URL을 직접 열면 **404**가 나야 한다(403이 아니라 404다 — 권한 없는 사람에게 "그 키는 존재한다"를 알려주지 않는다).

---

## 동작 방식

```
툴바 버튼 → 숨겨진 <input type=file>
  └─ POST /api/uploads/r2?wsId=<id>     requireRole(wsId, "EDITOR")
       ├─ Content-Length 선검사 (5MB)
       ├─ 매직바이트 스니핑 (PNG/JPEG/GIF/WEBP만)
       └─ R2 PutObject  key = w/<wsId>/<uuid>.<ext>
  └─ 본문에 ![alt](/api/uploads/r2/w/<wsId>/<uuid>.png) 삽입

이미지 표시
  └─ GET /api/uploads/r2/w/<wsId>/<uuid>.png
       ├─ 키에서 wsId를 파싱 → requireRole(wsId, "VIEWER")
       └─ R2 GetObject → 스트리밍
```

**키에 워크스페이스 id를 박아 넣은 것이 이 설계의 핵심이다.** 이미지 한 장을 서빙할 때마다 DB를 뒤져 소유 문서를 찾지 않고도 권한을 검증할 수 있다.

**presigned URL을 쓰지 않는 이유**: 마크다운 본문에 URL이 그대로 저장되고 export도 원문 그대로 나간다(NFR-5.2). 만료되는 URL을 넣으면 시간이 지난 문서의 이미지가 전부 깨진다.

**클라이언트가 보낸 `file.type`·`file.name`은 신뢰하지 않는다.** 서버가 바이트를 직접 읽어 형식을 판정하고(`sniffImageType`, `storage.ts`와 공유), 그 결과로 확장자와 `Content-Type`을 정한다. 이름은 alt 텍스트로만 쓰이며 마크다운 구조 문자가 제거된다.

---

## 기존 "이미지 삽입" 버튼과의 관계

툴바에는 이제 이미지 버튼이 **둘**이다.

| 버튼 | 라우트 | 저장 위치 | 권한 검증 |
|---|---|---|---|
| 이미지 삽입 | `POST /api/uploads` | 서버 로컬 디스크 `public/uploads` | 쓰기만. **읽기는 무방비** |
| 클라우드에 이미지 업로드 | `POST /api/uploads/r2` | Cloudflare R2 | 쓰기·읽기 모두 |

**기존 버튼은 Vercel 프로덕션에서 동작하지 않는다.** 서버리스 파일시스템이 읽기 전용이라 디스크 쓰기가 500으로 실패한다(`connect.md` §알려진 미해결 이슈). 로컬 개발에서만 쓸 수 있다.

둘을 하나로 합치려면 `src/lib/storage.ts`의 `saveUpload` 본문을 `saveUploadToR2` 호출로 바꾸면 된다 — TRD §8이 그 스왑을 전제로 설계한 지점이고, 호출부는 건드릴 필요가 없다. 지금은 요청대로 두 경로를 나란히 둔 상태다.

---

## 반복해서 밟는 함정

1. **`R2_ACCOUNT_ID`에 엔드포인트 전체를 넣는다.** `https://abc123.r2.cloudflarestorage.com`이 아니라 `abc123`만 넣는다. 코드가 저 URL을 조립한다.
2. **Secret Access Key를 놓친다.** 발급 화면을 닫으면 끝이다. 재발급 외에 방법이 없다 (2단계 함정 ②).
3. **Public Access를 켠다.** 튜토리얼 대부분이 그렇게 안내하지만, 이 구조에서는 켤 필요가 없고 켜면 권한 검증이 무의미해진다 (1단계 함정 ①).
4. **토큰 권한을 계정 전체로 준다.** 버킷 하나로 한정한다.
5. **env 추가하고 재배포를 안 한다.** `connect.md`와 같은 항목이다.
6. **`.env.local`만 고치고 dev 서버를 안 껐다.** env는 기동 시점에 한 번만 읽힌다.
7. **로컬 디스크 버튼과 헷갈린다.** 프로덕션에서 이미지 업로드가 500이면 구름 아이콘이 아닌 쪽을 눌렀을 가능성이 높다.

---

## 알려진 미해결 이슈

**이미지 서빙이 서버리스 함수를 거친다.** 이미지 한 장마다 함수가 호출되므로 CDN 직접 서빙보다 느리고 비용이 든다. `cache-control: private, max-age=31536000, immutable`로 브라우저 캐시는 최대한 활용하지만, 공유 CDN 캐시는 의도적으로 막았다 — 권한이 바뀔 수 있는데 CDN에 올려두면 권한 없는 사람에게도 흘러갈 수 있다.

트래픽이 문제가 되면 선택지는 두 가지다. (1) 공개해도 되는 이미지에 한해 R2 커스텀 도메인으로 직접 서빙 — 단, `mingleup.net` DNS를 가비아에서 Cloudflare로 옮겨야 한다. (2) 서명된 짧은 URL을 쓰되 마크다운에는 영구 경로를 저장하고 렌더 시점에 치환 — 파이프라인이 복잡해진다.

**삭제된 문서의 이미지가 R2에 남는다.** 문서를 지워도 오브젝트는 그대로다. 워크스페이스 권한 검증은 계속 걸리므로 유출 위험은 없지만 저장 용량은 계속 늘어난다. 정리가 필요해지면 문서 본문에서 참조되지 않는 키를 주기적으로 지우는 작업이 별도로 필요하다.
