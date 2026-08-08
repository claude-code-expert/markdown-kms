---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-08T03:57:25.700Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 3 | unrun-verify | .planning/phases/03-folder-tree-closure-table/03-05-PLAN.md |  | Task 3 human-check (drag-over cursor/outline visual feedback in real browser) not run this session | open |  | 2026-08-08T03:57:25.631Z |  |
| 2 | 3 | unrun-verify | src/components/tree/MoveFolderModal.tsx |  | MoveFolderModal own-subtree-disabled greying has no dedicated e2e assertion (not in must_haves), human_judgment flagged in 03-05-SUMMARY D7 | open |  | 2026-08-08T03:57:25.700Z |  |

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
  }
]
````
