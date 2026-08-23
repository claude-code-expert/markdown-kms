"use client";

// UI-SPEC Dashboard Join-Request Contract (WS-03 개정) — 워크스페이스 ID를 직접 입력하는
// 대신 이름으로 검색해 목록에서 고른다. SearchBox.tsx(tree)의 디바운스+race-guard 패턴
// (seqRef 비교, AbortController 없음)을 그대로 따르되, 대상이 workspace.name이고 검색
// 결과가 여러 개(각자 독립적으로 신청 가능)라 상태를 행(row) 단위로 갖는다.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "./JoinWorkspaceInput.module.css";

interface WorkspaceSearchResult {
  id: string;
  name: string;
  isMember: boolean;
  hasPendingRequest: boolean;
}

interface RowState {
  submitting: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
}

const DEBOUNCE_MS = 300;
// "이름"을 문구에 넣으면 CreateWorkspaceModal의 getByLabel("이름")과 substring 충돌한다
// (Playwright/testing-library의 getByLabel은 기본이 부분일치) — 대시보드에 두 입력이 동시에
// DOM 상 존재해 실제로 모든 workspace-create e2e 헬퍼가 strict-mode violation으로 깨졌다.
const PLACEHOLDER = "워크스페이스 검색";
const GENERIC_FAIL = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
const SUCCESS = "참여 신청을 보냈어요. 관리자 승인을 기다려 주세요.";
const noResultsCopy = (q: string) => `'${q}'에 대한 검색 결과가 없어요`;

export function JoinWorkspaceInput() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const seqRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      seqRef.current += 1; // in-flight 요청 무효화 -- SearchBox.tsx와 동일
      setSearched(false);
      setResults([]);
      return;
    }
    const seq = (seqRef.current += 1);
    const timer = setTimeout(() => {
      fetch(`/api/workspaces/search?q=${encodeURIComponent(trimmed)}`)
        .then(async (res) => {
          if (seq !== seqRef.current) return; // 늦은 응답 -- 가장 최근 요청만 반영
          const body = res.ok ? await res.json() : { results: [] };
          if (seq !== seqRef.current) return;
          setResults(body.results);
          setSearched(true);
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setResults([]);
          setSearched(true);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  async function submitJoin(ws: WorkspaceSearchResult) {
    setRows((prev) => ({ ...prev, [ws.id]: { submitting: true, feedback: null } }));
    const res = await fetch(`/api/workspaces/${ws.id}/join-requests`, { method: "POST" });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setRows((prev) => ({
        ...prev,
        [ws.id]: { submitting: false, feedback: { type: "error", message: body?.error ?? GENERIC_FAIL } },
      }));
      return;
    }

    setResults((prev) => prev.map((r) => (r.id === ws.id ? { ...r, hasPendingRequest: true } : r)));
    setRows((prev) => ({ ...prev, [ws.id]: { submitting: false, feedback: { type: "success", message: SUCCESS } } }));
  }

  return (
    <div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={PLACEHOLDER}
        aria-label={PLACEHOLDER}
      />
      {searched && results.length === 0 && <p className={styles.empty}>{noResultsCopy(query.trim())}</p>}
      {results.length > 0 && (
        <ul className={styles.results}>
          {results.map((ws) => {
            const row = rows[ws.id];
            const disabled = ws.isMember || ws.hasPendingRequest || row?.submitting === true;
            const label = ws.isMember
              ? "이미 멤버예요"
              : ws.hasPendingRequest
                ? "신청됨"
                : row?.submitting
                  ? "신청하는 중…"
                  : "신청";

            return (
              <li key={ws.id} className={styles.resultRow}>
                <div className={styles.resultMain}>
                  <span className={styles.resultName}>{ws.name}</span>
                  <Button
                    type="button"
                    variant={disabled ? "secondary" : "accentOutline"}
                    disabled={disabled}
                    onClick={() => submitJoin(ws)}
                  >
                    {label}
                  </Button>
                </div>
                {row?.feedback && (
                  <p className={row.feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError}>
                    {row.feedback.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
