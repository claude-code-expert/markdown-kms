# Vercel 최초 연동 가이드

markdown-kms를 Vercel에 처음 배포할 때 어디서 무엇을 입력하는지 순서대로 정리한 문서. 이미 배포된 프로젝트를 재구성하거나 새 환경(스테이징 등)을 만들 때도 동일하게 적용된다.

관련 문서: 스택·환경 전제는 `TRD.md` §1, 업로드 스토리지 교체 지점은 `TRD.md` §8, Google 로그인 연동은 `oauth-google.md`.

---

## 요약

Vercel에 넣어야 할 환경변수는 **3개**다.

| 키 | 값 | 어디서 얻나 |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** 연결 문자열 | Neon 콘솔 Connection Details |
| `AUTH_SECRET` | 랜덤 32바이트 base64 | `openssl rand -base64 32` |
| `AUTH_URL` | `https://<도메인>` | 배포 후 확정되는 프로덕션 도메인 |

기능별로 필요한 env가 더 있다. 둘 다 절차가 따로 있고 이 문서 범위 밖이다.

| 기능 | 추가 env | 문서 | 없으면 |
|---|---|---|---|
| Google 로그인 | `AUTH_GOOGLE_ID`·`AUTH_GOOGLE_SECRET` | `oauth-google.md` | 버튼만 동작 안 함 |
| 가입 이메일 인증 | `RESEND_API_KEY` | `email-verification.md` | **아무도 가입을 못 끝냄** (코드가 서버 로그에만 남음) |

넣지 않아도 되는 것: `DATABASE_URL_TEST`(vitest 로컬 전용), `NODE_ENV`(Vercel이 자동 설정).

그리고 env만으로는 앱이 돌지 않는다. 배포 후 **마이그레이션 + 시드**를 1회 실행해야 한다(3단계). 마이그레이션은 배포할 때마다 새로 추가됐는지 확인한다 — 예를 들어 `0009`(이메일 인증)를 빠뜨리면 가입이 전부 500이다.

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

> **함정 ②** — DB 연결 도중 아래 에러가 뜨면, 프로젝트에 같은 이름의 env가 **이미 있어서** 통합이 덮어쓰기를 거부한 것이다.
>
> ```
> This project already has an existing environment variable with name DATABASE_URL in one of the chosen environments
> ```
>
> 통합이 주입하는 이름은 `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` 여섯 개다. 선택한 환경(Production/Preview/Development) 중 **한 곳에라도** 겹치는 이름이 있으면 막힌다.
>
> 해결: Settings → Environment Variables에서 겹치는 항목을 **삭제하거나 이름을 바꾼 뒤** 연결을 재시도한다. 이전에 남은 Neon 통합이 원인이면 그 통합 자체를 제거하면 변수도 함께 지워진다.
>
> 순서를 뒤집는 게 더 편하다 — 2단계에서 `DATABASE_URL`을 수동 등록하기 **전에** DB 연결을 먼저 끝내면 이 충돌이 아예 안 난다.

연결이 끝나면 `DATABASE_URL`은 통합이 관리하는 변수가 된다. 이때부터 Settings 화면에서 그 항목의 값을 손으로 못 고친다 — 편집을 누르면 Storage(Neon) 화면으로 넘어간다. 값을 직접 쥐고 싶으면 통합을 쓰지 말고 Neon 콘솔에서 pooled 문자열을 복사해 2단계처럼 수동 등록한다(대신 비밀번호 로테이션 자동 동기화는 없어진다).

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

**TLD는 `.app`이다. `.com`이 아니다.** Vercel 배포 도메인은 `*.vercel.app`이고, `*.vercel.com`은 이 프로젝트와 무관한 별개 도메인이라 그대로 404가 난다. 오타가 나면 로그아웃이 깨진다 — `SiteHeader.tsx:29`의 `signOut({ redirectTo: "/" })`는 상대 경로라 Auth.js가 `AUTH_URL` origin에 붙여 절대 URL을 만들기 때문이다. 로그인·회원가입은 리다이렉트 origin을 타지 않아 멀쩡해 보이므로, 로그아웃에서만 증상이 드러난다.

