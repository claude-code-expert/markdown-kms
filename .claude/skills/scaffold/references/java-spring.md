# java-spring — Java / Spring Boot 스캐폴딩 세부 (2026)

버전은 움직인다. 이 문서의 숫자는 **"확인 후 사용"**. 가능하면 Initializr 서버 기본값에 맡기고 Java만 21+로 오버라이드한다.

## Spring Initializr — 비대화형 스캐폴드

자동화엔 **curl → start.spring.io**가 최선(로컬 설치 불필요·항상 최신·재현 가능):

```bash
curl https://start.spring.io/starter.zip \
  -d type=gradle-project \
  -d language=java \
  -d javaVersion=21 \
  -d packaging=jar \
  -d groupId=com.example \
  -d artifactId=demo \
  -d name=demo \
  -d packageName=com.example.demo \
  -d dependencies=web,actuator,validation,data-jpa,postgresql \
  -o demo.zip && unzip demo.zip -d demo
```

- `bootVersion`은 **생략** → 서버가 최신 안정을 채운다(하드코딩 금지). Java는 명시 오버라이드(기본은 최소 17이라 낮음).
- `type`: `gradle-project`(Groovy, 기본) · `gradle-project-kotlin`(Kotlin DSL, 시니어 선호 증가) · `maven-project`.
- `-d dependencies=`는 쉼표구분 **ID**. 필드 생략 = 서버 기본값.
- 사용 가능한 옵션 확인: `curl https://start.spring.io` (전체 텍스트 도움말).

**세 가지 방법**:
| 방법 | 용도 |
|------|------|
| **curl → start.spring.io** | **자동화·스크립트·이 스킬.** 재현 가능·툴체인 불필요·항상 최신. **선호.** |
| 웹 UI | 사람이 탐색, 의존성 이름 찾기, Explore 미리보기. |
| `spring init`(Boot CLI) | 로컬 ergonomics 좋지만 CLI 설치 필요(추가 의존성). 이식성엔 curl이 이김. |

## 현행 버전 (2026 — 확인 후 사용)

- **Spring Boot**: `4.x` 라인(Spring Framework 7). **3.5는 2026-06-30 OSS EOL** — 신규는 3.x 금지. `bootVersion` 생략해 서버 기본값 사용.
- **Java LTS**: Initializr 기본은 17(Boot 4 최소치)이지만 권장 아님. 신규는 **Java 21 LTS**(안전한 기본) 또는 **25 LTS**(2025-09, 지원 최장). 2026에 17로 시작할 이유 없음 — `javaVersion=21`(또는 25) 오버라이드.
- **빌드**: Initializr 기본 Gradle(Groovy). 신규 권장은 **Gradle + Kotlin DSL**(타입세이프 빌드). Maven도 유효(더 안정·장황). 팀 취향.

## 흔한 스타터 ID

| 목적 | ID |
|------|-----|
| REST/web (MVC+Tomcat) | `web` |
| ops/metrics/health | `actuator` |
| Bean Validation | `validation` |
| JPA/Hibernate | `data-jpa` |
| PostgreSQL 드라이버 | `postgresql` |
| Spring Security | `security` |
| Testcontainers | `testcontainers` |
| Lombok | `lombok` (아래 주의) |

**Lombok — 신규에선 지는 추세(2026).** 현대 Java(record·sealed·pattern matching)가 대부분 대체. Spring 입장도 "팀 선택이지 권장 아님". DTO/불변 값은 **Java `record`**(Spring Data가 record projection 지원). 가변 엔티티에 `@Getter/@Setter/@Builder`가 진짜 보일러플레이트를 줄일 때만 유지. **신규 스캐폴드 기본: 빼라.**

## 패키지/구조

**Initializr 생성물**: 단일 패키지(`com.example.demo`) + `@SpringBootApplication` main 클래스뿐. 구조 의견 없음.

- **package-by-layer**(`controller/`·`service/`·`repository/`·`dto/`): 작은 앱·학습엔 OK. 단점 — 한 기능의 클래스가 전 레이어에 흩어져 찾기·리팩터·추출이 어렵다.
- **package-by-feature**(`order/`·`payment/`·`user/` 각자 controller+service+repository): **중대형·팀 소유 서비스의 현행 권장.** 높은 응집·낮은 결합, 폴더 삭제로 기능 삭제, **Spring Modulith**로 가는 자연스러운 길.

원칙: 아주 작거나 학습이면 layered로 시작, **실서비스는 package-by-feature 기본**. 단, 엔드포인트 3개짜리를 미리 feature로 쪼개지 마라 (YAGNI).

## post-scaffold 추가

- **`application.yml`**(properties 대신 — 계층적·프로파일 멀티도큐먼트).
- **프로파일**: `application.yml` + `application-dev.yml`/`application-prod.yml`. 시크릿은 파일 아닌 env.
- **`.gitignore`**: Initializr가 넣지만 `build/`·`target/`·`.idea/`·`*.log` 커버 확인.
- **포매터**: **Spotless**(Gradle/Maven 플러그인) + google-java-format/Palantir, 빌드+CI에 연결.
- **CI**: GitHub Actions로 `./gradlew build`(컴파일+Spotless+테스트). Testcontainers로 통합테스트에 실제 Postgres.
- 흔히 추가: `spring-boot-docker-compose`(로컬 인프라), `./gradlew bootBuildImage`(buildpacks Docker 이미지).

## 안티패턴

- 신규를 Boot 3.x(EOL)·Java 17 타깃으로 시작(→ 21/25).
- **Lombok 반사 추가**(→ record 먼저).
- `data-jpa`+`security`+전부를 "나중을 위해" 미리 넣기 — 기능 착수 시 추가.
- 트리비얼 앱을 feature 패키지로 과분할(조기 구조).
- `application-prod.yml`에 시크릿 커밋.
- 프로파일/중첩에 `.properties` 사용.
- 빌드 파일 손으로 작성·버전 수동 핀(→ Boot BOM/parent에 맡겨라).

---

## 출처 (2026-07 검증, 버전은 이동성)

- start.spring.io 라이브 메타데이터 (기본값/ID 권위 출처 — `curl https://start.spring.io/metadata/client`로 런타임 확인 가능)
- Spring Boot releases — https://github.com/spring-projects/spring-boot/releases · endoflife.date/spring-boot
- Oracle Java SE roadmap — https://www.oracle.com/java/technologies/java-se-support-roadmap.html
- "You Don't Need Lombok Anymore" (Loiane Groner, 2026-03)
- Package by Layer vs Feature / Spring Modulith

> 스킬 실행 시 버전을 하드코딩하지 말 것: `bootVersion` 생략(서버 기본값) 또는 `curl .../metadata/client`로 조회.
