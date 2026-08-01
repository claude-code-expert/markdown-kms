# context7

라이브러리·프레임워크·SDK·API·CLI의 최신 공식 문서를 가져올 때 사용한다.

- **언제**: 라이브러리 API 문법, 설정, 버전 마이그레이션, 라이브러리 특정 디버깅, 셋업/CLI 사용법. React·Next.js·Spring Boot 같이 잘 아는 것도 학습 데이터가 오래됐을 수 있으니 웹 검색보다 우선 사용한다.
- **쓰지 않을 때**: 리팩터링, 새 스크립트 작성, 비즈니스 로직 디버깅, 코드 리뷰, 일반 프로그래밍 개념.
- **동작**: 두 단계로 호출한다.
  1. `resolve-library-id`: 라이브러리 이름 → Context7 ID로 변환
  2. `query-docs` (`get-library-docs`): 그 ID로 실제 문서 조회. `topic`으로 범위를 좁힌다.
- **주요 파라미터**:
  - `libraryName`: 조회할 라이브러리 이름 (resolve 단계)
  - `context7CompatibleLibraryID`: resolve로 얻은 ID (query 단계)
  - `topic`: 관심 주제로 문서 범위 한정 (예: `"routing"`, `"hooks"`)
  - `tokens`: 가져올 문서 분량 상한
