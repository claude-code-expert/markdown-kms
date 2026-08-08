---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 2
total_count: 5
last_updated: 2026-08-08T06:49:27.170Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 3 | unrun-verify | .planning/phases/03-folder-tree-closure-table/03-05-PLAN.md |  | Task 3 human-check (drag-over cursor/outline visual feedback in real browser) not run this session | open |  | 2026-08-08T03:57:25.631Z |  |
| 2 | 3 | unrun-verify | src/components/tree/MoveFolderModal.tsx |  | MoveFolderModal own-subtree-disabled greying has no dedicated e2e assertion (not in must_haves), human_judgment flagged in 03-05-SUMMARY D7 | open |  | 2026-08-08T03:57:25.700Z |  |
| 3 | 04 | deviation | e2e/preview-perf.spec.ts | 113 | 60ms-budget test still targets /w/[wsId] as the 2-pane editor host (pre-04-02 Phase 2 assumption); since 04-02's route split the editor lives at /w/[wsId]/d/[docId] — spec needs updating, out of 04-03 scope | fixed |  | 2026-08-08T06:09:54.764Z | 2026-08-08T06:49:27.089Z |
| 4 | 04 | deviation | e2e/workspace-delete.spec.ts | 19 | asserts a workspace-name heading on /w/[wsId] (Phase 1 D-14 placeholder) — superseded by 04-02's page.tsx rewrite to EmptyState; spec needs updating, out of 04-03 scope | fixed |  | 2026-08-08T06:09:54.833Z | 2026-08-08T06:49:27.170Z |
| 5 | 04 | deviation | e2e/document-workspace.spec.ts | 54 | pre-existing tracer test intermittently misses the transient '저장 중…' status text under load — unrelated to 04-03's files (autosave-controller/useAutosave/SaveStatusBar are unmodified 04-02 code) | open |  | 2026-08-08T06:09:54.900Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "3",
    "file": ".planning/phases/03-folder-tree-closure-table/03-05-PLAN.md",
    "line": null,
    "description": "Task 3 human-check (drag-over cursor/outline visual feedback in real browser) not run this session",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T03:57:25.631Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "3",
    "file": "src/components/tree/MoveFolderModal.tsx",
    "line": null,
    "description": "MoveFolderModal own-subtree-disabled greying has no dedicated e2e assertion (not in must_haves), human_judgment flagged in 03-05-SUMMARY D7",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T03:57:25.700Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "04",
    "file": "e2e/preview-perf.spec.ts",
    "line": 113,
    "description": "60ms-budget test still targets /w/[wsId] as the 2-pane editor host (pre-04-02 Phase 2 assumption); since 04-02's route split the editor lives at /w/[wsId]/d/[docId] — spec needs updating, out of 04-03 scope",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-08T06:09:54.764Z",
    "resolved_at": "2026-08-08T06:49:27.089Z"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "04",
    "file": "e2e/workspace-delete.spec.ts",
    "line": 19,
    "description": "asserts a workspace-name heading on /w/[wsId] (Phase 1 D-14 placeholder) — superseded by 04-02's page.tsx rewrite to EmptyState; spec needs updating, out of 04-03 scope",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-08T06:09:54.833Z",
    "resolved_at": "2026-08-08T06:49:27.170Z"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "04",
    "file": "e2e/document-workspace.spec.ts",
    "line": 54,
    "description": "pre-existing tracer test intermittently misses the transient '저장 중…' status text under load — unrelated to 04-03's files (autosave-controller/useAutosave/SaveStatusBar are unmodified 04-02 code)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T06:09:54.900Z",
    "resolved_at": null
  }
]
````
