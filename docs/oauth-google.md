# Google 로그인 연동 가이드

markdown-kms에 Google OAuth 회원가입·로그인을 붙일 때 Google Cloud 콘솔과 환경변수에 무엇을 넣는지 순서대로 정리한 문서. 로컬(`http://localhost:3000`)과 프로덕션(`https://mingleup.net`) 두 환경을 한 번에 다룬다.

관련 문서: Vercel 배포·도메인 연결은 `connect.md`, 인증 스택 전제는 `TRD.md` §1, 자동 가입 역할(EDITOR) 근거는 `PRD.md` §2-5.

---

## 요약

Google 로그인을 쓰려면 기존 환경변수 3개(`connect.md` §요약)에 **2개**를 더한다.

| 키 | 값 | 어디서 얻나 |
|---|---|---|
| `AUTH_GOOGLE_ID` | `1234...apps.googleusercontent.com` | Google Cloud 콘솔 → 사용자 인증 정보 → OAuth 클라이언트 ID |
| `AUTH_GOOGLE_SECRET` | `GOCSPX-...` | 같은 화면. 발급 직후 한 번만 전체가 보인다 |

이름이 `GOOGLE_CLIENT_ID`가 아니라 `AUTH_GOOGLE_ID`인 것이 중요하다. Auth.js v5는 `AUTH_<PROVIDER>_ID` / `AUTH_<PROVIDER>_SECRET` 규칙으로 env를 **자동 주입**하고, 그래서 `src/auth.ts`의 provider 등록이 인자 없는 `Google` 한 단어로 끝난다. 다른 이름을 쓰면 코드는 멀쩡한데 런타임에 `client_id is required`가 난다.

그리고 Google 콘솔에 등록할 **승인된 리다이렉트 URI는 항상 `AUTH_URL` + `/api/auth/callback/google`** 이다. 이 두 값이 한 글자라도 어긋나면 로그인 버튼을 눌렀을 때 Google이 `redirect_uri_mismatch`로 막는다.

DB 스키마 변경은 없다. Auth.js 어댑터를 쓰지 않고 기존 `user` 테이블에 직접 upsert하므로 마이그레이션을 돌릴 필요가 없다(`src/lib/account.ts`).

---

## 0단계 — Google Cloud 프로젝트와 동의 화면

