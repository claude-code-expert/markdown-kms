# 이메일 인증 연동 가이드 (Resend)

markdown-kms의 회원가입 이메일 인증을 켤 때 Resend와 DNS, 환경변수에 무엇을 넣는지 순서대로 정리한 문서. 로컬(`http://localhost:3000`)과 프로덕션(`https://mingleup.net`) 두 환경을 한 번에 다룬다.

관련 문서: 배포·도메인 연결은 `connect.md`, Google 로그인은 `oauth-google.md`, 코드 프로토콜과 스키마는 `TRD.md` §9.1·§9.2.

---

## 요약

기존 환경변수에 **1개**를 더한다(발신 주소를 바꿀 거면 2개).

| 키 | 값 | 어디서 얻나 |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | Resend 콘솔 → API Keys |
| `MAIL_FROM` | `markdown-kms <noreply@mingleup.net>` | 선택. 안 넣으면 이 값이 기본값이다 |
| `MAIL_REPLY_TO` | `support@mingleup.net` | 선택. **실제 받는 수신함이 있을 때만** 설정 (6단계 ⑥) |

**키가 없어도 앱은 정상 동작한다.** `src/lib/mailer.ts`가 `RESEND_API_KEY` 없을 때 메일 대신 서버 콘솔에 코드를 찍는다. 로컬 개발과 테스트가 키 없이 돌아가야 하기 때문이다 — 대신 프로덕션에 키를 안 넣으면 **아무도 가입을 끝낼 수 없다**(코드가 서버 로그에만 남는다).

DB 스키마 변경은 마이그레이션 `0009`에 들어 있다. 배포 전에 적용해야 한다(아래 3단계).

---

## 0단계 — Resend 계정과 도메인 등록

