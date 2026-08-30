# Google 검색엔진 등록 가이드 (Search Console)

`mingleup.net`을 Google 검색에 노출시키는 절차. 코드 쪽(robots.txt·sitemap.xml·메타태그)은 이미 들어가 있으므로, 이 문서는 **콘솔에서 사람이 해야 하는 일**을 순서대로 다룬다.

관련 문서: 배포·도메인은 `connect.md`, 네이버 등록은 `naver-search-advisor.md`.

---

## 요약

| 항목 | 값 |
|---|---|
| 속성 유형 | **도메인 속성** (`mingleup.net`) |
| 소유권 확인 | **DNS TXT 레코드** — 가비아 DNS에 추가 |
| 대표(canonical) 주소 | **`https://www.mingleup.net`** — apex는 여기로 308 리다이렉트된다 |
| 사이트맵 | `https://www.mingleup.net/sitemap.xml` (자동 생성) |
| 추가 환경변수 | 없음 (DNS 방식은 코드 변경 불필요) |

> **선행 조건** — `AUTH_URL`이 **대표 주소와 정확히 같아야** 한다. canonical·OpenGraph·사이트맵 URL이 전부 그 값에서 나오기 때문이다(`src/lib/site.ts`). 값이 apex인데 실제 대표가 `www`면 구글이 색인하려는 모든 URL이 리다이렉트를 한 번 거치고, Search Console에 "리다이렉트가 있는 페이지"로 잡힌다. 로그아웃·초대 링크도 같은 값을 쓰므로(`connect.md` §5 ④) 함께 어긋난다.

**색인 대상은 공개 페이지 3개뿐이다** — 랜딩(`/`), 가입(`/signup`), 로그인(`/login`). 문서·워크스페이스는 로그인 뒤에 있고 멤버에게만 보이므로 사이트맵에 올리지 않고 `robots.txt`로 크롤링도 막는다.

---

## 0단계 — 속성 유형 고르기

Search Console의 속성은 두 종류다. **도메인 속성을 권장한다.**

| | 도메인 속성 | URL 접두어 속성 |
|---|---|---|
| 범위 | `mingleup.net` + **모든 서브도메인** + http/https 전부 | 정확히 그 접두어 하나 (`https://mingleup.net/`) |
| 확인 방법 | **DNS TXT만 가능** | HTML 태그 / HTML 파일 / DNS / GA / GTM |
| 이 프로젝트에 맞나 | ✅ `www` 유무·프로토콜을 한 번에 커버 | 프로토콜·서브도메인마다 속성을 따로 만들어야 함 |

가비아 DNS를 이미 다루고 있으므로(Resend 연동에서 TXT·MX를 넣어봤다) DNS 방식이 추가 부담이 없다.

> **함정 ①** — URL 접두어 속성은 `https://mingleup.net`과 `https://www.mingleup.net`이 **서로 다른 속성**이다. 하나만 등록해두면 다른 쪽 데이터가 통째로 빠진다. 도메인 속성은 이 문제가 없다.

---

## 1단계 — 속성 추가

