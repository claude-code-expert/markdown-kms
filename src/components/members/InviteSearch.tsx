"use client";

// UI-SPEC Members Page Contract — 회원 초대 (WS-05). Debounce/race-guard state machine ported
// from SearchBox.tsx's useSearchResults (seqRef comparison, 300ms debounce), retargeted at
// members/search and MemberSearchResult. Invite send follows TrashList.tsx's per-row mutation
// pattern (sendingId), retargeted at per-row "sent" state instead of a list refresh — an invited
// row's button just flips to a disabled "초대 보냄" state in place (UI-SPEC: no toast, no refetch).
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "./MembersView.module.css";

interface MemberSearchResult {
  userId: string;
  email: string;
  name: string;
  isMember: boolean;
}

type SearchStatus = "idle" | "loading" | "results" | "no-results" | "error";

const DEBOUNCE_MS = 300;
const PLACEHOLDER = "이메일 또는 이름으로 검색";
const ERROR_COPY = "검색하지 못했어요.";
const RETRY_COPY = "다시 시도";
const SEND_FAIL_COPY = "초대를 보내지 못했어요. 다시 시도해 주세요.";

function noResultsCopy(query: string) {
  return `'${query}'와 일치하는 회원이 없어요`;
}

interface InviteSearchProps {
  wsId: string;
}

export function InviteSearch({ wsId }: InviteSearchProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const seqRef = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<{ userId: string; message: string } | null>(null);

  function runSearch() {
    const trimmed = queryRef.current.trim();
    if (!trimmed) return;
    const seq = (seqRef.current += 1);
    setStatus("loading");
    fetch(`/api/workspaces/${wsId}/members/search?q=${encodeURIComponent(trimmed)}`)
      .then(async (res) => {
        if (seq !== seqRef.current) return; // 늦은 응답 -- 가장 최근 요청만 반영
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const body: { results: MemberSearchResult[] } = await res.json();
        if (seq !== seqRef.current) return;
        setResults(body.results);
        setStatus(body.results.length > 0 ? "results" : "no-results");
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        setStatus("error");
      });
  }

  useEffect(() => {
    if (!query.trim()) {
      seqRef.current += 1; // in-flight 요청 무효화
      setStatus("idle");
      setResults([]);
      return;
    }
    const timer = setTimeout(runSearch, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, wsId]);

  async function handleInvite(result: MemberSearchResult) {
    setSendingId(result.userId);
    setSendError(null);
    const res = await fetch(`/api/workspaces/${wsId}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inviteeId: result.userId }),
    });
    setSendingId(null);
    if (!res.ok) {
      setSendError({ userId: result.userId, message: SEND_FAIL_COPY });
      return;
    }
    setSentIds((prev) => new Set(prev).add(result.userId));
  }

  return (
    <div>
      <div className={styles.searchRow}>
        {status === "loading" && <span className={styles.spinner} aria-hidden="true" />}
        <Input
          className={styles.searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={PLACEHOLDER}
          aria-label={PLACEHOLDER}
        />
      </div>

      {status === "no-results" && <p className={styles.empty}>{noResultsCopy(query.trim())}</p>}

      {status === "error" && (
        <p className={styles.searchError}>
          {ERROR_COPY}
          <button type="button" className={styles.retryButton} onClick={runSearch}>
            {RETRY_COPY}
          </button>
        </p>
      )}

      {status === "results" &&
        results.map((result) => {
          const sent = sentIds.has(result.userId);
          const sending = sendingId === result.userId;
          return (
            <div key={result.userId} className={styles.row}>
              <div className={styles.identity}>
                <span className={styles.name}>{result.name}</span>
                <span className={styles.email}>{result.email}</span>
              </div>
              {result.isMember ? (
                <span className={styles.badge}>이미 멤버</span>
              ) : sent ? (
                <Button variant="secondary" disabled>
                  <Check size={14} /> 초대 보냄
                </Button>
              ) : (
                <Button variant="accentOutline" disabled={sending} onClick={() => handleInvite(result)}>
                  {sending ? "보내는 중…" : "초대"}
                </Button>
              )}
              {sendError?.userId === result.userId && <p className={styles.errorText}>{sendError.message}</p>}
            </div>
          );
        })}
    </div>
  );
}