**위치**: [resend.com](https://resend.com) 가입 → **Domains → Add Domain**

도메인에 `mingleup.net`을 넣고 리전을 고른다. 한국에서 가장 가까운 것은 `ap-northeast-1`(도쿄)이다.

> **함정 ①** — 여기서 고른 리전이 아래 MX 레코드 값에 박힌다. 나중에 리전을 바꾸면 MX도 같이 바꿔야 하고, 안 바꾸면 `region-mismatch`로 검증이 실패한다.

apex 도메인을 넣어도 Resend는 발송용 레코드를 **`send.mingleup.net` 하위에** 깐다. 루트 도메인에 이미 걸린 MX(회사 메일 등)와 충돌하지 않는다.

---

## 1단계 — 가비아 DNS에 레코드 3개 추가

Resend 도메인 상세 화면에 표시되는 값을 **그대로** 복사한다. 아래 표의 값은 모양을 보여주기 위한 것이고, DKIM은 프로젝트마다 다르다.

**위치**: My가비아 → 도메인 관리툴 → DNS 정보 → **설정 → 레코드 수정 → 레코드 추가**

| 타입 | 호스트 | 값 | 우선순위 |
|---|---|---|---|
| `MX` | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` | `10` |
| `TXT` | `send` | `v=spf1 include:amazonses.com ~all` | - |
| `TXT` | `resend._domainkey` | Resend가 준 DKIM 값 (긴 문자열) | - |

`connect.md` 5단계에서 이미 밟은 가비아 함정 두 개가 그대로 재발한다.

> **함정 ②** — **호스트에 도메인을 적지 않는다.** `send.mingleup.net`이 아니라 `send`, `resend._domainkey.mingleup.net`이 아니라 `resend._domainkey`다. 가비아가 뒤에 도메인을 자동으로 붙이므로 적어 넣으면 `send.mingleup.net.mingleup.net`이 된다.

> **함정 ③** — **MX 값 끝에 마침표를 찍는다.** `feedback-smtp.ap-northeast-1.amazonses.com.` 처럼. 안 찍으면 가비아가 뒤에 자기 도메인을 붙여 `...amazonses.com.mingleup.net`으로 등록한다. `connect.md`의 CNAME 끝점 함정과 같은 원인이다.

DKIM 값은 **대소문자까지 정확히** 일치해야 한다. 손으로 옮겨 적지 말고 복사한다.

저장 후 보통 15분 안에 검증되고, 길면 72시간까지 걸린다. Resend 도메인 카드가 **Verified**로 바뀌면 끝이다. 24시간이 지나도 안 되면 값이 실제로 공개됐는지 먼저 확인한다.

```bash
dig +short TXT resend._domainkey.mingleup.net
dig +short MX send.mingleup.net
```

---

## 2단계 — 로컬 설정

**위치**: Resend 콘솔 → **API Keys → Create API Key** (권한은 `Sending access`면 충분하다)

`.env.local`에 추가한다.

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

팀에 공유되는 `.env.example`에도 값 없이 키만 남긴다(실제 값은 `.gitignore`가 `.env*`를 전부 막는다).

```
RESEND_API_KEY=
MAIL_FROM=
```

env는 기동 시점에 한 번만 읽히므로 개발 서버를 **재시작**한다.

```bash
pnpm dev
```

> **함정 ④** — 도메인 검증이 아직 안 끝났으면 발송이 `not_allowed`로 실패한다. 검증을 기다리는 동안 테스트하려면 `MAIL_FROM=onboarding@resend.dev`로 바꿔 끼운다. 이 주소는 Resend가 테스트용으로 열어둔 것이고, **본인 계정 이메일로만** 보낼 수 있다.

키를 아예 안 넣으면 코드가 서버 콘솔에 찍힌다. 로컬 검증은 이쪽이 더 빠르다.

```
[mailer] (dev) → kim@example.com | [markdown-kms] 인증 코드 042917
```

---

## 3단계 — DB 마이그레이션 (필수)

이 기능은 `user.email_verified` 컬럼과 `email_verification` 테이블을 새로 쓴다. 적용하지 않으면 가입이 전부 500으로 죽는다.

```bash
# 로컬
pnpm drizzle-kit migrate

# 프로덕션(Neon) — DDL이라 반드시 unpooled 문자열 (connect.md 3단계와 같은 이유)
DATABASE_URL='postgresql://user:pw@ep-xxxx.ap-northeast-1.aws.neon.tech/neondb?sslmode=require' pnpm drizzle-kit migrate
```

마이그레이션 `0009`에는 손으로 넣은 백필 한 줄이 들어 있다.

```sql
UPDATE "user" SET "email_verified" = true;
```

**이 줄이 있어야 기존 가입자가 안 잠긴다.** 인증 요구는 이 시점 이후의 신규 가입에만 적용된다.

---

## 4단계 — 프로덕션(mingleup.net) 설정

**위치**: Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables → Add New**

| 키 | Environment |
|---|---|
| `RESEND_API_KEY` | Production (Sensitive 체크 권장) |
| `MAIL_FROM` | Production (기본값을 쓸 거면 생략) |

등록 후 **재배포**한다. env 변경은 기존 배포에 소급 적용되지 않는다(`connect.md` §반복해서 밟는 함정 2).

---

## 5단계 — 확인

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://mingleup.net/api/auth/verify-email/resend \
  -H 'content-type: application/json' -d '{"email":"nobody@example.com"}'
```

`200`이 나와야 한다. 이 라우트는 계정이 없어도 200을 준다 — 응답이 갈리면 임의 이메일의 가입 여부를 알아내는 통로가 되기 때문이다.

그다음 브라우저로 확인한다.

1. `https://mingleup.net/signup` → 이름·이메일·비밀번호 입력 → **가입하기**
2. 화면이 **인증 코드 입력 단계**로 바뀐다 (`/dashboard`로 넘어가면 안 된다)
3. 메일함에서 6자리 코드 확인 → 입력 → **인증하고 시작하기**
4. `/dashboard`로 들어가고 사이드바에 **기본 워크스페이스**가 보인다
5. 인증 전에 `/login`으로 로그인하면 "이메일 인증이 아직 끝나지 않았어요"와 재발송 버튼이 뜬다

---

## 동작 방식 (요약)

- 코드는 `crypto.randomInt`로 뽑은 **6자리 숫자**, **10분** 만료, 시도 **5회**, 재발송 쿨다운 **60초**.
- DB에는 코드 원문이 아니라 `HMAC-SHA256(AUTH_SECRET, code)`만 저장한다. 6자리는 10^6 공간이라 평문 SHA-256이면 DB 유출 시 즉시 역산되기 때문이다.
- 코드 입력 전에 탭을 닫아도 막다른 길이 아니다. **같은 이메일로 다시 가입을 시도하면** 409 대신 코드를 재발송하고 입력 단계로 돌아간다. 그때 넣은 비밀번호·이름으로 갱신되므로 오타 복구도 된다.
- Google 로그인은 코드를 거치지 않는다. Google이 `email_verified`로 소유를 보증하기 때문이다.
- 미인증 계정에 Google이 도달하면 그 계정을 인증됨으로 승격하고 **비밀번호를 비운다** — `oauth-google.md`가 기록했던 계정 선점 위험이 이걸로 닫힌다.

---

## 6단계 — 스팸함으로 가는 문제

첫 발송이 스팸함에 들어가는 것은 정상이다. 새 도메인에는 발송 이력이 없고, Gmail은 이력 없는 도메인을 기본적으로 의심한다. 인증(SPF/DKIM/DMARC)이 완벽해도 그렇다.

### ① 먼저 인증부터 확인한다 — 여기가 깨졌으면 나머지는 의미 없다

```bash
dig +short TXT resend._domainkey.mingleup.net   # DKIM — 값이 나와야 함
dig +short TXT send.mingleup.net                # SPF  — v=spf1 ... 이 나와야 함
dig +short TXT _dmarc.mingleup.net              # DMARC
```

셋 다 값이 나오면 인증은 정상이다. 이 상태에서 스팸으로 가는 건 **평판** 문제지 설정 문제가 아니다.

받은 메일에서 직접 확인할 수도 있다 — Gmail에서 메일 열기 → 오른쪽 `⋮` → **원본 보기**. 상단에 이렇게 나와야 한다.

```
SPF:   PASS
DKIM:  PASS
DMARC: PASS
```

### ② DMARC를 강화한다

기본으로 깔린 `v=DMARC1; p=none;`은 "감시만 하고 아무것도 하지 않는다"는 뜻이다. 최소 요건은 만족하지만 신호가 약하다. 리포트 주소를 넣으면 누가 우리 도메인을 사칭하는지, 인증이 실제로 통과하는지 데이터로 볼 수 있다.

**위치**: 가비아 DNS → `TXT` / 호스트 `_dmarc`

```
v=DMARC1; p=none; rua=mailto:dmarc@mingleup.net; fo=1
```

2주쯤 리포트를 보고 정상 발송이 전부 PASS면 `p=quarantine`으로, 더 지나면 `p=reject`로 올린다. 처음부터 `p=reject`로 가면 설정 실수가 곧 전면 미배달이 된다.

### ③ 루트 도메인에 SPF를 추가한다

현재 `mingleup.net` 루트에는 TXT가 하나도 없다. 발송은 `send.mingleup.net`을 거치므로 **당장 인증에는 문제가 없지만**, 루트에 SPF가 없으면 아무나 `@mingleup.net` 봉투 주소로 사칭해도 SPF가 판단을 못 한다.

**위치**: 가비아 DNS → `TXT` / 호스트 `@`

```
v=spf1 -all
```

이 도메인 자체로는 직접 발송하지 않는다는 선언이다. Resend 발송은 `send` 서브도메인의 SPF를 쓰므로 영향받지 않는다.

### ④ 발신자와 브랜드를 일치시킨다

지금은 서비스 이름이 `markdown-kms`인데 도메인은 `mingleup.net`이다. 사람도 필터도 이 불일치를 의심한다. 둘 중 하나로 맞추는 것이 장기적으로 가장 확실하다 — 서비스명을 도메인에 맞추거나, 도메인을 서비스명에 맞추거나.

### ⑤ 초기 평판을 사람 손으로 쌓는다

가장 효과가 빠른 조치다. 코드가 아니라 수신 쪽 행동이 평판을 만든다.

- 스팸함의 메일을 **"스팸 아님"** 으로 표시한다
- 발신 주소를 **주소록에 추가**한다
- 받은 메일에 **한 번 회신**한다 (`MAIL_REPLY_TO`를 설정했을 때)
- 초기에는 소수의 실제 사용자에게만 보내고 며칠에 걸쳐 늘린다

Gmail은 이 신호들을 도메인 단위로 학습한다. 보통 수십 통 정도 정상 수신되면 받은편지함으로 자리를 잡는다.

### ⑥ 회신 가능한 주소를 둔다 (선택)

`noreply@`만 쓰는 발신자는 약한 감점 요인이다. 실제로 받는 수신함이 있다면 env로 지정한다.

```
MAIL_REPLY_TO=support@mingleup.net
```

**받는 사람이 없는 주소를 넣으면 안 된다** — 회신이 바운스되면 오히려 평판이 깎인다. 설정하지 않으면 헤더 자체가 붙지 않는다.

### 이미 한 것 (코드 쪽)

본문은 이미 필터 친화적으로 정리돼 있다. 참고로만 남긴다.

- 대괄호 프리픽스(`[markdown-kms]`)를 제목에서 제거 — 대량 발송 템플릿의 지문이다
- 본문에 "누가 왜 보냈는지" 맥락 문장과 푸터(서비스명·주소)를 넣어 텍스트 비중 확보 — 큰 숫자만 있는 짧은 HTML은 피싱 메일과 모양이 같다
- `text`와 `html`을 항상 함께 보냄 (한쪽만 보내면 감점)
- 인증 메일에는 링크를 넣지 않음

---

## 반복해서 밟는 함정

1. **프로덕션에 `RESEND_API_KEY`를 안 넣는다.** 앱이 안 죽어서 눈치채기 어렵다 — 가입은 200으로 성공하는데 메일이 안 가고 코드는 Vercel 로그에만 남는다. 4단계는 선택이 아니다.
2. **도메인 검증 전에 실제 도메인으로 보낸다.** Resend가 `not_allowed`로 거부한다. 검증이 끝날 때까지는 `MAIL_FROM=onboarding@resend.dev` (2단계 함정 ④).
3. **가비아 호스트에 도메인을 중복 입력한다.** `send.mingleup.net`이 아니라 `send`다 (1단계 함정 ②).
4. **MX 값 끝점 누락.** 값 뒤에 도메인이 한 번 더 붙어 등록되고 영원히 검증이 안 된다 (1단계 함정 ③).
5. **마이그레이션을 안 돌린다.** `column "email_verified" does not exist`(PG `42703`)로 가입이 전부 500이다 (3단계). **2026-08-29 프로덕션에서 실제로 발생했다** — 코드 머지 5분 뒤 배포는 됐는데 `0009`가 적용되지 않아 가입이 전부 죽었다. `MIGRATE_DATABASE_URL` 등록으로 자동화하는 방법은 `connect.md` 3단계 참조.
6. **백필 줄을 지우고 마이그레이션한다.** 기존 가입자 전원이 로그인 불가로 잠긴다. 이미 그렇게 됐다면 `UPDATE "user" SET email_verified = true WHERE created_at < '<배포시각>'`으로 복구한다.
7. **env만 바꾸고 재배포를 안 한다.** `connect.md`와 같은 항목이다.
8. **`.env.local`만 고치고 dev 서버를 안 껐다.** env는 기동 시점에 한 번만 읽힌다.

---

## 알려진 미해결 이슈

**재발송 레이트리밋이 인메모리다.** `src/lib/rate-limit.ts`가 프로세스 로컬 `Map`이라 서버리스 인스턴스가 여러 개면 인스턴스별로 따로 센다(원 코드의 `ponytail:` 주석이 이미 이 천장을 표기해뒀다). 60초 쿨다운은 DB(`email_verification.created_at`) 기반이라 인스턴스 수와 무관하게 성립하므로, 실질적인 방어는 그쪽이 한다. 발송량이 문제가 되면 레이트리밋을 DB나 Redis로 옮긴다.

**메일 발송 실패가 가입을 되돌리지 않는다.** 계정은 만들고 발송만 실패하면 사용자는 "코드 다시 받기"로 복구할 수 있다 — 그래서 발송 실패를 삼키고 로그만 남긴다(`src/app/api/auth/signup/route.ts`). 반대로 발송 실패에 트랜잭션을 되돌리면 Resend 장애 동안 아무도 가입할 수 없다. 의도한 트레이드오프다.

**정리 작업이 없다.** 소비·만료된 `email_verification` 행이 계속 쌓인다. 행이 작고 `ON DELETE CASCADE`로 계정 삭제 시 함께 지워지므로 당장 문제는 없지만, 양이 문제가 되면 Vercel Cron으로 오래된 행을 지우면 된다.