**위치**: [console.cloud.google.com](https://console.cloud.google.com) → 상단 프로젝트 선택기 → **새 프로젝트**

프로젝트 이름은 아무거나(예: `markdown-kms`). 조직이 없는 개인 계정이면 위치는 `조직 없음` 그대로 둔다.

그다음 **API 및 서비스 → Google Auth Platform**으로 간다. 예전 이름이 "OAuth 동의 화면(OAuth consent screen)"이라 검색으로 나오는 대부분의 글이 아직 그 이름을 쓴다 — 같은 화면이다. 지금은 **브랜딩 / 대상 / 데이터 액세스 / 클라이언트** 네 탭으로 나뉘어 있고, 1단계의 클라이언트 ID 발급은 그중 마지막 탭이다. 클라이언트부터 만들려고 하면 콘솔이 앞 단계를 먼저 채우라고 되돌린다.

`Google Auth Platform이 아직 구성되지 않았습니다`가 보이면 **시작하기**를 눌러 마법사를 따라간다.

### ① 브랜딩 (앱 정보)

| 항목 | 값 |
|---|---|
| 앱 이름 | 동의 화면에 그대로 노출된다. `markdown-kms` |
| 사용자 지원 이메일 | 본인 계정 |
| 승인된 도메인 | `mingleup.net` |
| 개발자 연락처 | 본인 이메일 |

승인된 도메인에는 스킴(`https://`)과 경로를 넣지 않는다. 호스트만 넣는다. `localhost`는 여기에 등록할 수 없고, 등록할 필요도 없다.

앱 이름과 로고는 브랜드 인증을 받기 전까지 동의 화면에 뜨지 않는다 — 대신 도메인이 표시된다. 동작에는 영향이 없다.

### ② 대상(Audience)

`외부(External)`를 고른다. `내부(Internal)`는 Google Workspace 조직 계정에만 나오고, 그 조직 구성원만 로그인할 수 있다.

### ③ 데이터 액세스 (범위)

**범위 추가 또는 삭제**에서 아래 3개만 체크한다.

```
openid
.../auth/userinfo.email
.../auth/userinfo.profile
```

Auth.js의 Google provider가 기본으로 요청하는 범위가 정확히 이 셋(`openid profile email`)이다. 셋 다 민감하지 않은 범위(non-sensitive)라 Google 검토 없이 바로 쓸 수 있다. 이 앱이 Google에서 필요한 것은 "이 사람의 검증된 이메일 주소"뿐이므로 그 이상을 요청하면 검토 심사만 길어진다.

### ④ 테스트 사용자 vs 게시

앱은 **테스트(Testing)** 상태로 시작한다. 이 상태에서는 **테스트 사용자에 등록된 계정만** 로그인할 수 있고(최대 100명), 나머지는 `Error 403: access_denied`를 본다.

- 개발·내부 검증만 할 거면: **대상** 탭의 테스트 사용자에 본인 Gmail 주소를 추가하고 그대로 둔다.
- 아무나 가입할 수 있게 하려면: **앱 게시 → 프로덕션으로 전환**. 위 3개 범위만 쓰는 앱은 검토 없이 즉시 전환된다.

> **함정 ①** — 테스트 상태에서는 사용자 동의가 **7일 뒤 만료**된다. 이 앱은 로그인 시점의 신원 확인만 하고 리프레시 토큰을 저장하지 않으므로 재로그인하면 그만이지만, 프로덕션에 그대로 두면 사용자가 주기적으로 재동의를 겪는다. `mingleup.net`에 실사용자를 받을 거면 게시가 사실상 필수다.

---

## 1단계 — OAuth 클라이언트 ID 발급

**위치**: Google Auth Platform → **클라이언트 → 클라이언트 만들기** (예전 경로인 API 및 서비스 → 사용자 인증 정보로 가도 같은 곳에 닿는다)

애플리케이션 유형은 **웹 애플리케이션**을 고른다. "데스크톱 앱"이나 "Android/iOS"를 고르면 리다이렉트 URI 입력란 자체가 나오지 않는다.

### ① 승인된 JavaScript 원본

```
http://localhost:3000
https://mingleup.net
```

두 줄 다 넣는다. 스킴 포함, **끝 슬래시 없이**, 경로 없이 origin만.

### ② 승인된 리다이렉트 URI

```
http://localhost:3000/api/auth/callback/google
https://mingleup.net/api/auth/callback/google
```

경로 `/api/auth/callback/google`은 Auth.js가 정하는 값이라 바꿀 수 없다. `src/app/api/auth/[...nextauth]/route.ts`가 `/api/auth/*` 아래 전부를 받고, 그 안에서 provider id(`google`)로 콜백을 라우팅한다.

로컬은 `http`, 프로덕션은 `https`다. Google은 `localhost`에 한해서만 `http`를 허용한다.

### ③ 값 복사

만들기를 누르면 클라이언트 ID와 **클라이언트 보안 비밀번호**가 모달로 뜬다. 보안 비밀번호는 **이 순간에만 전체가 보인다** — 닫고 나면 앞 몇 글자만 남는다. 놓쳤으면 다시 만드는 것 외에 방법이 없으니 바로 복사해둔다.

> **함정 ②** — URI를 고친 뒤 Google 쪽 반영까지 몇 분에서 길게는 수 시간 걸린다. 방금 추가한 URI가 `redirect_uri_mismatch`를 내면 오타를 의심하기 전에 5분 기다려 다시 시도해본다.

---

## 2단계 — 로컬 설정

`.env.local`에 두 줄을 추가한다.

```
AUTH_GOOGLE_ID=1234567890-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

같은 파일에 `AUTH_URL`이 로컬 주소로 잡혀 있는지도 확인한다. 없으면 추가한다.

```
AUTH_URL=http://localhost:3000
```

팀에 공유되는 `.env.example`에도 같은 키를 값 없이 남긴다(placeholder만 커밋되고 실제 값은 절대 커밋하지 않는다 — `.gitignore`가 `.env*`를 전부 막는다).

```
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

값을 넣었으면 개발 서버를 **재시작**한다. Next.js는 env를 기동 시점에 읽으므로 실행 중에 파일만 고치면 반영되지 않는다.

```bash
pnpm dev
```

provider가 실제로 등록됐는지는 추측하지 말고 확인한다.

```bash
curl -s http://localhost:3000/api/auth/providers
```

응답 JSON에 `"google"` 키가 있어야 한다. `credentials`만 있으면 env 이름이 틀렸거나 서버를 재시작하지 않은 것이다.

---

## 3단계 — 프로덕션(mingleup.net) 설정

**위치**: Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables → Add New**

1단계에서 받은 값 2개를 그대로 등록한다. Environment는 **Production**을 체크한다.

| 키 | Environment |
|---|---|
| `AUTH_GOOGLE_ID` | Production |
| `AUTH_GOOGLE_SECRET` | Production (Sensitive 체크 권장) |

Preview는 체크해도 실익이 없다 — 아래 함정 ⑤ 참조.

그리고 기존 `AUTH_URL`이 커스텀 도메인으로 바뀌어 있는지 확인한다. 1단계 ②에서 Google에 등록한 origin과 **정확히 같아야** 한다.

```
https://mingleup.net
```

끝 슬래시 없이. `www.mingleup.net`을 primary로 뒀다면 Google 콘솔의 origin·리다이렉트 URI도 `www`가 붙은 쪽으로 맞춰야 한다(`connect.md` §5 ④와 같은 이야기다).

마지막으로 **재배포**한다. env 변경은 기존 배포에 소급 적용되지 않는다 — Deployments 탭 → 최신 배포 → `⋯` → **Redeploy**.

---

## 4단계 — 확인

```bash
curl -s https://mingleup.net/api/auth/providers | grep -o google
curl -s -o /dev/null -w "%{http_code}\n" -I https://mingleup.net/api/auth/csrf
```

- 첫 명령이 `google`을 출력 → provider 등록 정상
- 둘째가 `200` → `AUTH_SECRET` 정상

그다음은 브라우저로 확인한다. Google 동의 화면은 외부 서비스라 Playwright E2E로 자동화하지 않았다(그래서 이 4단계는 사람이 직접 밟아야 한다).

1. `https://mingleup.net/login` → **Google로 계속하기**
2. 동의 화면에서 계정 선택 → `/dashboard`로 돌아온다
3. 사이드바에 **기본 워크스페이스**가 보인다 (FR-A3 자동 편입, `PRD.md` §2-5의 EDITOR 역할)
4. 문서를 하나 만들어 저장까지 된다 (EDITOR 권한 정상)
5. 로그아웃 → `https://mingleup.net/`으로 돌아온다

**계정 자동 연결**도 한 번 확인해둔다. 이메일+비밀번호로 이미 가입한 주소와 같은 Google 계정으로 로그인하면 새 계정이 생기지 않고 **기존 계정**으로 들어와야 한다(문서·워크스페이스가 그대로 보인다). 별개 계정 두 개로 갈라졌다면 이메일 정규화가 어긋난 것이다 — `src/lib/validation.ts:7` `normalizeEmail`을 확인한다.

---

## 반복해서 밟는 함정

1. **env 이름을 `GOOGLE_CLIENT_ID`로 쓴다.** Auth.js v5가 읽는 이름은 `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`이다. 증상이 헷갈리게 나온다 — 앱은 멀쩡히 뜨고 `/api/auth/providers`에도 `google`이 보이지만, 버튼을 누르면 `client_id=undefined`인 채로 Google에 도착해 **Google 쪽 화면**에서 `401: invalid_client`가 뜬다. 우리 앱 로그에는 아무것도 안 남으니 우리 코드를 뒤지기 전에 env 이름부터 확인한다.
2. **리다이렉트 URI 오타.** `redirect_uri_mismatch` 에러 화면에 Google이 **실제로 받은 URI**를 그대로 찍어준다. 그 문자열을 콘솔의 등록값과 눈으로 대조하는 게 가장 빠르다. 끝 슬래시, `http`/`https`, `www` 유무가 전부 별개 값이다.
3. **`AUTH_URL`과 Google 등록 origin 불일치.** `connect.md` §2 ③의 `.app`/`.com` 함정과 같은 계보다. `AUTH_URL`이 콜백 URL의 origin을 만들기 때문에, 도메인을 바꾸면 Vercel env와 Google 콘솔 **양쪽**을 고쳐야 한다. 한쪽만 고치면 로그인이 통째로 막힌다.
4. **동의 화면이 테스트 상태인데 테스트 사용자를 등록 안 했다.** 본인은 되는데 남은 `access_denied`가 난다. 0단계 ④에서 게시하거나 테스트 사용자에 추가한다.
5. **Preview 배포에서 Google 로그인이 안 된다.** Vercel preview URL은 배포마다 달라지는데 Google은 리다이렉트 URI에 와일드카드를 허용하지 않는다. Preview에서는 이메일+비밀번호 로그인으로 검증하고, Google 경로는 로컬과 프로덕션에서만 확인한다.
6. **env 추가하고 재배포를 안 한다.** `connect.md` §반복해서 밟는 함정 2와 같은 항목이다. 새 env는 새 배포에만 실린다.
7. **기본 워크스페이스가 시드되지 않았다.** Google 첫 로그인도 비밀번호 가입과 똑같이 `default workspace not seeded`로 죽는다. 원인과 해결은 `connect.md` §3단계와 동일하다 (`pnpm tsx src/db/seed.ts`).
8. **`.env.local`만 고치고 dev 서버를 안 껐다.** env는 기동 시점에 한 번만 읽힌다. `curl /api/auth/providers`로 확인하는 습관이 이 실수를 바로 잡아준다.

---

## 알려진 미해결 이슈

**같은 이메일 계정의 자동 연결에는 선점 위험이 있다.** Google이 `email_verified: true`로 보증한 이메일에 한해 기존 계정에 합류시키는데(`src/lib/account.ts`), 이 앱의 비밀번호 가입에는 이메일 인증 단계가 없다(`PRD.md` D-02). 따라서 공격자가 피해자의 Gmail 주소로 먼저 비밀번호 가입을 해두면, 나중에 피해자가 Google로 로그인했을 때 **공격자가 비밀번호를 아는 그 계정**으로 들어가게 된다.

근본 해결은 비밀번호 가입 시 이메일 소유 확인을 넣는 것이다. `src/lib/mailer.ts`가 아직 콘솔 출력 스텁이라 메일 발송 인프라부터 필요하다. 현재는 수용된 리스크로 둔다.

**리프레시 토큰을 저장하지 않는다.** Auth.js 어댑터와 `account` 테이블을 쓰지 않으므로 Google 액세스 토큰이 세션에 남지 않는다. 로그인 신원 확인에는 충분하지만, 나중에 사용자 대신 Google API(Drive 등)를 호출하려면 그때 어댑터 도입과 마이그레이션이 필요하다.