**위치**: [search.google.com/search-console](https://search.google.com/search-console) → 좌측 상단 속성 선택기 → **속성 추가**

왼쪽 **도메인** 칸에 프로토콜 없이 입력한다.

```
mingleup.net
```

`https://`를 붙이거나 `www.`를 붙이면 안 된다 — 도메인 속성은 그것들을 자동으로 포함한다.

계속을 누르면 TXT 레코드 값이 나온다. 형태는 이렇다.

```
google-site-verification=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 2단계 — 가비아 DNS에 TXT 레코드 추가

**위치**: My가비아 → 도메인 목록 → 해당 도메인 **관리툴** → DNS 정보 → **설정 → 레코드 수정 → 레코드 추가**

| 타입 | 호스트 | 값 |
|---|---|---|
| `TXT` | `@` | Search Console이 준 `google-site-verification=...` 전체 |

> **함정 ②** — **호스트는 `@`다.** `mingleup.net`을 적으면 가비아가 뒤에 도메인을 한 번 더 붙여 `mingleup.net.mingleup.net`이 된다. Resend 레코드에서 밟았던 것과 같은 함정이다.

> **함정 ③** — **기존 TXT 레코드를 지우지 않는다.** 루트(`@`)에 이미 SPF(`v=spf1 -all`)를 넣어뒀다면 그것과 **별개의 TXT 레코드로 추가**한다. 한 호스트에 TXT가 여러 개 있는 것은 정상이고, 덮어쓰면 메일 인증이 깨진다.

저장 후 Search Console로 돌아가 **확인**을 누른다. DNS 전파 때문에 바로 안 될 수 있다 — 보통 몇 분, 최대 48시간이다. 실패하면 값이 실제로 보이는지 먼저 확인한다.

```bash
dig +short TXT mingleup.net
```

`google-site-verification=...` 이 출력에 있어야 한다.

---

## 3단계 — 사이트맵 제출

**위치**: 속성 선택 후 좌측 메뉴 **색인 생성 → Sitemaps**

"새 사이트맵 추가"에 **전체 URL**을 입력한다.

```
https://www.mingleup.net/sitemap.xml
```

> **함정 ④** — 흔한 안내처럼 `sitemap.xml`만 넣으면 **`invalid URL`** 이 난다. 경로만 넣는 방식은 **URL 접두어 속성** 이야기다 — 그쪽은 화면에 접두어가 이미 붙어 있어 나머지 경로만 채우면 된다. 우리가 쓰는 **도메인 속성**은 프로토콜·서브도메인을 전부 포함하는 속성이라 고정 접두어가 없고, 그래서 Search Console이 경로만으로는 대상 URL을 확정하지 못한다.

apex(`https://mingleup.net/sitemap.xml`)가 아니라 **`www`** 로 넣는다. apex는 308이라 사이트맵 가져오기도 리다이렉트를 한 번 탄다.

제출 후 상태가 **성공**으로 바뀌고 발견된 URL이 3개로 잡히면 정상이다.

사이트맵은 코드가 자동 생성한다(`src/app/sitemap.ts`). 배포할 때마다 `lastmod`가 갱신되므로 따로 관리할 파일이 없다.

```bash
curl -s https://www.mingleup.net/sitemap.xml
curl -s https://www.mingleup.net/robots.txt
```

`content-type`이 `application/xml`·`text/plain`이 아니라 `text/html`로 나오면 **아직 배포가 안 된 것**이다 — Next가 404 페이지를 HTML로 내주고 있다는 뜻이다.

---

## 4단계 — 색인 요청

사이트맵을 냈다고 바로 색인되지 않는다. 랜딩 페이지만 수동으로 밀어준다.

**위치**: 상단 검색창(URL 검사)에 `https://www.mingleup.net/` 입력 → **색인 생성 요청**

리다이렉트되는 apex(`https://mingleup.net/`)가 아니라 **대표 주소**를 넣는다. apex를 넣으면 "리다이렉트가 있는 페이지"로만 보고되고 색인은 되지 않는다.

신규 도메인은 첫 색인까지 **며칠에서 2주** 걸린다. 요청을 반복해도 빨라지지 않는다.

확인:

```
site:mingleup.net
```

이 쿼리를 구글에 넣어 결과가 나오면 색인된 것이다.

---

## 코드 쪽에 이미 들어가 있는 것

사람이 만질 필요 없는 부분이다. 참고용으로만 남긴다.

| 파일 | 역할 |
|---|---|
| `src/lib/site.ts` | 사이트 주소·이름·설명의 단일 원천. `AUTH_URL`을 재사용해 초대 메일 링크와 origin이 어긋나지 않게 한다 |
| `src/app/robots.ts` | `/robots.txt` 자동 생성. 비공개 경로 차단 + 사이트맵 주소 |
| `src/app/sitemap.ts` | `/sitemap.xml` 자동 생성. 공개 페이지 3개 |
| `src/app/layout.tsx` | `metadataBase`·canonical·OpenGraph·Twitter 카드·robots 지시어 |
| `(auth)/login`·`signup/page.tsx` | 페이지별 title·description·canonical |

### 왜 비공개 경로를 명시적으로 막나

로그인 게이트가 있어 크롤러가 내용을 볼 수는 없지만, 그래도 `robots.txt`에 적는다.

- `/invitations/` — **URL에 일회성 초대 토큰이 들어간다.** 링크가 어딘가로 새면 크롤러가 방문하는 것만으로 초대가 소진될 수 있다
- `/dashboard`, `/w/` — 전부 로그인 리다이렉트라 색인 가치가 0인데 크롤 예산만 먹는다
- `/api/` — 사람이 볼 페이지가 아니다

---

## HTML 태그로 확인해야 한다면

DNS를 못 만지는 상황(예: 다른 팀이 DNS를 관리)이라면 **URL 접두어 속성 + HTML 태그**를 쓴다. 코드는 이미 준비돼 있다.

Search Console이 주는 태그에서 `content` 값만 떼어 환경변수로 넣는다.

```html
<meta name="google-site-verification" content="여기만_복사" />
```

```
GOOGLE_SITE_VERIFICATION=여기만_복사
```

`.env.local`과 Vercel(Production) 양쪽에 넣고 **재배포**한다. env가 없으면 태그 자체가 나가지 않으므로, DNS 방식으로 확인했다면 설정할 필요가 없다.

---

## 반복해서 밟는 함정

1. **도메인 속성에 `https://`나 `www.`를 붙인다.** 프로토콜·서브도메인 없이 `mingleup.net`만 넣는다 (1단계).
2. **TXT 호스트에 도메인을 중복 입력한다.** `@`다 (2단계 함정 ②).
3. **기존 TXT를 덮어쓴다.** SPF와 별개 레코드로 추가한다. 덮으면 메일 발송 인증이 깨진다 (2단계 함정 ③).
4. **DNS 전파를 안 기다린다.** `dig +short TXT mingleup.net`으로 값이 실제로 보이는지 먼저 확인한다.
5. **사이트맵 제출 = 색인이라고 생각한다.** 발견을 앞당길 뿐이고, 신규 도메인은 며칠~2주 걸린다.
6. **`AUTH_URL`이 대표 주소와 다르다.** canonical·OG·사이트맵 URL이 전부 그 값에서 나온다. `www`가 대표인데 apex로 잡아두면 색인 대상 URL이 전부 308을 거치고 Search Console에 "리다이렉트가 있는 페이지"로 잡힌다. 실제로 이 프로젝트에서 그랬다 — `connect.md` 5단계 ④와 같은 항목이다.
7. **코드 배포 전에 사이트맵을 제출한다.** `robots.txt`·`sitemap.xml`은 앱이 생성하므로 배포되기 전에는 404다. `content-type`이 `text/html`이면 아직 안 올라간 것이다 (3단계).
8. **사이트맵에 경로만 넣어 `invalid URL`이 난다.** 도메인 속성은 전체 URL을 요구한다 (3단계 함정 ④).
9. **URL 검사에 apex를 넣는다.** 대표 주소(`www`)를 넣어야 색인된다 (4단계).

---

## 알려진 미해결 이슈

**OG 이미지가 없다.** 링크를 슬랙·카톡에 붙여도 썸네일이 안 뜬다. 필요해지면 `src/app/opengraph-image.tsx`를 추가하면 된다(Next가 `og:image` 메타태그까지 자동으로 붙인다).

**색인 대상이 랜딩 하나뿐이라 검색 유입 여지가 작다.** 블로그·문서 공개 공유 같은 공개 콘텐츠가 생기기 전까지는 `site:mingleup.net` 정도로만 잡힌다. 공개 문서 공유 기능이 생기면 `sitemap.ts`에서 해당 문서만 DB로 조회해 추가한다.