의심되면 추측하지 말고 확인한다:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -I https://<프로젝트명>.vercel.app/
```

`200`이 나오는 쪽이 맞는 도메인이다. 브라우저 강력 새로고침으로는 절대 해결되지 않는다 — 캐시가 아니라 잘못된 origin으로 나가는 것이다.

**끝에 슬래시를 붙이지 않는다.** 워크스페이스 초대 링크의 origin으로도 쓰이며(`src/app/api/workspaces/[id]/invitations/route.ts:65`), 없으면 초대 API가 `AUTH_URL (or NEXTAUTH_URL) is not configured`로 500을 낸다. 도메인을 아직 모르면 일단 배포하고 도메인 확정 후 추가한 뒤 **재배포**한다.

값을 고친 뒤에는 반드시 재배포하고, 초대 링크도 한 번 재발급해 origin이 정상인지 확인한다(깨진 도메인으로 이미 나간 링크는 죽은 링크다).

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

### 이건 최초 1회가 아니다 — 마이그레이션이 추가될 때마다 다시 밟아야 한다

`git push` → Vercel 자동 배포는 **코드만** 옮긴다. 새 마이그레이션을 적용하지 않은 채 배포하면 새 컬럼을 읽는 코드가 그 컬럼이 없는 DB보다 먼저 도착한다.

2026-08-29에 실제로 그렇게 터졌다. `0009`(이메일 인증)를 안 돌린 상태로 배포되어 가입이 전부 500이 났다.

```
signup failed Error: Failed query: select "id", "email_verified" from "user" ...
[cause]: column "email_verified" does not exist   ← PG 42703
```

**증상이 `column "..." does not exist`면 항상 이것이다.** env도 코드도 아니고 마이그레이션 누락이다. 위 1) 명령을 돌리면 끝난다.

### 자동화 (권장)

이 단계를 사람이 기억하지 않게 하려면 Vercel에 env를 하나 더 넣는다.

| 키 | 값 | Environment |
|---|---|---|
| `MIGRATE_DATABASE_URL` | Neon **unpooled** 문자열 | **Production만** |

`package.json`의 `vercel-build`가 `next build` 앞에서 `scripts/migrate-on-build.mjs`를 부르고, 그 스크립트가 이 변수가 있을 때만 마이그레이션을 적용한다. 마이그레이션이 실패하면 빌드가 중단되어 스키마를 앞서가는 코드가 배포되지 않는다.

Production에만 넣는 이유는 preview 배포가 프로덕션 DB에 DDL을 치지 않게 하기 위함이다. 변수가 없는 환경(로컬·preview·다른 개발자)의 빌드는 이 스크립트가 있기 전과 완전히 동일하게 동작한다.

`DATABASE_URL`(pooled)과 값이 다르다는 점에 주의한다 — DDL은 PgBouncer를 통과하지 못하므로 반드시 unpooled 쪽이다(1단계 표 참조).

---

## 4단계 — 확인

```bash
curl -I https://<도메인>/api/auth/csrf
```

- `200` → `AUTH_SECRET` 정상
- `500` → 2단계 ②를 삭제 후 재등록하고 재배포

그다음 브라우저에서 회원가입 → 로그인 → 문서 생성까지 되면 연동 완료다.

---

## 5단계 — 커스텀 도메인 연결 (가비아)

`*.vercel.app` 대신 보유 도메인을 붙이는 절차. 4단계까지 정상 동작하는 상태에서 시작한다.

**전제**: 도메인의 네임서버가 가비아여야 한다. 다른 곳(Cloudflare 등)을 쓰고 있으면 가비아 DNS 관리툴에 뭘 넣어도 적용되지 않는다. My가비아 → 도메인 관리에서 네임서버가 `ns.gabia.co.kr` 계열인지 먼저 확인한다.

### ① Vercel에 도메인 등록

프로젝트 → **Settings → Domains → Add Domain** → 도메인 입력.

apex(`example.com`)를 넣으면 Vercel이 `www.example.com`도 같이 추가할지 묻는다. 둘 다 등록하고 **한쪽을 primary로, 다른 쪽은 리다이렉트**로 두는 게 정석이다. 어느 쪽을 primary로 하든 앱 동작은 같지만, 뒤의 ④에서 `AUTH_URL`에 넣을 값이 primary 하나로 고정된다.

### ② 도메인 카드의 값 복사

등록 직후 도메인 카드에 넣어야 할 DNS 레코드가 표시된다. **이 화면의 값을 그대로 쓴다.**

블로그에서 흔히 보는 `76.76.21.21`과 `cname.vercel-dns.com`을 그대로 복사하면 안 된다. A 레코드 IP도(신규 프로젝트는 `216.198.79.1` 계열을 받는다) CNAME 타깃도(`d1d4fc829fe7bc7c.vercel-dns-017.com` 같은 프로젝트 고유값) 프로젝트마다 다르고, Vercel의 검증은 **정확히 그 값**이 있는지를 본다. 값이 다르면 영원히 `Invalid Configuration`에서 멈춘다.

### ③ 가비아에 레코드 입력

My가비아 → 도메인 목록 → 해당 도메인 **관리툴** → DNS 정보 → **설정 → 레코드 수정 → 레코드 추가**.

| 타입 | 호스트 | 값/위치 |
|---|---|---|
| `A` | `@` | 도메인 카드에 표시된 IP |
| `CNAME` | `www` | 도메인 카드에 표시된 CNAME 타깃 + **끝에 마침표** |

가비아는 CNAME 값 끝에 마침표를 요구한다. `xxxx.vercel-dns-017.com.` 처럼 끝점을 찍지 않으면 도메인 뒤에 자기 도메인이 한 번 더 붙어 엉뚱한 호스트로 등록된다.

apex(`@`)에는 A 레코드만 넣는다. `@`에 CNAME을 넣으면 안 되고, 가비아도 `@`와 `www` 양쪽에 CNAME을 동시에 두는 것을 막는다.

저장 후 전파까지 보통 10분~1시간. Vercel 도메인 카드가 **Valid Configuration**으로 바뀌면 인증서(Let's Encrypt)가 자동 발급된다.

### ④ `AUTH_URL` 교체 + 재배포 (빠뜨리면 로그아웃이 깨진다)

DNS가 붙어도 앱은 아직 옛 도메인을 자기 origin으로 알고 있다. Settings → Environment Variables에서 `AUTH_URL`을 primary 도메인으로 바꾼다.

```
https://example.com
```

끝 슬래시 없이, primary로 정한 쪽 하나만. 그리고 **재배포**한다. 안 바꾸면 2단계 ③에 적은 것과 똑같은 증상이 난다 — 로그인은 되는데 로그아웃이 `*.vercel.app`으로 튀고, 초대 링크도 옛 도메인으로 발송된다.

### ⑤ 확인

```bash
curl -s -o /dev/null -w "%{http_code}\n" -I https://example.com/
curl -s -o /dev/null -w "%{http_code}\n" -I https://example.com/api/auth/csrf
```

둘 다 `200`이면 브라우저에서 로그인 → **로그아웃**까지 확인한다. 로그아웃이 새 도메인 `/`로 돌아오면 완료다.

기존 `*.vercel.app`은 계속 살아있다. 세션 쿠키는 origin마다 별개라, 옛 도메인에 로그인해 있던 세션은 새 도메인에서 이어지지 않는다(정상 동작).

---

## 반복해서 밟는 함정

1. **Neon 통합의 프리픽스 env** — `markdownkms_DATABASE_URL`은 코드가 읽지 않는다. plain `DATABASE_URL`을 직접 추가할 것 (1단계 참조).
2. **env 변경은 재배포해야 반영된다.** 기존 배포에는 적용되지 않는다. Deployments 탭 → 최신 배포 → `⋯` → **Redeploy**.
3. **`AUTH_SECRET`을 Sensitive로 등록하면 값을 다시 읽을 수 없다.** 값이 의심될 때 확인할 방법이 없으므로 `vercel env rm AUTH_SECRET production` → 재등록 → 재배포가 유일한 경로다.
4. **DB 시드 누락** — 마이그레이션만 돌리고 시드를 건너뛰면 회원가입이 전부 실패한다.
4-1. **새 마이그레이션을 안 돌리고 배포한다.** 최초 1회로 끝나는 일이 아니다. `column "..." does not exist`(42703)로 500이 나면 항상 이것이다. `MIGRATE_DATABASE_URL`을 등록해 자동화하는 쪽을 권장한다 (3단계 참조).
5. **env를 먼저 넣고 DB를 연결하면 이름 충돌로 막힌다.** `DATABASE_URL` 수동 등록 → Neon 연결 순서면 `already has an existing environment variable` 에러가 난다. DB 연결을 먼저 하거나, 겹치는 변수를 지우고 재시도할 것 (1단계 함정 ② 참조).
6. **통합이 주입한 변수는 손으로 못 고친다.** 편집을 누르면 Storage 화면으로 넘어간다. 값 교체는 통합 쪽에서 하거나, 통합을 떼고 수동 등록으로 전환해야 한다.
7. **`AUTH_URL`의 `.app`을 `.com`으로 쓴다.** 로그아웃만 404가 나면 십중팔구 이것이다. 브라우저 캐시 문제로 오인하기 쉬우니 `curl -I`로 도메인부터 확인할 것 (2단계 ③ 참조).
8. **커스텀 도메인 붙이고 `AUTH_URL`을 안 바꾼다.** DNS는 정상인데 로그아웃이 `*.vercel.app`으로 튄다. 5단계 ④는 선택이 아니다.
9. **DNS 값을 블로그에서 복사한다.** A 레코드 IP와 CNAME 타깃은 프로젝트 고유값이라 Vercel 도메인 카드에 뜨는 것만 유효하다. 다르면 `Invalid Configuration`에서 안 넘어간다.
10. **가비아 CNAME 끝점 누락.** 값 끝에 `.`을 안 찍으면 도메인이 한 번 더 붙어 등록된다.
11. **CAA 레코드가 Let's Encrypt를 막고 있다.** 도메인 검증은 통과했는데 인증서만 안 나오면 이걸 의심한다. 기존 CAA가 있으면 `letsencrypt.org`를 허용하도록 고치거나 제거한다.

---

## 알려진 미해결 이슈

`/api/uploads`(이미지 업로드)는 `public/uploads`에 디스크 쓰기를 하므로 Vercel 프로덕션에서 500이 난다. 환경변수로는 해결되지 않는다.

고칠 때는 `src/lib/storage.ts`의 `saveUpload` 하나만 교체하면 된다 — TRD §8이 이 스왑을 전제로 설계돼 있다. 후보는 Vercel Blob.
