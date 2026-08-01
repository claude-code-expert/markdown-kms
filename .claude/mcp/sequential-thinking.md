# sequential-thinking

복잡한 문제를 여러 단계로 나눠 사고할 때 `sequentialthinking` 툴을 사용한다.

- **언제**: 다단계 설계·디버깅·리팩터링처럼 계획을 세우고 도중에 방향을 수정해야 하는 작업. 단순 조회나 한 줄 수정에는 쓰지 않는다.
- **동작**: 생각을 `thought` 단위로 이어가며, 필요하면 이전 단계를 수정(revision)하거나 분기(branch)한다. `nextThoughtNeeded`가 `false`가 될 때까지 반복한다.
- **주요 파라미터**:
  - `thought`: 현재 단계의 사고 내용
  - `nextThoughtNeeded`: 더 생각할 단계가 남았는지 (boolean)
  - `thoughtNumber` / `totalThoughts`: 현재 번호 / 예상 총 단계 수 (진행 중 조정 가능)
  - `isRevision` + `revisesThought`: 이전 사고를 다시 검토할 때
  - `branchFromThought` + `branchId`: 대안 경로를 탐색할 때
