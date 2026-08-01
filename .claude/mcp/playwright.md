# playwright

브라우저를 실제로 구동해 웹 페이지를 탐색·조작·검증할 때 사용한다.

- **언제**: E2E 확인, UI 동작 검증, 폼 입력/클릭 시나리오, 스크린샷, 페이지 상태·콘솔·네트워크 확인. "앱을 띄워서 동작 확인" 류의 작업.
- **동작**: 접근성 트리(snapshot) 기반으로 요소를 식별하고 상호작용한다. 스크린샷의 좌표가 아니라 `ref`(요소 참조)로 조작하므로 먼저 snapshot을 찍어 대상 요소의 `ref`를 얻는다.
- **주요 툴**:
  - `browser_navigate`: URL 이동
  - `browser_snapshot`: 접근성 트리 캡처 (조작 전 대상 파악용)
  - `browser_click` / `browser_type` / `browser_fill_form`: 클릭·입력
  - `browser_take_screenshot`: 화면 캡처
  - `browser_console_messages` / `browser_network_requests`: 콘솔·네트워크 확인
  - `browser_wait_for`: 텍스트/시간 대기
