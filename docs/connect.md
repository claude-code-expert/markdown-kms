# Vercel 최초 연동 가이드

markdown-kms를 Vercel에 처음 배포할 때 어디서 무엇을 입력하는지 순서대로 정리한 문서. 이미 배포된 프로젝트를 재구성하거나 새 환경(스테이징 등)을 만들 때도 동일하게 적용된다.

관련 문서: 스택·환경 전제는 `TRD.md` §1, 업로드 스토리지 교체 지점은 `TRD.md` §8.

---

## 요약

Vercel에 넣어야 할 환경변수는 **3개**다.

| 키 | 값 | 어디서 얻나 |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** 연결 문자열 | Neon 콘솔 Connection Details |
| `AUTH_SECRET` | 랜덤 32바이트 base64 | `openssl rand -base64 32` |
| `AUTH_URL` | `https://<도메인>` | 배포 후 확정되는 프로덕션 도메인 |

넣지 않아도 되는 것: `DATABASE_URL_TEST`(vitest 로컬 전용), `NODE_ENV`(Vercel이 자동 설정).

그리고 env만으로는 앱이 돌지 않는다. 배포 후 **마이그레이션 + 시드**를 1회 실행해야 한다(3단계).

---

## 0단계 — 프로젝트 임포트

Vercel 대시보드 → **Add New… → Project** → GitHub 레포 `markdown-kms` 선택.

Configure Project 화면에서:

- Framework Preset: `Next.js` (자동 감지)
- Build Command: 기본값 그대로 (`pnpm build` 자동 인식)
- Production Branch: `main`

**Deploy를 누르기 전에** 같은 화면의 Environment Variables 섹션을 펼쳐 2단계의 값을 먼저 넣는다. 안 넣고 배포하면 빌드가 `Error: DATABASE_URL is not set`으로 죽는다(`src/db/index.ts:7`에서 fail-fast).

---

## 1단계 — DB 먼저 만들기

환경변수 값이 여기서 나오므로 DB 생성이 먼저다.

Vercel 대시보드 → 프로젝트 → **Storage 탭 → Create Database → Neon** (Marketplace 통합).

- Region: `ap-southeast-1` (Singapore) — 한국에서 가장 가깝다

생성 후 Neon 콘솔(`console.neon.tech`) → 해당 프로젝트 → **Connection Details**에서 연결 문자열 **두 종류**를 복사한다. 용도가 달라 둘 다 필요하다.

| 종류 | 호스트 모양 | 용도 |
|---|---|---|
| **Pooled** | `...-pooler.ap-southeast-1.aws.neon.tech` | Vercel에 넣을 `DATABASE_URL`. 서버리스는 인스턴스마다 커넥션을 열어 금방 소진되므로 pooler가 필수 |
| **Unpooled** (Direct) | `...ap-southeast-1.aws.neon.tech` (`-pooler` 없음) | 로컬에서 마이그레이션·시드를 돌릴 때만. DDL은 PgBouncer를 통과하지 못한다 |

Neon 콘솔의 "Pooled connection" 토글을 켜고 끄면 각각의 문자열이 나온다. 둘 다 임시로 저장해둔다.

> **함정 ①** — Neon 통합은 env를 자동 주입하는데 이름에 프로젝트명 프리픽스가 붙는다(`markdownkms_DATABASE_URL`). 코드는 plain `DATABASE_URL`만 읽으므로, 자동 주입만 믿으면 빌드가 죽는다. 아래 2단계에서 plain 이름으로 **직접 추가**해야 한다.

앱 코드는 pooled 엔드포인트를 전제로 `postgres(url, { prepare: false })`로 접속한다(PgBouncer transaction mode는 prepared statement를 보장하지 않음). direct 연결에서도 안전한 설정이라 그대로 두면 된다.

---

## 2단계 — 환경변수 3개 입력

**위치**: 프로젝트 → **Settings → Environment Variables → Add New**

각 항목의 Environment는 **Production + Preview 둘 다 체크**한다. Development는 로컬 `.env.local`을 쓰므로 불필요하다.

### ① `DATABASE_URL`

```
postgresql://<user>:<password>@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

1단계에서 복사한 **pooled** 문자열 그대로. 호스트에 `-pooler`가 들어있는지 반드시 확인한다.

### ② `AUTH_SECRET`

로컬 터미널에서 생성:

```bash
openssl rand -base64 32
```

출력된 문자열을 붙여넣는다. 앞뒤 공백이나 줄바꿈이 섞이면 런타임에 빈 값으로 잡혀 `[auth][error] MissingSecret`이 나고 `/api/auth/csrf`·`/api/auth/session`이 500을 반환한다. 붙여넣은 뒤 커서를 끝으로 옮겨 공백이 없는지 확인할 것.

### ③ `AUTH_URL`

```
https://<프로젝트명>.vercel.app
```

**끝에 슬래시를 붙이지 않는다.** 워크스페이스 초대 링크의 origin으로 쓰이며(`src/app/api/workspaces/[id]/invitations/route.ts:65`), 없으면 초대 API가 `AUTH_URL (or NEXTAUTH_URL) is not configured`로 500을 낸다. 도메인을 아직 모르면 일단 배포하고 도메인 확정 후 추가한 뒤 **재배포**한다.

---

## 3단계 — 배포 후 DB 초기화 (필수)

Deploy가 성공해도 DB는 빈 껍데기다. 테이블도 없고 `기본 워크스페이스` row도 없어 회원가입이 전부 500(`default workspace not seeded`)이 난다.

로컬 터미널에서 **unpooled** 문자열로 두 번 실행한다.

```bash
# 1) 테이블 생성 — DDL이라 반드시 unpooled
DATABASE_URL='postgresql://user:pw@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' pnpm drizzle-kit migrate

# 2) 기본 워크스페이스 시드
DATABASE_URL='postgresql://user:pw@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' pnpm tsx src/db/seed.ts
```

인라인 `DATABASE_URL=` 주입은 안전하다 — `drizzle.config.ts`의 `process.loadEnvFile`은 셸 env를 덮어쓰지 않는다.

pg_trgm 검색 인덱스는 마이그레이션 `0006`에 포함돼 있어 위 명령으로 함께 생성된다.

---

## 4단계 — 확인

```bash
curl -I https://<도메인>/api/auth/csrf
```

- `200` → `AUTH_SECRET` 정상
- `500` → 2단계 ②를 삭제 후 재등록하고 재배포

그다음 브라우저에서 회원가입 → 로그인 → 문서 생성까지 되면 연동 완료다.

---

## 반복해서 밟는 함정

1. **Neon 통합의 프리픽스 env** — `markdownkms_DATABASE_URL`은 코드가 읽지 않는다. plain `DATABASE_URL`을 직접 추가할 것 (1단계 참조).
2. **env 변경은 재배포해야 반영된다.** 기존 배포에는 적용되지 않는다. Deployments 탭 → 최신 배포 → `⋯` → **Redeploy**.
3. **`AUTH_SECRET`을 Sensitive로 등록하면 값을 다시 읽을 수 없다.** 값이 의심될 때 확인할 방법이 없으므로 `vercel env rm AUTH_SECRET production` → 재등록 → 재배포가 유일한 경로다.
4. **DB 시드 누락** — 마이그레이션만 돌리고 시드를 건너뛰면 회원가입이 전부 실패한다.

---

## 알려진 미해결 이슈

`/api/uploads`(이미지 업로드)는 `public/uploads`에 디스크 쓰기를 하므로 Vercel 프로덕션에서 500이 난다. 환경변수로는 해결되지 않는다.

고칠 때는 `src/lib/storage.ts`의 `saveUpload` 하나만 교체하면 된다 — TRD §8이 이 스왑을 전제로 설계돼 있다. 후보는 Vercel Blob.
